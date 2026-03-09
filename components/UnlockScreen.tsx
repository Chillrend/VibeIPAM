"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deriveKeyContext, storeKey, getStoredKey, encryptData, decryptData } from "@/lib/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ShieldCheck, Loader2, Lock, Unlock } from "lucide-react";
import { getVaultConfig, initializeVault } from "@/app/actions/db";

const CANARY_PAYLOAD = "VAULT_READY";

export function UnlockScreen() {
    const [password, setPassword] = useState("");
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [vaultState, setVaultState] = useState<"INITIALIZING" | "LOCKED" | "CHECKING">("CHECKING");
    const [encryptedCanary, setEncryptedCanary] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Check if we already have a valid local key
                const key = await getStoredKey();
                if (key) {
                    router.push("/dashboard");
                    return;
                }

                // 2. Fetch Vault Config from DB
                const config = await getVaultConfig();

                if (config) {
                    setEncryptedCanary(config.encrypted_canary);
                    setVaultState("LOCKED");
                } else {
                    setVaultState("INITIALIZING");
                }
            } catch (error) {
                console.error("Failed to check vault:", error);
                setErrorMsg("Database connection failed. Ensure PostgreSQL is running.");
            } finally {
                setIsChecking(false);
            }
        };

        init();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;

        setIsUnlocking(true);
        setErrorMsg(null);

        try {
            const key = await deriveKeyContext(password);

            if (vaultState === "INITIALIZING") {
                // First time setup
                const encrypted = await encryptData(CANARY_PAYLOAD, key);
                await initializeVault(encrypted);
                await storeKey(key);
                router.push("/dashboard");
            } else if (vaultState === "LOCKED" && encryptedCanary) {
                // Attempt to unlock
                try {
                    const decrypted = await decryptData(encryptedCanary, key);
                    if (decrypted === CANARY_PAYLOAD) {
                        // Correct password!
                        await storeKey(key);
                        router.push("/dashboard");
                    } else {
                        throw new Error("Invalid canary payload"); // Should be handled by catch block below due to tag mismatch usually
                    }
                } catch (decryptionError) {
                    setErrorMsg("Incorrect Master Password.");
                    setPassword("");
                }
            }
        } catch (error) {
            console.error("Action failed:", error);
            setErrorMsg("An unexpected error occurred.");
        } finally {
            setIsUnlocking(false);
        }
    };

    if (isChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            </div>
        );
    }

    const isSetup = vaultState === "INITIALIZING";

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 overflow-hidden p-4">
            {/* Ambient Background Glows */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20 blur-[100px] pointer-events-none transition-colors duration-1000 ${isSetup ? 'bg-blue-600' : 'bg-emerald-600'}`} />
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            <Card className="z-10 w-full max-w-md border-zinc-800/60 bg-zinc-950/40 backdrop-blur-3xl shadow-2xl ring-1 ring-white/10">
                <CardHeader className="space-y-2 pb-6 pt-8 text-center">
                    <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl p-2 shadow-inner ring-1 ring-inset ${isSetup ? 'bg-blue-500/10 ring-blue-500/20 shadow-blue-500/20' : 'bg-emerald-500/10 ring-emerald-500/20 shadow-emerald-500/20'}`}>
                        {isSetup ? (
                            <Lock className="h-8 w-8 text-blue-400" />
                        ) : (
                            <ShieldCheck className="h-8 w-8 text-emerald-400" />
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                        {isSetup ? "Initialize Vault" : "Zero-Knowledge DCIM"}
                    </CardTitle>
                    <CardDescription className="text-zinc-400 text-sm px-4 leading-relaxed">
                        {isSetup
                            ? "Set a Master Password. This heavily encrypts your vault credentials locally in your browser."
                            : "Enter your master password to unlock secure storage and manage your infrastructure."}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5 px-8 pb-8">
                        <div className="space-y-2.5">
                            <Label htmlFor="password" className="text-zinc-300 font-medium">
                                {isSetup ? "Create Master Password" : "Master Password"}
                            </Label>
                            <div className="relative group">
                                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••••••••••"
                                    className={`pl-10 h-11 border-zinc-800 bg-zinc-900/50 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-offset-0 transition-shadow ${isSetup ? 'focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50' : 'focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500/50'}`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isUnlocking}
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg animate-in fade-in slide-in-from-top-1">
                                {errorMsg}
                            </div>
                        )}

                        {isSetup && (
                            <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-900/30">
                                <p className="text-xs text-blue-400/80 leading-relaxed font-medium">
                                    <strong className="text-blue-400">Warning:</strong> If you lose this password, your synced credentials cannot be recovered by anyone.
                                </p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="px-8 pb-8 pt-4">
                        <Button
                            type="submit"
                            className={`w-full h-11 text-white font-medium transition-all duration-300 
                                ${isSetup
                                    ? 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]'
                                    : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(5,150,105,0.4)]'}
                            `}
                            disabled={isUnlocking || !password}
                        >
                            {isUnlocking ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isSetup ? "Securing Vault..." : "Unlocking..."}
                                </>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {isSetup ? "Initialize Vault" : "Unlock Vault"}
                                    {!isSetup && <Unlock className="w-4 h-4 ml-1 opacity-70" />}
                                </span>
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
