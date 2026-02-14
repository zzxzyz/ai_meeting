# Electron 应用开发指南

## 快速开始

### 1. 安装依赖

在项目根目录：

```bash
pnpm install
```

### 2. 启动开发服务器

```bash
cd apps/electron
pnpm dev
```

这会同时启动：
- Vite 开发服务器（http://localhost:3001）
- Electron 应用窗口

### 3. 项目结构

```
apps/electron/
├── src/
│   ├── main/              # 主进程（Node.js 环境）
│   │   ├── index.ts       # 应用启动、窗口管理
│   │   └── preload.ts     # 渲染进程桥接
│   ├── renderer/          # 渲染进程（浏览器环境）
│   │   ├── App.tsx        # 根组件
│   │   ├── main.tsx       # React 入口
│   │   └── index.css      # 全局样式
│   ├── types/             # TypeScript 类型定义
│   └── utils/             # 工具函数
├── dist/                  # 构建输出
│   ├── main/             # 主进程编译结果
│   └── renderer/         # 渲染进程打包结果
├── index.html            # HTML 模板
├── package.json
├── vite.config.ts        # Vite 配置（渲染进程）
├── tsconfig.json         # TypeScript 配置（渲染进程）
└── tsconfig.main.json    # TypeScript 配置（主进程）
```

## 开发流程

### 主进程开发

主进程运行在 Node.js 环境，负责应用生命周期和原生功能。

**文件位置**: `src/main/index.ts`

**主要职责**:
- 创建和管理窗口
- 处理 IPC 通信
- 访问系统原生 API
- 管理应用菜单和托盘

**示例 - 添加新的 IPC 处理器**:

```typescript
// src/main/index.ts
function registerIpcHandlers() {
  // 现有处理器...

  // 新增：保存文件
  ipcMain.handle('save-file', async (event, content: string) => {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog({
      defaultPath: 'meeting-notes.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled && result.filePath) {
      await fs.promises.writeFile(result.filePath, content);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });
}
```

### Preload 脚本

Preload 脚本在渲染进程加载前运行，是主进程和渲染进程的桥梁。

**文件位置**: `src/main/preload.ts`

**主要职责**:
- 暴露安全的 API 给渲染进程
- 封装 IPC 调用
- 提供类型安全的接口

**示例 - 暴露新 API**:

```typescript
// 1. 更新类型定义
export interface ElectronAPI {
  // 现有 API...

  // 新增
  saveFile: (content: string) => Promise<{ success: boolean; path?: string }>;
}

// 2. 实现 API
const electronAPI: ElectronAPI = {
  // 现有实现...

  saveFile: (content: string) => ipcRenderer.invoke('save-file', content),
};
```

### 渲染进程开发

渲染进程运行在浏览器环境，使用 React 构建 UI。

**文件位置**: `src/renderer/`

**与 Web 应用的代码复用**:

渲染进程与 Web 应用共享大部分代码：
- ✅ React 组件
- ✅ 状态管理（Zustand）
- ✅ 路由（React Router）
- ✅ 样式（Tailwind CSS）
- ✅ 共享包（@ai-meeting/shared, @ai-meeting/ui）

**平台差异处理**:

使用 `utils/platform.ts` 检测运行环境：

```typescript
import { isElectron, getElectronAPI } from '@/utils/platform';

function MyComponent() {
  const handleSave = async () => {
    if (isElectron()) {
      // Electron 环境：使用原生文件对话框
      const api = getElectronAPI()!;
      const result = await api.saveFile('content');
      console.log('文件已保存:', result.path);
    } else {
      // Web 环境：使用浏览器下载
      const blob = new Blob(['content'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meeting-notes.txt';
      a.click();
    }
  };

  return <button onClick={handleSave}>保存</button>;
}
```

## 常见任务

### 添加新功能

#### 1. 纯 UI 功能（不需要原生能力）

直接在 `src/renderer/` 中开发，代码与 Web 应用相同。

#### 2. 需要原生能力的功能

**步骤**:

1. **在主进程添加 IPC 处理器** (`src/main/index.ts`)
2. **在 preload 暴露 API** (`src/main/preload.ts`)
3. **更新类型定义** (`src/types/electron.d.ts`)
4. **在 utils 封装工具函数** (`src/utils/platform.ts`)
5. **在组件中使用**

