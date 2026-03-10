"use server";

import { prisma } from "@/lib/prisma";
import { parseCidr, ipToLong, longToIp } from "@/lib/ip-utils";

// Audit Logger
async function createAuditLog(action: string, description: string) {
    try {
        await prisma.auditLog.create({
            data: { action, description }
        });
    } catch (e) {
        console.error("Failed to write audit log", e);
    }
}

// Vault Security
export async function getVaultConfig() {
    try {
        return await prisma.vaultConfig.findUnique({
            where: { id: "singleton" }
        });
    } catch (error) {
        console.error("Failed to fetch vault config:", error);
        return null;
    }
}

export async function initializeVault(encryptedCanary: string) {
    try {
        return await prisma.vaultConfig.upsert({
            where: { id: "singleton" },
            update: { encrypted_canary: encryptedCanary },
            create: { id: "singleton", encrypted_canary: encryptedCanary }
        });
    } catch (error) {
        console.error("Failed to init vault:", error);
        throw new Error("Initialization failed");
    }
}

// IPAM
export async function getVlansWithIps() {
    try {
        const vlans = await prisma.vlan.findMany({
            include: {
                ipAddresses: {
                    include: {
                        device: true,
                    }
                },
                scopeReservations: true,
            },
            orderBy: {
                vlan_id: 'asc'
            }
        });

        // Sort IPs logically (e.g., 10.0.0.2 before 10.0.0.10)
        return vlans.map(vlan => ({
            ...vlan,
            ipAddresses: vlan.ipAddresses.sort((a, b) => ipToLong(a.ip_address) - ipToLong(b.ip_address))
        }));
    } catch (error) {
        console.error("Failed to fetch VLANs:", error);
        return [];
    }
}

// Inventory Metadata
export async function getLocations() {
    return await prisma.location.findMany();
}

export async function getDeviceTypes() {
    return await prisma.deviceType.findMany();
}

export async function getTags() {
    return await prisma.tag.findMany();
}

