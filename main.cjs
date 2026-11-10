/**
 * Electron 入口（package.json "main"）
 *
 * 【做什么】app ready 后建窗、建 MQTT 管理器、注册 IPC；macOS activate 时空窗重建。
 * 【依赖】electron/window.cjs · mqtt-manager.cjs · ipc.cjs
 * 【改时注意】MQTT 与窗体生命周期绑在一起；勿在渲染进程直连 mqtt（安全/白名单在主进程）。
 */
const { app, BrowserWindow } = require('electron');
const { createWindow } = require('./electron/window.cjs');
const { createMqttManager } = require('./electron/mqtt-manager.cjs');
const { registerIpc } = require('./electron/ipc.cjs');

let mainWindow = null;

app.whenReady().then(() => {
  mainWindow = createWindow();
  const mqtt = createMqttManager(() => mainWindow);
  registerIpc(mqtt, () => mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
