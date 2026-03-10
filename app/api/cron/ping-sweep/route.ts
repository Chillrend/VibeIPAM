import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ping from 'ping';

export async function GET(request: Request) {
    try {
        const ipsToCheck = await prisma.ipAddress.findMany({
            where: {
                is_allocated: true,
                is_pingable: true
            }
        });

        if (ipsToCheck.length === 0) {
            return NextResponse.json({ message: "No pingable IPs found" });
        }

        const batchSize = 50;
        const results = [];

        for (let i = 0; i < ipsToCheck.length; i += batchSize) {
            const batch = ipsToCheck.slice(i, i + batchSize);
            
            const promises = batch.map(async (ipRecord) => {
                const res = await ping.promise.probe(ipRecord.ip_address, {
                    timeout: 2,
                    extra: ['-c', '1']
                });
                
                const isAlive = res.alive;
                
                await prisma.ipAddress.update({
                    where: { id: ipRecord.id },
                    data: {
                        status: isAlive ? 'UP' : 'DOWN',
                        last_seen: isAlive ? new Date() : ipRecord.last_seen
                    }
                });

                return { ip: ipRecord.ip_address, alive: isAlive };
            });

            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
        }

        return NextResponse.json({
            message: "Ping sweep completed",
            total: results.length,
            up: results.filter(r => r.alive).length,
            down: results.filter(r => !r.alive).length
        });
    } catch (error) {
        console.error("Ping sweep error:", error);
        return NextResponse.json({ error: "Failed to run ping sweep" }, { status: 500 });
    }
}
