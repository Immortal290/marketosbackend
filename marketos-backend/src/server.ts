import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { execSync } from 'child_process';
import app from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { connectKafka } from './lib/kafka';
import { initSocket } from './lib/socket';

const PORT = process.env.PORT || 3000;
const server = createServer(app);

const startServer = async () => {
  // ── Step 1: Bind the port FIRST so Railway healthcheck can pass ──────────
  // Railway's healthcheck fires seconds after deploy starts. Blocking on
  // migrations or DB connections before listen() means the healthcheck
  // always times out. We open the port immediately — /health responds at once.
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`[Server] Listening on port ${PORT}`);
      resolve();
    });
  });

  // Setup Socket.io (requires server to be listening first)
  initSocket(server);

  // ── Step 2: Run DB migrations (port already open — healthcheck passes) ───
  // Migrations run AFTER the port is bound so the healthcheck succeeds while
  // migrations are applying. Any pending migrations complete before Prisma
  // opens its connection pool.
  try {
    logger.info('[DB] Running prisma migrate deploy…');
    execSync('node node_modules/.bin/prisma migrate deploy', { stdio: 'inherit' });
    logger.info('[DB] Migrations applied successfully');
  } catch (err) {
    logger.error('[DB] Migration failed (non-fatal — DB may already be up to date):', err);
  }

  // ── Step 3: Connect Prisma after migrations complete ─────────────────────
  try {
    await prisma.$connect();
    logger.info('[DB] Connected to PostgreSQL via Prisma');
  } catch (error) {
    logger.error('[DB] Failed to connect to PostgreSQL:', error);
  }

  // ── Step 4: Kafka (fully optional — skipped if KAFKA_BROKER is unset) ────
  connectKafka().catch((err) => {
    logger.error('[Kafka] Unexpected error during connection:', err);
  });

  logger.info('[Server] MarketOS backend fully initialised.');
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[Shutdown] SIGTERM received — closing server…');
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('[Shutdown] Server closed. Goodbye.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  logger.error('[UnhandledRejection]', reason);
});

startServer().catch((err) => {
  logger.error('[Server] Fatal startup error:', err);
  process.exit(1);
});

