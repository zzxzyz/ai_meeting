# 客户端架构设计

## 1. 背景与目标

### 1.1 业务背景
开发跨平台视频会议桌面客户端,支持 Windows、macOS、Linux,提供比 Web 端更稳定的性能和更丰富的系统集成功能。

### 1.2 技术目标
- **跨平台**：一套代码,支持多平台
- **高性能**：本地渲染,低延迟
- **系统集成**：通知、快捷键、系统托盘
- **离线能力**：本地缓存,离线查看历史记录

### 1.3 平台要求
- Windows 10/11
- macOS 11+
- Ubuntu 20.04+

---

## 2. 技术栈选型

### 2.1 跨平台框架

#### 2.1.1 方案对比

| 框架 | 语言 | 性能 | 包大小 | 系统集成 | 学习曲线 |
|-----|------|------|--------|---------|---------|
| **Electron** | JS/TS | ★★★☆☆ | ~100MB | ★★★★★ | 低 |
| **Tauri** | Rust+JS | ★★★★★ | ~10MB | ★★★★☆ | 中 |
| **Flutter Desktop** | Dart | ★★★★☆ | ~30MB | ★★★☆☆ | 中 |
| **Qt** | C++ | ★★★★★ | ~20MB | ★★★★★ | 高 |

**选型决策**：Electron

**理由**：
1. 可复用 Web 端代码（80%+ 复用率）
2. 生态成熟,第三方库丰富
3. 系统集成能力强
4. 团队熟悉 TypeScript
5. 商业案例多（VS Code、Slack、Discord）

**权衡**：
- 包体积大：可接受（用户只需下载一次）
- 性能略低：对视频会议场景影响小
- 内存占用：现代电脑内存充足,可接受

---

### 2.2 架构模式

#### 2.2.1 进程架构

```
┌─────────────────────────────────────┐
│        Main Process (Node.js)       │
│  - 窗口管理                          │
│  - 系统集成（通知、托盘、快捷键）     │
│  - 自动更新                          │
│  - IPC 服务端                        │
└────────────┬────────────────────────┘
             │ IPC
    ┌────────┴────────┬───────────────┐
    │                 │               │
┌───▼───────┐  ┌─────▼──────┐ ┌─────▼──────┐
│ Renderer  │  │ Renderer   │ │ Preload    │
│ (React)   │  │ (Overlay)  │ │ Scripts    │
│ - UI      │  │ - 画中画   │ │ - API封装  │
│ - WebRTC  │  │            │ │            │
└───────────┘  └────────────┘ └────────────┘
```

---

## 3. 详细设计

### 3.1 Main Process 设计

#### 3.1.1 窗口管理

```typescript
// main/windowManager.ts
import { BrowserWindow, screen } from 'electron';

class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;

  createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    this.mainWindow = new BrowserWindow({
      width: Math.min(1280, width),
      height: Math.min(720, height),
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      },
      titleBarStyle: 'hidden',  // 自定义标题栏
      trafficLightPosition: { x: 15, y: 15 }  // macOS 红绿灯位置
    });

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile('dist/index.html');
    }

    // 窗口事件
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // 阻止关闭（最小化到托盘）
    this.mainWindow.on('close', (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  // 画中画窗口（始终置顶）
  createOverlayWindow() {
    this.overlayWindow = new BrowserWindow({
      width: 320,
      height: 180,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    });

    this.overlayWindow.loadURL('about:blank');
  }

  showMainWindow() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }
}

export const windowManager = new WindowManager();
```

---

#### 3.1.2 系统集成

**系统托盘**：
```typescript
// main/trayManager.ts
import { Tray, Menu, nativeImage } from 'electron';

class TrayManager {
  private tray: Tray | null = null;

  create() {
    const icon = nativeImage.createFromPath(
      path.join(__dirname, '../assets/tray-icon.png')
    );

    this.tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开',
        click: () => {
          windowManager.showMainWindow();
        }
      },
      {
        label: '新建会议',
        click: () => {
          // 打开新建会议窗口
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Open Meeting');

    // 点击托盘图标显示窗口
    this.tray.on('click', () => {
      windowManager.showMainWindow();
    });
  }
}

export const trayManager = new TrayManager();
```

**全局快捷键**：
```typescript
// main/shortcutManager.ts
import { globalShortcut } from 'electron';

class ShortcutManager {
  register() {
    // Command/Ctrl + Shift + M: 静音/取消静音
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      this.toggleMute();
    });

    // Command/Ctrl + Shift + O: 开启/关闭摄像头
    globalShortcut.register('CommandOrControl+Shift+O', () => {
      this.toggleVideo();
    });

    // Command/Ctrl + Shift + D: 共享屏幕
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      this.shareScreen();
    });
  }

  private toggleMute() {
    // 通过 IPC 通知 Renderer 进程
    windowManager.mainWindow?.webContents.send('shortcut:toggle-mute');
  }

  private toggleVideo() {
    windowManager.mainWindow?.webContents.send('shortcut:toggle-video');
  }

  private shareScreen() {
    windowManager.mainWindow?.webContents.send('shortcut:share-screen');
  }

  unregister() {
    globalShortcut.unregisterAll();
  }
}

export const shortcutManager = new ShortcutManager();
```

