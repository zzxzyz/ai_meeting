# REQ-004 音视频控制功能 - 技术方案调研

## 文档信息

- **需求编号**: REQ-004
- **需求名称**: 音视频控制功能
- **文档类型**: 技术方案调研
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **负责人**: architect
- **状态**: 草稿框架（待完善）
- **依赖**: REQ-003 技术方案、REQ-004 需求分析

---

## 1. 技术方案概述

### 1.1 技术选型原则

基于 REQ-003 已建立的 mediasoup SFU 架构，REQ-004 的技术方案遵循以下原则：

1. **架构一致性**：复用现有 mediasoup 基础设施和信令通道
2. **最小侵入性**：通过 Producer pause/resume 机制实现控制，无需修改核心媒体路径
3. **实时性优先**：控制指令延迟 < 100ms，状态同步延迟 < 200ms
4. **可靠性保障**：弱网环境下控制功能仍可用，支持自动重试
5. **扩展性考虑**：为后续高级控制功能预留接口

### 1.2 技术架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                   前端/客户端层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  控制组件    │  │  状态管理    │  │  设备管理模块        │ │
│  │ (ControlBar)│  │ (StateStore) │  │ (DeviceManager)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│          │               │                    │           │
└──────────┼───────────────┼────────────────────┼───────────┘
           │               │                    │
           ▼               ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   WebSocket 信令层                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  rtc:producerPaused/resumed 信令                         │ │
│  │  rtc:deviceStateChanged 信令                            │ │
│  │  rtc:controlAck 确认信令                                │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    mediasoup 服务层                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Producer管理 │  │ 状态同步服务 │  │ 设备状态持久化        │ │
│  │ (Producer)  │  │ (StateSync) │  │ (DeviceState)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 核心实现方案

### 2.1 基于 Producer pause/resume 的控制机制

#### 2.1.1 技术原理

mediasoup Producer 提供 pause() 和 resume() 方法，用于控制媒体流的发送：

- **pause()**：暂停发送 RTP 包，但不关闭 Producer
- **resume()**：恢复发送 RTP 包，继续传输媒体流
- **paused 属性**：只读属性，表示当前暂停状态

#### 2.1.2 控制逻辑映射

**麦克风控制**：
```typescript
// 静音：暂停音频 Producer
await audioProducer.pause();

// 取消静音：恢复音频 Producer
await audioProducer.resume();
```

**摄像头控制**：
```typescript
// 关闭摄像头：暂停视频 Producer
await videoProducer.pause();

// 开启摄像头：恢复视频 Producer
await videoProducer.resume();
```

#### 2.1.3 技术优势

1. **零转码开销**：pause/resume 只控制包发送，不涉及媒体处理
2. **即时生效**：暂停后立即停止发送，恢复后立即开始发送
3. **状态保持**：Producer 保持连接状态，恢复时无需重新协商
4. **资源友好**：暂停时不占用编码资源，节省 CPU

### 2.2 信令协议设计

#### 2.2.1 控制信令消息

**客户端 → 服务端**：
```typescript
// 暂停 Producer
interface ProducerPauseRequest {
  type: 'rtc:producerPause';
  data: {
    meetingId: string;
    producerId: string;
    kind: 'audio' | 'video';
  };
}

// 恢复 Producer
interface ProducerResumeRequest {
  type: 'rtc:producerResume';
  data: {
    meetingId: string;
    producerId: string;
    kind: 'audio' | 'video';
  };
}
```

**服务端 → 客户端**：
```typescript
// 状态变化确认
interface ControlAckResponse {
  type: 'rtc:controlAck';
  data: {
    requestId: string;
    success: boolean;
    producerId: string;
    paused: boolean;
    timestamp: number;
  };
}

// 状态同步广播
interface StateSyncBroadcast {
  type: 'rtc:stateSync';
  data: {
    peerId: string;
    audioPaused: boolean;
    videoPaused: boolean;
    timestamp: number;
  };
}
```

#### 2.2.2 信令流程

