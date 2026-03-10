"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2, Network, Server, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getVlansWithIps, createVlan, updateVlan, deleteVlan, createIpAddress, updateIpAddress, deleteIpAddress, createIpReservation } from "@/app/actions/db";
import { calculateAvailableRanges, getFirstAvailableIp, ipToLong } from "@/lib/ip-utils";
import { Prisma } from "@prisma/client";

type VlanWithIps = Prisma.VlanGetPayload<{
    include: {
        ipAddresses: {
            include: {
                device: true
            }
        },
        scopeReservations: true
    }
}>;

export default function IpamPage() {
    const router = useRouter();
    const [vlans, setVlans] = useState<VlanWithIps[]>([]);
    const [selectedVlan, setSelectedVlan] = useState<VlanWithIps | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const [isVlanDialogOpen, setIsVlanDialogOpen] = useState(false);
    const [newVlanLoading, setNewVlanLoading] = useState(false);
    const [editingVlan, setEditingVlan] = useState(false);
    const [newVlanData, setNewVlanData] = useState({
        vlan_id: "",
        name: "",
        cidr_block: "",
        description: ""
    });

    const [isIpDialogOpen, setIsIpDialogOpen] = useState(false);
    const [ipLoading, setIpLoading] = useState(false);
    const [ipError, setIpError] = useState<string | null>(null);
    const [editingIpId, setEditingIpId] = useState<string | null>(null);
    const [ipData, setIpData] = useState({
        ipAddress: "",
        description: "",
        isPingable: true,
    });

    // Reserve Scope State
    const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false);
    const [reserveLoading, setReserveLoading] = useState(false);
    const [reserveError, setReserveError] = useState<string | null>(null);
    const [reserveData, setReserveData] = useState({
        startIp: "",
        endIp: "",
        description: "[DHCP Scope] Reserved Block",
    });

    const refreshVlans = async () => {
        const data = await getVlansWithIps();
        setVlans(data);
        if (data.length > 0 && !selectedVlan) {
            setSelectedVlan(data[0]);
        }
    };

    const handleCreateVlan = async (e: React.FormEvent) => {
        e.preventDefault();
        setNewVlanLoading(true);
        try {
            let result;
            if (editingVlan && selectedVlan) {
                result = await updateVlan(selectedVlan.id, {
                    name: newVlanData.name,
                    cidr_block: newVlanData.cidr_block,
                    description: newVlanData.description
                });
            } else {
                result = await createVlan({
                    vlan_id: parseInt(newVlanData.vlan_id),
                    name: newVlanData.name,
                    cidr_block: newVlanData.cidr_block,
                    description: newVlanData.description
                });
            }
            await refreshVlans();
            setIsVlanDialogOpen(false);
            setEditingVlan(false);
            setNewVlanData({ vlan_id: "", name: "", cidr_block: "", description: "" });

            const updated = await getVlansWithIps();
            const found = updated.find(v => v.id === result.id);
            if (found) setSelectedVlan(found);

        } catch (error) {
            console.error(error);
        } finally {
            setNewVlanLoading(false);
        }
    };

    const handleDeleteVlan = async () => {
        if (!selectedVlan) return;
        if (!window.confirm(`Are you sure you want to completely delete VLAN ${selectedVlan.vlan_id} and all its IP allocations? This action cannot be undone.`)) return;
        setNewVlanLoading(true);
        try {
            await deleteVlan(selectedVlan.id);
            setVlans(prev => prev.filter(v => v.id !== selectedVlan.id));
            setSelectedVlan(null);
            setIsVlanDialogOpen(false);
            setEditingVlan(false);
        } catch (error) {
            console.error(error);
        } finally {
            setNewVlanLoading(false);
        }
    };

    const handleSaveIp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIpLoading(true);
        setIpError(null);
        try {
            setIpError(null);
            if (editingIpId) {
                await updateIpAddress(editingIpId, { description: ipData.description, isPingable: ipData.isPingable });
            } else if (selectedVlan) {
                await createIpAddress({
                    vlanId: selectedVlan.id,
                    ipAddress: ipData.ipAddress,
                    description: ipData.description,
                    isAllocated: true,
                    isPingable: ipData.isPingable
                });
            }
            await refreshVlans();
            setIsIpDialogOpen(false);
            setEditingIpId(null);
            setIpData({ ipAddress: "", description: "", isPingable: true });
            
            // Re-select the vlan from refreshed data
            if (selectedVlan) {
               const updated = await getVlansWithIps();
               const found = updated.find(v => v.id === selectedVlan.id);
               if (found) setSelectedVlan(found);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIpLoading(false);
        }
    };

    const handleFreeIp = async (id: string) => {
        setIpLoading(true);
        setIpError(null);
        try {
            await deleteIpAddress(id);
            await refreshVlans();
            setIsIpDialogOpen(false);
            if (selectedVlan) {
               const updated = await getVlansWithIps();
               const found = updated.find(v => v.id === selectedVlan.id);
               if (found) setSelectedVlan(found);
            }
        } catch (error: any) {
            console.error(error);
            setIpError(error.message || "Failed to free IP");
        } finally {
            setIpLoading(false);
        }
    };

    const handleReserveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVlan) return;
        setReserveLoading(true);
        setReserveError(null);
        try {
            await createIpReservation(reserveData.startIp, reserveData.endIp, selectedVlan.id, reserveData.description);
            await refreshVlans();
            setIsReserveDialogOpen(false);
            setReserveData({ startIp: "", endIp: "", description: "[DHCP Scope] Reserved Block" });

            if (selectedVlan) {
                const updated = await getVlansWithIps();
                const found = updated.find(v => v.id === selectedVlan.id);
                if (found) setSelectedVlan(found);
            }
        } catch (error: any) {
            console.error(error);
            setReserveError(error.message || "Failed to reserve IP range");
        } finally {
            setReserveLoading(false);
        }
    };

    const openEditVlan = () => {
        if (!selectedVlan) return;
        setEditingVlan(true);
        setNewVlanData({
            vlan_id: selectedVlan.vlan_id.toString(),
            name: selectedVlan.name,
            cidr_block: selectedVlan.cidr_block,
            description: selectedVlan.description
        });
        setIsVlanDialogOpen(true);
    };

    const openEditIp = (ip: any) => {
        setEditingIpId(ip.id);
        setIpError(null);
        setIpData({
            ipAddress: ip.ip_address,
            description: ip.description || "",
            isPingable: ip.is_pingable ?? true
        });
        setIsIpDialogOpen(true);
    };

    const openAllocateIp = (ipAddr?: string) => {
        setEditingIpId(null);
        setIpError(null);
        setIpData({ ipAddress: ipAddr || "", description: "", isPingable: true });
        setIsIpDialogOpen(true);
    }

    useEffect(() => {
        async function fetchVlans() {
            try {
                const data = await getVlansWithIps();
                setVlans(data);
                if (data.length > 0) setSelectedVlan(data[0]);
            } catch (error) {
                console.error("Error loading VLANs", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchVlans();
    }, []);

    const handleFirstAvailable = () => {
        if (!selectedVlan) return;
        const allocatedIps = selectedVlan.ipAddresses.map(ip => ip.ip_address);
        const reservedRanges = selectedVlan.scopeReservations.map(r => ({
            start: BigInt(ipToLong(r.start_ip)),
            end: BigInt(ipToLong(r.end_ip))
        }));
        
        const firstFree = getFirstAvailableIp(selectedVlan.cidr_block, allocatedIps, reservedRanges);
        if (firstFree) {
            router.push(`/dashboard/inventory?prefillIp=${encodeURIComponent(firstFree)}&vlanId=${selectedVlan.id}`);
        } else {
            alert("No available IP addresses in this subnet.");
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    const CreateVlanDialog = (
        <Dialog open={isVlanDialogOpen} onOpenChange={setIsVlanDialogOpen}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingVlan ? `Edit Subnet VLAN ${newVlanData.vlan_id}` : "Create New Subnet"}</DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        {editingVlan ? "Update the properties of your existing Subnet." : "Add a new CIDR block to begin managing dynamic IP allocations."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateVlan} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vlan_id">VLAN ID</Label>
                            <Input id="vlan_id" type="number" required placeholder="e.g. 10" disabled={editingVlan}
                                className="border-zinc-800 bg-zinc-900/50 disabled:opacity-50"
                                value={newVlanData.vlan_id} onChange={e => setNewVlanData({ ...newVlanData, vlan_id: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vlan_name">Name</Label>
                            <Input id="vlan_name" required placeholder="e.g. Servers"
                                className="border-zinc-800 bg-zinc-900/50"
                                value={newVlanData.name} onChange={e => setNewVlanData({ ...newVlanData, name: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cidr">CIDR Block</Label>
                        <Input id="cidr" required placeholder="e.g. 10.0.10.0/24"
                            className="border-zinc-800 bg-zinc-900/50"
                            value={newVlanData.cidr_block} onChange={e => setNewVlanData({ ...newVlanData, cidr_block: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="desc">Description</Label>
                        <Input id="desc" placeholder="Scope of this subnet"
                            className="border-zinc-800 bg-zinc-900/50"
                            value={newVlanData.description} onChange={e => setNewVlanData({ ...newVlanData, description: e.target.value })} />
                    </div>
                    <DialogFooter className="-mx-4 -mb-4 mt-4 flex flex-col items-center gap-2 rounded-b-xl border-t border-zinc-800 bg-muted/50 p-4 sm:flex-row sm:justify-between">
                        {editingVlan ? (
                            <Button type="button" variant="destructive" onClick={handleDeleteVlan} disabled={newVlanLoading} className="bg-red-950 border border-red-900 text-red-500 hover:bg-red-900 hover:text-red-300 transition-colors w-full sm:w-auto">
                                Delete Subnet
                            </Button>
                        ) : <div className="hidden sm:block" />}
                        <div className="flex w-full sm:w-auto gap-2 justify-end">
                            <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setIsVlanDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={newVlanLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1 sm:flex-none">
                                {newVlanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingVlan ? "Save Subnet" : "Create Subnet"}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );

    const IpDialog = (
        <Dialog open={isIpDialogOpen} onOpenChange={setIsIpDialogOpen}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingIpId ? "Manage IP Allocation" : "Manual IP Allocation"}</DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        {editingIpId ? "Edit description or free this IP." : "Manually carve out an IP address in this VLAN without a device."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveIp} className="space-y-4 py-4">
                    {ipError && (
                        <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-md text-red-500 text-sm font-medium">
                            {ipError}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="ip_addr">IP Address {editingIpId ? "" : "or Range"}</Label>
                        <Input id="ip_addr" required placeholder="e.g. 10.0.10.55 or 10.0.10.10-10.0.10.20" disabled={!!editingIpId}
                            className="border-zinc-800 bg-zinc-900/50 disabled:opacity-50 font-mono text-sm"
                            value={ipData.ipAddress} onChange={e => setIpData({ ...ipData, ipAddress: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ip_desc">Description</Label>
                        <Input id="ip_desc" placeholder="What is this allocated for?"
                            className="border-zinc-800 bg-zinc-900/50"
                            value={ipData.description} onChange={e => setIpData({ ...ipData, description: e.target.value })} />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <input type="checkbox" id="pingable" className="rounded border-zinc-700 bg-zinc-900" 
                            checked={ipData.isPingable} onChange={e => setIpData({ ...ipData, isPingable: e.target.checked })} />
                        <Label htmlFor="pingable" className="font-normal text-zinc-300">Enable Ping Sweep Monitoring</Label>
                    </div>
                    
                    <DialogFooter className="-mx-4 -mb-4 mt-4 flex flex-col items-center gap-2 rounded-b-xl border-t border-zinc-800 bg-muted/50 p-4 sm:flex-row sm:justify-between">
                         {editingIpId ? (
                            <Button type="button" variant="destructive" onClick={() => handleFreeIp(editingIpId)} disabled={ipLoading} className="bg-red-950 border border-red-900 text-red-500 hover:bg-red-900 hover:text-red-300 transition-colors w-full sm:w-auto">
                               Free IP
                            </Button>
                         ) : <div className="hidden sm:block" />}

                        <div className="flex w-full sm:w-auto gap-2 justify-end">
                            <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setIsIpDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={ipLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1 sm:flex-none">
                                {ipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );

    const ReserveDialog = (
        <Dialog open={isReserveDialogOpen} onOpenChange={setIsReserveDialogOpen}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Reserve DHCP Scope</DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Bulk allocate a range of IPs to prevent them from being manually assigned or suggested.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleReserveSubmit} className="space-y-4 py-4">
                    {reserveError && (
                        <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-md text-red-500 text-sm font-medium">
                            {reserveError}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start_ip">Start IP</Label>
                            <Input id="start_ip" required placeholder="e.g. 10.0.10.100" 
                                className="border-zinc-800 bg-zinc-900/50 font-mono text-sm"
                                value={reserveData.startIp} onChange={e => setReserveData({ ...reserveData, startIp: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end_ip">End IP</Label>
                            <Input id="end_ip" required placeholder="e.g. 10.0.10.200" 
                                className="border-zinc-800 bg-zinc-900/50 font-mono text-sm"
                                value={reserveData.endIp} onChange={e => setReserveData({ ...reserveData, endIp: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="res_desc">Description</Label>
                        <Input id="res_desc" required placeholder="[DHCP Scope] Server VLAN"
                            className="border-zinc-800 bg-zinc-900/50"
                            value={reserveData.description} onChange={e => setReserveData({ ...reserveData, description: e.target.value })} />
                    </div>
                    
                    <DialogFooter className="-mx-4 -mb-4 mt-4 flex flex-col items-center gap-2 rounded-b-xl border-t border-zinc-800 bg-muted/50 p-4 sm:flex-row sm:justify-end">
                        <div className="flex w-full sm:w-auto gap-2 justify-end">
                            <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setIsReserveDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={reserveLoading} className="bg-blue-600 hover:bg-blue-500 text-white flex-1 sm:flex-none">
                                {reserveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reserve Scope"}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );

    if (!selectedVlan) {
        return (
            <div className="space-y-6">
                {CreateVlanDialog}
                <div className="flex flex-col items-center justify-center h-64 border border-dashed border-zinc-800 rounded-lg space-y-4">
                    <div className="text-zinc-400">No VLANs found in the database.</div>
                    <Button variant="outline" className="border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/30" onClick={() => setIsVlanDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Create First Subnet
                    </Button>
                </div>
            </div>
        );
    }

    // Dynamic calculations
    const allocatedIpsFilter = selectedVlan.ipAddresses.filter(ip => ip.is_allocated);
    const visibleAllocatedIps = allocatedIpsFilter.filter(ip =>
        ip.ip_address.includes(searchQuery) ||
        (ip.device?.name && ip.device.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const visibleScopeReservations = selectedVlan.scopeReservations.filter(scope =>
        scope.start_ip.includes(searchQuery) ||
        scope.end_ip.includes(searchQuery) ||
        scope.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const allocatedIpStrings = allocatedIpsFilter.map(ip => ip.ip_address);
    const reservedRanges = selectedVlan.scopeReservations.map(r => ({
        start: BigInt(ipToLong(r.start_ip)),
        end: BigInt(ipToLong(r.end_ip))
    }));
    const availableRanges = calculateAvailableRanges(selectedVlan.cidr_block, allocatedIpStrings, reservedRanges);

    const getStatusDot = (status: string, isPingable: boolean) => {
        if (!isPingable) return <div className="w-2 h-2 rounded-full bg-zinc-600" title="Monitoring Disabled" />;
        if (status === 'UP') return <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="UP" />;
        if (status === 'DOWN') return <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" title="DOWN" />;
        return <div className="w-2 h-2 rounded-full bg-zinc-400" title="Unknown Status (Wait for Ping Sweep)" />;
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-8rem)]">
            {CreateVlanDialog}
            {IpDialog}
            {ReserveDialog}

            {/* Left Sidebar for VLANs */}
            <Card className="w-full md:w-72 shrink-0 border-zinc-800 bg-zinc-900/50 flex flex-col h-full overflow-hidden shadow-lg">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                    <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                        <Network className="w-4 h-4 text-emerald-500" />
                        Subnets
                    </h3>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={() => { setEditingVlan(false); setNewVlanData({vlan_id: "", name: "", cidr_block: "", description: ""}); setIsVlanDialogOpen(true); }}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                    {vlans.map(vlan => {
                        const isSelected = selectedVlan.id === vlan.id;
                        return (
                            <button
                                key={vlan.id}
                                onClick={() => setSelectedVlan(vlan)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex flex-col gap-1 border ${
                                    isSelected 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-inner' 
                                    : 'bg-zinc-950/30 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border-zinc-800/50'
                                }`}
                            >
                                <div className="flex justify-between items-center w-full">
                                    <span className="font-medium truncate text-sm">{vlan.name}</span>
                                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${isSelected ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/50' : 'border-zinc-700 text-zinc-500'}`}>{vlan.vlan_id}</Badge>
                                </div>
                                <div className={`text-xs font-mono tracking-tight ${isSelected ? 'opacity-90' : 'opacity-60'}`}>{vlan.cidr_block}</div>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Right Content */}
            <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pb-6 pr-2 custom-scrollbar">
                {/* Header Toolbar */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/80">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
                                {selectedVlan.name}
                            </h2>
                        </div>
                        <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-300 pointer-events-none font-mono tracking-wider">
                            {selectedVlan.cidr_block}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20" onClick={openEditVlan}>
                            Configure Route
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-4 xl:mt-0">
                        <div className="relative flex-1 xl:w-56 min-w-[200px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                            <Input
                                type="text"
                                placeholder="Search Allocations..."
                                className="h-9 pl-9 border-zinc-700 bg-zinc-900/50 focus-visible:ring-emerald-500/50 text-zinc-100 text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border bg-zinc-900/50 hover:bg-zinc-800 hover:text-accent-foreground h-9 px-3 border-zinc-700 text-zinc-300">
                                Options
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 border-zinc-800 bg-zinc-950 text-zinc-300">
                                <DropdownMenuItem onClick={() => openAllocateIp()} className="focus:bg-zinc-900 cursor-pointer">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Allocate IPv4
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleFirstAvailable} className="focus:bg-zinc-900 text-emerald-400 focus:text-emerald-300 cursor-pointer">
                                    <Plus className="h-4 w-4 mr-2" />
                                    First Available
                                </DropdownMenuItem>
                                <div className="h-px bg-zinc-800/80 my-1"/>
                                <DropdownMenuItem onClick={() => setIsReserveDialogOpen(true)} className="focus:bg-zinc-900 text-blue-400 focus:text-blue-300 cursor-pointer">
                                    <Network className="h-4 w-4 mr-2" />
                                    Reserve Scope
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Main Grids */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full">
                    {/* Allocated Nodes */}
                    <div className="xl:col-span-3">
                        <Card className="border-zinc-800 bg-zinc-900/50 h-full shadow-lg">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base text-zinc-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Server className="w-4 h-4 text-zinc-400" />
                                        Allocated Nodes
                                    </div>
                                    <Badge variant="outline" className="border-emerald-900/50 text-emerald-400 bg-emerald-950/20">{allocatedIpsFilter.length} Used</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {visibleAllocatedIps.length === 0 && visibleScopeReservations.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
                                        <Server className="w-8 h-8 opacity-20 mb-3" />
                                        <span>No IPs active in this scope yet.</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {visibleAllocatedIps.map((ip) => {
                                            const isReserved = ip.description?.toLowerCase().includes('dhcp') || ip.description?.toLowerCase().includes('reserved');
                                            return (
                                            <button
                                                key={ip.id}
                                                onClick={() => openEditIp(ip)}
                                                className={`p-3 rounded border text-left flex flex-col gap-1 transition-all
                                                    ${isReserved
                                                        ? 'bg-[#111822] border-blue-900/30 hover:border-blue-500/50'
                                                        : 'bg-zinc-950/50 border-emerald-900/30 hover:border-emerald-500/50'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <span className={`font-mono text-xs tracking-tight font-semibold ${isReserved ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                        {ip.ip_address}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        {getStatusDot(ip.status, ip.is_pingable)}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                                                    {ip.device ? (
                                                        <><Server className="h-2.5 w-2.5 shrink-0"/> {ip.device.name}</>
                                                    ) : (
                                                        <><span className="shrink-0 w-2.5 text-center">•</span> {ip.description || "Allocated"}</>
                                                    )}
                                                </div>
                                            </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Free Scopes */}
                    <div className="xl:col-span-1">
                        <Card className="border-zinc-800 bg-zinc-900/50 h-full shadow-lg">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base text-zinc-100 flex items-center gap-2">
                                    <Network className="w-4 h-4 text-zinc-400" />
                                    Free Scopes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {availableRanges.length === 0 ? (
                                    <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">Exhausted</div>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                        {availableRanges.map((range, idx) => (
                                            <div key={idx} className="flex flex-col p-2.5 rounded-lg border border-emerald-900/20 bg-emerald-950/10 text-emerald-400/80 font-mono text-xs items-center justify-center text-center shadow-inner hover:bg-emerald-950/30 transition-colors">
                                                {range}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="pt-4 flex justify-center">
                                    <Button
                                        className="w-full text-xs h-9 border-emerald-800/60 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-400 font-semibold"
                                        variant="outline"
                                        onClick={() => availableRanges[0] && openAllocateIp(availableRanges[0].split('-')[0])}
                                        disabled={availableRanges.length === 0}
                                    >
                                        Auto-Provision Next
                                    </Button>
                                </div>

                                {visibleScopeReservations.length > 0 && (
                                    <div className="pt-4 mt-2 border-t border-zinc-800/50 flex flex-col gap-2">
                                        <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
                                            DHCP Pools
                                            <Badge variant="outline" className="border-blue-900/50 text-blue-400 bg-blue-950/30 text-[10px] h-4 px-1.5">
                                                {visibleScopeReservations.length} Scopes
                                            </Badge>
                                        </div>
                                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                            {visibleScopeReservations.map((scope) => (
                                                <div key={scope.id} className="flex flex-col p-2.5 rounded-lg border border-blue-900/30 bg-[#111822] text-blue-400 font-mono text-xs items-center justify-center text-center shadow-inner hover:border-blue-500/50 transition-all border-dashed">
                                                    <div className="font-semibold">{scope.start_ip} - {scope.end_ip}</div>
                                                    <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 justify-center w-full truncate">
                                                        <Network className="h-2.5 w-2.5 shrink-0 text-blue-500/50"/> {scope.description}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
