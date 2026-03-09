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
export function calculateAvailableRanges(cidr: string, allocatedIps: string[]): string[] {
    const details = parseCidr(cidr);
    if (!details || details.total === 0) return [];

    const allocatedLongs = allocatedIps.map(ipToLong).sort((a, b) => a - b);
    const validAllocated = [...new Set(allocatedLongs.filter(long => long >= details.first && long <= details.last))];

    const ranges: string[] = [];
    let currentStart = details.first;

    for (const alloc of validAllocated) {
        if (currentStart < alloc) {
            const end = alloc - 1;
            if (currentStart === end) {
                ranges.push(longToIp(currentStart));
            } else {
                ranges.push(`${longToIp(currentStart)} - ${longToIp(end)}`);
            }
        }
        currentStart = alloc + 1;
    }

    if (currentStart <= details.last) {
        if (currentStart === details.last) {
            ranges.push(longToIp(currentStart));
        } else {
            ranges.push(`${longToIp(currentStart)} - ${longToIp(details.last)}`);
        }
    }

    return ranges;
}

/**
 * Returns the very first usable IP address that hasn't been allocated yet.
 */
export function getFirstAvailableIp(cidr: string, allocatedIps: string[]): string | null {
    const details = parseCidr(cidr);
    if (!details || details.total === 0) return null;

    const allocatedLongs = new Set(allocatedIps.map(ipToLong));
    const sortedAllocated = Array.from(allocatedLongs).sort((a, b) => a - b);

    let currentStart = details.first;

    for (const alloc of sortedAllocated) {
        if (alloc > currentStart) {
            return longToIp(currentStart);
        } else if (alloc === currentStart) {
            currentStart++;
        }
    }

    if (currentStart <= details.last) {
        return longToIp(currentStart);
    }

    return null;
}