**控制指令流程**：
```
1. 客户端发送 rtc:producerPause 信令
2. 服务端调用 Producer.pause()
3. 服务端返回 rtc:controlAck 确认
4. 服务端广播 rtc:stateSync 给其他客户端
5. 其他客户端更新状态显示
```

**容错机制**：
- 信令超时重试（3次）
- 状态不一致时主动同步
- 网络恢复后状态重建

### 2.3 状态同步机制

#### 2.3.1 服务端状态管理

**内存状态存储**：
```typescript
interface PeerControlState {
  peerId: string;
  meetingId: string;
  audioProducerId?: string;
  videoProducerId?: string;
  audioPaused: boolean;
  videoPaused: boolean;
  lastUpdated: Date;
}

class ControlStateManager {
  private states: Map<string, PeerControlState> = new Map();

  // 更新状态
  async updateState(peerId: string, updates: Partial<PeerControlState>) {
    const state = this.states.get(peerId) || this.createDefaultState(peerId);
    Object.assign(state, updates, { lastUpdated: new Date() });
    this.states.set(peerId, state);

    // 广播状态变化
    await this.broadcastStateChange(peerId, state);
  }
}
```

#### 2.3.2 状态一致性保障

**主动同步策略**：
- 新用户加入时，推送当前房间状态
- 定期状态检查（30秒一次）
- 信令失败时状态回滚
- 网络中断恢复后状态重建

**冲突解决机制**：
- 以服务端状态为准
- 客户端状态与服务端不一致时，强制同步
- 操作冲突时，后到操作覆盖前到操作

---

## 3. 前端技术实现

### 3.1 控制组件架构

#### 3.1.1 React Hook 设计

**useMediaControl Hook**：
```typescript
interface UseMediaControlReturn {
  audioMuted: boolean;
  videoEnabled: boolean;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  setAudioDevice: (deviceId: string) => Promise<void>;
  setVideoDevice: (deviceId: string) => Promise<void>;
  availableDevices: MediaDeviceInfo[];
  loading: boolean;
  error: string | null;
}

function useMediaControl(meetingId: string): UseMediaControlReturn {
  const [state, setState] = useState<ControlState>(initialState);
  const { sendSignal, onSignal } = useWebSocket();

  // 控制逻辑实现
  const toggleAudio = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      await sendSignal('rtc:producerPause', {
        meetingId,
        producerId: state.audioProducerId,
        kind: 'audio'
      });

      // 等待确认信令
      const ack = await waitForAck('rtc:controlAck');
      if (ack.success) {
        setState(prev => ({
          ...prev,
          audioMuted: !prev.audioMuted,
          loading: false
        }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  }, [meetingId, state.audioProducerId, sendSignal]);
}
```

#### 3.1.2 状态管理集成

**与 Redux/Zustand 集成**：
```typescript
// 控制状态 Store
interface ControlStore {
  // 本地状态
  local: {
    audioMuted: boolean;
    videoEnabled: boolean;
    audioDeviceId: string;
    videoDeviceId: string;
  };

  // 远端状态
  remote: Map<string, RemotePeerState>;

  // 操作方法
  toggleAudio: () => void;
  toggleVideo: () => void;
  setAudioDevice: (deviceId: string) => void;
  setVideoDevice: (deviceId: string) => void;
}

const useControlStore = create<ControlStore>((set, get) => ({
  local: initialState,
  remote: new Map(),

  toggleAudio: async () => {
    const { local, meetingId } = get();

    // 发送控制信令
    await sendControlSignal({
      type: local.audioMuted ? 'resume' : 'pause',
      kind: 'audio',
      meetingId
    });

    // 乐观更新
    set(state => ({
      local: { ...state.local, audioMuted: !state.local.audioMuted }
    }));
  }
}));
```

### 3.2 设备管理实现

#### 3.2.1 设备枚举与监听