// Inventory Devices
export async function getInventoryDevices() {
    try {
        const devices = await prisma.device.findMany({
            include: {
                location: true,
                deviceType: true,
                tags: true,
                ipAddresses: true,
                credentials: {
                    select: {
                        id: true,
                        username: true,
                        desc: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return devices;
    } catch (error) {
        console.error("Failed to fetch Devices:", error);
        return [];
    }
}

export async function getDeviceCredentials(deviceId: string) {
    try {
        const creds = await prisma.credential.findMany({
            where: { deviceId }
        });
        return creds; // Array of credentials, containing encrypted_password
    } catch (error) {
        console.error("Failed to fetch Credentials:", error);
        return [];
    }
}

// Mutations
export async function createVlan(data: { vlan_id: number; name: string; cidr_block: string; description: string; ipRangeEnd?: number }) {
    try {
        const vlan = await prisma.vlan.create({
            data: {
                vlan_id: data.vlan_id,
                name: data.name,
                cidr_block: data.cidr_block,
                description: data.description,
            }
        });

        // We no longer pre-warm IP addresses.
        await createAuditLog("VLAN_CREATE", `Created subnet ${vlan.name} (${vlan.cidr_block}) VLAN ID: ${vlan.vlan_id}`);

        return vlan;
    } catch (error) {
        console.error("Failed to create VLAN:", error);
        throw new Error("Failed to create VLAN");
    }
}

export async function updateVlan(id: string, data: { name: string; cidr_block: string; description: string }) {
    try {
        const updated = await prisma.vlan.update({
            where: { id },
            data: {
                name: data.name,
                cidr_block: data.cidr_block,
                description: data.description,
            }
        });
        await createAuditLog("VLAN_UPDATE", `Updated subnet configuration for ID: ${id}`);
        return updated;
    } catch (error) {
        console.error("Failed to update VLAN:", error);
        throw new Error("Failed to update VLAN");
    }
}

export async function deleteVlan(id: string) {
    try {
        await prisma.ipAddress.deleteMany({
            where: { vlanId: id }
        });
        return await prisma.vlan.delete({
            where: { id }
        });
    } catch (error) {
        console.error("Failed to delete VLAN:", error);
        throw new Error("Failed to delete VLAN");
    }
}

export async function createIpAddress(data: { ipAddress: string; vlanId: string; description?: string; isAllocated?: boolean; isPingable?: boolean }) {
    try {
        const vlan = await prisma.vlan.findUnique({ where: { id: data.vlanId } });
        if (!vlan) throw new Error("VLAN not found");

        const cidrDetails = parseCidr(vlan.cidr_block);
        if (!cidrDetails) throw new Error("Invalid VLAN CIDR block");

        let ipsToCreate: string[] = [];

        // Parse range or single IP
        if (data.ipAddress.includes('-')) {
            const parts = data.ipAddress.split('-');
            if (parts.length !== 2) throw new Error("Invalid IP range format");
            
            const startLong = ipToLong(parts[0].trim());
            const endLong = ipToLong(parts[1].trim());

            if (startLong > endLong) throw new Error("Range start cannot be greater than range end");
            
            // Limit range size to prevent abuse (e.g. max 1000 IPs at once)
            if (endLong - startLong > 1000) throw new Error("Cannot allocate more than 1000 IPs at once");

            for (let i = startLong; i <= endLong; i++) {
                ipsToCreate.push(longToIp(i));
            }
        } else {
            ipsToCreate.push(data.ipAddress.trim());
        }

        // Validate CIDR Bounds
        for (const ip of ipsToCreate) {
            const ipLong = ipToLong(ip);
            if (ipLong < cidrDetails.first || ipLong > cidrDetails.last) {
                throw new Error(`IP ${ip} is outside the allowed VLAN subnet (${vlan.cidr_block})`);
            }
        }

        // Check against Scope Reservations
        const reservations = await prisma.scopeReservation.findMany({
            where: { vlanId: data.vlanId }
        });
        
        for (const ip of ipsToCreate) {
            const ipLong = BigInt(ipToLong(ip));
            for (const res of reservations) {
                if (ipLong >= res.start_long && ipLong <= res.end_long) {
                    throw new Error(`IP ${ip} falls within the reserved DHCP scope: ${res.start_ip} - ${res.end_ip}`);
                }
            }
        }

        // Check for Duplicates
        const existing = await prisma.ipAddress.findMany({
            where: {
                ip_address: { in: ipsToCreate },
                vlanId: data.vlanId
            }
        });

        if (existing.length > 0) {
             throw new Error(`The following IPs already exist: ${existing.map(e => e.ip_address).join(', ')}`);
        }

        // Bulk Insert using createMany (or loop if standard)
        // Wait, standard Prisma createMany is fine.
        await prisma.ipAddress.createMany({
            data: ipsToCreate.map(ip => ({
                ip_address: ip,
                vlanId: data.vlanId,
                description: data.description || "",
                is_allocated: data.isAllocated ?? true,
                is_pingable: data.isPingable ?? true
            }))
        });

        await createAuditLog("IP_ALLOCATE", `Manually allocated IPs: ${ipsToCreate.join(", ")} in VLAN ${vlan.vlan_id}`);

        return { success: true };
    } catch (error: any) {
        console.error("Failed to allocate IP manually:", error);
        throw new Error(error.message || "Failed to allocate IP manually");
    }
}

export async function updateIpAddress(id: string, data: { description?: string; isAllocated?: boolean; deviceId?: string | null; isPingable?: boolean }) {
    try {
        const updated = await prisma.ipAddress.update({
            where: { id },
            data: {
                description: data.description,
                is_allocated: data.isAllocated,
                deviceId: data.deviceId,
                is_pingable: data.isPingable
            }
        });
        await createAuditLog("IP_UPDATE", `Updated IP allocation properties for ID: ${id}`);
        return updated;
    } catch (error: any) {
        console.error("Failed to update IP address:", error);
        throw new Error(error.message || "Failed to update IP address");
    }
}

export async function deleteIpAddress(id: string) {
    try {
        return await prisma.ipAddress.delete({
            where: { id }
        });
        await createAuditLog("IP_FREE", `Freed IP allocation ID: ${id}`);
    } catch (error: any) {
        console.error("Failed to delete IP address:", error);
        throw new Error(error.message || "Failed to delete IP address");
    }
}

export async function createDevice(data: {
    name: string; status: string; desc: string;
    locationId: string; deviceTypeId: string;
    tagIds: string[];
    ips: { ipAddress: string; vlanId: string; isPingable?: boolean }[];
    credentials: { username: string; encryptedPassword: string; desc: string }[];
}) {
    try {
        // 1. Create Device
        const device = await prisma.device.create({
            data: {
                name: data.name,
                status: data.status,
                desc: data.desc,
                locationId: data.locationId,
                deviceTypeId: data.deviceTypeId,
                tags: {
                    connect: data.tagIds.map(id => ({ id }))
                }
            }
        });

        // 2. Allocate IPs if any
        if (data.ips.length > 0) {
            const reservations = await prisma.scopeReservation.findMany(); // Broad fetch since we might cross vlans

            await Promise.all(data.ips.map(async ip => {
                const ipLong = BigInt(ipToLong(ip.ipAddress));
                for (const res of reservations.filter(r => r.vlanId === ip.vlanId)) {
                    if (ipLong >= res.start_long && ipLong <= res.end_long) {
                        throw new Error(`IP ${ip.ipAddress} falls within the reserved DHCP scope: ${res.start_ip} - ${res.end_ip}`);
                    }
                }

                const existing = await prisma.ipAddress.findUnique({ where: { ip_address: ip.ipAddress } });
                if (existing && existing.deviceId && existing.deviceId !== device.id) {
                    throw new Error(`IP ${ip.ipAddress} is already assigned to another device`);
                }
                return prisma.ipAddress.upsert({
                    where: { ip_address: ip.ipAddress },
                    update: { is_allocated: true, deviceId: device.id, description: `Allocated to ${device.name}`, vlanId: ip.vlanId, is_pingable: ip.isPingable ?? true },
                    create: { ip_address: ip.ipAddress, is_allocated: true, deviceId: device.id, vlanId: ip.vlanId, description: `Allocated to ${device.name}`, is_pingable: ip.isPingable ?? true }
                });
            }));
        }

        // 3. Store Credentials if provided
        if (data.credentials.length > 0) {
            await Promise.all(data.credentials.map(cred =>
                prisma.credential.create({
                    data: {
                        username: cred.username,
                        encrypted_password: cred.encryptedPassword,
                        desc: cred.desc,
                        deviceId: device.id
                    }
                })
            ));
        }

        return device;
    } catch (error) {
        console.error("Failed to create Device:", error);
        throw new Error("Failed to create Device");
    }
}

export async function updateDevice(id: string, data: {
    name: string; status: string; desc: string;
    locationId: string; deviceTypeId: string;
    tagIds: string[];
    ipsToCreate: { ipAddress: string; vlanId: string; isPingable?: boolean }[];
    ipIdsToRemove: string[];
    credentialsToCreate: { username: string; encryptedPassword: string; desc: string }[];
    credentialIdsToRemove: string[];
}) {
    try {
        // 1. Update Core Device Data & Tags
        const device = await prisma.device.update({
            where: { id },
            data: {
                name: data.name,
                status: data.status,
                desc: data.desc,
                locationId: data.locationId,
                deviceTypeId: data.deviceTypeId,
                tags: {
                    set: data.tagIds.map(tagId => ({ id: tagId })) // Replaces relationships entirely
                }
            }
        });

        // 2. Remove detached IPs (unallocate them, or delete them)
        // Here we'll delete them to fully un-allocate for simplicity.
        if (data.ipIdsToRemove.length > 0) {
             await prisma.ipAddress.deleteMany({
                 where: { id: { in: data.ipIdsToRemove } }
             });
        }

        // 3. Allocate new IPs
        if (data.ipsToCreate.length > 0) {
             const reservations = await prisma.scopeReservation.findMany();
             
             await Promise.all(data.ipsToCreate.map(async ip => {
                 const ipLong = BigInt(ipToLong(ip.ipAddress));
                 for (const res of reservations.filter(r => r.vlanId === ip.vlanId)) {
                     if (ipLong >= res.start_long && ipLong <= res.end_long) {
                         throw new Error(`IP ${ip.ipAddress} falls within the reserved DHCP scope: ${res.start_ip} - ${res.end_ip}`);
                     }
                 }

                 const existing = await prisma.ipAddress.findUnique({ where: { ip_address: ip.ipAddress } });
                 if (existing && existing.deviceId && existing.deviceId !== device.id) {
                     throw new Error(`IP ${ip.ipAddress} is already assigned to another device`);
                 }
                 return prisma.ipAddress.upsert({
                     where: { ip_address: ip.ipAddress },
                     update: { is_allocated: true, deviceId: device.id, description: `Allocated to ${device.name}`, vlanId: ip.vlanId, is_pingable: ip.isPingable ?? true },
                     create: { ip_address: ip.ipAddress, is_allocated: true, deviceId: device.id, vlanId: ip.vlanId, description: `Allocated to ${device.name}`, is_pingable: ip.isPingable ?? true }
                 });
             }));
        }

        // 4. Remove detached Credentials
        if (data.credentialIdsToRemove.length > 0) {
            await prisma.credential.deleteMany({
                where: { id: { in: data.credentialIdsToRemove } }
            });
        }

        // 5. Create new Credentials
        if (data.credentialsToCreate.length > 0) {
             await Promise.all(data.credentialsToCreate.map(cred =>
                 prisma.credential.create({
                     data: {
                         username: cred.username,
                         encrypted_password: cred.encryptedPassword,
                         desc: cred.desc,
                         deviceId: device.id
                     }
                 })
             ));
        }

        return device;
    } catch (error) {
        console.error("Failed to update Device:", error);
        throw new Error("Failed to update Device");
    }
}

export async function deleteDevice(id: string) {
    try {
        // Unallocate IPs (or delete them if they should only exist attached to device)
        await prisma.ipAddress.deleteMany({
            where: { deviceId: id }
        });

        // Delete Credentials
        await prisma.credential.deleteMany({
            where: { deviceId: id }
        });

        // Delete Device
        const deleted = await prisma.device.delete({
            where: { id }
        });
        await createAuditLog("DEVICE_DELETE", `Deleted device and associated records for ID: ${id}`);
        return deleted;
    } catch (error) {
        console.error("Failed to delete Device:", error);
        throw new Error("Failed to delete Device");
    }
}

// Metadata Settings Mutations
export async function createLocation(name: string) {
    if (!name) throw new Error("Name required");
    return await prisma.location.create({ data: { name } });
}

export async function deleteLocation(id: string) {
    return await prisma.location.delete({ where: { id } });
}

export async function createDeviceType(type: string, is_virtual: boolean) {
    if (!type) throw new Error("Type required");
    return await prisma.deviceType.create({ data: { type, is_virtual } });
}

export async function deleteDeviceType(id: string) {
    return await prisma.deviceType.delete({ where: { id } });
}

export async function createTag(name: string, color_hex: string) {
    if (!name) throw new Error("Name required");
    return await prisma.tag.create({ data: { name, color_hex: color_hex || '#4ade80' } });
}

export async function deleteTag(id: string) {
    return await prisma.tag.delete({ where: { id } });
}

// IP Utility functions for Reservations
function ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int: number): string {
    return [
        (int >>> 24) & 255,
        (int >>> 16) & 255,
        (int >>> 8) & 255,
        int & 255
    ].join('.');
}

export async function createIpReservation(startIp: string, endIp: string, vlanId: string, desc: string) {
    const start = ipToInt(startIp);
    const end = ipToInt(endIp);

    if (start > end) throw new Error("Start IP must be less than or equal to End IP");

    try {
        await prisma.scopeReservation.create({
            data: {
                start_ip: startIp,
                end_ip: endIp,
                start_long: BigInt(start),
                end_long: BigInt(end),
                description: desc || "Reserved DHCP Scope",
                vlanId: vlanId
            }
        });
        await createAuditLog("SCOPE_RESERVE", `Created lightweight scope reservation from ${startIp} to ${endIp} in VLAN ${vlanId}. Type: ${desc}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to create IP reservation", error);
        throw new Error("Failed to create reservation");
    }
}

// Audit Logs
export async function getAuditLogs() {
    try {
        return await prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 50 // Limit to recent 50 logs for performance
        });
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return [];
    }
}
