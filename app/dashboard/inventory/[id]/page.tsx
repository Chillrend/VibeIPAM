import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Server, MapPin, Tag, Activity, Key, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DeviceVaultForm } from "./device-vault-form"; // We will create this client component

export const dynamic = 'force-dynamic';

export default async function DeviceDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    
    const device = await prisma.device.findUnique({
        where: { id: resolvedParams.id },
        include: {
            location: true,
            deviceType: true,
            tags: true,
            ipAddresses: true,
            credentials: {
                select: { id: true, username: true, desc: true }
            }
        }
    });

    if (!device) {
        notFound();
    }

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/inventory" className="p-2 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-emerald-400">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 flex items-center gap-3">
                        <Server className="w-6 h-6 text-emerald-500" />
                        {device.name}
                        <Badge variant="outline" className={`
                            ${device.status === 'Active' ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'
                                : device.status === 'Offline' ? 'text-red-400 border-red-900/50 bg-red-950/20'
                                    : 'text-blue-400 border-blue-900/50 bg-blue-950/20'}
                        `}>
                            {device.status}
                        </Badge>
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {device.location.name}</span>
                        <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> {device.deviceType.type}</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="text-zinc-200 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" />
                                Network Interfaces
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3">
                                {device.ipAddresses.length > 0 ? device.ipAddresses.map(ip => (
                                    <div key={ip.id} className="flex items-center justify-between p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-mono text-emerald-400 text-sm tracking-wide">{ip.ip_address}</span>
                                            {ip.description && <span className="text-xs text-zinc-500">{ip.description}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest px-2 py-0.5 rounded-full border border-zinc-800">
                                                {ip.status}
                                            </span>
                                            {ip.is_pingable ? (
                                                <div className={`w-2 h-2 rounded-full ${ip.status === 'UP' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : ip.status === 'DOWN' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-zinc-400'}`} />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-zinc-600" title="Monitoring Disabled" />
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-sm text-zinc-500 italic">No IP addresses assigned.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-800 bg-zinc-900/50">
                        <CardHeader>
                            <CardTitle className="text-zinc-200 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-emerald-500" />
                                Metadata & Tags
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-4">
                                {device.desc && (
                                    <div>
                                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Description</label>
                                        <p className="text-sm text-zinc-300 mt-1">{device.desc}</p>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">Assigned Tags</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {device.tags.map(tag => (
                                            <span
                                                key={tag.id}
                                                className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-opacity-10 border"
                                                style={{ backgroundColor: `${tag.color_hex}15`, color: tag.color_hex, borderColor: `${tag.color_hex}30` }}
                                            >
                                                {tag.name}
                                            </span>
                                        ))}
                                        {device.tags.length === 0 && <span className="text-sm text-zinc-500 italic">No tags assigned.</span>}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-zinc-800 bg-zinc-900/50 h-full">
                        <CardHeader>
                            <CardTitle className="text-zinc-200 flex items-center gap-2">
                                <Key className="w-4 h-4 text-emerald-500" />
                                Zero-Knowledge Vault
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DeviceVaultForm deviceId={device.id} initialCredentials={device.credentials} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