**设备发现服务**：
```typescript
class DeviceManager {
  private audioDevices: MediaDeviceInfo[] = [];
  private videoDevices: MediaDeviceInfo[] = [];

  async initialize() {
    // 初始设备枚举
    await this.refreshDevices();

    // 监听设备变化
    navigator.mediaDevices.addEventListener('devicechange',
      this.handleDeviceChange.bind(this)
    );
  }

  private async refreshDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();

    this.audioDevices = devices.filter(d => d.kind === 'audioinput');
    this.videoDevices = devices.filter(d => d.kind === 'videoinput');

    // 触发设备更新事件
    this.emit('devicesChanged', { audio: this.audioDevices, video: this.videoDevices });
  }

  private handleDeviceChange() {
    // 防抖处理，避免频繁刷新
    clearTimeout(this.refreshTimeout);
    this.refreshTimeout = setTimeout(() => this.refreshDevices(), 500);
  }
}
```

#### 3.2.2 设备切换逻辑

**音频设备切换**：
```typescript
async switchAudioDevice(newDeviceId: string): Promise<void> {
  const oldDeviceId = this.currentAudioDeviceId;

  if (oldDeviceId === newDeviceId) return;

  try {
    // 1. 暂停当前音频 Producer
    if (this.audioProducer && !this.audioProducer.paused) {
      await this.audioProducer.pause();
    }

    // 2. 获取新设备流
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: newDeviceId } },
      video: false
    });

    // 3. 创建新 Producer
    const newTrack = newStream.getAudioTracks()[0];
    const newProducer = await this.sendTransport.produce({
      track: newTrack,
      codecOptions: { /* 音频编码参数 */ }
    });

    // 4. 关闭旧 Producer
    if (this.audioProducer) {
      this.audioProducer.close();
    }

    // 5. 更新状态
    this.audioProducer = newProducer;
    this.currentAudioDeviceId = newDeviceId;

    // 6. 恢复音频（如果之前不是静音状态）
    if (!this.audioMuted) {
      await this.audioProducer.resume();
    }

  } catch (error) {
    console.error('设备切换失败:', error);
    // 回滚到原设备
    await this.fallbackToOldDevice(oldDeviceId);
  }
}
```

### 3.3 错误处理与恢复

#### 3.3.1 控制指令错误处理

**重试机制**：
```typescript
async function sendControlSignalWithRetry(
  signal: ControlSignal,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ack = await sendSignal(signal.type, signal.data);

      if (ack.success) {
        return; // 成功返回
      }

      // 服务端确认失败，等待后重试
      await sleep(attempt * 1000); // 指数退避

    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`控制指令失败: ${error.message}`);
      }

      console.warn(`控制指令第${attempt}次失败:`, error);
      await sleep(attempt * 1000);
    }
  }
}
```

#### 3.3.2 状态不一致恢复

**状态同步检查**：
```typescript
class StateConsistencyChecker {
  private lastSyncTime = 0;
  private syncInterval = 30000; // 30秒同步一次

  start() {
    setInterval(() => this.checkConsistency(), this.syncInterval);
  }

  async checkConsistency() {
    const localState = this.getLocalState();
    const serverState = await this.fetchServerState();

    if (!this.statesMatch(localState, serverState)) {
      console.warn('状态不一致，强制同步');
      await this.forceSync(serverState);
    }
  }

  private statesMatch(local: ControlState, server: ControlState): boolean {
    return local.audioMuted === server.audioPaused &&
           local.videoEnabled === !server.videoPaused;
  }
}
```

---

## 4. 后端技术实现

### 4.1 Mediasoup 服务扩展

#### 4.1.1 ControlService 设计

