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
  try {
    // Connect to Postgres via Prisma
    await prisma.$connect();
    logger.info('Connected to PostgreSQL via Prisma');

    // Connect to Kafka
    await connectKafka();

    // Setup Socket.io
    initSocket(server);

    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
