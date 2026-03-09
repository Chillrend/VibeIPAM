"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Server, Shield, Loader2, Key, Plus, HardDrive, Network } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { encryptData, decryptData, getStoredKey } from "@/lib/crypto";
import { getInventoryDevices, getDeviceCredential, getLocations, getDeviceTypes, getTags, createDevice } from "@/app/actions/db";
import { Prisma } from "@prisma/client";

type DeviceWithRelations = Prisma.DeviceGetPayload<{
    include: {
        location: true;
        deviceType: true;
        tags: true;
        ipAddresses: true;
        credential: { select: { id: true } };
    }
}>;

function InventoryContent() {
    const searchParams = useSearchParams();
    const prefillIp = searchParams.get('prefillIp');
    const prefillVlanId = searchParams.get('vlanId');

    const [devices, setDevices] = useState<DeviceWithRelations[]>([]);

    // Form Reference Metadata
    const [locations, setLocations] = useState<Prisma.LocationGetPayload<{}>[]>([]);
    const [deviceTypes, setDeviceTypes] = useState<Prisma.DeviceTypeGetPayload<{}>[]>([]);
    const [tags, setTags] = useState<Prisma.TagGetPayload<{}>[]>([]);

    const [searchQuery, setSearchQuery] = useState("");
    const [revealingId, setRevealingId] = useState<string | null>(null);
    const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // New Device form state
    const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
    const [newDeviceLoading, setNewDeviceLoading] = useState(false);
    const [newDeviceData, setNewDeviceData] = useState({
        name: "", status: "Active", desc: "", locationId: "", deviceTypeId: "",
        username: "", password: "", tagId: "", ipAddress: "", vlanId: ""
    });

    const fetchAllData = async () => {
        try {
            const [devs, locs, types, tgs] = await Promise.all([
                getInventoryDevices(),
                getLocations(),
                getDeviceTypes(),
                getTags()
            ]);
            setDevices(devs);
            setLocations(locs);
            setDeviceTypes(types);
            setTags(tgs);
        } catch (error) {
            console.error("Failed to load inventory data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (prefillIp && prefillVlanId) {
            setNewDeviceData(prev => ({ ...prev, ipAddress: prefillIp, vlanId: prefillVlanId }));
            setIsDeviceDialogOpen(true);
        }
    }, [prefillIp, prefillVlanId]);

    const filteredDevices = devices.filter(dev =>
        dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dev.ipAddresses.some(ip => ip.ip_address.includes(searchQuery))
    );

    const handleCreateDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        setNewDeviceLoading(true);

        try {
            let encryptedPassword;
            if (newDeviceData.password) {
                const key = await getStoredKey();
                if (!key) throw new Error("Master key missing");
                encryptedPassword = await encryptData(newDeviceData.password, key);
            }

            await createDevice({
                name: newDeviceData.name,
                status: newDeviceData.status,
                desc: newDeviceData.desc,
                locationId: newDeviceData.locationId,
                deviceTypeId: newDeviceData.deviceTypeId,
                tagIds: newDeviceData.tagId ? [newDeviceData.tagId] : [],
                ipAddress: newDeviceData.ipAddress ? newDeviceData.ipAddress : undefined,
                vlanId: newDeviceData.vlanId ? newDeviceData.vlanId : undefined,
                username: newDeviceData.username ? newDeviceData.username : undefined,
                encryptedPassword: encryptedPassword
            });

            await fetchAllData();
            setIsDeviceDialogOpen(false);

            // Strip URL params silently after successful usage so refresh doesn't pop it up again
            if (prefillIp) {
                window.history.replaceState(null, '', '/dashboard/inventory');
            }

            setNewDeviceData({
                name: "", status: "Active", desc: "", locationId: "", deviceTypeId: "",
                username: "", password: "", tagId: "", ipAddress: "", vlanId: ""
            });
        } catch (error) {
            console.error("Failed to create device", error);
        } finally {
            setNewDeviceLoading(false);
        }
    };

    const handleRevealPassword = async (deviceId: string) => {
        setRevealingId(deviceId);
        setDecryptedPassword(null);

        try {
            const encryptedStr = await getDeviceCredential(deviceId);
            if (!encryptedStr) throw new Error("No credential found for this device.");

            const key = await getStoredKey();
            if (!key) throw new Error("Master key not found. Please log in again.");

            const plaintext = await decryptData(encryptedStr, key);
            await new Promise(resolve => setTimeout(resolve, 800));
            setDecryptedPassword(plaintext);
        } catch (error) {
            console.error("Failed to reveal password", error);
            setDecryptedPassword("Error: Decryption Failed");
        } finally {
            setRevealingId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const selectClassName = "flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm ring-offset-zinc-950 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 text-zinc-100";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">Device Inventory</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300">
                                <HardDrive className="h-4 w-4 mr-2" />
                                Add Device
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Register New Device</DialogTitle>
                                <DialogDescription className="text-zinc-500">
                                    Add physical or virtual infrastructure. Passwords entered here will be encrypted locally zero-knowledge before being sent to the database.
                                </DialogDescription>
                            </DialogHeader>

                            {newDeviceData.ipAddress && (
                                <div className="bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-md flex items-center shadow-inner mt-2">
                                    <Network className="w-4 h-4 text-emerald-500 mr-2" />
                                    <span className="text-sm text-emerald-200">
                                        Auto-provisioning with IP: <strong className="font-mono text-emerald-400 ml-1">{newDeviceData.ipAddress}</strong>
                                    </span>
                                </div>
                            )}

                            <form onSubmit={handleCreateDevice} className="space-y-6 py-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="dev_name">Hostname</Label>
                                        <Input id="dev_name" required placeholder="app-vps-01"
                                            className="border-zinc-800 bg-zinc-900/50"
                                            value={newDeviceData.name} onChange={e => setNewDeviceData({ ...newDeviceData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="status">Status</Label>
                                        <select id="status" className={selectClassName} value={newDeviceData.status} onChange={e => setNewDeviceData({ ...newDeviceData, status: e.target.value })}>
                                            <option value="Active">Active</option>
                                            <option value="Offline">Offline</option>
                                            <option value="Provisioning">Provisioning</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="location">Location</Label>
                                        <select id="location" required className={selectClassName} value={newDeviceData.locationId} onChange={e => setNewDeviceData({ ...newDeviceData, locationId: e.target.value })}>
                                            <option value="" disabled>Select a location...</option>
                                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="device_type">Device Type</Label>
                                        <select id="device_type" required className={selectClassName} value={newDeviceData.deviceTypeId} onChange={e => setNewDeviceData({ ...newDeviceData, deviceTypeId: e.target.value })}>
                                            <option value="" disabled>Select a type...</option>
                                            {deviceTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.type} {dt.is_virtual ? '(Virtual)' : ''}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tag">Primary Tag</Label>
                                    <select id="tag" className={selectClassName} value={newDeviceData.tagId} onChange={e => setNewDeviceData({ ...newDeviceData, tagId: e.target.value })}>
                                        <option value="">None</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="dev_desc">Description</Label>
                                    <Input id="dev_desc" placeholder="Role or notes"
                                        className="border-zinc-800 bg-zinc-900/50"
                                        value={newDeviceData.desc} onChange={e => setNewDeviceData({ ...newDeviceData, desc: e.target.value })} />
                                </div>

                                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-emerald-500" />
                                        <h4 className="text-sm font-medium text-emerald-400">Zero-Knowledge Credentials (Optional)</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="remote_user">Username</Label>
                                            <Input id="remote_user" placeholder="root"
                                                className="border-zinc-800 bg-zinc-950"
                                                value={newDeviceData.username} onChange={e => setNewDeviceData({ ...newDeviceData, username: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="remote_pass">Password</Label>
                                            <Input id="remote_pass" type="password" placeholder="••••••••"
                                                className="border-zinc-800 bg-zinc-950"
                                                value={newDeviceData.password} onChange={e => setNewDeviceData({ ...newDeviceData, password: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="pt-4">
                                    <Button type="button" variant="ghost" onClick={() => setIsDeviceDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={newDeviceLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                        {newDeviceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Device"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            type="text"
                            placeholder="Search devices or IPs..."
                            className="pl-9 border-zinc-700 bg-zinc-900/50 focus-visible:ring-emerald-500/50 text-zinc-100"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <Card className="border-zinc-800 bg-zinc-900/50">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-zinc-900/80 border-b border-zinc-800">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-zinc-400 font-medium">Name</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Status</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Type</TableHead>
                                <TableHead className="text-zinc-400 font-medium">IP Address</TableHead>
                                <TableHead className="text-zinc-400 font-medium">Tags</TableHead>
                                <TableHead className="text-right text-zinc-400 font-medium">Credentials</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDevices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                                        No devices found.
                                    </TableCell>
                                </TableRow>
                            ) : filteredDevices.map((device) => (
                                <TableRow key={device.id} className="border-zinc-800 hover:bg-zinc-800/30">
                                    <TableCell className="font-medium text-zinc-200">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <Server className="h-4 w-4 text-zinc-500" />
                                                {device.name}
                                            </div>
                                            <span className="text-[10px] text-zinc-500 ml-6 uppercase">{device.location.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`
                                            ${device.status === 'Active' ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'
                                                : device.status === 'Offline' ? 'text-red-400 border-red-900/50 bg-red-950/20'
                                                    : 'text-blue-400 border-blue-900/50 bg-blue-950/20'}
                                        `}>
                                            {device.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-zinc-400">
                                        {device.deviceType.type} {device.deviceType.is_virtual && <span className="text-xs text-zinc-500 ml-1">(VM)</span>}
                                    </TableCell>
                                    <TableCell className="font-mono text-zinc-300">
                                        {device.ipAddresses.map(ip => ip.ip_address).join(', ') || <span className="text-zinc-600">None</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1.5 flex-wrap">
                                            {device.tags.map(tag => (
                                                <span
                                                    key={tag.name}
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase"
                                                    style={{ backgroundColor: `${tag.color_hex}15`, color: tag.color_hex, border: `1px solid ${tag.color_hex}30` }}
                                                >
                                                    {tag.name}
                                                </span>
                                            ))}
                                            {device.tags.length === 0 && <span className="text-zinc-600 text-xs">None</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {device.credential ? (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                                        onClick={() => handleRevealPassword(device.id)}
                                                    >
                                                        <Shield className="h-4 w-4 mr-2" />
                                                        Reveal
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <Key className="h-5 w-5 text-emerald-500" />
                                                            Decrypted Credential
                                                        </DialogTitle>
                                                        <DialogDescription className="text-zinc-400">
                                                            For device: <strong className="text-zinc-200">{device.name}</strong>
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 rounded-lg border border-zinc-800 mt-4 min-h-[100px] shadow-inner">
                                                        {revealingId === device.id ? (
                                                            <div className="flex flex-col items-center gap-3 text-emerald-500">
                                                                <Loader2 className="h-6 w-6 animate-spin" />
                                                                <span className="text-sm font-medium animate-pulse">Decrypting locally...</span>
                                                            </div>
                                                        ) : decryptedPassword ? (
                                                            <div className="flex flex-col items-center gap-4 w-full">
                                                                <div className="flex flex-col items-center justify-center gap-1">
                                                                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Username</span>
                                                                    <div className="text-zinc-300 font-medium">{device.credential.id && "Saved"}</div>
                                                                </div>
                                                                <div className="w-full space-y-1">
                                                                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold flex justify-center">Password</span>
                                                                    <code className="block bg-zinc-950/80 px-4 py-3 rounded-md text-lg font-mono text-emerald-400 border border-emerald-900/50 w-full text-center tracking-wider select-all shadow-md">
                                                                        {decryptedPassword}
                                                                    </code>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="mt-4 text-xs text-zinc-500 text-center flex items-center justify-center gap-1.5 bg-yellow-500/10 text-yellow-500/90 border border-yellow-500/20 py-2.5 rounded-md font-medium">
                                                        <Shield className="h-3.5 w-3.5" />
                                                        Decrypted securely in your browser using AES-GCM
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        ) : (
                                            <span className="text-zinc-600 text-sm italic mr-4">None</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <InventoryContent />
        </Suspense>
    );
}
