export function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function longToIp(long: number): string {
    return [
        (long >>> 24) & 255,
        (long >>> 16) & 255,
        (long >>> 8) & 255,
        long & 255
    ].join('.');
}

/**
 * Parses a CIDR block (e.g., "10.0.0.0/24") into its bounds.
 */
export function parseCidr(cidr: string) {
    if (!cidr.includes('/')) return null;

    const [ip, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix, 10);

    if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) return null;

    const ipLong = ipToLong(ip);

    // Calculate mask (Handle 0 / 32 edge cases securely)
    const maskLong = prefixNum === 0 ? 0 : (~0 << (32 - prefixNum)) >>> 0;

    const networkLong = (ipLong & maskLong) >>> 0;
    const broadcastLong = (networkLong | (~maskLong)) >>> 0;

    const firstUsable = networkLong + 1;
    const lastUsable = broadcastLong - 1;
    const totalUsable = Math.max(0, lastUsable - firstUsable + 1);

    // Handle /32 and /31 bounds manually
    if (prefixNum === 32) {
        return { network: networkLong, broadcast: networkLong, first: networkLong, last: networkLong, total: 1 };
    } else if (prefixNum === 31) {
        return { network: networkLong, broadcast: broadcastLong, first: networkLong, last: broadcastLong, total: 2 };
    }

    return {
        network: networkLong,
        broadcast: broadcastLong,
        first: firstUsable,
        last: lastUsable,
        total: totalUsable
    };
}

/**
 * Calculates human-readable contiguous blocks of available IP ranges.
 */
export function calculateAvailableRanges(cidr: string, allocatedIps: string[], reservedRanges: {start: bigint, end: bigint}[] = []): string[] {
    const details = parseCidr(cidr);
    if (!details || details.total === 0) return [];

    const allocatedLongs = allocatedIps.map(ipToLong).sort((a, b) => a - b);
    const validAllocated = [...new Set(allocatedLongs.filter(long => long >= details.first && long <= details.last))];

    // Merge individual IPs and Ranges into a unified array of blocked intervals
    const blocked: {start: bigint, end: bigint}[] = [
        ...validAllocated.map(long => ({ start: BigInt(long), end: BigInt(long) })),
        ...reservedRanges
    ].sort((a, b) => (a.start < b.start ? -1 : 1));

    // Merge contiguous/overlapping blocked regions
    const mergedBlocks: {start: bigint, end: bigint}[] = [];
    for (const b of blocked) {
        if (mergedBlocks.length === 0) {
            mergedBlocks.push(b);
            continue;
        }
        const last = mergedBlocks[mergedBlocks.length - 1];
        if (b.start <= last.end + BigInt(1)) {
            last.end = b.end > last.end ? b.end : last.end;
        } else {
            mergedBlocks.push(b);
        }
    }

    const ranges: string[] = [];
    let currentStart = BigInt(details.first);
    const networkLast = BigInt(details.last);

    for (const block of mergedBlocks) {
        if (currentStart < block.start && block.start <= networkLast) {
            const end = block.start - BigInt(1);
            if (currentStart === end) {
                ranges.push(longToIp(Number(currentStart)));
            } else {
                ranges.push(`${longToIp(Number(currentStart))} - ${longToIp(Number(end))}`);
            }
        }
        if (block.end >= currentStart) {
            currentStart = block.end + BigInt(1);
        }
    }

    if (currentStart <= networkLast) {
        if (currentStart === networkLast) {
            ranges.push(longToIp(Number(currentStart)));
        } else {
            ranges.push(`${longToIp(Number(currentStart))} - ${longToIp(Number(networkLast))}`);
        }
    }

    return ranges;
}


/**
 * Returns the very first usable IP address that hasn't been allocated yet.
 */
export function getFirstAvailableIp(cidr: string, allocatedIps: string[], reservedRanges: {start: bigint, end: bigint}[] = []): string | null {
    const details = parseCidr(cidr);
    if (!details || details.total === 0) return null;

    const allocatedLongs = new Set(allocatedIps.map(ipToLong));
    const sortedAllocated = Array.from(allocatedLongs).sort((a, b) => a - b);

    // Merge into blocked intervals
    const blocked: {start: bigint, end: bigint}[] = [
        ...sortedAllocated.map(long => ({ start: BigInt(long), end: BigInt(long) })),
        ...reservedRanges
    ].sort((a, b) => (a.start < b.start ? -1 : 1));

    // Merge contiguous blocks
    const mergedBlocks: {start: bigint, end: bigint}[] = [];
    for (const b of blocked) {
        if (mergedBlocks.length === 0) {
            mergedBlocks.push(b);
            continue;
        }
        const last = mergedBlocks[mergedBlocks.length - 1];
        if (b.start <= last.end + BigInt(1)) {
            last.end = b.end > last.end ? b.end : last.end;
        } else {
            mergedBlocks.push(b);
        }
    }

    let currentStart = BigInt(details.first);
    const networkLast = BigInt(details.last);

    for (const block of mergedBlocks) {
        if (block.start > currentStart && currentStart <= networkLast) {
            return longToIp(Number(currentStart));
        }
        if (block.end >= currentStart) {
            currentStart = block.end + BigInt(1);
        }
    }

    if (currentStart <= networkLast) {
        return longToIp(Number(currentStart));
    }

    return null;
}
