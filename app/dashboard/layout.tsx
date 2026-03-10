"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getStoredKey, clearStoredKey } from "@/lib/crypto";
import { Loader2, ShieldAlert, LogOut, LayoutDashboard, Database, Server, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const authorize = async () => {
            try {
                const key = await getStoredKey();
                if (!key) {
                    router.push("/");
                } else {
                    setIsAuthorized(true);
                }
            } catch (error) {
                console.error("Authorization failed", error);
                router.push("/");
            }
        };
        authorize();
    }, [router, pathname]);

    const handleLock = async () => {
        await clearStoredKey();
        router.push("/");
    };

    if (!isAuthorized) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    const navItems = [
        { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
        { name: "IPAM", href: "/dashboard/ipam", icon: Database },
        { name: "Inventory", href: "/dashboard/inventory", icon: Server },
        { name: "Audit Logs", href: "/dashboard/audit", icon: ShieldAlert },
        { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ];

    return (
        <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
            {/* Sidebar */}
            <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-zinc-800">
                    <ShieldAlert className="w-5 h-5 text-emerald-400 mr-2" />
                    <span className="font-semibold tracking-tight">Zero-K DCIM</span>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <a
                                key={item.href}
                                href={item.href}
                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive
                                        ? "bg-zinc-800 text-white"
                                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                                    }`}
                            >
                                <Icon className={`mr-3 h-4 w-4 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                                {item.name}
                            </a>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-zinc-800">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-400/10"
                        onClick={handleLock}
                    >
                        <LogOut className="mr-3 h-4 w-4" />
                        Lock Vault
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 flex items-center px-8 justify-between">
                    <h1 className="text-lg font-medium">
                        {navItems.find(i => i.href === pathname)?.name || "Dashboard"}
                    </h1>
                    <div className="flex items-center space-x-2 text-sm text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Vault Unlocked</span>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
