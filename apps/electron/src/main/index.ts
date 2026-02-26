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
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
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

  // REQ-004 音视频控制功能
  // 音频控制
  ipcMain.handle('toggle-audio', async (_event, muted: boolean) => {
    try {
      console.log(`音频控制: ${muted ? '静音' : '取消静音'}`);
      // 这里将调用 WebSocket 发送信令给服务端
      return { success: true };
    } catch (error) {
      console.error('音频控制失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle('set-audio-muted', async (_event, muted: boolean) => {
    try {
      console.log(`设置音频静音状态: ${muted}`);
      return { success: true };
    } catch (error) {
      console.error('设置音频静音状态失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 视频控制
  ipcMain.handle('toggle-video', async (_event, enabled: boolean) => {
    try {
      console.log(`视频控制: ${enabled ? '开启' : '关闭'}`);
      // 这里将调用 WebSocket 发送信令给服务端
      return { success: true };
    } catch (error) {
      console.error('视频控制失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle('set-video-enabled', async (_event, enabled: boolean) => {
    try {
      console.log(`设置视频启用状态: ${enabled}`);
      return { success: true };
    } catch (error) {
      console.error('设置视频启用状态失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 设备切换
  ipcMain.handle('switch-audio-device', async (_event, deviceId: string) => {
    try {
      console.log(`切换音频设备: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error('切换音频设备失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle('switch-video-device', async (_event, deviceId: string) => {
    try {
      console.log(`切换视频设备: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error('切换视频设备失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 状态同步
  ipcMain.handle('sync-media-state', async () => {
    try {
      console.log('同步媒体状态');
      return {
        audioMuted: false,
        videoEnabled: true,
        audioDeviceId: 'default',
        videoDeviceId: 'default'
      };
    } catch (error) {
      console.error('同步媒体状态失败:', error);
      throw new Error('无法同步媒体状态');
    }
  });

  // REQ-002 会议管理功能
  // 创建会议
  ipcMain.handle('create-meeting', async (_event, data?: { title?: string }) => {
    try {
      const meetingData = data || {};
      console.log(`创建会议: ${meetingData.title || '无标题'}`);
      // 模拟创建会议响应
      return {
        id: 'meeting-uuid-001',
        meetingNumber: '123456789',
        title: meetingData.title || '测试会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-uuid-001',
        startedAt: new Date().toISOString(),
        endedAt: null,
        participantCount: 1,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('创建会议失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 加入会议
  ipcMain.handle('join-meeting', async (_event, data: { meetingNumber: string }) => {
    try {
      console.log(`加入会议: ${data.meetingNumber}`);
      // 模拟加入会议响应
      return {
        id: 'meeting-uuid-001',
        meetingNumber: data.meetingNumber,
        title: '产品评审会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-uuid-001',
        startedAt: '2026-02-26T10:00:00.000Z',
        endedAt: null,
        participantCount: 2,
        createdAt: '2026-02-26T10:00:00.000Z',
        durationSeconds: 1800,
        participants: [
          {
            userId: 'user-uuid-001',
            nickname: '张三',
            isCreator: true,
            joinedAt: '2026-02-26T10:00:00.000Z'
          },
          {
            userId: 'user-uuid-002',
            nickname: '李四',
            isCreator: false,
            joinedAt: '2026-02-26T10:05:00.000Z'
          }
        ]
      };
    } catch (error) {
      console.error('加入会议失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 查询会议列表
  ipcMain.handle('get-meetings', async (_event, params?: {
    type?: 'created' | 'joined';
    page?: number;
    pageSize?: number;
  }) => {
    try {
      console.log(`查询会议列表: type=${params?.type}, page=${params?.page}, pageSize=${params?.pageSize}`);
      // 模拟会议列表响应
      return {
        items: [
          {
            id: 'meeting-uuid-001',
            meetingNumber: '123456789',
            title: '产品评审会议',
            status: 'IN_PROGRESS',
            creatorId: 'user-uuid-001',
            startedAt: '2026-02-26T10:00:00.000Z',
            endedAt: null,
            participantCount: 3,
            createdAt: '2026-02-26T10:00:00.000Z'
          },
          {
            id: 'meeting-uuid-002',
            meetingNumber: '987654321',
            title: '技术分享会',
            status: 'ENDED',
            creatorId: 'user-uuid-002',
            startedAt: '2026-02-25T14:00:00.000Z',
            endedAt: '2026-02-25T16:00:00.000Z',
            participantCount: 5,
            createdAt: '2026-02-25T13:30:00.000Z'
          }
        ],
        total: 2,
        page: params?.page || 1,
        pageSize: params?.pageSize || 10
      };
    } catch (error) {
      console.error('查询会议列表失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 查询会议详情
  ipcMain.handle('get-meeting-by-id', async (_event, meetingId: string) => {
    try {
      console.log(`查询会议详情: ${meetingId}`);
      // 模拟会议详情响应
      return {
        id: meetingId,
        meetingNumber: '123456789',
        title: '产品评审会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-uuid-001',
        startedAt: '2026-02-26T10:00:00.000Z',
        endedAt: null,
        participantCount: 3,
        createdAt: '2026-02-26T10:00:00.000Z',
        durationSeconds: 1800,
        participants: [
          {
            userId: 'user-uuid-001',
            nickname: '张三',
            isCreator: true,
            joinedAt: '2026-02-26T10:00:00.000Z'
          },
          {
            userId: 'user-uuid-002',
            nickname: '李四',
            isCreator: false,
            joinedAt: '2026-02-26T10:05:00.000Z'
          },
          {
            userId: 'user-uuid-003',
            nickname: '王五',
            isCreator: false,
            joinedAt: '2026-02-26T10:10:00.000Z'
          }
        ]
      };
    } catch (error) {
      console.error('查询会议详情失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });

  // 结束会议
  ipcMain.handle('end-meeting', async (_event, meetingId: string) => {
    try {
      console.log(`结束会议: ${meetingId}`);
      // 模拟结束会议响应
      return {
        meetingId: meetingId,
        endedAt: new Date().toISOString(),
        durationSeconds: 3600
      };
    } catch (error) {
      console.error('结束会议失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
