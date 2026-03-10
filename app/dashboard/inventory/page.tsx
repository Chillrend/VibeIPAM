"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Search, Server, Tag as TagIcon, MapPin, X, Pencil, ArrowRight, HardDrive, Network } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getInventoryDevices, getLocations, getDeviceTypes, getTags, createDevice, updateDevice, deleteDevice, getVlansWithIps } from "@/app/actions/db";
import { Prisma } from "@prisma/client";
import Link from "next/link";

type DeviceWithRelations = Prisma.DeviceGetPayload<{
    include: {
        location: true;
        deviceType: true;
        tags: true;
        ipAddresses: true;
    }
}>;

type VlanWithIps = Prisma.VlanGetPayload<{
    include: {
        ipAddresses: {
            include: {
                device: true
            }
        }
    }
}>;

type LocalIpData = { id?: string; ip_address: string; vlanId: string };

function InventoryContent() {
    const searchParams = useSearchParams();
    const prefillIp = searchParams.get('prefillIp');
    const prefillVlanId = searchParams.get('vlanId');

    const [devices, setDevices] = useState<DeviceWithRelations[]>([]);

    // Form Reference Metadata
    const [locations, setLocations] = useState<Prisma.LocationGetPayload<{}>[]>([]);
    const [deviceTypes, setDeviceTypes] = useState<Prisma.DeviceTypeGetPayload<{}>[]>([]);
    const [tags, setTags] = useState<Prisma.TagGetPayload<{}>[]>([]);
    const [vlans, setVlans] = useState<VlanWithIps[]>([]);

    const [searchQuery, setSearchQuery] = useState("");

    const [isLoading, setIsLoading] = useState(true);

    const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
    const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
    const [deviceLoading, setDeviceLoading] = useState(false);
    const [deviceError, setDeviceError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deviceData, setDeviceData] = useState<{
        name: string; status: string; desc: string; locationId: string; deviceTypeId: string; tagIds: string[];
        ips: LocalIpData[];
    }>({
        name: "", status: "Active", desc: "", locationId: "", deviceTypeId: "", tagIds: [],
        ips: []
    });

    // Tracking what was removed during edit
    const [removedIpIds, setRemovedIpIds] = useState<string[]>([]);

    const fetchAllData = async () => {
        try {
            const [devs, locs, types, tgs, vls] = await Promise.all([
                getInventoryDevices(),
                getLocations(),
                getDeviceTypes(),
                getTags(),
                getVlansWithIps()
            ]);
            setDevices(devs);
            setLocations(locs);
            setDeviceTypes(types);
            setTags(tgs);
            setVlans(vls);
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
            handleOpenDialog();
            setDeviceData(prev => ({ 
                ...prev, 
                ips: [{ ip_address: prefillIp, vlanId: prefillVlanId }] 
            }));
        }
    }, [prefillIp, prefillVlanId]);

    const filteredDevices = devices.filter(dev =>
        dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dev.ipAddresses.some(ip => ip.ip_address.includes(searchQuery))
    );

    const handleOpenDialog = (device?: DeviceWithRelations) => {
        setRemovedIpIds([]);
        setDeviceError(null);
        
        if (device) {
            setEditingDeviceId(device.id);
            setDeviceData({
                name: device.name,
                status: device.status,
                desc: device.desc,
                locationId: device.locationId,
                deviceTypeId: device.deviceTypeId,
                tagIds: device.tags.map(t => t.id),
                ips: device.ipAddresses.map(ip => ({ id: ip.id, ip_address: ip.ip_address, vlanId: ip.vlanId })),
            });
        } else {
            setEditingDeviceId(null);
            setDeviceData({
                name: "", status: "Active", desc: "", locationId: "", deviceTypeId: "", tagIds: [],
                ips: []
            });
        }
        setIsDeviceDialogOpen(true);
    };

    const handleSaveDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        setDeviceLoading(true);
        setDeviceError(null);
        try {
            if (editingDeviceId) {
                await updateDevice(editingDeviceId, {
                    name: deviceData.name,
                    status: deviceData.status,
                    desc: deviceData.desc,
                    locationId: deviceData.locationId,
                    deviceTypeId: deviceData.deviceTypeId,
                    tagIds: deviceData.tagIds,
                    ipsToCreate: deviceData.ips.filter(ip => !ip.id).map(ip => ({ ipAddress: ip.ip_address, vlanId: ip.vlanId })),
                    ipIdsToRemove: removedIpIds,
                    credentialsToCreate: [],
                    credentialIdsToRemove: []
                });
            } else {
                await createDevice({
                    name: deviceData.name,
                    status: deviceData.status,
                    desc: deviceData.desc,
                    locationId: deviceData.locationId,
                    deviceTypeId: deviceData.deviceTypeId,
                    tagIds: deviceData.tagIds,
                    ips: deviceData.ips.map(ip => ({ ipAddress: ip.ip_address, vlanId: ip.vlanId })),
                    credentials: []
                });
            }

            await fetchAllData();
            setIsDeviceDialogOpen(false);

            if (prefillIp) window.history.replaceState(null, '', '/dashboard/inventory');

        } catch (error: any) {
            console.error("Failed to save device", error);
            setDeviceError(error.message || "Failed to save device");
        } finally {
            setDeviceLoading(false);
        }
    };

    const handleDeleteDevice = async () => {
        if (!editingDeviceId) return;
        if (!confirm("Are you sure you want to delete this device?")) return;
        
        setIsDeleting(true);
        setDeviceError(null);
        try {
            await deleteDevice(editingDeviceId);
            await fetchAllData();
            setIsDeviceDialogOpen(false);
        } catch (error: any) {
            console.error("Failed to delete device", error);
            setDeviceError(error.message || "Failed to delete device");
        } finally {
            setIsDeleting(false);
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

    const getStatusDot = (status: string, isPingable: boolean) => {
        if (!isPingable) return <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" title="Monitoring Disabled" />;
        if (status === 'UP') return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0" title="UP" />;
        if (status === 'DOWN') return <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] shrink-0" title="DOWN" />;
        return <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" title="Unknown Status" />;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-semibold tracking-tight">Device Inventory</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant="outline" className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300" onClick={() => handleOpenDialog()}>
                            <HardDrive className="h-4 w-4 mr-2" />
                            Add Device
                        </Button>
                        <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
                        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{editingDeviceId ? "Edit Device" : "Register New Device"}</DialogTitle>
                                <DialogDescription className="text-zinc-500">
                                    {editingDeviceId ? "Modify physical or virtual infrastructure properties." : "Add physical or virtual infrastructure. Passwords entered here will be encrypted locally zero-knowledge before being sent to the database."}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSaveDevice} className="space-y-6 py-2">
                                {deviceError && (
                                    <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-md text-red-500 text-sm font-medium">
                                        {deviceError}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="dev_name">Hostname</Label>
                                        <Input id="dev_name" required placeholder="app-vps-01"
                                            className="border-zinc-800 bg-zinc-900/50"
                                            value={deviceData.name} onChange={e => setDeviceData({ ...deviceData, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="status">Status</Label>
                                        <select id="status" className={selectClassName} value={deviceData.status} onChange={e => setDeviceData({ ...deviceData, status: e.target.value })}>
                                            <option value="Active">Active</option>
                                            <option value="Offline">Offline</option>
                                            <option value="Provisioning">Provisioning</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="location">Location</Label>
                                        <select id="location" required className={selectClassName} value={deviceData.locationId} onChange={e => setDeviceData({ ...deviceData, locationId: e.target.value })}>
                                            <option value="" disabled>Select a location...</option>
                                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="device_type">Device Type</Label>
                                        <select id="device_type" required className={selectClassName} value={deviceData.deviceTypeId} onChange={e => setDeviceData({ ...deviceData, deviceTypeId: e.target.value })}>
                                            <option value="" disabled>Select a type...</option>
                                            {deviceTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.type} {dt.is_virtual ? '(Virtual)' : ''}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="tag">Primary Tag</Label>
                                    <select id="tag" className={selectClassName} value={deviceData.tagIds[0] || ""} onChange={e => setDeviceData({ ...deviceData, tagIds: e.target.value ? [e.target.value] : [] })}>
                                        <option value="">None</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="dev_desc">Description</Label>
                                    <Input id="dev_desc" placeholder="Role or notes"
                                        className="border-zinc-800 bg-zinc-900/50"
                                        value={deviceData.desc} onChange={e => setDeviceData({ ...deviceData, desc: e.target.value })} />
                                </div>

                                {/* Network Interfaces Section */}
                                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Network className="w-4 h-4 text-blue-500" />
                                            <h4 className="text-sm font-medium text-blue-400">Network Interfaces</h4>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-blue-400 hover:text-blue-300" onClick={() => setDeviceData({...deviceData, ips: [...deviceData.ips, { ip_address: "", vlanId: "" }]})}>
                                            <Plus className="w-3 h-3 mr-1" /> Add IP
                                        </Button>
                                    </div>
                                    {deviceData.ips.map((ip, idx) => {
                                        const selectedVlan = vlans.find(v => v.id === ip.vlanId);
                                        const unassignedIps = selectedVlan ? selectedVlan.ipAddresses.filter(i => !i.deviceId) : [];
                                        return (
                                        <div key={idx} className="flex gap-2 items-start relative pb-2 group">
                                            <div className="flex-1 space-y-2">
                                                 <Input placeholder="IP Address (e.g. 10.0.0.5)" required disabled={!!ip.id}
                                                    list={`ip-suggestions-${idx}`}
                                                    className="border-zinc-800 bg-zinc-950 disabled:opacity-50"
                                                    value={ip.ip_address} onChange={e => {
                                                        const newIps = [...deviceData.ips]; newIps[idx].ip_address = e.target.value; setDeviceData({...deviceData, ips: newIps});
                                                    }} />
                                                 {selectedVlan && (
                                                     <datalist id={`ip-suggestions-${idx}`}>
                                                         {unassignedIps.map(unassignedIp => (
                                                             <option key={unassignedIp.id} value={unassignedIp.ip_address}>
                                                                 {unassignedIp.description ? `${unassignedIp.description}` : 'Available manually allocated IP'}
                                                             </option>
                                                         ))}
                                                     </datalist>
                                                 )}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <select required disabled={!!ip.id} className={`${selectClassName} bg-zinc-950`} value={ip.vlanId} onChange={e => {
                                                    const newIps = [...deviceData.ips]; newIps[idx].vlanId = e.target.value; setDeviceData({...deviceData, ips: newIps});
                                                }}>
                                                    <option value="" disabled>Select VLAN...</option>
                                                    {vlans.map(v => <option key={v.id} value={v.id}>VLAN {v.vlan_id} ({v.name})</option>)}
                                                </select>
                                            </div>
                                            <Button type="button" variant="ghost" className="h-10 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                                                const newIps = [...deviceData.ips];
                                                if (newIps[idx].id) setRemovedIpIds([...removedIpIds, newIps[idx].id!]);
                                                newIps.splice(idx, 1);
                                                setDeviceData({...deviceData, ips: newIps});
                                            }}>Remove</Button>
                                        </div>
                                    )})}
                                    {deviceData.ips.length === 0 && <div className="text-xs text-zinc-500 text-center py-2 italic">No IP Addresses assigned.</div>}
                                </div>

                                <DialogFooter className="-mx-4 -mb-4 mt-4 flex flex-col items-center gap-2 rounded-b-xl border-t border-zinc-800 bg-muted/50 p-4 sm:flex-row sm:justify-between">
                                     {editingDeviceId ? (
                                        <Button type="button" variant="destructive" onClick={handleDeleteDevice} disabled={isDeleting} className="bg-red-950 border border-red-900 text-red-500 hover:bg-red-900 hover:text-red-300 transition-colors w-full sm:w-auto">
                                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Device"}
                                        </Button>
                                     ) : <div className="hidden sm:block" />}
                                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                                        <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setIsDeviceDialogOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={deviceLoading || isDeleting} className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1 sm:flex-none">
                                            {deviceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingDeviceId ? "Save" : "Save Device"}
                                        </Button>
                                    </div>
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

            <Card className="border-zinc-800 bg-zinc-900/50 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-zinc-900 border-b border-zinc-800">
                            <TableRow className="hover:bg-zinc-900 border-zinc-800">
                                <TableHead className="text-zinc-400 font-medium h-12 px-4">Name</TableHead>
                                <TableHead className="text-zinc-400 font-medium h-12">Status</TableHead>
                                <TableHead className="text-zinc-400 font-medium h-12">Type</TableHead>
                                <TableHead className="text-zinc-400 font-medium h-12">IP Address</TableHead>
                                <TableHead className="text-zinc-400 font-medium h-12">Tags</TableHead>
                                <TableHead className="text-right text-zinc-400 font-medium h-12 px-4">Credentials</TableHead>
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
                                <TableRow key={device.id} className="border-zinc-800 hover:bg-zinc-800/40 transition-colors group">
                                    <TableCell className="font-medium text-zinc-200 px-4 py-3 align-top min-w-[200px]">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/dashboard/inventory/${device.id}`} className="flex flex-col gap-1 cursor-pointer w-fit group">
                                                <div className="flex items-center gap-2 group-hover:text-emerald-400 transition-colors">
                                                    <Server className="h-4 w-4 text-emerald-500/70" />
                                                    <span className="underline decoration-transparent underline-offset-4 group-hover:decoration-emerald-500/50 transition-all font-semibold">{device.name}</span>
                                                </div>
                                                <span className="text-[10px] text-zinc-500 ml-6 uppercase font-semibold tracking-wider bg-zinc-800 w-fit px-1.5 py-0.5 rounded-sm">{device.location.name}</span>
                                            </Link>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleOpenDialog(device)}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top py-4">
                                        <Badge variant="outline" className={`
                                            ${device.status === 'Active' ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'
                                                : device.status === 'Offline' ? 'text-red-400 border-red-900/50 bg-red-950/20'
                                                    : 'text-blue-400 border-blue-900/50 bg-blue-950/20'}
                                        `}>
                                            {device.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-zinc-400 align-top py-4">
                                        <div className="flex items-center gap-1.5">
                                            {device.deviceType.type} 
                                            {device.deviceType.is_virtual && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-blue-950/40 text-blue-400 hover:bg-blue-950/40 border-blue-900/30">VM</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-zinc-300 align-top py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {device.ipAddresses.length > 0 
                                                ? device.ipAddresses.map((ip: any) => (
                                                    <Badge key={ip.ip_address} variant="secondary" className="bg-zinc-800/80 text-emerald-400 border border-emerald-900/30 font-semibold tracking-tight flex items-center gap-1.5 pr-2">
                                                        {ip.ip_address}
                                                        {getStatusDot(ip.status, ip.is_pingable)}
                                                    </Badge>
                                                ))
                                                : <span className="text-zinc-600 text-xs font-sans italic pt-1">No IPs assigned</span>
                                            }
                                        </div>
                                    </TableCell>
                                    <TableCell className="align-top py-4">
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
                                            {device.tags.length === 0 && <span className="text-zinc-600 text-xs italic pt-1">None</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right align-top py-3 px-4">
                                        <Link href={`/dashboard/inventory/${device.id}`}>
                                            <Button variant="ghost" size="sm" className="text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                                Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                            </Button>
                                        </Link>
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
