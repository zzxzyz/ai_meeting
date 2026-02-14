# AI Meeting - Electron 桌面应用

企业级视频会议系统的 Electron 桌面客户端。

## 特性

- 🖥️ 跨平台支持（Windows、macOS、Linux）
- 🔄 80-85% 代码与 Web 端复用
- ⚡ 基于 Vite 的快速开发体验
- 🎨 Tailwind CSS 样式
- 🔒 安全的 IPC 通信（Context Isolation + Sandbox）
- 📦 自动更新支持

## 架构

```
apps/electron/
├── src/
│   ├── main/           # 主进程
│   │   ├── index.ts    # 主进程入口
│   │   └── preload.ts  # Preload 脚本
│   ├── renderer/       # 渲染进程（复用 Web 代码）
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── types/          # 类型定义
│   │   └── electron.d.ts
│   └── utils/          # 工具函数
│       └── platform.ts # 平台检测
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 代码复用策略

### 渲染进程复用 Web 代码

渲染进程直接使用与 Web 应用相同的 React 组件和逻辑：

- `App.tsx` - 与 Web 完全相同
- `main.tsx` - 与 Web 完全相同
- `index.css` - 与 Web 完全相同

### 平台差异处理

通过 `utils/platform.ts` 提供的工具函数检测运行环境：

```typescript
import { isElectron, getElectronAPI } from './utils/platform';

if (isElectron()) {
  // Electron 特定功能
  const api = getElectronAPI();
  await api.minimizeWindow();
} else {
  // Web 环境回退方案
}
```

### 共享包依赖

- `@ai-meeting/shared` - 类型定义、工具函数、常量
- `@ai-meeting/ui` - UI 组件库

## 开发

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 从项目根目录启动
pnpm dev

# 或在 apps/electron 目录下启动
cd apps/electron
pnpm dev
```

这将同时启动：
1. Vite 开发服务器（端口 3001）
2. Electron 应用（加载 Vite 服务器）

### 构建

```bash
# 构建渲染进程和主进程
pnpm build

# 打包成可分发应用
# macOS
electron-builder --mac

# Windows
electron-builder --win

# Linux
electron-builder --linux
```

构建产物：
- 渲染进程：`dist/renderer/`
- 主进程：`dist/main/`
- 安装包：`out/`

## 主进程功能

### 窗口管理

- 自适应屏幕尺寸
- 最小尺寸限制（800x600）
- 窗口控制（最小化、最大化、关闭）

### IPC 通信

主进程提供以下 IPC 处理器：

| Handler | 功能 |
|---------|------|
| `get-app-version` | 获取应用版本 |
| `get-system-info` | 获取系统信息 |
| `minimize-window` | 最小化窗口 |
| `maximize-window` | 最大化/还原窗口 |
| `close-window` | 关闭窗口 |

### 安全特性

- `nodeIntegration: false` - 禁用 Node.js 集成
- `contextIsolation: true` - 启用上下文隔离
- `sandbox: true` - 启用沙箱模式
- 通过 `contextBridge` 暴露安全 API

## Preload 脚本

暴露给渲染进程的安全 API：

```typescript
window.electronAPI = {
  // 应用信息
  getAppVersion: () => Promise<string>,
  getSystemInfo: () => Promise<SystemInfo>,

  // 窗口控制
  minimizeWindow: () => Promise<void>,
  maximizeWindow: () => Promise<void>,
  closeWindow: () => Promise<void>,

  // 平台检测
  platform: string,
  isElectron: boolean,
};
```

## 使用示例

### 检测运行环境

```typescript
import { isElectron, isWeb } from '@/utils/platform';

if (isElectron()) {
  console.log('运行在 Electron 中');
} else {
  console.log('运行在 Web 浏览器中');
}
```

### 调用 Electron API

```typescript
import { getAppVersion, minimizeWindow } from '@/utils/platform';

// 获取版本
const version = await getAppVersion();
console.log('应用版本:', version);

// 最小化窗口
await minimizeWindow();
```

### 在组件中使用

```tsx
import React, { useEffect, useState } from 'react';
import { isElectron, getAppVersion } from '@/utils/platform';

function AppHeader() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (isElectron()) {
      getAppVersion().then(setVersion);
    }
  }, []);

  return (
    <header>
      <h1>AI Meeting</h1>
      {version && <span>v{version}</span>}
    </header>
  );
}
```

## 配置

### package.json

```json
{
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "tsc -p tsconfig.main.json && electron .",
    "build": "vite build && tsc -p tsconfig.main.json && electron-builder"
  }
}
```

### electron-builder 配置

位于 `package.json` 的 `build` 字段：

- **appId**: `com.ai-meeting.desktop`
- **productName**: `AI Meeting`
- **输出目录**: `out/`
- **macOS**: DMG + ZIP
- **Windows**: NSIS + Portable
- **Linux**: AppImage + DEB

## 调试

### 开发者工具

开发模式自动打开 DevTools：

```typescript
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

### 主进程调试

```bash
# VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Electron Main",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
  "program": "${workspaceFolder}/apps/electron/dist/main/index.js"
}
```

## 技术栈

- **Electron**: 28.x
- **React**: 18.x
- **TypeScript**: 5.3.x
- **Vite**: 5.x
- **Tailwind CSS**: 3.4.x
- **Electron Builder**: 24.x

## 与 Web 应用的差异

| 特性 | Web | Electron |
|------|-----|----------|
| 运行环境 | 浏览器 | 桌面应用 |
| 窗口控制 | ❌ | ✅ |
| 文件系统访问 | 受限 | 完全访问 |
| 系统托盘 | ❌ | ✅ |
| 自动更新 | 通过 CDN | electron-updater |
| 原生通知 | Web API | Electron API |
| 离线支持 | PWA | 原生支持 |

## 代码复用率

预期代码复用率：**80-85%**

- ✅ 复用：UI 组件、业务逻辑、状态管理、路由
- ❌ 不复用：主进程代码、Preload 脚本、窗口管理
- 🔀 条件复用：平台特定功能（通过 platform.ts 封装）

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/architecture/)
- [客户端架构](../../docs/architecture/client.md)
- [Web 应用](../web/README.md)

## License

Private - 企业内部项目
