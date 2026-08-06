import { Kafka } from 'kafkajs';
import { logger } from './logger';
import { io } from './socket';
import { redisClient } from './redis';

// ── Kafka broker — reads KAFKA_BROKER env var (set in Railway) ──────────────
const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
const clientId = process.env.KAFKA_CLIENT_ID || 'marketos-backend';

export const kafka = new Kafka({
  clientId,
  brokers: [kafkaBroker],
  retry: {
    retries: 5,
    initialRetryTime: 1000,
    maxRetryTime: 10000,
  },
});

export const producer = kafka.producer();

// ── Result consumer — subscribes to campaign completion events ───────────────
// Uses a NAMED, deliberate consumer group ID so messages are not dropped or
// duplicated on restart. This consumer runs persistently (consumer.run() is
// an infinite loop that never exits under normal operation).
export const resultConsumer = kafka.consumer({
  groupId: 'marketos-backend-results',
});

// ── Topics that the Python agents ACTUALLY produce to ───────────────────────
// Must match kafka_bus.py Topics class EXACTLY (case-sensitive).
const RESULT_TOPICS = [
  'campaign.events',            // Worker publishes campaign_completed / campaign_failed here
  'agent.supervisor.results',   // Supervisor agent result events
  'agent.dlq',                  // Dead-letter queue (failed tasks)
];

/**
 * Connects to Kafka broker. NON-FATAL — if no broker is available the HTTP
 * server continues running; only real-time event forwarding + result caching
 * is disabled.
 */
export const connectKafka = async (): Promise<void> => {
  if (!process.env.KAFKA_BROKER) {
    logger.warn('[Kafka] KAFKA_BROKER env not set — skipping Kafka connection. Real-time agent events disabled.');
    return;
  }

  try {
    // ── Producer ────────────────────────────────────────────────────────
    await producer.connect();
    logger.info(`[Kafka] Producer connected to ${kafkaBroker}`);

    // ── Result consumer ─────────────────────────────────────────────────
    await resultConsumer.connect();
    logger.info('[Kafka] Result consumer connected');

    await resultConsumer.subscribe({
      topics: RESULT_TOPICS,
      fromBeginning: false,
    });
    logger.info(`[Kafka] Result consumer subscribed to: ${RESULT_TOPICS.join(', ')}`);

    // ── Persistent consumer.run() — never exits ─────────────────────────
    await resultConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        const raw = message.value.toString();
        let envelope: any;

        try {
          envelope = JSON.parse(raw);
        } catch (parseErr) {
          logger.error(`[Kafka] JSON parse error on ${topic}: ${parseErr}`);
          return;
        }

        // Extract campaign_id from the envelope's payload
        const payload = envelope?.payload || envelope;
        const campaignId = payload?.campaign_id || payload?.campaignId || 'unknown';
        const event = payload?.event || 'unknown';
        const status = event === 'campaign_completed' ? 'completed'
                     : event === 'campaign_failed' ? 'failed'
                     : 'processing';

        logger.info(`[Kafka][RESULT CONSUMED] job_id=${campaignId} event=${event} topic=${topic} partition=${partition}`);

        // ── Write to Redis (fast cache, 1-hour TTL) ───────────────────
        try {
          const cachePayload = JSON.stringify({
            campaign_id: campaignId,
            status,
            event,
            payload,
            received_at: new Date().toISOString(),
          });
          await redisClient.set(`job:${campaignId}:result`, cachePayload, 'EX', 3600);
          logger.info(`[Kafka][REDIS WRITTEN] job_id=${campaignId} status=${status}`);
        } catch (redisErr) {
          logger.error(`[Kafka][REDIS WRITE FAILED] job_id=${campaignId}: ${redisErr}`);
        }

        // ── Forward to Socket.io (real-time push to frontend) ─────────
        if (io) {
          try {
            io.emit('agentEvent', { topic, campaignId, event, payload });
            logger.info(`[Kafka][SOCKET EMITTED] job_id=${campaignId} event=${event}`);
          } catch (socketErr) {
            logger.warn(`[Kafka][SOCKET EMIT FAILED] ${socketErr}`);
          }
        }
      },
    });

    logger.info('[Kafka] Result consumer running persistently — listening for campaign events...');

  } catch (error) {
    // Non-fatal: log and continue — the HTTP server will still start
    logger.error('[Kafka] Connection failed (non-fatal). Kafka-dependent features will be unavailable:', error);
  }
};