**系统通知**：
```typescript
// main/notificationManager.ts
import { Notification } from 'electron';

class NotificationManager {
  show(title: string, body: string) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, '../assets/icon.png'),
      sound: true
    });

    notification.on('click', () => {
      windowManager.showMainWindow();
    });

    notification.show();
  }

  // 会议邀请通知
  showMeetingInvitation(meeting: Meeting) {
    this.show(
      '会议邀请',
      `${meeting.host.name} 邀请您参加会议"${meeting.title}"`
    );
  }

  // 参会者加入通知
  showParticipantJoined(participant: Participant) {
    this.show(
      '参会者加入',
      `${participant.name} 加入了会议`
    );
  }
}

export const notificationManager = new NotificationManager();
```

---

#### 3.1.3 IPC 通信

**Main Process → Renderer Process**：
```typescript
// main/ipc/handlers.ts
import { ipcMain } from 'electron';

// 注册 IPC 处理器
export function registerIPCHandlers() {
  // 获取系统信息
  ipcMain.handle('system:getInfo', async () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion()
    };
  });

  // 选择文件
  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'png', 'gif'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      return result.filePaths[0];
    }
    return null;
  });

  // 最小化窗口
  ipcMain.on('window:minimize', () => {
    windowManager.mainWindow?.minimize();
  });

  // 最大化/还原窗口
  ipcMain.on('window:maximize', () => {
    const win = windowManager.mainWindow;
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  // 关闭窗口
  ipcMain.on('window:close', () => {
    windowManager.mainWindow?.close();
  });
}
```

**Preload Script**（安全的 IPC 封装）：
```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给 Renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // 系统信息
  getSystemInfo: () => ipcRenderer.invoke('system:getInfo'),

  // 文件选择
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),

  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // 监听快捷键
  onShortcut: (callback: (event: string) => void) => {
    ipcRenderer.on('shortcut:toggle-mute', () => callback('toggle-mute'));
    ipcRenderer.on('shortcut:toggle-video', () => callback('toggle-video'));
    ipcRenderer.on('shortcut:share-screen', () => callback('share-screen'));
  }
});

// TypeScript 类型定义
declare global {
  interface Window {
    electronAPI: {
      getSystemInfo: () => Promise<SystemInfo>;
      selectFile: () => Promise<string | null>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onShortcut: (callback: (event: string) => void) => void;
    };
  }
}
```

---

### 3.2 Renderer Process 设计

#### 3.2.1 自定义标题栏

```typescript
// components/TitleBar.tsx
export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div className="h-8 bg-gray-900 flex items-center justify-between px-4 draggable">
      <div className="flex items-center space-x-2">
        <img src="/icon.png" className="w-5 h-5" />
        <span className="text-white text-sm">Open Meeting</span>
      </div>

      <div className="flex space-x-2 non-draggable">
        <button
          onClick={() => window.electronAPI.minimize()}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-700"
        >
          <MinusIcon />
        </button>
        <button
          onClick={() => {
            window.electronAPI.maximize();
            setIsMaximized(!isMaximized);
          }}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-700"
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="w-8 h-8 flex items-center justify-center hover:bg-red-600"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
```

**CSS 样式**：
```css
/* 可拖动区域 */
.draggable {
  -webkit-app-region: drag;
}

/* 不可拖动区域（按钮） */
.non-draggable {
  -webkit-app-region: no-drag;
}
```

---

#### 3.2.2 屏幕共享选择器

```typescript
// components/ScreenSharePicker.tsx
import { desktopCapturer } from 'electron';

export function ScreenSharePicker({ onSelect }: { onSelect: (sourceId: string) => void }) {
  const [sources, setSources] = useState<DesktopCapturerSource[]>([]);

  useEffect(() => {
    async function getSources() {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 300, height: 200 }
      });
      setSources(sources);
    }
    getSources();
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {sources.map((source) => (
        <div
          key={source.id}
          onClick={() => onSelect(source.id)}
          className="cursor-pointer hover:ring-2 ring-blue-500 rounded"
        >
          <img
            src={source.thumbnail.toDataURL()}
            alt={source.name}
            className="w-full rounded"
          />
          <p className="mt-2 text-sm truncate">{source.name}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### 3.3 自动更新

```typescript
// main/autoUpdater.ts
import { autoUpdater } from 'electron-updater';

class AutoUpdater {
  init() {
    // 检查更新
    autoUpdater.checkForUpdatesAndNotify();

    // 监听更新事件
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: '发现新版本',
        message: `版本 ${info.version} 可用,是否立即下载?`,
        buttons: ['下载', '稍后']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: '更新已下载',
        message: '新版本已下载完成,是否立即重启安装?',
        buttons: ['立即重启', '稍后']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto update error:', err);
    });
  }
}

export const updater = new AutoUpdater();
```

---

## 4. 性能优化

### 4.1 启动优化

**延迟加载**：
```typescript
// main/index.ts
app.on('ready', async () => {
  // 1. 先创建窗口（快速显示）
  windowManager.createMainWindow();

  // 2. 延迟初始化非关键模块
  setTimeout(() => {
    trayManager.create();
    shortcutManager.register();
    updater.init();
  }, 1000);
});
```

---

### 4.2 内存优化

**清理未使用的缓存**：
```typescript
app.on('window-all-closed', () => {
  // 清理缓存
  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData();
});
```

---

## 5. 打包与分发

### 5.1 electron-builder 配置

```json
{
  "build": {
    "appId": "com.openmeeting.app",
    "productName": "Open Meeting",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"],
      "icon": "assets/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "assets/icon.png",
      "category": "Network"
    },
    "publish": {
      "provider": "github",
      "owner": "your-org",
      "repo": "open-meeting"
    }
  }
}
```

---

## 6. 参考资料

- [Electron 官方文档](https://www.electronjs.org/docs/latest/)
- [electron-builder](https://www.electron.build/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
