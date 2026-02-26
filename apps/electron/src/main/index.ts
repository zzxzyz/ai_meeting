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
      // 允许 WebRTC 媒体访问
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false, // 窗口准备好后再显示
  });

  // 设置权限请求处理器
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['camera', 'microphone', 'media'];

    if (allowedPermissions.includes(permission)) {
      callback(true); // 允许权限
    } else {
      callback(false); // 拒绝其他权限
    }
  });

  // 设置 CSP 策略以允许 WebRTC 媒体流
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: https:;",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
          "style-src 'self' 'unsafe-inline' https:;",
          "img-src 'self' data: https:;",
          "font-src 'self' data: https:;",
          "connect-src 'self' ws: wss: http: https:;",
          "media-src 'self' blob: data:;",
          "frame-src 'self';",
        ].join(' ')
      }
    });
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
if (typeof app !== 'undefined' && app.whenReady) {
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
}

// 注册 IPC 处理器
export function registerIpcHandlers() {
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

  // 音视频功能 - 获取媒体设备列表
  ipcMain.handle('get-media-devices', async () => {
    try {
      // 在 Electron 中，我们可以直接访问系统媒体设备
      // 这里返回模拟数据，实际实现需要调用系统 API
      return {
        audioInputs: [
          { deviceId: 'default', label: '默认麦克风', kind: 'audioinput' },
          { deviceId: 'mic1', label: '内置麦克风', kind: 'audioinput' }
        ],
        videoInputs: [
          { deviceId: 'default', label: '默认摄像头', kind: 'videoinput' },
          { deviceId: 'camera1', label: 'FaceTime HD Camera', kind: 'videoinput' }
        ],
        audioOutputs: [
          { deviceId: 'default', label: '默认扬声器', kind: 'audiooutput' },
          { deviceId: 'speaker1', label: '内置扬声器', kind: 'audiooutput' }
        ]
      };
    } catch (error) {
      console.error('获取媒体设备失败:', error);
      throw new Error('无法获取媒体设备列表');
    }
  });

  // 音视频功能 - 请求媒体权限
  ipcMain.handle('request-media-permission', async (_event, permissionType: 'camera' | 'microphone' | 'screen') => {
    try {
      // 在 Electron 中，权限请求通过 session.setPermissionRequestHandler 处理
      // 这里返回模拟的权限授予状态
      return { granted: true };
    } catch (error) {
      console.error(`请求 ${permissionType} 权限失败:`, error);
      return { granted: false };
    }
  });
}
