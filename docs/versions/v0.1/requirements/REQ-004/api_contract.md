# REQ-004 音视频控制功能 API 契约

## 文档信息

- **需求编号**: REQ-004
- **需求名称**: 音视频控制功能
- **文档类型**: API 契约
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: team-lead
- **状态**: 已评审通过

---

## 概述

本文档定义音视频控制功能相关的 WebSocket 信令消息格式、数据模型扩展及前端状态管理约定。所有接口复用 REQ-003 建立的 WebSocket 连接和 mediasoup 架构。

### 核心概念扩展

- **Producer pause/resume 机制**：基于 mediasoup Producer API 实现音视频控制
- **状态同步信令**：实时同步用户音视频状态给其他参会者
- **设备热插拔**：监听设备变化，支持设备切换
- **状态持久化**：会议期间保持用户选择的设备状态

---

## WebSocket 信令消息格式

复用 REQ-003 的 WebSocket 连接（`MeetingGateway`），在现有信令基础上扩展控制功能。

### 消息格式规范

**请求格式**（客户端 → 服务端）：
```typescript
interface ControlRequest {
  type: string;     // 控制消息类型
  data: object;     // 控制数据
  requestId?: string; // 请求 ID（用于匹配响应）
}
```

**响应格式**（服务端 → 客户端）：
```typescript
interface ControlResponse {
  requestId?: string;  // 对应请求 ID
  data?: object;       // 响应数据
  error?: string;      // 错误信息
}
```

### 信令消息清单（新增）

#### 1. rtc:producerPause — 暂停 Producer（静音/关闭摄像头）

**客户端 → 服务端**：
```json
{
  "type": "rtc:producerPause",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "producerId": "producer-uuid-001",
    "kind": "audio"  // 'audio' | 'video'
  },
  "requestId": "req-001"
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:controlAck",
  "data": {
    "requestId": "req-001",
    "success": true,
    "producerId": "producer-uuid-001",
    "paused": true,
    "timestamp": 1737984000000
  }
}
```

#### 2. rtc:producerResume — 恢复 Producer（取消静音/开启摄像头）

**客户端 → 服务端**：
```json
{
  "type": "rtc:producerResume",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "producerId": "producer-uuid-001",
    "kind": "audio"  // 'audio' | 'video'
  },
  "requestId": "req-002"
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:controlAck",
  "data": {
    "requestId": "req-002",
    "success": true,
    "producerId": "producer-uuid-001",
    "paused": false,
    "timestamp": 1737984001000
  }
}
```

#### 3. rtc:deviceSwitch — 切换设备

**客户端 → 服务端**：
```json
{
  "type": "rtc:deviceSwitch",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "kind": "audio",  // 'audio' | 'video'
    "oldDeviceId": "device-uuid-001",
    "newDeviceId": "device-uuid-002"
  },
  "requestId": "req-003"
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:deviceSwitchAck",
  "data": {
    "requestId": "req-003",
    "success": true,
    "kind": "audio",
    "newDeviceId": "device-uuid-002",
    "timestamp": 1737984002000
  }
}
```

### 服务端广播事件（新增）

#### 4. rtc:peerMuted — 参会者静音状态变化

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:peerMuted",
  "data": {
    "peerId": "peer-uuid-001",
    "muted": true,  // true: 静音, false: 取消静音
    "timestamp": 1737984000000
  }
}
```

#### 5. rtc:peerVideoDisabled — 参会者摄像头状态变化

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:peerVideoDisabled",
  "data": {
    "peerId": "peer-uuid-001",
    "disabled": true,  // true: 摄像头关闭, false: 摄像头开启
    "timestamp": 1737984001000
  }
}
```

#### 6. rtc:roomState — 房间状态同步（新用户加入时）

**服务端 → 客户端（单播）**：
```json
{
  "type": "rtc:roomState",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "peers": [
      {
        "peerId": "peer-uuid-001",
        "audioMuted": false,
        "videoDisabled": true
      },
      {
        "peerId": "peer-uuid-002",
        "audioMuted": true,
        "videoDisabled": false
      }
    ],
    "timestamp": 1737984000000
  }
}
```

#### 7. rtc:deviceListUpdate — 设备列表更新

**服务端 → 客户端（单播）**：
```json
{
  "type": "rtc:deviceListUpdate",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "audioDevices": [
      {
        "deviceId": "device-uuid-001",
        "label": "内置麦克风",
        "kind": "audioinput"
      }
    ],
    "videoDevices": [
      {
        "deviceId": "device-uuid-002",
        "label": "USB 摄像头",
        "kind": "videoinput"
      }
    ],
    "timestamp": 1737984000000
  }
}
```

---

## 数据模型扩展

### 前端数据模型扩展

