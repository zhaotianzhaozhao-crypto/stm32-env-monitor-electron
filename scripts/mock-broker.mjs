/**
 * 本地 MQTT Broker（aedes v1 createBroker）— 云电脑联调用
 * 默认监听 1883；无 mosquitto/docker 时用此脚本。
 *
 * 用法: node scripts/mock-broker.mjs
 * 或:   npm run mock:broker
 */
import { createServer } from 'node:net';
import { Aedes } from 'aedes';

const PORT = Number(process.env.MQTT_PORT || 1883);
const broker = await Aedes.createBroker();
const server = createServer(broker.handle);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mock-broker] aedes listening on mqtt://127.0.0.1:${PORT}`);
});

broker.on('client', (c) => {
  console.log(`[mock-broker] client connected: ${c.id}`);
});
broker.on('clientDisconnect', (c) => {
  console.log(`[mock-broker] client disconnect: ${c.id}`);
});
broker.on('publish', (packet, client) => {
  if (!client) return;
  const topic = packet.topic;
  const payload = packet.payload?.toString?.() || '';
  if (topic.startsWith('$SYS')) return;
  console.log(`[mock-broker] publish ${client.id} → ${topic}: ${JSON.stringify(payload)}`);
});

const shutdown = () => {
  console.log('[mock-broker] shutting down…');
  try { broker.close(() => {}); } catch {}
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
