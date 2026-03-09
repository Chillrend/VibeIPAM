# DCIM & IPAM Project Tasks

## Stage 1: Backend & Security Foundations (Completed)
- [x] Initialize Prisma (`npx prisma init`) and configure PostgreSQL connection
- [x] Define Prisma Schema models: Location, DeviceType, Tag, Device, Vlan, IpAddress, Credential, AuditLog
- [x] Implement Web Crypto API utility functions (AES-GCM encryption/decryption)
- [x] Implement IndexedDB key storage logic for the non-extractable CryptoKey
- [x] Setup strict Content Security Policy (CSP) in `next.config.js`
- [x] Create Next.js API route stubs (`/api/sync/proxmox`, `/api/sync/esxi`)

## Stage 2: UI & Frontend Development (Completed)
- [x] Initialize `shadcn/ui` components
- [x] Build the "Unlock Screen" to accept the Master Password and derive the CryptoKey
- [x] Build IPAM Module (Vlan selection, IP grid, "first available IP" logic)
- [x] Build Inventory Dashboard (Device list, IP association, "Reveal Password" functionality)

## Stage 3: Database Integration & Polish (Pending Execution)
- [x] Connect Prisma to the real PostgreSQL database and push schema
- [x] Create Dockerfile and docker-compose.yml for self-hosting
- [x] Update README.md with comprehensive setup guide
- [x] Implement Server Actions/API routes to replace mock data in UI
- [x] Change application font from Inter to Noto Sans

## Stage 4: Data Entry & Vault Verification (Completed)
- [x] Update Prisma schema to add `VaultConfig` table for canary string
- [x] Implement Server Actions for Creating Devices, VLANs, and IP Allocations
- [x] Add creation forms/dialogs in the Inventory and IPAM UIs
- [x] Revamp `UnlockScreen.tsx` with premium design
- [x] Implement first-time vault setup vs unlock detection
- [x] Implement correct master password validation via encrypted canary
- [x] Update README.md with first-time setup docs

## Stage 5: Bug Fixes & Refinements (Pending Approval)
- [x] Create `lib/ip-utils.ts` for CIDR math and range calculations
- [x] Remove IP pre-warming logic from `createVlan` action
- [x] Fix Hydration Error in `<DropdownMenuTrigger>` on IPAM page
- [x] Redesign IPAM UI to show Allocated IPs and calculated Available Ranges
- [x] Connect "First Available" button to dynamically calculate free IP and redirect
- [x] Add `app/dashboard/settings/page.tsx` for Location, Tag, and Type CRUD
