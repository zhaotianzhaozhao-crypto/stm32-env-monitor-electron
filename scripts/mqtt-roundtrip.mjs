/**
 * 指令主题往返冒烟：向 commands 发 fan:on\\n，确认订阅端收到。
 * 用法: node scripts/mqtt-roundtrip.mjs
 * 需已启动 mock-broker；可选同时跑 mock-stm32。
 */
import mqtt from 'mqtt';

const URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const COMMAND_TOPIC = process.env.COMMAND_TOPIC || 'device/stm32/commands';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 5000);

const pub = mqtt.connect(URL, { clientId: `rt-pub-${Date.now()}`, clean: true });
const sub = mqtt.connect(URL, { clientId: `rt-sub-${Date.now()}`, clean: true });

let done = false;
const fail = (msg) => {
  console.error('[roundtrip] FAIL:', msg);
  cleanup(1);
};
const ok = (msg) => {
  console.log('[roundtrip] PASS:', msg);
  cleanup(0);
};

function cleanup(code) {
  if (done) return;
  done = true;
  try { pub.end(true); } catch {}
  try { sub.end(true); } catch {}
  setTimeout(() => process.exit(code), 100);
}

const timer = setTimeout(() => fail(`timeout ${TIMEOUT_MS}ms waiting for fan:on`), TIMEOUT_MS);

sub.on('connect', () => {
  sub.subscribe(COMMAND_TOPIC, (err) => {
    if (err) return fail(String(err));
    // 等订阅生效再发
    setTimeout(() => {
      pub.publish(COMMAND_TOPIC, 'fan:on\n', { qos: 0 }, (e) => {
        if (e) fail(String(e));
        else console.log('[roundtrip] published fan:on\\n');
      });
    }, 200);
  });
});

sub.on('message', (_t, buf) => {
  const raw = buf.toString();
  const cmd = raw.replace(/\r?\n$/, '');
  console.log(`[roundtrip] received: ${JSON.stringify(raw)}`);
  if (cmd === 'fan:on' && raw.endsWith('\n')) {
    clearTimeout(timer);
    ok('received fan:on with trailing newline');
  } else if (cmd === 'fan:on') {
    clearTimeout(timer);
    // 仍算通过，但提醒缺 \\n
    console.warn('[roundtrip] WARN: fan:on without trailing \\n');
    ok('received fan:on (newline missing — check publisher)');
  }
});

pub.on('error', (e) => fail(e.message || e));
sub.on('error', (e) => fail(e.message || e));
