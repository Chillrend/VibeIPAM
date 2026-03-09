import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Server, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function DashboardOverview() {
    const totalDevices = await prisma.device.count();
    const totalSubnets = await prisma.vlan.count();

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Total Devices</CardTitle>
                        <Server className="h-4 w-4 text-zinc-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-zinc-100">{totalDevices}</div>
                    </CardContent>
                </Card>
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Total Subnets</CardTitle>
                        <Database className="h-4 w-4 text-zinc-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-zinc-100">{totalSubnets}</div>
                    </CardContent>
                </Card>
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Vault Status</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">Secure</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-zinc-800 bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-zinc-100 text-xl">Welcome to Zero-K DCIM</CardTitle>
                        <CardDescription className="text-zinc-400">Your lightweight, zero-knowledge dashboard.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-zinc-300 text-sm space-y-4">
                        <p>
                            Navigate to the <strong>IPAM</strong> section to manage your VLANs and IP address allocations.
                        </p>
                        <p>
                            Use the <strong>Inventory</strong> section to manage devices and securely retrieve credentials. Remember, all
                            decryption happens exclusively your browser using the Master Key you entered earlier.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
