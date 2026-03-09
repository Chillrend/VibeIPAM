# Zero-Knowledge DCIM and IPAM

This document outlines the architecture and implementation steps for building the Next.js DCIM application with zero-knowledge credential storage.

## Proposed Changes

### Database Integration (Stage 3)
Connect Prisma to the real PostgreSQL database and push the schema.
#### [MODIFY] `prisma.config.ts` & `.env`
- Configure `DATABASE_URL` with provided credentials (`10.23.9.10`).
#### [NEW] `lib/prisma.ts`
- Create a PrismaClient singleton instance for Next.js to avoid connection exhaustion in dev mode.
#### [NEW] Server Actions (`app/actions/*.ts`)
- Implement data fetching actions using Prisma for `Vlans`, `IpAddresses`, and `Devices`.
#### [MODIFY] UI Components (`app/dashboard/**/*.tsx`)
- Transition the `IpamPage` and `InventoryPage` from mock data to real data fetched via Server Actions.

### Deployment & Documentation (Stage 3)
Build and prepare the application for self-hosted containerized deployment.
#### [NEW] `Dockerfile`
- Multi-stage Next.js production build (`node:18-alpine`).
- Ensures `prisma generate` runs during build.
#### [NEW] `docker-compose.yml`
- Define the `web` service (Next.js app).
- Define the `db` service (PostgreSQL instance).
#### [MODIFY] `README.md`
- Add comprehensive setup instructions for local dev, Docker Compose deployment, and environment variables.

### Typography Polish (Stage 3)
Change the application font to Noto Sans.
#### [MODIFY] `app/layout.tsx`
- Replace `Inter` with `Noto_Sans` from `next/font/google`.
#### [MODIFY] `tailwind.config.ts`
- Ensure the default sans family uses `var(--font-noto-sans)`.

### Data Entry & Vault Verification (Stage 4)
Enable inserting new data and strictly validating the zero-knowledge master password.
#### [MODIFY] `prisma/schema.prisma`
- Add a new model `VaultConfig` to store an encrypted "canary" string. This string is encrypted by the client during the first-ever login and stored on the server.
#### [MODIFY] `components/UnlockScreen.tsx`
- Redesign the Unlock Screen to be visually stunning, using smooth transitions, blur effects, and premium layout aesthetics.
- Implement logic to check if the vault is initialized. If not, prompt the user to create a master password (encrypting the canary). If it is, require unlocking (decrypting the canary to verify correctness).
#### [MODIFY] `app/actions/db.ts`
- Add `createDevice`, `createVlan`, and `allocateIpAddress` server actions.
- Add `getVaultConfig` and `initializeVault` actions for the canary handling.
#### [MODIFY] `app/dashboard/inventory/page.tsx` & `app/dashboard/ipam/page.tsx`
- Add "Add New Device" and "Add VLAN" forms/dialogs utilizing the Server Actions.
- Ensure forms securely encrypt passwords on the client-side *before* passing them to the Server Actions.
#### [MODIFY] `README.md`
- Provide documentation explaining the First-Time Initialization phase and how the Master Password establishes the cryptographic canary.

## Verification Plan
### Automated Tests
- `npx prisma db push` to verify database connectivity and schema sync.
### Manual Verification
- Verify data is loading securely in the UI from the live database.
- Visually verify Noto Sans font implementation.

### Bug Fixes & Refinements (Stage 5)
#### [NEW] `lib/ip-utils.ts`
- Implement CIDR math utilities: parse CIDR to get network details, calculate total IPs, identify the first available IP (checking against allocated ones), and calculate available IP ranges (e.g., "10.0.0.1 - 10.0.0.50").
#### [MODIFY] `app/actions/db.ts`
- Modify `createVlan` to NOT pre-warm IPs in the database. Only save the VLAN itself.
- Add `createLocation`, `deleteLocation`, `createTag`, `createDeviceType` server actions.
- Update `getVlansWithIps` or create a new action if needed to ensure we only fetch allocated IPs.
#### [MODIFY] `app/dashboard/ipam/page.tsx`
- Fix hydration errors by replacing `<DropdownMenuTrigger asChild> <Button>` with standard elements.
- Redesign the "IP Allocations" view:
  - Display a list/grid of *Allocated* IPs.
  - Display calculated text showing *Available IP Ranges* (e.g., Available: `10.x.x.x - 10.x.x.y`).
- Make "First Available" calculate the first free IP based on the CIDR and allocated list, then redirect to Inventory with `?prefillIp=IP_STRING`.
#### [MODIFY] `app/dashboard/layout.tsx`
- Remove the "Settings" link or build a basic Settings page.
#### [NEW] `app/dashboard/settings/page.tsx`
- Implement basic CRUD tabs for Locations, Device Types, and Tags.
