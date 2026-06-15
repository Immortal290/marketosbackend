import { Queue, Worker, Job } from 'bullmq';
import { logger } from './logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const defaultQueue = new Queue('default', { connection });

export const defaultWorker = new Worker(
  'default',
  async (job: Job) => {
    logger.info(`Processing job ${job.id} of type ${job.name}`);
    // Job processing logic
  },
  { connection }
);

defaultWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} has completed!`);
});

defaultWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} has failed with ${err.message}`);
});