```typescript
@Injectable()
export class ControlService {
  constructor(
    private mediasoupService: MediasoupService,
    private signalingService: SignalingService
  ) {}

  async pauseProducer(
    meetingId: string,
    peerId: string,
    producerId: string
  ): Promise<void> {
    const room = this.mediasoupService.getRoom(meetingId);
    const peer = room.peers.get(peerId);
    const producer = peer.producers.get(producerId);

    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }

    // 暂停 Producer
    await producer.pause();

    // 更新状态
    await this.updatePeerState(peerId, {
      [`${producer.kind}Paused`]: true
    });

    // 广播状态变化
    await this.broadcastStateChange(meetingId, peerId, producer.kind, true);
  }

  private async broadcastStateChange(
    meetingId: string,
    peerId: string,
    kind: 'audio' | 'video',
    paused: boolean
  ): Promise<void> {
    await this.signalingService.broadcastToRoom(meetingId, {
      type: 'rtc:stateSync',
      data: {
        peerId,
        [`${kind}Paused`]: paused,
        timestamp: Date.now()
      }
    });
  }
}
```

#### 4.1.2 WebSocket Gateway 扩展

```typescript
@WebSocketGateway()
export class ControlGateway {
  @SubscribeMessage('rtc:producerPause')
  async handleProducerPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ProducerPauseRequest
  ): Promise<ControlAckResponse> {
    try {
      await this.controlService.pauseProducer(
        data.meetingId,
        data.peerId,
        data.producerId
      );

      return {
        type: 'rtc:controlAck',
        data: {
          requestId: data.requestId,
          success: true,
          producerId: data.producerId,
          paused: true,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      return {
        type: 'rtc:controlAck',
        data: {
          requestId: data.requestId,
          success: false,
          error: error.message,
          timestamp: Date.now()
        }
      };
    }
  }
}
```

### 4.2 状态持久化策略

#### 4.2.1 内存状态管理

**状态存储结构**：
```typescript
interface MeetingControlState {
  meetingId: string;
  peers: Map<string, PeerControlState>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ControlStateManager {
  private meetings: Map<string, MeetingControlState> = new Map();

  getMeetingState(meetingId: string): MeetingControlState {
    if (!this.meetings.has(meetingId)) {
      this.meetings.set(meetingId, {
        meetingId,
        peers: new Map(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    return this.meetings.get(meetingId)!;
  }

  updatePeerState(meetingId: string, peerId: string, updates: Partial<PeerControlState>) {
    const meeting = this.getMeetingState(meetingId);
    const peerState = meeting.peers.get(peerId) || this.createPeerState(peerId);

    Object.assign(peerState, updates, { updatedAt: new Date() });
    meeting.peers.set(peerId, peerState);
    meeting.updatedAt = new Date();
  }
}
```

#### 4.2.2 状态清理机制

**自动清理**：
```typescript
@Injectable()
export class StateCleanupService {
  private cleanupInterval = 5 * 60 * 1000; // 5分钟清理一次

  @Cron('*/5 * * * *') // 每5分钟执行一次
  async cleanupExpiredStates() {
    const now = new Date();
    const expirationTime = 30 * 60 * 1000; // 30分钟过期

    for (const [meetingId, meeting] of this.controlStateManager.meetings) {
      if (now.getTime() - meeting.updatedAt.getTime() > expirationTime) {
        // 会议状态过期，清理
        this.controlStateManager.meetings.delete(meetingId);
        console.log(`清理过期会议状态: ${meetingId}`);
      }
    }
  }
}
```

---

## 5. 性能优化方案

### 5.1 控制指令优化

#### 5.1.1 信令压缩

**消息格式优化**：
```typescript
// 优化前
{
  type: 'rtc:producerPause',
  data: {
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    producerId: 'producer-uuid-001',
    kind: 'audio'
  }
}

// 优化后（使用短字段名）
{
  t: 'pause',
  d: {
    m: '550e8400-e29b-41d4-a716-446655440000',
    p: 'producer-uuid-001',
    k: 'a' // 'a' for audio, 'v' for video
  }
}
```

#### 5.1.2 批量操作支持

**批量控制信令**：
```typescript
interface BatchControlRequest {
  type: 'rtc:batchControl';
  data: {
    meetingId: string;
    operations: Array<{
      producerId: string;
      kind: 'audio' | 'video';
      action: 'pause' | 'resume';
    }>;
  };
}
```

