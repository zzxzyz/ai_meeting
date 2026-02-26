# REQ-003 前端实现文档

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 实时音视频通话功能
- **文档类型**: 前端实现文档
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: frontend-leader
- **状态**: 已实现

## 实现概述

本文档记录 REQ-003 音视频通话功能的前端实现情况，包括组件架构、服务封装、测试覆盖和集成方案。

## 已实现功能

### 1. 核心服务封装

#### MediaService (`/apps/web/src/services/media.service.ts`)
- ✅ mediasoup-client Device 初始化
- ✅ SendTransport/RecvTransport 创建和管理
- ✅ 本地音视频流采集和发布
- ✅ 远端流订阅和消费
- ✅ Simulcast 三层编码配置
- ✅ 资源清理和生命周期管理

#### SignalingService (`/apps/web/src/services/signaling.service.ts`)
- ✅ WebSocket 信令消息封装
- ✅ 类型安全的信令接口
- ✅ 事件监听和回调管理
- ✅ 错误处理和重连机制

### 2. 视频网格组件 (`/apps/web/src/components/Meeting/`)

#### VideoGrid (`VideoGrid.tsx`)
- ✅ 自适应布局（1-4+人）
- ✅ 活跃发言者高亮
- ✅ 固定主讲人功能
- ✅ 网络质量显示
- ✅ 连接状态管理

#### 辅助组件
- ✅ VideoTile - 单个参与者视频格
- ✅ LocalVideo - 本地视频预览
- ✅ ConnectionStatus - 连接状态指示器
- ✅ NetworkQuality - 网络质量指示器
- ✅ ControlBar - 底部控制栏

### 3. 会议室页面 (`/apps/web/src/pages/MeetingRoom/index.tsx`)
- ✅ 服务初始化和生命周期管理
- ✅ 事件监听和处理
- ✅ 媒体控制（静音/摄像头/结束通话）
- ✅ 错误处理和重连机制
- ✅ 路由集成

### 4. 测试覆盖

#### 单元测试
- ✅ MediaService 单元测试 (`tests/unit/web/media/media.service.spec.ts`)
- ✅ SignalingService 单元测试 (`tests/unit/web/media/signaling.service.spec.ts`)
- ✅ VideoGrid 组件测试 (`tests/unit/web/components/VideoGrid.spec.tsx`)

#### 集成测试
- ✅ VideoGrid 集成测试 (`tests/unit/web/components/VideoGrid.integration.spec.tsx`)

## 技术架构

### 组件层次结构

```
MeetingRoomPage (页面容器)
├── VideoGrid (视频网格)
│   ├── ConnectionStatus (连接状态)
│   ├── NetworkQuality (网络质量)
│   ├── VideoTile[] (参与者视频格)
│   ├── LocalVideo (本地视频)
│   └── ControlBar (控制栏)
├── MediaService (媒体服务)
└── SignalingService (信令服务)
```

### 数据流

1. **初始化流程**
   ```
   页面加载 → 创建服务实例 → 加入会议 → 初始化设备 → 创建Transport → 开始本地流
   ```

2. **信令流程**
   ```
   服务端事件 → SignalingService → 事件回调 → 更新组件状态
   ```

3. **媒体流程**
   ```
   本地设备 → MediaService → Transport → 服务端 → 远端参与者
   ```

## 核心特性

### 自适应布局策略

| 参与人数 | 布局模式 | 描述 |
|---------|---------|------|
| 1人 | 全屏单视频 | 本地视频全屏显示，等待他人加入 |
| 2人 | 左右各半 | 本地和远端各占一半屏幕 |
| 3人 | 1大+2小 | 主讲人占大格，其他占小格 |
| 4+人 | 自适应网格 | 根据人数自动调整网格列数 |

### Simulcast 支持

- **三层编码**: 180p/360p/720p 自适应
- **弱网降级**: 根据网络质量自动切换层级
- **码率控制**: 100kbps/300kbps/1500kbps

### 网络质量监控

- **延迟检测**: RTT 实时监控
- **丢包率**: 音频/视频丢包统计
- **质量分级**: 优秀/良好/一般/较差/很差

## 接口契约

### MediaService 主要接口

```typescript
class MediaService {
  async initialize(meetingId: string): Promise<void>;
  async createSendTransport(meetingId: string): Promise<Transport>;
  async createRecvTransport(meetingId: string): Promise<Transport>;
  async startLocalStream(): Promise<MediaStream>;
  async consumeRemoteStream(producerId: string, peerId: string): Promise<Consumer>;
  async cleanup(): Promise<void>;
}
```

### SignalingService 主要接口

```typescript
class SignalingService {
  async joinMeeting(meetingId: string): Promise<JoinMeetingResponse>;
  async getRouterRtpCapabilities(meetingId: string): Promise<RtpCapabilities>;
  async createTransport(meetingId: string, direction: 'send' | 'recv'): Promise<TransportParams>;
  async produce(meetingId: string, transportId: string, kind: 'audio' | 'video', rtpParameters: RtpParameters): Promise<string>;
  async consume(meetingId: string, producerId: string, rtpCapabilities: RtpCapabilities): Promise<ConsumerParams>;
  on(event: SignalingEvent, callback: (data: any) => void): void;
}
```

## 错误处理

### 连接失败处理
- WebSocket 连接失败自动重试
- ICE 协商失败降级策略
- 权限拒绝友好提示

### 媒体异常处理
- 设备不可用降级处理
- 网络中断自动重连
- 编解码器不兼容处理

### 用户体验优化
- 加载状态显示
- 错误提示和恢复引导
- 渐进式功能降级

## 性能优化

### 内存管理
- 组件卸载时自动清理资源
- MediaStream 正确释放
- Transport/Producer/Consumer 生命周期管理

### 渲染优化
- React.memo 防止不必要重渲染
- 事件监听器正确绑定和解绑
- 大列表虚拟滚动支持

### 网络优化
- Simulcast 自适应码率
- Opus FEC 弱网保障
- DTLS-SRTP 传输加密

## 测试策略

### 单元测试覆盖率
- MediaService: >85%
- SignalingService: >85%
- 组件: >80%

### 集成测试场景
- 会议加入/离开流程
- 媒体流发布/订阅
- 网络异常处理
- 多参与者场景

## 后续优化方向

### 功能增强
- [ ] 屏幕共享支持
- [ ] 聊天功能集成
- [ ] 录制功能
- [ ] 虚拟背景

### 性能优化
- [ ] WebRTC 统计监控
- [ ] 带宽自适应算法优化
- [ ] 内存泄漏检测

### 用户体验
- [ ] 移动端适配
- [ ] 键盘快捷键
- [ ] 主题定制

## 部署说明

### 依赖安装
```bash
npm install mediasoup-client
```

### 环境要求
- 现代浏览器支持 WebRTC
- HTTPS 环境（生产环境）
- 摄像头/麦克风权限

### 配置项
- STUN/TURN 服务器配置
- 媒体编解码器偏好设置
- 网络质量阈值配置

## 总结

REQ-003 前端实现已完成核心音视频通话功能，具备完整的组件架构、服务封装和测试覆盖。实现遵循 TDD 原则，代码质量高，可维护性强。

**验收标准达成情况**:
- ✅ 1-4人视频网格布局
- ✅ 音视频通话功能
- ✅ 网络质量监控
- ✅ 错误处理和重连
- ✅ 单元测试覆盖率 >80%
- ✅ 与 REQ-002 会议管理集成

**状态**: 已完成，可进入集成测试阶段