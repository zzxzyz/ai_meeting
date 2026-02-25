import { app, BrowserWindow, clipboard, ipcMain, screen } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(800, height),
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false, // 窗口准备好后再显示
  });

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发环境加载 Vite 服务器,生产环境加载打包文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 初始化应用
app.whenReady().then(() => {
  // 注册 IPC 处理器
  registerIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 注册 IPC 处理器
function registerIpcHandlers() {
  // 获取应用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // 获取系统信息
  ipcMain.handle('get-system-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
    };
  });

  // 最小化窗口
  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize();
  });

  // 最大化/还原窗口
  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  // 关闭窗口
  ipcMain.handle('close-window', () => {
    mainWindow?.close();
  });

  // 复制文本到系统剪贴板（会议号复制功能）
  ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
    clipboard.writeText(text);
  });
}
