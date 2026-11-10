/**
 * IPC 注册 — 渲染进程 ↔ 主进程
 *
 * 【通道】
 *   send: minimize-window / close-window / connect-mqtt / disconnect-mqtt / send-command
 *   invoke: get-app-config / set-allowed-commands
 * 【MQTT 白名单】send-command → mqtt.sendCommand → isAllowedCommand；未授权直接拒绝。
 */
const { ipcMain } = require('electron');
const { defaults, APP_MODE, BROKER_URL, SENSOR_TOPIC, COMMAND_TOPIC, ALLOWED_COMMANDS, setAllowedCommands } = require('./config.cjs');

function registerIpc(mqtt, getWindow) {
  for (const ch of ['minimize-window', 'close-window', 'connect-mqtt', 'disconnect-mqtt', 'send-command']) {
    ipcMain.removeAllListeners(ch);
  }
  ipcMain.removeHandler('get-app-config');
  ipcMain.removeHandler('set-allowed-commands');

  ipcMain.on('minimize-window', () => getWindow()?.minimize());
  ipcMain.on('close-window', () => getWindow()?.close());

  ipcMain.on('connect-mqtt', (_event, payload) => mqtt.connect(payload));
  ipcMain.on('disconnect-mqtt', () => mqtt.disconnect());
  ipcMain.on('send-command', (_event, cmd) => mqtt.sendCommand(cmd));

  ipcMain.handle('get-app-config', () => ({
    productName: defaults.productName || '奶家人',
    version: defaults.version || '1.3.10',
    mode: APP_MODE,
    brokerUrl: BROKER_URL,
    topics: {
      sensor: defaults.topics?.sensor || SENSOR_TOPIC,
      command: defaults.topics?.command || COMMAND_TOPIC,
    },
    allowedCommands: Array.from(ALLOWED_COMMANDS || []), // 可被 set-allowed-commands 热更新
    skins: defaults.skins || [],
    scenes: defaults.scenes || [],
    thresholds: defaults.thresholds,
    demoNotice: APP_MODE === 'demo'
      ? '当前为演示模式：公网 Broker 仅供联调，不可用于生产。'
      : null,
    canEditBroker: APP_MODE === 'demo',
  }));

  ipcMain.handle('set-allowed-commands', (_e, list) => {
    const next = setAllowedCommands(list);
    return { ok: true, allowedCommands: next };
  });

}

module.exports = { registerIpc };
