import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import app from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { connectKafka } from './lib/kafka';
import { initSocket } from './lib/socket';

const execAsync = promisify(exec);
const PORT = process.env.PORT || 3000;
const server = createServer(app);

const startServer = async () => {
  // ── Step 1: Bind port FIRST — event loop stays live for healthcheck ───────
  // execSync would block the event loop even after listen(), preventing
  // Railway's healthcheck from getting a response. We use exec (async) instead.
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`[Server] Listening on port ${PORT}`);
      resolve();
    });
  });

  // Setup Socket.io (requires server to be listening first)
  initSocket(server);

  // ── Step 2: Run DB migrations async (event loop stays live) ──────────────
  // Using exec (not execSync) keeps Node.js I/O active so /health responds
  // while migrations run in a child process.
  try {
    logger.info('[DB] Running prisma migrate deploy…');
    const res = await execAsync('npx prisma migrate deploy --schema=./prisma/schema.prisma').catch((err) => ({ stdout: '', stderr: String(err) }));
    if (res.stdout) logger.info('[DB] Migrations:', res.stdout.trim());
    if (res.stderr) logger.warn('[DB] Migration stderr:', res.stderr.trim());
    logger.info('[DB] Migrations step finished.');
  } catch (err) {
    logger.warn('[DB] Migration skipped/failed (continuing):', err);
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


