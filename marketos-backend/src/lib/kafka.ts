import { Kafka } from 'kafkajs';
import { logger } from './logger';

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
  } catch (error) {
    logger.error('Failed to connect to Kafka:', error);
  }
};
