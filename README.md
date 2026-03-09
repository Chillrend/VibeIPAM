# Zero-Knowledge DCIM and IPAM

A lightweight, secure Data Center Infrastructure Management and IP Address Management dashboard. Features zero-knowledge client-side encryption for infrastructure credentials using the Web Crypto API.

## Core Features
- IPAM Module: Visual grid of VLAN allocations.
- Inventory Dashboard: Server tracking with secure credential retrieval.
- Zero-Knowledge Security: Master password never leaves your browser; all secrets decrypted locally via AES-GCM.

## Local Development Setup

### 1. Requirements
- Node.js 18+
- PostgreSQL Database

### 2. Environment Configuration
Create a `.env` file at the root of the project with your database credentials:
```env
DATABASE_HOST=10.23.9.10
DATABASE_USERNAME=your_db_user
DATABASE_PASSWORD=your_db_password
DATABASE_NAME=ipam_dev
DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:5432/${DATABASE_NAME}?schema=public"
```

### 3. Install & Run
```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Docker Compose Deployment (Self-Hosting)

The project includes a `Dockerfile` and `docker-compose.yml` for quick containerized deployment.

1. Configure your `.env` file as shown above.
2. Build and start the containers in detached mode:
```bash
docker-compose up -d --build
```
3. Access the dashboard at `http://localhost:3000`.

*Note: The docker-compose file optionally spins up its own PostgreSQL instance if you do not have an external one configured, simply adjust the environment strings accordingly.*

## First-Time Initialization & Vault Security

Upon spinning up the application successfully for the first time, you will be met with the **Initialize Vault** screen.

1. **Create Master Password**: You must set a strong Master Password. This password serves as the root entropy for deriving an AES-GCM symmetric encryption key locally in your browser (using the Web Crypto API).
2. **The Canary**: When initialized, the dashboard encrypts a static "VAULT_READY" canary payload and stores it in the database.
3. **Future Logins**: On subsequent visits, your entered password derives the key and attempts to decrypt the canary string. If the decryption succeeds, your password is correct, and access to zero-knowledge infrastructure credentials is unlocked. At no point does the clear-text password ever leave your device.