**示例 - 添加截图功能**:

```typescript
// 1. 主进程
ipcMain.handle('capture-screenshot', async () => {
  const { desktopCapturer } = require('electron');
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  });
  return sources[0].thumbnail.toDataURL();
});

// 2. Preload
const electronAPI: ElectronAPI = {
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
};

// 3. 工具函数
export const captureScreenshot = async (): Promise<string | null> => {
  const api = getElectronAPI();
  if (api) {
    return api.captureScreenshot();
  }
  return null;
};

// 4. 组件中使用
const screenshot = await captureScreenshot();
if (screenshot) {
  // 使用截图 data URL
}
```

### 调试

#### 渲染进程调试

开发模式自动打开 DevTools，可直接使用浏览器开发者工具。

#### 主进程调试

**方法 1: 使用 console.log**

```typescript
console.log('主进程日志:', someVariable);
```

日志输出到终端（启动 Electron 的终端）。

**方法 2: VS Code 调试器**

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Electron Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/apps/electron",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:electron"],
      "outputCapture": "std"
    }
  ]
}
```

### 构建和打包

#### 开发构建

```bash
pnpm build
```

生成：
- `dist/main/` - 主进程 JS
- `dist/renderer/` - 渲染进程静态文件

#### 打包成应用

```bash
# macOS
pnpm build && electron-builder --mac

# Windows (需要在 Windows 上运行)
pnpm build && electron-builder --win

# Linux
pnpm build && electron-builder --linux

# 所有平台
pnpm build && electron-builder -mwl
```

产物位于 `out/` 目录。

### 测试

#### 单元测试

```bash
pnpm test
```

#### E2E 测试（使用 Spectron/Playwright）

```bash
pnpm test:e2e
```

## 最佳实践

### 1. 安全性

- ✅ **始终使用 Context Isolation**
- ✅ **禁用 Node Integration**
- ✅ **启用 Sandbox**
- ✅ **通过 Preload 暴露最小必要 API**
- ❌ **永远不要直接暴露 ipcRenderer**

```typescript
// ❌ 危险
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);

// ✅ 安全
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
});
```

### 2. 性能

- 主进程避免阻塞操作，使用异步 API
- 大量数据传输使用 SharedArrayBuffer 或文件系统
- 图片/视频使用 Stream 而非 Base64

### 3. 代码复用

- 业务逻辑放在 `packages/shared`
- UI 组件放在 `packages/ui`
- 平台差异通过 `utils/platform.ts` 封装

### 4. 类型安全

- 所有 IPC 通信定义 TypeScript 接口
- 使用严格的类型检查
- Preload API 必须有完整类型定义

## 常见问题

### Q: 为什么渲染进程无法 import Node.js 模块？

**A**: 出于安全考虑，渲染进程禁用了 Node.js 集成。需要通过 IPC 在主进程中调用 Node.js API。

### Q: 如何在渲染进程使用 fs、path 等模块？

**A**: 在主进程实现文件操作，通过 IPC 暴露给渲染进程：

```typescript
// 主进程
ipcMain.handle('read-file', async (event, filePath) => {
  return fs.promises.readFile(filePath, 'utf-8');
});

// 渲染进程
const content = await window.electronAPI.readFile('/path/to/file');
```

### Q: 如何调试主进程？

**A**:
1. 使用 `console.log` 输出到终端
2. 使用 VS Code 调试器
3. 启动时添加 `--inspect` 参数：`electron --inspect=5858 .`

### Q: 热重载不生效？

**A**:
- 渲染进程：Vite 自动热重载
- 主进程：需要重启 Electron，或使用 `electron-reloader`

### Q: 如何处理 Web 和 Electron 的差异？

**A**: 使用 `utils/platform.ts` 封装：

```typescript
import { isElectron } from '@/utils/platform';

if (isElectron()) {
  // Electron 特定代码
} else {
  // Web 浏览器代码
}
```

## 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Electron 安全最佳实践](https://www.electronjs.org/docs/tutorial/security)
- [Vite 官方文档](https://vitejs.dev)
- [项目架构文档](../../docs/architecture/)
