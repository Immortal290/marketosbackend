const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'test-agent',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'test-agent-group' });

async function run() {
  console.log('Connecting to Kafka broker at localhost:9092...');
  await consumer.connect();
  console.log('Connected to Kafka.');

  const topic = 'agent.copy.commands';
  await consumer.subscribe({ topic, fromBeginning: false });
  console.log(`Subscribed to topic: ${topic}`);
  console.log('Waiting for command messages from the backend...');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      console.log('\n========================================');
      console.log('🤖 [AI AGENT RECEIVED OPERATIONAL COMMAND]');
      console.log(`Topic:       ${topic}`);
      console.log(`Payload:     ${value}`);
      console.log('========================================\n');
    },
  });
}

run().catch(err => {
  console.error('Error running test agent:', err);
  process.exit(1);
});
