"use server";

import { prisma } from "@/lib/prisma";

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
                    },
                    orderBy: {
                        // Sort IPs logically
                        ip_address: 'asc'
                    }
                },
            },
            orderBy: {
                vlan_id: 'asc'
            }
        });
        return vlans;
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
                credential: {
                    select: {
                        id: true // Only select ID to know it exists, don't auto-fetch encrypted string until requested
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

export async function getDeviceCredential(deviceId: string) {
    try {
        const cred = await prisma.credential.findUnique({
            where: { deviceId }
        });
        return cred ? cred.encrypted_password : null;
    } catch (error) {
        console.error("Failed to fetch Credential:", error);
        return null;
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

        return vlan;
    } catch (error) {
        console.error("Failed to create VLAN:", error);
        throw new Error("Failed to create VLAN");
    }
}

export async function createDevice(data: {
    name: string; status: string; desc: string;
    locationId: string; deviceTypeId: string;
    tagIds: string[]; ipAddress?: string; vlanId?: string;
    encryptedPassword?: string; username?: string;
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

        // 2. Allocate IP if selected
        if (data.ipAddress && data.vlanId) {
            await prisma.ipAddress.create({
                data: {
                    ip_address: data.ipAddress,
                    is_allocated: true,
                    deviceId: device.id,
                    vlanId: data.vlanId,
                    description: `Allocated to ${device.name}`
                }
            });
        }

        // 3. Store Credential if provided
        if (data.encryptedPassword && data.username) {
            await prisma.credential.create({
                data: {
                    username: data.username,
                    encrypted_password: data.encryptedPassword,
                    deviceId: device.id
                }
            });
        }

        return device;
    } catch (error) {
        console.error("Failed to create Device:", error);
        throw new Error("Failed to create Device");
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
