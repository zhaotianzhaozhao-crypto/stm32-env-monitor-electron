/**
 * 预加载脚本 — contextBridge 暴露 window.electronAPI
 *
 * 【做什么】在隔离环境下给渲染进程有限 IPC 能力（窗控 / MQTT / 配置）。
 * 【安全】nodeIntegration=false + sandbox；勿在此暴露任意 ipcRenderer 或 require。
 * 【改时注意】新增 API 须同步 electron/ipc.cjs 通道名；渲染侧只认 electronAPI.*。
 */
const { contextBridge, ipcRenderer } = require('electron');

function bindChannel(channel, wrap) {
  ipcRenderer.removeAllListeners(channel);
  const listener = wrap;
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),

  /** @param {string|{url?:string,sensorTopic?:string,commandTopic?:string}} urlOrOpts */
  connectBroker: (urlOrOpts) => {
    if (urlOrOpts && typeof urlOrOpts === 'object') {
      ipcRenderer.send('connect-mqtt', {
        url: urlOrOpts.url || '',
        sensorTopic: urlOrOpts.sensorTopic || '',
        commandTopic: urlOrOpts.commandTopic || '',
      });
    } else {
      ipcRenderer.send('connect-mqtt', { url: urlOrOpts || '' });
    }
  },
  disconnectBroker: () => ipcRenderer.send('disconnect-mqtt'),
  sendCommand: (cmd) => ipcRenderer.send('send-command', cmd),

  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setAllowedCommands: (list) => ipcRenderer.invoke('set-allowed-commands', list),

  onConnected: (cb) => bindChannel('mqtt-connected', (_e, url) => cb(url)),
  onMessage: (cb) => bindChannel('mqtt-message', (_e, payload) => cb(payload)),
  onError: (cb) => bindChannel('mqtt-error', (_e, err) => cb(err)),
  onReconnecting: (cb) => bindChannel('mqtt-reconnecting', () => cb()),
  onClosed: (cb) => bindChannel('mqtt-closed', () => cb()),
});
