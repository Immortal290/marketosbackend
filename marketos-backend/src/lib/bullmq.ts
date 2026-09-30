import { Queue, Worker, Job } from 'bullmq';
import { logger } from './logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  // lazyConnect prevents connection attempts at module load time
  enableOfflineQueue: false,
};

// Lazily initialised — avoids top-level Redis connections that crash the
// process before the HTTP server binds its port (would fail Railway healthcheck).
let _defaultQueue: Queue | null = null;
let _defaultWorker: Worker | null = null;

export function getDefaultQueue(): Queue {
  if (!_defaultQueue) {
    _defaultQueue = new Queue('default', { connection });
  }
  return _defaultQueue;
}

export function getDefaultWorker(): Worker {
  if (!_defaultWorker) {
    _defaultWorker = new Worker(
      'default',
      async (job: Job) => {
        logger.info(`Processing job ${job.id} of type ${job.name}`);
        // Job processing logic
      },
      { connection }
    );

    _defaultWorker.on('completed', (job) => {
      logger.info(`Job ${job.id} has completed!`);
    });

    _defaultWorker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} has failed with ${err.message}`);
    });
  }
  return _defaultWorker;
}

/** @deprecated Use getDefaultQueue() instead */
export const defaultQueue = { add: (...args: any[]) => getDefaultQueue().add(...args as [any, any, any]) };
/** @deprecated Use getDefaultWorker() instead */
export const defaultWorker = { on: () => {} };
