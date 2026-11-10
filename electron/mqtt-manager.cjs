/**
 * MQTT 管理器（主进程唯一连接点）
 *
 * 【做什么】校验 Broker/Topic → connect/subscribe 上行主题；下发指令前白名单校验并追加 \n。
 * 【安全】validateBrokerUrl（主机/协议/TLS）；validateTopic；isAllowedCommand（buzzer/breath/fan/skin…）。
 * 【改时注意】
 *   - 指令必须以 \n 结尾（硬件串口缓冲约定）；勿改 qos 除非固件同步。
 *   - 新增指令：defaults.json allowedCommands + 固件解析 + 前端 ALLOWED_COMMANDS 预检。
 *   - breath:bri / breath:color 故意不在白名单（HC-05 前仅孪生）。
 *   - 上下行 Topic 可由渲染进程在 connect 时覆盖，缺省用 defaults.json。
 */
const mqtt = require('mqtt');
const {
  BROKER_URL,
  SENSOR_TOPIC,
  COMMAND_TOPIC,
  validateBrokerUrl,
  validateTopic,
  normalizeCommand,
  isAllowedCommand,
  APP_MODE,
} = require('./config.cjs');

function createMqttManager(getWindow) {
  let mqttClient = null;
  let activeBroker = BROKER_URL;
  let activeSensorTopic = SENSOR_TOPIC;
  let activeCommandTopic = COMMAND_TOPIC;
  /** 同一次 connect 尝试只向渲染进程报一次错误，避免 error+重连刷屏 */
  let errorEmitted = false;

  const emit = (channel, ...args) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  };

  const emitErrorOnce = (msg) => {
    if (errorEmitted) return;
    errorEmitted = true;
    emit('mqtt-error', msg);
  };

  /** 兼容旧调用：connect(urlString) 或 connect({ url, sensorTopic, commandTopic }) */
  const normalizeConnectArgs = (arg) => {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      return {
        url: arg.url,
        sensorTopic: arg.sensorTopic,
        commandTopic: arg.commandTopic,
      };
    }
    return { url: arg, sensorTopic: undefined, commandTopic: undefined };
  };

  return {
    connect(arg) {
      const opts = normalizeConnectArgs(arg);
      const nextUrl = (opts.url && String(opts.url).trim()) || BROKER_URL;
      const nextSensor = (opts.sensorTopic && String(opts.sensorTopic).trim()) || SENSOR_TOPIC;
      const nextCommand = (opts.commandTopic && String(opts.commandTopic).trim()) || COMMAND_TOPIC;

      if (
        mqttClient &&
        mqttClient.connected &&
        activeBroker === nextUrl &&
        activeSensorTopic === nextSensor &&
        activeCommandTopic === nextCommand
      ) {
        emit('mqtt-connected', {
          url: activeBroker,
          sensorTopic: activeSensorTopic,
          commandTopic: activeCommandTopic,
        });
        return;
      }

      if (mqttClient) {
        try {
          mqttClient.options.reconnectPeriod = 0;
          mqttClient.end(true);
        } catch (_) {}
        mqttClient = null;
      }

      errorEmitted = false;
      const candidate =
        (opts.url && String(opts.url).trim()) || BROKER_URL;
      const check = validateBrokerUrl(candidate);
      if (!check.ok) {
        emitErrorOnce(`[安全] ${check.reason}（模式=${APP_MODE}）`);
        return;
      }

      const sensorCheck = validateTopic(
        (opts.sensorTopic && String(opts.sensorTopic).trim()) || SENSOR_TOPIC,
        '上行 Topic',
      );
      if (!sensorCheck.ok) {
        emitErrorOnce(`[安全] ${sensorCheck.reason}`);
        return;
      }

      const commandCheck = validateTopic(
        (opts.commandTopic && String(opts.commandTopic).trim()) || COMMAND_TOPIC,
        '下行 Topic',
      );
      if (!commandCheck.ok) {
        emitErrorOnce(`[安全] ${commandCheck.reason}`);
        return;
      }

      activeBroker = check.url;
      activeSensorTopic = sensorCheck.topic;
      activeCommandTopic = commandCheck.topic;

      mqttClient = mqtt.connect(activeBroker, {
        keepalive: 60,
        // 连接失败不自动狂重试（用户再点「接入云端」）；已连上后断线再开短重连
        reconnectPeriod: 0,
        clean: true,
      });

      mqttClient.on('connect', () => {
        errorEmitted = false;
        // 已接通后允许短周期重连，避免短暂抖动掉线
        try { mqttClient.options.reconnectPeriod = 3000; } catch (_) {}
        emit('mqtt-connected', {
          url: activeBroker,
          sensorTopic: activeSensorTopic,
          commandTopic: activeCommandTopic,
        });
        mqttClient.subscribe(activeSensorTopic, (err) => {
          if (err) emitErrorOnce(`订阅失败: ${err.message}`);
        });
      });
      mqttClient.on('message', (_topic, message) => {
        emit('mqtt-message', message.toString());
      });
      mqttClient.on('reconnect', () => emit('mqtt-reconnecting'));
      mqttClient.on('error', (err) => {
        emitErrorOnce(err && err.message ? err.message : String(err || '未知错误'));
        // 首次失败后结束客户端，避免底层反复 error
        try {
          if (mqttClient && !mqttClient.connected) {
            mqttClient.end(true);
            mqttClient = null;
          }
        } catch (_) {}
      });
      mqttClient.on('close', () => emit('mqtt-closed'));
    },

    disconnect() {
      if (mqttClient) {
        try { mqttClient.options.reconnectPeriod = 0; } catch (_) {}
        mqttClient.end(true);
        mqttClient = null;
      }
    },

    sendCommand(cmd) {
      const normalized = normalizeCommand(cmd);
      if (!isAllowedCommand(normalized)) {
        emit('mqtt-error', `[安全] 拒绝未授权指令: ${normalized || '(空)'}`);
        console.warn('[mqtt] blocked command:', normalized);
        return false;
      }
      if (mqttClient && mqttClient.connected) {
        // 硬件串口缓冲到 \n 才执行；白名单：buzzer/fan/breath/skin（fan/breath 固件未接则无效）
        mqttClient.publish(activeCommandTopic, normalized + '\n', { qos: 0 });
        return true;
      }
      emit('mqtt-error', 'MQTT 未连接，无法下发指令');
      return false;
    },
  };
}

module.exports = { createMqttManager };
