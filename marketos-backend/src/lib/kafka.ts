import { Kafka } from 'kafkajs';
import { logger } from './logger';
import { io } from './socket';
import { AgentType } from '../modules/agents/types';

const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
const clientId = process.env.KAFKA_CLIENT_ID || 'marketos-backend';

export const kafka = new Kafka({
  clientId,
  brokers: [kafkaBroker],
  // Reduce retry aggressiveness so startup isn't blocked for minutes
  retry: {
    retries: 3,
    initialRetryTime: 300,
    maxRetryTime: 3000,
  },
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: 'marketos-group' });

/**
 * Connects to Kafka broker. This is NON-FATAL — if no broker is available
 * (e.g., Railway deployment without Kafka), the server continues running
 * and only real-time agent event forwarding is disabled.
 */
export const connectKafka = async (): Promise<void> => {
  if (!process.env.KAFKA_BROKER) {
    logger.warn('[Kafka] KAFKA_BROKER env not set — skipping Kafka connection. Real-time agent events disabled.');
    return;
  }

  try {
    await producer.connect();
    logger.info('[Kafka] Producer connected');
    await consumer.connect();
    logger.info('[Kafka] Consumer connected');

    // Subscribe to all agent topics
    const topics = Object.values(AgentType).map((type) => [
      `agent.${type.toLowerCase()}.responses`,
      `agent.${type.toLowerCase()}.events`,
    ]).flat();

    await consumer.subscribe({ topics, fromBeginning: false });
    logger.info(`[Kafka] Subscribed to ${topics.length} agent topics`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (message.value) {
          const payload = message.value.toString();
          logger.info(`[Kafka] Message from ${topic}: ${payload}`);

          if (io) {
            io.emit('agentEvent', { topic, payload: JSON.parse(payload) });
          }
        }
      },
    });

  } catch (error) {
    // Non-fatal: log and continue — the HTTP server will still start
    logger.error('[Kafka] Connection failed (non-fatal). Kafka-dependent features (agent event streaming) will be unavailable:', error);
  }
};