#### Peer 模型扩展（前端）
```typescript
interface PeerControlState {
  peerId: string;
  userId: string;
  nickname: string;

  // 新增控制状态字段
  audioMuted: boolean;      // 是否静音
  videoDisabled: boolean;   // 摄像头是否关闭

  // 原有字段
  producers: ProducerInfo[];
  networkQuality: 'good' | 'medium' | 'poor';
}
```

#### 本地设备状态模型
```typescript
interface LocalDeviceState {
  audio: {
    muted: boolean;                    // 是否静音
    deviceId: string;                   // 当前音频设备 ID
    availableDevices: MediaDeviceInfo[]; // 可用音频设备列表
  };
  video: {
    enabled: boolean;                   // 摄像头是否开启
    deviceId: string;                   // 当前视频设备 ID
    availableDevices: MediaDeviceInfo[]; // 可用视频设备列表
  };
}
```

### 服务端数据模型扩展

#### PeerControlState 模型（服务端）
```typescript
interface PeerControlState {
  peerId: string;
  meetingId: string;

  // Producer 状态
  audioProducerId?: string;
  videoProducerId?: string;
  audioPaused: boolean;      // 音频 Producer 是否暂停
  videoPaused: boolean;      // 视频 Producer 是否暂停

  // 设备信息
  audioDeviceId?: string;
  videoDeviceId?: string;

  // 时间戳
  lastUpdated: Date;
}
```

#### MeetingControlState 模型（服务端）
```typescript
interface MeetingControlState {
  meetingId: string;
  peers: Map<string, PeerControlState>;  // peerId → PeerControlState
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 错误码定义

### WebSocket 信令错误码（新增）

| 错误码 | 说明 | 触发场景 |
|--------|------|---------|
| `40404` | Producer 不存在 | producerId 对应的 Producer 不存在 |
| `40902` | Producer 状态冲突 | Producer 已处于目标状态（重复操作） |
| `40903` | 设备切换冲突 | 设备切换过程中有其他控制操作 |
| `50002` | Producer 控制失败 | mediasoup Producer API 调用失败 |
| `50003` | 状态同步失败 | 状态广播到其他客户端失败 |

### 错误响应示例

**Producer 控制失败**：
```json
{
  "type": "rtc:controlAck",
  "data": {
    "requestId": "req-001",
    "success": false,
    "error": "Producer 控制失败: Producer not found",
    "errorCode": "40404",
    "timestamp": 1737984000000
  }
}
```

**设备切换失败**：
```json
{
  "type": "rtc:deviceSwitchAck",
  "data": {
    "requestId": "req-003",
    "success": false,
    "error": "设备切换失败: 设备不可用",
    "errorCode": "40903",
    "timestamp": 1737984000000
  }
}
```

---

## 前端状态管理约定

### 控制状态 Store 结构

#### Vuex/Pinia Store 结构
```typescript
interface ControlStoreState {
  // 本地状态
  local: {
    audioMuted: boolean;
    videoEnabled: boolean;
    audioDeviceId: string;
    videoDeviceId: string;
    availableDevices: {
      audio: MediaDeviceInfo[];
      video: MediaDeviceInfo[];
    };
  };

  // 远端状态
  remote: Map<string, RemotePeerState>;

  // 加载状态
  loading: {
    audio: boolean;
    video: boolean;
    deviceSwitch: boolean;
  };

  // 错误状态
  error: string | null;
}
```

#### 操作方法定义
```typescript
interface ControlStoreActions {
  // 音频控制
  toggleAudio(): Promise<void>;
  setAudioMuted(muted: boolean): Promise<void>;

  // 视频控制
  toggleVideo(): Promise<void>;
  setVideoEnabled(enabled: boolean): Promise<void>;

  // 设备管理
  switchAudioDevice(deviceId: string): Promise<void>;
  switchVideoDevice(deviceId: string): Promise<void>;
  refreshDevices(): Promise<void>;

  // 状态同步
  updateRemotePeerState(peerId: string, state: Partial<RemotePeerState>): void;
  clearError(): void;
}
```

### 组件接口约定

#### ControlBar 组件 Props
```typescript
interface ControlBarProps {
  // 状态属性
  audioMuted: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  availableDevices: {
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
  };

  // 操作方法
  onAudioToggle: () => void;
  onVideoToggle: () => void;
  onAudioDeviceSelect: (deviceId: string) => void;
  onVideoDeviceSelect: (deviceId: string) => void;

  // UI 状态
  loading?: boolean;
  error?: string;
}
```

#### VideoGrid 组件状态绑定
```typescript
interface VideoGridProps {
  peers: Array<{
    peerId: string;
    userId: string;
    nickname: string;
    audioMuted: boolean;      // 新增
    videoDisabled: boolean;   // 新增
    networkQuality: 'good' | 'medium' | 'poor';
    videoStream?: MediaStream;
  }>;

