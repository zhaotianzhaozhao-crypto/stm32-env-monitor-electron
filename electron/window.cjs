/**
 * 主窗口创建
 *
 * 【做什么】无边框透明固定尺寸窗；preload + contextIsolation + sandbox。
 * 【加载】开发：VITE_DEV_SERVER_URL；生产：dist/index.html。
 * 【改时注意】改尺寸/透明需同步 styles 圆角与拖拽区；勿开 nodeIntegration。
 */
const { BrowserWindow, app } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    title: '奶家人',
    // 任务栏 / Alt-Tab 图标（打包安装图标仍用 build/icon.ico）
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  return mainWindow;
}

module.exports = { createWindow };
