import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { connectKafka } from './lib/kafka';
import { initSocket } from './lib/socket';

const PORT = process.env.PORT || 3000;
const server = createServer(app);

const startServer = async () => {
  // ── Step 1: Bind the port FIRST so Railway healthcheck can pass ──────────
  // Railway sends a healthcheck to /health shortly after deploy. If we block
  // on DB migrations before listening, the healthcheck fails and the deploy
  // is marked as failed. We start listening immediately, then connect to
  // backing services in the background.
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`Server is listening on port ${PORT}`);
      resolve();
    });
  });

  // Setup Socket.io (requires server to be listening)
  initSocket(server);

  // ── Step 2: Connect to backing services (non-blocking for healthcheck) ───
  try {
    await prisma.$connect();
    logger.info('[DB] Connected to PostgreSQL via Prisma');
  } catch (error) {
    logger.error('[DB] Failed to connect to PostgreSQL:', error);
    // Non-fatal during startup: requests that need DB will fail gracefully.
    // If DB is permanently down, Railway will restart the container.
  }

  // Kafka is optional — connectKafka() already handles missing KAFKA_BROKER
  connectKafka().catch((err) => {
    logger.error('[Kafka] Unexpected error during connection:', err);
  });

  logger.info('MarketOS backend fully initialised.');
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
  logger.error('Fatal startup error:', err);
  process.exit(1);
});