  // 状态指示器配置
  showStatusIndicators: boolean;
  statusIndicatorPosition: 'top-right' | 'bottom-right';
}
```

### React Hook 约定

#### useMediaControl Hook
```typescript
interface UseMediaControlReturn {
  // 状态
  audioMuted: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  availableDevices: {
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
  };

  // 操作方法
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  setAudioDevice: (deviceId: string) => Promise<void>;
  setVideoDevice: (deviceId: string) => Promise<void>;

  // UI 状态
  loading: {
    audio: boolean;
    video: boolean;
    deviceSwitch: boolean;
  };
  error: string | null;

  // 工具方法
  refreshDevices: () => Promise<void>;
  clearError: () => void;
}
```

---

## 性能与安全要求

### 性能指标

| 指标 | 目标值 | 可接受值 |
|------|--------|---------|
| 控制操作延迟 | < 50ms | < 100ms |
| 状态同步延迟 | < 100ms | < 200ms |
| 设备切换时间 | < 500ms | < 1000ms |
| 弱网下控制可用性 | 20% 丢包 | 30% 丢包 |

### 安全要求

- **权限控制**：只能控制自己的 Producer，服务端验证权限
- **状态验证**：服务端验证控制指令的合法性
- **信令加密**：WebSocket 信令通过 TLS 加密
- **频率限制**：每用户每秒最多 5 条控制信令

### 容错要求

- **重试机制**：控制失败时自动重试 3 次
- **状态一致性**：定期检查并同步状态
- **降级方案**：Producer 控制失败时尝试关闭重建
- **网络恢复**：网络中断恢复后自动重建状态

---

## 兼容性要求

### 浏览器支持

| 浏览器 | 最低版本 | 控制功能支持 |
|--------|---------|-------------|
| Chrome | 90+ | 完整支持 |
| Safari | 14+ | 基本支持（设备枚举受限） |
| Firefox | 88+ | 完整支持 |
| Edge | 90+ | 完整支持 |

### 桌面端支持

- Windows 10+（Electron）：完整支持
- macOS 11+（Electron）：完整支持
- Linux（Electron）：完整支持

### 移动端支持（v0.2）

- iOS Safari 14+：基本支持
- Android Chrome 90+：完整支持

---

## 测试验证要点

### 功能测试用例

#### 控制功能测试
```typescript
describe('音视频控制功能', () => {
  test('用户可静音/取消静音麦克风', async () => {
    // 测试步骤
  });

  test('用户可开启/关闭摄像头', async () => {
    // 测试步骤
  });

  test('状态实时同步给其他用户', async () => {
    // 测试步骤
  });
});
```

#### 设备管理测试
```typescript
describe('设备管理功能', () => {
  test('用户可切换音频设备', async () => {
    // 测试步骤
  });

  test('热插拔设备自动检测', async () => {
    // 测试步骤
  });
});
```

### 性能测试用例

#### 控制延迟测试
```typescript
describe('控制性能', () => {
  test('控制操作延迟 < 100ms', async () => {
    // 性能测试
  });

  test('弱网环境下控制功能可用', async () => {
    // 弱网测试
  });
});
```

### 兼容性测试用例

#### 跨浏览器测试
```typescript
describe('浏览器兼容性', () => {
  test('Chrome 90+ 功能正常', async () => {
    // Chrome 测试
  });

  test('Safari 14+ 基本功能正常', async () => {
    // Safari 测试
  });
});
```

---

## 部署与运维

### 配置参数

#### 控制服务配置
```yaml
control:
  # 控制指令超时时间（毫秒）
  commandTimeout: 5000

  # 状态同步间隔（毫秒）
  syncInterval: 30000

  # 最大重试次数
  maxRetries: 3

  # 状态清理间隔（分钟）
  cleanupInterval: 5

  # 状态过期时间（分钟）
  stateExpiration: 30
```

### 监控指标

#### Prometheus 指标
```yaml
# 控制延迟指标
control_command_duration_seconds

# 成功率指标
control_command_success_total
control_command_failure_total

# 状态同步指标
state_sync_duration_seconds
state_sync_success_total
state_sync_failure_total
```

#### 告警规则
```yaml
alert: HighControlLatency
expr: histogram_quantile(0.95, rate(control_command_duration_seconds_bucket[5m])) > 0.1
for: 2m
labels:
  severity: warning
annotations:
  summary: "控制指令延迟过高"
  description: "P95控制指令延迟超过100ms"
```

---

## 参考资料

- [REQ-003 API 契约](../REQ-003/api_contract.md)
- [mediasoup Producer API 文档](https://mediasoup.org/documentation/v3/mediasoup/api/#Producer)
- [WebRTC MediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)
- [REQ-004 需求分析文档](../analysis.md)

---

**文档状态**: 已评审通过
**维护人**: team-lead