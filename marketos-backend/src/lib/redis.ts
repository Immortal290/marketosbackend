import Redis from 'ioredis';
import { logger } from './logger';

// Use lazyConnect so ioredis does NOT attempt a connection at import time.
// This prevents uncaught ECONNREFUSED errors from crashing the process before
// the HTTP server binds its port (which would kill Railway's healthcheck).
export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  lazyConnect: true,
  // Limit reconnect attempts so a missing Redis doesn't spam logs forever
  retryStrategy: (times) => {
    if (times > 5) {
      logger.warn('[Redis] Max reconnect attempts reached. Redis features will be unavailable.');
      return null; // Stop retrying
    }
    return Math.min(times * 500, 3000);
  },
});

redisClient.on('connect', () => {
  logger.info('[Redis] Connected');
});

redisClient.on('error', (err) => {
  // Log but never crash — Redis is non-fatal for the HTTP API
  logger.error('[Redis] Connection error (non-fatal):', err.message);
});
