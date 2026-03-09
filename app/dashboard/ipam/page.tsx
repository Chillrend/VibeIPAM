"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Loader2, Network, Server } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getVlansWithIps, createVlan } from "@/app/actions/db";
import { calculateAvailableRanges, getFirstAvailableIp } from "@/lib/ip-utils";
import { Prisma } from "@prisma/client";

type VlanWithIps = Prisma.VlanGetPayload<{
    include: {
        ipAddresses: {
            include: {
                device: true
            }
        }
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
    const [newVlanData, setNewVlanData] = useState({
        vlan_id: "",
        name: "",
        cidr_block: "",
        description: ""
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
            const created = await createVlan({
                vlan_id: parseInt(newVlanData.vlan_id),
                name: newVlanData.name,
                cidr_block: newVlanData.cidr_block,
                description: newVlanData.description
            });
            await refreshVlans();
            setIsVlanDialogOpen(false);
            setNewVlanData({ vlan_id: "", name: "", cidr_block: "", description: "" });

            const updated = await getVlansWithIps();
            const found = updated.find(v => v.id === created.id);
            if (found) setSelectedVlan(found);

        } catch (error) {
            console.error(error);
        } finally {
            setNewVlanLoading(false);
        }
    };

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
        const firstFree = getFirstAvailableIp(selectedVlan.cidr_block, allocatedIps);
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
                    <DialogTitle>Create New Subnet</DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Add a new CIDR block to begin managing dynamic IP allocations.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateVlan} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vlan_id">VLAN ID</Label>
                            <Input id="vlan_id" type="number" required placeholder="e.g. 10"
                                className="border-zinc-800 bg-zinc-900/50"
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
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsVlanDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={newVlanLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                            {newVlanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Subnet"}
                        </Button>
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

    const allocatedIpStrings = allocatedIpsFilter.map(ip => ip.ip_address);
    const availableRanges = calculateAvailableRanges(selectedVlan.cidr_block, allocatedIpStrings);

    return (
        <div className="space-y-6">
            {CreateVlanDialog}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4 relative">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 px-4 py-2 min-w-[200px] border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-100">
                            VLAN {selectedVlan.vlan_id}: {selectedVlan.name}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[200px] bg-zinc-900 border-zinc-800 text-zinc-100">
                            {vlans.map(vlan => (
                                <DropdownMenuItem
                                    key={vlan.id}
                                    onClick={() => setSelectedVlan(vlan)}
                                    className="hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer"
                                >
                                    VLAN {vlan.vlan_id}: {vlan.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 pointer-events-none">
                        {selectedVlan.cidr_block}
                    </Badge>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300" onClick={() => setIsVlanDialogOpen(true)}>
                        <Network className="h-4 w-4 mr-2" />
                        Add Subnet
                    </Button>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            type="text"
                            placeholder="Search Allocated IPs..."
                            className="pl-9 border-zinc-700 bg-zinc-900/50 focus-visible:ring-emerald-500/50 text-zinc-100"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleFirstAvailable} className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0">
                        <Plus className="h-4 w-4 mr-2" />
                        First Available
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                    <Card className="border-zinc-800 bg-zinc-900/50 h-full">
                        <CardHeader>
                            <CardTitle className="text-lg text-zinc-100 flex items-center justify-between">
                                Allocated Nodes
                                <Badge variant="outline" className="border-emerald-900/50 text-emerald-400 bg-emerald-950/20">{allocatedIpsFilter.length} Used</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {visibleAllocatedIps.length === 0 ? (
                                <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
                                    No IPs allocated in this subnet yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {visibleAllocatedIps.map((ip) => (
                                        <div
                                            key={ip.id}
                                            className="p-3 rounded-md border border-red-900/30 bg-red-950/20 text-red-400 flex flex-col gap-1 hover:bg-red-950/40 transition-colors"
                                            title={ip.device?.name ? `Allocated to: ${ip.device.name}` : 'Unknown'}
                                        >
                                            <div className="text-sm font-mono font-semibold tracking-tight">{ip.ip_address}</div>
                                            <div className="flex items-center gap-1.5 text-xs text-red-400/80 truncate">
                                                <Server className="h-3 w-3 shrink-0" />
                                                {ip.device?.name || "Unknown Device"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-1">
                    <Card className="border-zinc-800 bg-zinc-900/50 h-full">
                        <CardHeader>
                            <CardTitle className="text-lg text-zinc-100">Free Scopes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {availableRanges.length === 0 ? (
                                <div className="text-center py-4 text-zinc-500 text-xs">Exhausted</div>
                            ) : (
                                availableRanges.map((range, idx) => (
                                    <div key={idx} className="flex flex-col p-2.5 rounded-lg border border-emerald-900/30 bg-emerald-950/10 text-emerald-400 font-mono text-xs items-center justify-center text-center shadow-inner">
                                        {range}
                                    </div>
                                ))
                            )}
                            <div className="pt-4 flex justify-center">
                                <Button
                                    className="w-full text-xs border-emerald-800 bg-transparent hover:bg-emerald-950 text-emerald-400"
                                    variant="outline"
                                    onClick={handleFirstAvailable}
                                >
                                    Auto-Provision
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