### 5.2 状态同步优化

#### 5.2.1 增量同步

**只同步变化的状态**：
```typescript
interface DeltaStateSync {
  type: 'rtc:deltaSync';
  data: {
    peerId: string;
    changes: Array<{
      field: 'audioPaused' | 'videoPaused';
      value: boolean;
      timestamp: number;
    }>;
  };
}
```

#### 5.2.2 智能广播策略

**条件广播**：
```typescript
class SmartBroadcaster {
  async broadcastStateChange(meetingId: string, changes: StateChange[]) {
    const room = this.getRoom(meetingId);

    // 只广播给关注该状态的客户端
    for (const peer of room.peers.values()) {
      if (this.shouldNotifyPeer(peer, changes)) {
        await this.sendToPeer(peer, changes);
      }
    }
  }

  private shouldNotifyPeer(peer: PeerInfo, changes: StateChange[]): boolean {
    // 检查该客户端是否订阅了相关状态
    return changes.some(change =>
      peer.subscribedStates.includes(change.field)
    );
  }
}
```

---

## 6. 测试策略

### 6.1 单元测试

#### 6.1.1 控制逻辑测试

```typescript
describe('ControlService', () => {
  let controlService: ControlService;
  let mockProducer: jest.Mocked<Producer>;

  beforeEach(() => {
    mockProducer = {
      pause: jest.fn(),
      resume: jest.fn(),
      paused: false
    } as any;

    controlService = new ControlService(mockMediasoupService, mockSignalingService);
  });

  test('pauseProducer should call producer.pause()', async () => {
    await controlService.pauseProducer('meeting-1', 'peer-1', 'producer-1');

    expect(mockProducer.pause).toHaveBeenCalledTimes(1);
    expect(mockProducer.paused).toBe(true);
  });

  test('resumeProducer should call producer.resume()', async () => {
    mockProducer.paused = true;

    await controlService.resumeProducer('meeting-1', 'peer-1', 'producer-1');

    expect(mockProducer.resume).toHaveBeenCalledTimes(1);
    expect(mockProducer.paused).toBe(false);
  });
});
```

### 6.2 集成测试

#### 6.2.1 端到端控制流程测试

```typescript
describe('End-to-End Control Flow', () => {
  test('user can mute and unmute microphone', async () => {
    // 1. 用户加入会议
    await joinMeeting('meeting-1');

    // 2. 点击静音按钮
    await page.click('[data-testid="mute-button"]');

    // 3. 验证本地状态变化
    await expect(page.locator('[data-testid="mute-button"]'))
      .toHaveAttribute('data-muted', 'true');

    // 4. 验证远端收到状态同步
    await expect(otherUserPage.locator(`[data-peer="user-1"]`))
      .toHaveAttribute('data-audio-muted', 'true');

    // 5. 取消静音
    await page.click('[data-testid="mute-button"]');

    // 6. 验证状态恢复
    await expect(otherUserPage.locator(`[data-peer="user-1"]`))
      .toHaveAttribute('data-audio-muted', 'false');
  });
});
```

### 6.3 性能测试

#### 6.3.1 控制延迟测试

```typescript
describe('Control Latency', () => {
  test('control operation should complete within 100ms', async () => {
    const startTime = Date.now();

    await controlService.pauseProducer('meeting-1', 'peer-1', 'producer-1');

    const endTime = Date.now();
    const latency = endTime - startTime;

    expect(latency).toBeLessThan(100);
  });

  test('state synchronization should complete within 200ms', async () => {
    const startTime = Date.now();

    // 触发状态同步
    await triggerStateSync('meeting-1', 'peer-1');

    // 等待所有客户端收到同步
    await waitForAllClientsToReceiveSync();

    const endTime = Date.now();
    const syncLatency = endTime - startTime;

    expect(syncLatency).toBeLessThan(200);
  });
});
```

---

## 7. 部署与运维

### 7.1 配置管理

#### 7.1.1 环境配置

