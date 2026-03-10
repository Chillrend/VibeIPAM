"use client";

import { useState, useEffect } from "react";
import { getAuditLogs } from "@/app/actions/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Activity, Clock, ShieldAlert, Monitor, Network, Database } from "lucide-react";
import { format } from "date-fns";

type AuditLog = {
    id: string;
    action: string;
    description: string;
    timestamp: Date;
};

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchLogs() {
            const data = await getAuditLogs();
            setLogs(data);
            setIsLoading(false);
        }
        fetchLogs();
    }, []);

    const getActionIcon = (action: string) => {
        if (action.includes("DEVICE")) return <Monitor className="w-4 h-4 text-emerald-400" />;
        if (action.includes("IP") || action.includes("SCOPE")) return <Network className="w-4 h-4 text-blue-400" />;
        if (action.includes("VLAN")) return <Database className="w-4 h-4 text-purple-400" />;
        return <Activity className="w-4 h-4 text-zinc-400" />;
    };

    const getActionColor = (action: string) => {
        if (action.includes("DELETE") || action.includes("FREE")) return "text-red-400 bg-red-950/20 border-red-900/30";
        if (action.includes("CREATE") || action.includes("ALLOCATE") || action.includes("RESERVE")) return "text-emerald-400 bg-emerald-950/20 border-emerald-900/30";
        if (action.includes("UPDATE")) return "text-blue-400 bg-blue-950/20 border-blue-900/30";
        return "text-zinc-400 bg-zinc-900 border-zinc-800";
    };

    return (
        <div className="space-y-6 lg:max-w-4xl max-w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
                        <ShieldAlert className="w-6 h-6 text-emerald-500" />
                        Anonymous Audit Log
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">A verifiable, zero-knowledge history of infrastructure mutations.</p>
                </div>
            </div>

            <Card className="border-zinc-800 bg-zinc-900/50 shadow-lg overflow-hidden">
                <CardHeader className="bg-zinc-900 border-b border-zinc-800 py-4">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Recent Activity (Last 50 Events)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-sm">
                            <Activity className="w-8 h-8 opacity-20 mb-3" />
                            <span>No audit logs recorded yet.</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-800/50">
                            {logs.map((log) => (
                                <div key={log.id} className="flex gap-4 p-4 hover:bg-zinc-800/30 transition-colors">
                                    <div className="mt-1 flex-shrink-0">
                                        <div className="w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-sm">
                                            {getActionIcon(log.action)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col w-full min-w-0">
                                        <div className="flex items-center justify-between gap-4 mb-1">
                                            <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border uppercase ${getActionColor(log.action)}`}>
                                                {log.action.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap hidden sm:block">
                                                {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-300 leading-relaxed break-words">{log.description}</p>
                                        <span className="text-[10px] text-zinc-600 sm:hidden mt-2">
                                            {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
