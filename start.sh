#!/bin/sh
echo "Running Prisma migrations..."
npx --yes prisma migrate deploy

echo "Starting Next.js server..."
exec node server.js