```yaml
# config/control.yml
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

#### 7.1.2 性能调优参数

```typescript
// 性能优化配置
const performanceConfig = {
  // WebSocket 消息批处理大小
  batchSize: 10,

  // 状态同步并发限制
  concurrencyLimit: 100,

  // 内存状态缓存大小
  cacheSize: 1000,

  // 控制指令队列大小
  queueSize: 1000
};
```

### 7.2 监控与告警

#### 7.2.1 关键指标监控

**控制延迟监控**：
```promql
# 控制指令平均延迟
avg(control_command_duration_seconds)

# 控制指令 P95 延迟
histogram_quantile(0.95, sum(rate(control_command_duration_seconds_bucket[5m])) by (le))

# 状态同步延迟
avg(state_sync_duration_seconds)
```

**成功率监控**：
```promql
# 控制指令成功率
rate(control_command_success_total[5m]) / rate(control_command_total[5m])

# 状态同步成功率
rate(state_sync_success_total[5m]) / rate(state_sync_total[5m])
```

#### 7.2.2 告警规则

```yaml
alert: HighControlLatency
expr: histogram_quantile(0.95, rate(control_command_duration_seconds_bucket[5m])) > 0.1
for: 2m
labels:
  severity: warning
annotations:
  summary: "控制指令延迟过高"
  description: "P95控制指令延迟超过100ms"

alert: ControlFailureRateHigh
expr: rate(control_command_failure_total[5m]) / rate(control_command_total[5m]) > 0.05
for: 2m
labels:
  severity: critical
annotations:
  summary: "控制指令失败率过高"
  description: "控制指令失败率超过5%"
```

---

## 8. 风险评估与应对

### 8.1 技术风险

| 风险项 | 风险等级 | 影响 | 应对措施 |
|--------|---------|------|---------|
| Producer pause/resume 机制不稳定 | 中 | 控制功能失效 | 增加重试机制，准备降级方案 |
| 状态同步延迟过高 | 中 | 用户体验差 | 优化广播策略，增量同步 |
| 设备切换失败 | 低 | 功能受限 | 自动回滚，错误提示 |
| 内存状态丢失 | 低 | 状态不一致 | 定期持久化，状态重建 |

### 8.2 兼容性风险

| 浏览器/平台 | 风险点 | 应对措施 |
|------------|--------|---------|
| Safari 14+ | 设备枚举权限限制 | 引导用户手动授权 |
| 旧版 Chrome | WebRTC API 差异 | 功能检测，降级处理 |
| Electron | 系统权限处理 | 使用系统级权限 API |
| 移动端浏览器 | 触摸交互适配 | 响应式设计，手势支持 |

### 8.3 性能风险

| 场景 | 风险点 | 应对措施 |
|------|--------|---------|
| 多人同时操作 | 信令风暴 | 限流，批量处理 |
| 弱网环境 | 控制指令失败 | 重试机制，状态缓存 |
| 高并发会议 | 内存压力 | 状态清理，资源限制 |

---

## 9. 后续演进规划

### 9.1 v0.2 增强功能

**高级控制功能**：
- 语音激活检测（VAD）自动静音
- 设备质量监测与自动切换
- 控制权限管理（主持人控制）
- 状态快捷键自定义

### 9.2 v0.3 智能功能

**AI 增强控制**：
- 智能噪音检测与自动降噪
- 语音识别自动字幕
- 面部识别自动美颜
- 情绪检测状态提示

### 9.3 架构演进

**微服务化**：
- 控制服务独立部署
- 状态服务集群化
- 消息队列异步处理
- 分布式状态存储

---

## 10. 参考资料

- [mediasoup Producer API 文档](https://mediasoup.org/documentation/v3/mediasoup/api/#Producer)
- [WebRTC 设备管理 API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)
- [REQ-003 技术方案](../REQ-003/tech_research.md)
- [REQ-004 需求分析](../analysis.md)

---

**文档状态**: 草稿框架（待 architect 完善）
**下一步**: 评审阶段（Task #110）