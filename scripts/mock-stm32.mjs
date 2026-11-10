/**
 * 模拟 STM32/ESP8266（F411 环境监测屏字段 + 可选旧执行器字段）
 * 用法: node scripts/mock-stm32.mjs
 */
import mqtt from 'mqtt';

const URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const SENSOR_TOPIC = process.env.SENSOR_TOPIC || 'device/stm32/sensor_data';
const COMMAND_TOPIC = process.env.COMMAND_TOPIC || 'device/stm32/commands';
const INTERVAL = Number(process.env.SENSOR_INTERVAL_MS || 2000);

const client = mqtt.connect(URL, {
  clientId: `mock-stm32-${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  reconnectPeriod: 2000,
});

let tick = 0;
let timer = null;

const actuators = {
  buzzer: 0,
  fan: 0,
  breath: 0,
  skin: 'industrial-dark',
};

const VALID_SKINS = new Set([
  'industrial-dark',
  'mist-blue',
  'soft-home',
  'ops-cyan',
]);

function handleCommand(cmd) {
  if (cmd === 'buzzer:on') actuators.buzzer = 1;
  else if (cmd === 'buzzer:off') actuators.buzzer = 0;
  else if (cmd === 'fan:on') actuators.fan = 1;
  else if (cmd === 'fan:off') actuators.fan = 0;
  else if (cmd === 'breath:on') actuators.breath = 1;
  else if (cmd === 'breath:off') actuators.breath = 0;
  else if (cmd.startsWith('skin:')) {
    let id = cmd.slice(5);
    if (id === 'minimal-light') id = 'mist-blue';
    if (VALID_SKINS.has(id)) actuators.skin = id;
  }
}

client.on('connect', () => {
  console.log(`[mock-stm32] connected ${URL}`);
  client.subscribe(COMMAND_TOPIC, (err) => {
    if (err) console.error('[mock-stm32] subscribe failed', err);
    else console.log(`[mock-stm32] subscribed ${COMMAND_TOPIC}`);
  });
  timer = setInterval(publishSensor, INTERVAL);
  publishSensor();
});

client.on('message', (topic, buf) => {
  const raw = buf.toString();
  const cmd = raw.replace(/\r?\n$/, '');
  console.log(`[mock-stm32] CMD ← ${topic}: ${JSON.stringify(raw)}`);
  handleCommand(cmd);
});

client.on('error', (e) => console.error('[mock-stm32] error', e.message || e));
client.on('close', () => console.log('[mock-stm32] closed'));

function publishSensor() {
  tick += 1;
  const now = new Date();
  const temp = 24 + (tick % 12) * 0.7;
  const aqi = 30 + (tick % 40) * 3; // 覆盖优/良/轻度
  const payload = JSON.stringify({
    temp: Number(temp.toFixed(1)),
    humidity: 45 + (tick % 5),
    aqi,
    wifi: 3,
    battery: 76,
    weatherCond: tick % 4,
    weatherLow: 18,
    weatherHigh: 28,
    hour: now.getHours(),
    minute: now.getMinutes(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    // 旧执行器字段：桌面可解析但不在 F411 孪生页绘制开关
    buzzer: actuators.buzzer,
    fan: actuators.fan,
    breath: actuators.breath,
    skin: actuators.skin,
  });
  client.publish(SENSOR_TOPIC, payload, { qos: 0 });
  console.log(`[mock-stm32] SENSOR → ${payload}`);
}

const shutdown = () => {
  if (timer) clearInterval(timer);
  client.end(true, () => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
