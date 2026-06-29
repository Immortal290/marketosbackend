import { Kafka } from 'kafkajs';
import { logger } from './logger';
import { io } from './socket';
import { AgentType } from '../modules/agents/types';

const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
const clientId = process.env.KAFKA_CLIENT_ID || 'marketos-backend';

export const kafka = new Kafka({
  clientId,
  brokers: [kafkaBroker],
});

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: 'marketos-group' });

export const connectKafka = async () => {
  try {
    await producer.connect();
    logger.info('Kafka producer connected');
    await consumer.connect();
    logger.info('Kafka consumer connected');

    // Subscribe to all agent topics
    const topics = Object.values(AgentType).map((type) => [
      `agent.${type.toLowerCase()}.responses`,
      `agent.${type.toLowerCase()}.events`,
    ]).flat();

    await consumer.subscribe({ topics, fromBeginning: false });
    logger.info(`Subscribed to ${topics.length} agent topics`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (message.value) {
          const payload = message.value.toString();
          logger.info(`Received message from ${topic}: ${payload}`);
          
          if (io) {
            io.emit('agentEvent', { topic, payload: JSON.parse(payload) });
          }
        }
      },
    });

  } catch (error) {
    logger.error('Failed to connect to Kafka:', error);
  }
};
