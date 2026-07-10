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
    const { stdout, stderr } = await execAsync('node node_modules/.bin/prisma migrate deploy');
    if (stdout) logger.info('[DB] Migrations:', stdout.trim());
    if (stderr) logger.warn('[DB] Migration stderr:', stderr.trim());
    logger.info('[DB] Migrations applied successfully');
  } catch (err) {
    logger.error('[DB] Migration failed (continuing — DB may already be up to date):', err);
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


