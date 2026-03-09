"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, MapPin, Tag, Cpu } from "lucide-react";
import {
    getLocations, getDeviceTypes, getTags,
    createLocation, deleteLocation,
    createDeviceType, deleteDeviceType,
    createTag, deleteTag
} from "@/app/actions/db";

export default function SettingsPage() {
    const [locations, setLocations] = useState<any[]>([]);
    const [deviceTypes, setDeviceTypes] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [newLocation, setNewLocation] = useState("");
    const [newType, setNewType] = useState({ type: "", isVirtual: false });
    const [newTag, setNewTag] = useState({ name: "", color: "#10b981" });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [locs, types, tgs] = await Promise.all([getLocations(), getDeviceTypes(), getTags()]);
            setLocations(locs);
            setDeviceTypes(types);
            setTags(tgs);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        await createLocation(newLocation);
        setNewLocation("");
        fetchData();
    }

    const handleCreateType = async (e: React.FormEvent) => {
        e.preventDefault();
        await createDeviceType(newType.type, newType.isVirtual);
        setNewType({ type: "", isVirtual: false });
        fetchData();
    }

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        await createTag(newTag.name, newTag.color);
        setNewTag({ name: "", color: "#10b981" });
        fetchData();
    }

    const handleDeleteLocation = async (id: string) => {
        if (!confirm("Delete location? Ensure no devices are attached.")) return;
        try { await deleteLocation(id); fetchData(); } catch (e) { alert("Failed to delete. It might be in use."); }
    }

    const handleDeleteType = async (id: string) => {
        if (!confirm("Delete type? Ensure no devices use this.")) return;
        try { await deleteDeviceType(id); fetchData(); } catch (e) { alert("Failed to delete. It might be in use."); }
    }

    const handleDeleteTag = async (id: string) => {
        if (!confirm("Delete tag? Ensure no devices use this.")) return;
        try { await deleteTag(id); fetchData(); } catch (e) { alert("Failed to delete. It might be in use."); }
    }

    if (isLoading && locations.length === 0) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight">Application Settings</h2>
                <p className="text-zinc-400 mt-2">Manage metadata definitions used throughout the DCIM application, such as Locations, Device Types, and Tags.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Locations Module */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader className="pb-3 border-b border-zinc-800/50">
                        <CardTitle className="text-lg text-zinc-100 flex items-center">
                            <MapPin className="h-5 w-5 mr-2 text-emerald-500" /> Locations
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <form onSubmit={handleCreateLocation} className="flex gap-2">
                            <Input className="border-zinc-800 bg-zinc-950 focus-visible:ring-emerald-500/50" placeholder="e.g. Rack 1, AWS" required value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                            <Button type="submit" variant="secondary" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300">Add</Button>
                        </form>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {locations.length === 0 && <span className="text-sm text-zinc-500">No locations added.</span>}
                            {locations.map(loc => (
                                <div key={loc.id} className="flex items-center justify-between p-2 rounded border border-zinc-800/50 bg-zinc-950/30">
                                    <span className="text-sm text-zinc-300 font-medium">{loc.name}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/70 hover:bg-red-950/30 hover:text-red-400" onClick={() => handleDeleteLocation(loc.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Device Types Module */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader className="pb-3 border-b border-zinc-800/50">
                        <CardTitle className="text-lg text-zinc-100 flex items-center">
                            <Cpu className="h-5 w-5 mr-2 text-blue-500" /> Device Types
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <form onSubmit={handleCreateType} className="space-y-3">
                            <Input className="border-zinc-800 bg-zinc-950 focus-visible:ring-blue-500/50" placeholder="e.g. Switch, Hypervisor" required value={newType.type} onChange={e => setNewType({ ...newType, type: e.target.value })} />
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-zinc-400 flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" className="rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900" checked={newType.isVirtual} onChange={e => setNewType({ ...newType, isVirtual: e.target.checked })} />
                                    Is Virtual?
                                </label>
                                <Button type="submit" variant="secondary" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300">Add Type</Button>
                            </div>
                        </form>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {deviceTypes.length === 0 && <span className="text-sm text-zinc-500">No device types added.</span>}
                            {deviceTypes.map(dt => (
                                <div key={dt.id} className="flex items-center justify-between p-2 rounded border border-zinc-800/50 bg-zinc-950/30">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-zinc-300 font-medium">{dt.type}</span>
                                        {dt.is_virtual && <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">Virtual</span>}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/70 hover:bg-red-950/30 hover:text-red-400" onClick={() => handleDeleteType(dt.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Tags Module */}
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader className="pb-3 border-b border-zinc-800/50">
                        <CardTitle className="text-lg text-zinc-100 flex items-center">
                            <Tag className="h-5 w-5 mr-2 text-violet-500" /> Tags
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <form onSubmit={handleCreateTag} className="flex gap-2">
                            <Input type="color" className="w-[42px] h-10 p-1 border-zinc-800 bg-zinc-950 cursor-pointer block rounded-md shrink-0" value={newTag.color} onChange={e => setNewTag({ ...newTag, color: e.target.value })} />
                            <Input className="border-zinc-800 bg-zinc-950 flex-1 focus-visible:ring-violet-500/50" placeholder="e.g. Production" required value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} />
                            <Button type="submit" variant="secondary" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300">Add</Button>
                        </form>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {tags.length === 0 && <span className="text-sm text-zinc-500">No tags added.</span>}
                            {tags.map(tag => (
                                <div key={tag.id} className="flex items-center justify-between p-2 rounded border border-zinc-800/50 bg-zinc-950/30">
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: `${tag.color_hex}15`, color: tag.color_hex, border: `1px solid ${tag.color_hex}30` }}>
                                        {tag.name}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/70 hover:bg-red-950/30 hover:text-red-400" onClick={() => handleDeleteTag(tag.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
