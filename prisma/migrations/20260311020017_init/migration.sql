-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceType" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_virtual" BOOLEAN NOT NULL,

    CONSTRAINT "DeviceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "deviceTypeId" TEXT NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vlan" (
    "id" TEXT NOT NULL,
    "vlan_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cidr_block" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Vlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeReservation" (
    "id" TEXT NOT NULL,
    "start_ip" TEXT NOT NULL,
    "end_ip" TEXT NOT NULL,
    "start_long" BIGINT NOT NULL,
    "end_long" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "vlanId" TEXT NOT NULL,

    CONSTRAINT "ScopeReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "is_allocated" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "is_pingable" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "last_seen" TIMESTAMP(3),
    "vlanId" TEXT NOT NULL,
    "deviceId" TEXT,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "desc" TEXT,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encrypted_canary" TEXT NOT NULL,

    CONSTRAINT "VaultConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeviceToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DeviceToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_name_key" ON "Device"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_ip_address_key" ON "IpAddress"("ip_address");

-- CreateIndex
CREATE INDEX "_DeviceToTag_B_index" ON "_DeviceToTag"("B");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_deviceTypeId_fkey" FOREIGN KEY ("deviceTypeId") REFERENCES "DeviceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeReservation" ADD CONSTRAINT "ScopeReservation_vlanId_fkey" FOREIGN KEY ("vlanId") REFERENCES "Vlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_vlanId_fkey" FOREIGN KEY ("vlanId") REFERENCES "Vlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceToTag" ADD CONSTRAINT "_DeviceToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeviceToTag" ADD CONSTRAINT "_DeviceToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
