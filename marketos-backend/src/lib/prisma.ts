import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // Warn instead of throw — a hard throw at import time crashes the server before
  // it binds its port, which kills Railway's healthcheck. The real connection
  // error will surface clearly when a DB query is attempted.
  console.error(
    '[Prisma] WARNING: DATABASE_URL environment variable is not set. ' +
    'Database queries will fail. Ensure DATABASE_URL is configured in Railway Variables.'
  );
}

// Create pool AFTER dotenv/config loads so DATABASE_URL is always a string
const pool = new Pool({ connectionString: DATABASE_URL || 'postgresql://localhost/marketos_placeholder' });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

