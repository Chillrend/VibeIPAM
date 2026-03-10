'use client';

import React, { useState } from "react";
import { getStoredKey, decryptData, encryptData } from "@/lib/crypto";
import { Key, Shield, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDeviceCredentials, updateDevice } from "@/app/actions/db";
import { useRouter } from "next/navigation";

export function DeviceVaultForm({ deviceId, initialCredentials }: { deviceId: string, initialCredentials: any[] }) {
    const [revealing, setRevealing] = useState(false);
    const [decryptedPasswords, setDecryptedPasswords] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [credentials, setCredentials] = useState(initialCredentials || []);
    const [removedCredentialIds, setRemovedCredentialIds] = useState<string[]>([]);
    const router = useRouter();

    const handleRevealPasswords = async () => {
        setRevealing(true);
        setError(null);
        setDecryptedPasswords({});

        try {
            const encryptedCreds = await getDeviceCredentials(deviceId);
            if (!encryptedCreds || encryptedCreds.length === 0) throw new Error("No credentials found in database.");

            const key = await getStoredKey();
            if (!key) throw new Error("Master key not found. Please log out and back in.");

            const decryptedMap: Record<string, string> = {};
            for (const cred of encryptedCreds) {
                decryptedMap[cred.id] = await decryptData(cred.encrypted_password, key);
            }
            
            setDecryptedPasswords(decryptedMap);
        } catch (err: any) {
            console.error("Failed to reveal passwords", err);
            setError(err.message || "Failed to reveal passwords");
        } finally {
            setRevealing(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const key = await getStoredKey();
            if (!key && credentials.some(c => c.password)) {
                throw new Error("Master key missing for encryption");
            }

            const processedCredentials = await Promise.all(
                credentials.filter(c => c.password && !c.id).map(async c => ({
                    username: c.username,
                    desc: c.desc,
                    encryptedPassword: await encryptData(c.password!, key!)
                }))
            );

            await updateDevice(deviceId, {
                credentialIdsToRemove: removedCredentialIds,
                credentialsToCreate: processedCredentials
            } as any); // Type override to allow partial update

            setRemovedCredentialIds([]);
            router.refresh();
        } catch (err: any) {
             setError(err.message || "Failed to save vault contents");
        } finally {
             setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="flex flex-col h-full space-y-4">
            {error && (
                <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-md text-red-500 text-sm font-medium">
                    {error}
                </div>
            )}
            
            <div className="flex justify-between items-center bg-zinc-950/50 border border-zinc-800/80 p-3 rounded-lg text-sm text-zinc-400 mt-2">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Browser-based AES-GCM Encryption
                </div>
                {Object.keys(decryptedPasswords).length === 0 && credentials.filter(c => c.id).length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={handleRevealPasswords} disabled={revealing} className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-emerald-400">
                        {revealing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock Vault"}
                    </Button>
                )}
            </div>

            <div className="flex-1 space-y-3 mt-4 overflow-y-auto max-h-[400px] pr-2">
                {credentials.map((cred, idx) => (
                    <div key={idx} className="flex gap-3 bg-zinc-950/30 p-3 rounded-lg border border-zinc-800 focus-within:border-emerald-900/50 transition-colors group">
                        <div className="flex-1 space-y-3">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] text-zinc-500 uppercase font-semibold mb-1 block tracking-wider">Username</label>
                                    <Input placeholder="root / admin" required
                                        className="h-8 border-zinc-800 bg-zinc-950/50 text-xs text-emerald-400 font-mono"
                                        value={cred.username} readOnly={!!cred.id} onChange={e => {
                                            const newCreds = [...credentials]; newCreds[idx].username = e.target.value; setCredentials(newCreds);
                                        }} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-zinc-500 uppercase font-semibold mb-1 block tracking-wider">Description</label>
                                    <Input placeholder="Label" 
                                        className="h-8 border-zinc-800 bg-zinc-950/50 text-xs text-zinc-400"
                                        value={cred.desc} readOnly={!!cred.id} onChange={e => {
                                            const newCreds = [...credentials]; newCreds[idx].desc = e.target.value; setCredentials(newCreds);
                                        }} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-semibold mb-1 block tracking-wider">Password</label>
                                {cred.id ? (
                                    decryptedPasswords[cred.id] ? (
                                        <code className="block w-full h-8 px-3 py-1.5 border border-emerald-900/50 bg-emerald-950/20 rounded-md text-emerald-400 text-sm font-mono tracking-wider select-all transition-colors hover:bg-emerald-900/30">
                                            {decryptedPasswords[cred.id]}
                                        </code>
                                    ) : (
                                        <div className="h-8 flex items-center px-3 border border-zinc-800 bg-zinc-950/80 rounded-md text-zinc-600 text-xs italic shadow-inner">
                                            Encrypted (Unlock vault to view)
                                        </div>
                                    )
                                ) : (
                                    <Input type="text" placeholder="••••••••" required
                                        className="h-8 border-zinc-800 bg-zinc-950/50 font-mono text-sm"
                                        value={cred.password || ""} onChange={e => {
                                            const newCreds = [...credentials]; newCreds[idx].password = e.target.value; setCredentials(newCreds);
                                        }} />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col justify-start">
                             <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 hover:text-red-400 hover:bg-red-950/30 -mr-1 -mt-1" onClick={() => {
                                const newCreds = [...credentials];
                                if (newCreds[idx].id) setRemovedCredentialIds([...removedCredentialIds, newCreds[idx].id!]);
                                newCreds.splice(idx, 1);
                                setCredentials(newCreds);
                             }}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                ))}
                
                {credentials.length === 0 && (
                    <div className="text-sm text-zinc-500 italic text-center py-8">
                        No credentials stored in vault.
                    </div>
                )}
                
                <Button type="button" variant="outline" className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 bg-transparent hover:bg-emerald-950/20" onClick={() => {
                    setCredentials([...credentials, { username: "", desc: "", password: "" }]);
                }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Vault Entry
                </Button>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3 mt-auto">
                {removedCredentialIds.length > 0 || credentials.some(c => !c.id) ? (
                    <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white w-full sm:w-auto">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />}
                        Save Vault Changes
                    </Button>
                ) : null}
            </div>
        </form>
    );
}
