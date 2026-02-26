# REQ-003 音视频通话功能技术调研报告

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 音视频通话功能
- **文档类型**: 技术调研报告
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: architect
- **状态**: 待评审

---

## 1. 调研概述

### 1.1 调研目标

为视频会议系统 MVP v0.1 的音视频通话功能确定技术方案，涵盖：
- mediasoup v3 SFU 服务端集成方案
- WebRTC 信令消息设计与 REQ-002 WebSocket 基础设施集成
- 前端 mediasoup-client 集成方案
- 弱网处理（20% 丢包）降级策略
- 信令服务 Room/Peer 内存数据模型
- 技术选型对比与风险评估

### 1.2 调研背景

当前已完成：
- NestJS + DDD 分层架构（REQ-001/REQ-002）
- PostgreSQL + TypeORM（meetings、meeting_participants 表）
- Redis Cache Manager
- JWT 认证（REQ-001）
- WebSocket Gateway（`MeetingGateway`，`/` 命名空间，socket.io）
- 会议管理 API（创建/加入/离开/结束）

`MeetingGateway` 已实现 `join_meeting_room`/`leave_meeting_room` 消息和 `meeting.ended`/`meeting.participant_joined` 事件推送，本次 REQ-003 需在同一 WebSocket 连接上扩展 WebRTC 信令消息。

---

## 2. mediasoup SFU 方案调研

### 2.1 mediasoup v3 核心概念

#### 2.1.1 架构层次

```
Worker（操作系统进程，绑定单 CPU 核）
  └── Router（会议房间，一个 Worker 可有多个 Router）
        ├── WebRtcTransport（每个 Peer 的发送 Transport）
        │     └── Producer（音频/视频生产者，每个 Track 一个）
        └── WebRtcTransport（每个 Peer 的接收 Transport）
              └── Consumer（订阅某个 Producer 的消费者）
```

#### 2.1.2 Worker

- **定义**：Node.js 通过子进程（C++ 实现）启动的媒体处理进程
- **CPU 绑定**：每个 Worker 绑定一个 CPU 核心，充分利用多核
- **Worker 数量策略**：`os.cpus().length`（生产环境），开发环境 1 个
- **Worker 配置参数**：

```typescript
import * as mediasoup from 'mediasoup';
import * as os from 'os';

const workerSettings: mediasoup.types.WorkerSettings = {
  logLevel: 'warn',
  logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  rtcMinPort: 40000,
  rtcMaxPort: 49999,
};

// 创建 Worker 池
const workers: mediasoup.types.Worker[] = [];
const numWorkers = os.cpus().length;

for (let i = 0; i < numWorkers; i++) {
  const worker = await mediasoup.createWorker(workerSettings);
  workers.push(worker);
}

// 轮询分配策略
let workerIndex = 0;
function getNextWorker(): mediasoup.types.Worker {
  const worker = workers[workerIndex];
  workerIndex = (workerIndex + 1) % workers.length;
  return worker;
}
```

#### 2.1.3 Router（会议 Room 的媒体路由器）

- **对应关系**：每个会议 Room 创建一个 Router
- **生命周期**：Router 随 Room 创建而创建，随 Room 关闭而关闭
- **媒体编解码器配置**：

```typescript
const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

// 创建 Router
const router = await worker.createRouter({ mediaCodecs });
```

#### 2.1.4 WebRtcTransport

每个 Peer 需创建两个 Transport：
- **Send Transport**：Peer 向服务器发布流（上行）
- **Recv Transport**：Peer 从服务器接收流（下行）

```typescript
const transportOptions: mediasoup.types.WebRtcTransportOptions = {
  listenIps: [
    {
      ip: '0.0.0.0',
      announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP, // 公网 IP
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1000000, // 1 Mbps
  minimumAvailableOutgoingBitrate: 600000,
  maxSctpMessageSize: 262144,
};

const transport = await router.createWebRtcTransport(transportOptions);
```

**ICE/DTLS 配置说明**：
- `enableUdp: true`：优先 UDP，延迟最低
- `enableTcp: true`：UDP 不通时 TCP 回退
- `preferUdp: true`：ICE 候选者优先 UDP
- `announcedIp`：公网部署时必须配置，否则 ICE 失败

#### 2.1.5 Producer（媒体发布者）

```typescript
// 客户端发起 produce 后，服务端创建 Producer
const producer = await transport.produce({
  kind,        // 'audio' | 'video'
  rtpParameters,
  // Simulcast 时 rtpParameters 包含多个 encoding
});
```

#### 2.1.6 Consumer（媒体订阅者）

```typescript
// 为 Peer B 创建消费 Peer A 视频流的 Consumer
const consumer = await transport.consume({
  producerId: producer.id,
  rtpCapabilities: peerRtpCapabilities, // 客户端能力
  paused: true, // 初始暂停，客户端准备好后 resume
});
```

---

### 2.2 Simulcast 配置

#### 2.2.1 三层编码参数

| 层级 | 分辨率 | 帧率 | 码率 | rid |
|------|--------|------|------|-----|
| 低清 | 320×180 | 15fps | 100 kbps | r0 |
| 标清 | 640×360 | 24fps | 300 kbps | r1 |
| 高清 | 1280×720 | 30fps | 1500 kbps | r2 |

#### 2.2.2 前端 Simulcast 发送配置

```typescript
// mediasoup-client 发布 Simulcast 视频流
const videoProducer = await sendTransport.produce({
  track: videoTrack,
  encodings: [
    { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
    { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
    { rid: 'r2', maxBitrate: 1500000, scalabilityMode: 'S1T3' },
  ],
  codecOptions: {
    videoGoogleStartBitrate: 1000,
  },
});
```

#### 2.2.3 Consumer 层切换

```typescript
// 服务端根据网络质量切换 Simulcast 层
await consumer.setPreferredLayers({
  spatialLayer: 2,  // 0=低清, 1=标清, 2=高清
  temporalLayer: 2,
});
```

---

### 2.3 RTP 能力协商

```
客户端                          服务端
  |                               |
  |-- getRouterRtpCapabilities --> |  获取 Router 支持的编解码器
  |<-- routerRtpCapabilities ----- |
  |                               |
  | device.load(routerRtpCapabilities)  // 本地初始化
  |                               |
  |-- createTransport ----------> |  请求创建 Transport
  |<-- transportParams ---------- |  返回 ICE/DTLS 参数
  |                               |
  | device.createSendTransport(transportParams)
  |                               |
  | transport.on('connect') -> connectTransport 信令
  | transport.on('produce') -> produce 信令
```

---

## 3. WebRTC 信令设计

### 3.1 信令消息类型定义

#### 3.1.1 消息格式规范

复用 REQ-002 WebSocket 连接（`MeetingGateway`），所有信令通过 socket.io 消息传输。

**请求格式**（客户端 → 服务端）：
```typescript
interface SignalingRequest {
  type: string;     // 消息类型
  data: object;     // 消息数据
  requestId: string; // 用于匹配响应（可选，客户端生成）
}
```

**响应格式**（服务端 → 客户端）：
```typescript
interface SignalingResponse {
  requestId?: string;  // 对应请求 ID
  data?: object;       // 响应数据
  error?: string;      // 错误信息
}
```

#### 3.1.2 信令消息清单

**① join — 加入会议房间（信令层）**

```typescript
// 客户端发送
socket.emit('rtc:join', { meetingId: string });

// 服务端响应（emit 回 socket）
socket.emit('rtc:joined', {
  peerId: string,        // 服务端分配的 Peer ID
  peers: PeerInfo[],     // 房间内已有的 Peer 列表
});
```

**② getRouterRtpCapabilities — 获取路由器 RTP 能力**

```typescript
// 客户端发送
socket.emit('rtc:getRouterRtpCapabilities', { meetingId: string });

// 服务端响应
socket.emit('rtc:routerRtpCapabilities', {
  rtpCapabilities: mediasoup.types.RtpCapabilities,
});
```

**③ createTransport — 创建 Transport**

```typescript
// 客户端发送
socket.emit('rtc:createTransport', {
  meetingId: string,
  direction: 'send' | 'recv',  // 发送或接收
});

// 服务端响应
socket.emit('rtc:transportCreated', {
  transportId: string,
  iceParameters: mediasoup.types.IceParameters,
  iceCandidates: mediasoup.types.IceCandidate[],
  dtlsParameters: mediasoup.types.DtlsParameters,
});
```

**④ connectTransport — 连接 Transport（DTLS 握手）**

```typescript
// 客户端发送（transport 'connect' 事件触发）
socket.emit('rtc:connectTransport', {
  meetingId: string,
  transportId: string,
  dtlsParameters: mediasoup.types.DtlsParameters,
});

// 服务端响应
socket.emit('rtc:transportConnected', { transportId: string });
```

**⑤ produce — 发布媒体流**

```typescript
// 客户端发送（transport 'produce' 事件触发）
socket.emit('rtc:produce', {
  meetingId: string,
  transportId: string,
  kind: 'audio' | 'video',
  rtpParameters: mediasoup.types.RtpParameters,
  appData?: object,
});

// 服务端响应
socket.emit('rtc:produced', {
  producerId: string,
});
```

**⑥ consume — 订阅媒体流**

```typescript
// 客户端发送
socket.emit('rtc:consume', {
  meetingId: string,
  producerId: string,
  rtpCapabilities: mediasoup.types.RtpCapabilities,
});

// 服务端响应
socket.emit('rtc:consumed', {
  consumerId: string,
  producerId: string,
  kind: 'audio' | 'video',
  rtpParameters: mediasoup.types.RtpParameters,
  type: string,
  producerPaused: boolean,
});
```

**⑦ newProducer — 新生产者通知（服务端广播）**

```typescript
// 服务端向房间内其他 Peer 广播
socket.to(`meeting:${meetingId}`).emit('rtc:newProducer', {
  producerId: string,
  peerId: string,
  kind: 'audio' | 'video',
  appData?: object,
});
```

**⑧ producerClosed — 生产者关闭通知（服务端广播）**

```typescript
// 服务端向房间广播
socket.to(`meeting:${meetingId}`).emit('rtc:producerClosed', {
  producerId: string,
  peerId: string,
});
```

**⑨ leave — 离开会议（信令层清理）**

```typescript
// 客户端发送
socket.emit('rtc:leave', { meetingId: string });

// 服务端：关闭该 Peer 的所有 Transport/Producer/Consumer
// 广播给房间内其他 Peer
socket.to(`meeting:${meetingId}`).emit('rtc:peerLeft', { peerId: string });
```

### 3.2 与 REQ-002 WebSocket 基础设施的集成方式

#### 3.2.1 集成策略

**方案：扩展现有 `MeetingGateway`**

在现有 `MeetingGateway`（`apps/backend/src/api/gateways/meeting.gateway.ts`）中增加 RTC 相关 `@SubscribeMessage` 处理器，而非新建 Gateway。

**优势**：
- 复用同一 WebSocket 连接（减少握手开销）
- 客户端连接管理统一
- REQ-002 的 `meeting:${meetingId}` 房间机制直接复用

**集成示意**：

```typescript
// apps/backend/src/api/gateways/meeting.gateway.ts（扩展）
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // ... 现有 REQ-002 消息处理 ...

  // 新增 RTC 信令处理
  @SubscribeMessage('rtc:join')
  async handleRtcJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { meetingId: string }) {
    // 调用 MediasoupService 获取/创建 Room
    // 返回 peerId 和已有 peers 列表
  }

  @SubscribeMessage('rtc:getRouterRtpCapabilities')
  async handleGetRouterRtpCapabilities(...) { ... }

  @SubscribeMessage('rtc:createTransport')
  async handleCreateTransport(...) { ... }

  @SubscribeMessage('rtc:connectTransport')
  async handleConnectTransport(...) { ... }

  @SubscribeMessage('rtc:produce')
  async handleProduce(...) { ... }

  @SubscribeMessage('rtc:consume')
  async handleConsume(...) { ... }

  @SubscribeMessage('rtc:leave')
  async handleRtcLeave(...) { ... }
}
```

#### 3.2.2 新增 MediasoupService

```
apps/backend/src/application/services/mediasoup.service.ts
```

负责管理 Worker 池、Room（Router）生命周期、Peer 状态，作为 `MeetingGateway` 的依赖注入服务。

### 3.3 STUN/TURN 服务配置方案

#### 3.3.1 STUN 服务器

**MVP 阶段推荐**：使用 Google 公共 STUN 服务器

```typescript
// WebRtcTransport ICE 服务器配置（客户端侧）
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```

**注意**：mediasoup 的 ICE 候选者由 Worker 进程处理，STUN 主要用于 NAT 穿透，需确保 `announcedIp` 配置正确。

#### 3.3.2 TURN 服务器（弱网/NAT 穿透失败时）

**方案**：自托管 coturn

```bash
# coturn 基础配置
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=<公网IP>
realm=meeting.example.com
user=user:password
lt-cred-mech
```

**客户端配置**：
```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:turn.example.com:3478',
    username: 'user',
    credential: 'password',
  },
];
```

**MVP 决策**：
- 内网/开发环境：仅 STUN（或无）
- 生产环境：STUN + coturn TURN（对称 NAT 穿透兜底）

---

## 4. 前端 WebRTC 客户端方案

### 4.1 mediasoup-client 库集成

```bash
npm install mediasoup-client
```

**版本要求**：mediasoup-client v3（与服务端 mediasoup v3 配套）

### 4.2 Device 初始化流程

```typescript
import { Device } from 'mediasoup-client';

class RtcClient {
  private device: Device;

  async initialize(meetingId: string): Promise<void> {
    // 1. 创建 Device 实例
    this.device = new Device();

    // 2. 从服务端获取 Router RTP 能力
    const { rtpCapabilities } = await this.request('rtc:getRouterRtpCapabilities', { meetingId });

    // 3. 加载能力（设备能力协商）
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
  }
}
```

### 4.3 SendTransport / RecvTransport 建立

```typescript
async createSendTransport(meetingId: string): Promise<void> {
  // 1. 请求服务端创建 Transport
  const transportParams = await this.request('rtc:createTransport', {
    meetingId,
    direction: 'send',
  });

  // 2. 本地创建 SendTransport
  this.sendTransport = this.device.createSendTransport(transportParams);

  // 3. 监听 connect 事件（DTLS 握手）
  this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await this.request('rtc:connectTransport', {
        meetingId,
        transportId: this.sendTransport.id,
        dtlsParameters,
      });
      callback();
    } catch (e) {
      errback(e);
    }
  });

  // 4. 监听 produce 事件
  this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
    try {
      const { producerId } = await this.request('rtc:produce', {
        meetingId,
        transportId: this.sendTransport.id,
        kind,
        rtpParameters,
        appData,
      });
      callback({ id: producerId });
    } catch (e) {
      errback(e);
    }
  });
}

async createRecvTransport(meetingId: string): Promise<void> {
  const transportParams = await this.request('rtc:createTransport', {
    meetingId,
    direction: 'recv',
  });

  this.recvTransport = this.device.createRecvTransport(transportParams);

  this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await this.request('rtc:connectTransport', {
        meetingId,
        transportId: this.recvTransport.id,
        dtlsParameters,
      });
      callback();
    } catch (e) {
      errback(e);
    }
  });
}
```

### 4.4 本地流采集（getUserMedia）

```typescript
async startLocalStream(): Promise<void> {
  // 采集本地音视频
  this.localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 48000,
    },
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    },
  });

  // 发布音频 Producer
  const audioTrack = this.localStream.getAudioTracks()[0];
  this.audioProducer = await this.sendTransport.produce({
    track: audioTrack,
    codecOptions: {
      opusStereo: true,
      opusDtx: true,      // 静音检测，节省带宽
      opusFec: true,       // 前向纠错
      opusMaxPlaybackRate: 48000,
    },
  });

  // 发布视频 Producer（Simulcast）
  const videoTrack = this.localStream.getVideoTracks()[0];
  this.videoProducer = await this.sendTransport.produce({
    track: videoTrack,
    encodings: [
      { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
      { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
      { rid: 'r2', maxBitrate: 1500000, scalabilityMode: 'S1T3' },
    ],
    codecOptions: {
      videoGoogleStartBitrate: 1000,
    },
  });
}
```

### 4.5 远端流渲染（video 元素管理）

```typescript
// 订阅远端流并渲染到 video 元素
async consumeRemoteStream(producerId: string, peerId: string): Promise<void> {
  const consumerParams = await this.request('rtc:consume', {
    meetingId: this.meetingId,
    producerId,
    rtpCapabilities: this.device.rtpCapabilities,
  });

  const consumer = await this.recvTransport.consume(consumerParams);

  // 创建 MediaStream 并挂载到 video 元素
  const stream = new MediaStream([consumer.track]);
  const videoEl = document.getElementById(`video-${peerId}`) as HTMLVideoElement;
  if (videoEl) {
    videoEl.srcObject = stream;
    videoEl.play().catch(console.error);
  }

  // 通知服务端 Consumer 已就绪，可开始接收
  await this.request('rtc:resumeConsumer', {
    meetingId: this.meetingId,
    consumerId: consumer.id,
  });

  this.consumers.set(consumer.id, consumer);
}

// 监听新 Producer 通知
socket.on('rtc:newProducer', async ({ producerId, peerId }) => {
  await this.consumeRemoteStream(producerId, peerId);
});
```

### 4.6 Simulcast 发送配置总结

| 参数 | 值 |
|------|-----|
| 层数 | 3 层（rid: r0/r1/r2） |
| scalabilityMode | S1T3（单空间层，3 时间层） |
| 低清码率上限 | 100 kbps（180p@15fps） |
| 标清码率上限 | 300 kbps（360p@24fps） |
| 高清码率上限 | 1500 kbps（720p@30fps） |

---

## 5. 弱网处理策略

### 5.1 20% 丢包场景降级策略

WebRTC 内置的 GCC（Google Congestion Control）算法会在高丢包时自动降低码率，结合 Simulcast 实现分层降级：

```
丢包率 0~5%   → 高清层（r2，720p，1500kbps），正常通话
丢包率 5~10%  → 标清层（r1，360p，300kbps），NACK 重传
丢包率 10~20% → 低清层（r0，180p，100kbps），FEC 启用
丢包率 >20%  → 关闭视频，仅保留音频（Opus FEC 保障）
```

### 5.2 Simulcast 层切换触发条件

**服务端主动切换**：根据 Consumer 的 `getStats()` 监控指标，自动切换 `preferredLayers`。

```typescript
// 定期检查 Consumer 统计，自动降级
setInterval(async () => {
  for (const [consumerId, consumer] of consumers) {
    const stats = await consumer.getStats();
    const packetLoss = calculatePacketLoss(stats);

    if (packetLoss > 0.20) {
      // >20% 丢包：关闭视频
      await consumer.pause();
    } else if (packetLoss > 0.10) {
      // 10-20% 丢包：切低清
      await consumer.setPreferredLayers({ spatialLayer: 0, temporalLayer: 2 });
    } else if (packetLoss > 0.05) {
      // 5-10% 丢包：切标清
      await consumer.setPreferredLayers({ spatialLayer: 1, temporalLayer: 2 });
    } else {
      // <5% 丢包：切高清
      await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    }
  }
}, 3000); // 每 3 秒检查一次
```

**客户端主动降级**：监听 `RTCPeerConnection` 统计并通知服务端。

### 5.3 网络质量指标采集

```typescript
// 前端定期采集 RTCPeerConnection 统计
async function collectStats(producer: Producer): Promise<NetworkStats> {
  const report = await producer.getStats();
  let rtt = 0, packetLoss = 0, bitrate = 0;

  for (const stat of report.values()) {
    if (stat.type === 'outbound-rtp') {
      // 计算丢包率
      const lostPackets = stat.packetsLost ?? 0;
      const sentPackets = stat.packetsSent ?? 0;
      packetLoss = sentPackets > 0 ? lostPackets / sentPackets : 0;
    }
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
      rtt = stat.currentRoundTripTime * 1000; // 转为 ms
    }
    if (stat.type === 'outbound-rtp') {
      bitrate = stat.bytesSent * 8 / stat.timestamp; // kbps
    }
  }

  return { rtt, packetLoss, bitrate };
}
```

**关键指标阈值**：

| 指标 | 正常 | 注意 | 降级 | 严重 |
|------|------|------|------|------|
| RTT | <100ms | 100-200ms | 200-500ms | >500ms |
| 丢包率 | <2% | 2-5% | 5-20% | >20% |
| 视频码率 | 800-1500kbps | 300-800kbps | 100-300kbps | <100kbps |

### 5.4 Opus 音频弱网保障

```typescript
// 音频 Producer 配置（弱网增强）
const audioProducer = await sendTransport.produce({
  track: audioTrack,
  codecOptions: {
    opusFec: true,          // 启用 FEC，20% 丢包仍可恢复
    opusDtx: true,          // 静音检测节省带宽
    opusMaxPlaybackRate: 48000,
    opusStereo: false,      // 弱网时改为单声道（节省 50% 带宽）
  },
});
```

Opus 内置 FEC（前向纠错）在 20% 丢包场景下可有效恢复音频，配合 DTX（非连续传输）在弱网下保障通话质量。

---

## 6. 数据模型设计

### 6.1 信令服务 Room/Peer 内存模型

mediasoup 相关状态存储在内存（Node.js 进程中），不持久化到数据库。

```typescript
// apps/backend/src/application/services/mediasoup.service.ts

interface PeerInfo {
  peerId: string;
  userId: string;
  socketId: string;
  sendTransportId?: string;
  recvTransportId?: string;
  producers: Map<string, mediasoup.types.Producer>;   // producerId -> Producer
  consumers: Map<string, mediasoup.types.Consumer>;   // consumerId -> Consumer
}

interface RoomInfo {
  meetingId: string;
  router: mediasoup.types.Router;
  peers: Map<string, PeerInfo>;                       // peerId -> PeerInfo
  transports: Map<string, mediasoup.types.WebRtcTransport>; // transportId -> Transport
  createdAt: Date;
}

@Injectable()
export class MediasoupService {
  private workers: mediasoup.types.Worker[] = [];
  private workerIndex = 0;

  // 核心数据结构：meetingId -> RoomInfo
  private rooms: Map<string, RoomInfo> = new Map();

  async getOrCreateRoom(meetingId: string): Promise<RoomInfo> {
    if (this.rooms.has(meetingId)) {
      return this.rooms.get(meetingId)!;
    }
    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs });
    const room: RoomInfo = {
      meetingId,
      router,
      peers: new Map(),
      transports: new Map(),
      createdAt: new Date(),
    };
    this.rooms.set(meetingId, room);
    return room;
  }

  closeRoom(meetingId: string): void {
    const room = this.rooms.get(meetingId);
    if (room) {
      room.router.close(); // 关闭 Router，自动关闭所有 Transport
      this.rooms.delete(meetingId);
    }
  }
}
```

### 6.2 WebSocket 连接与 mediasoup Transport 的映射关系

```
socket.id (socket.io 连接 ID)
    │
    └── PeerInfo.socketId               # socket 与 Peer 的关联
          │
          ├── PeerInfo.sendTransportId  # → RoomInfo.transports.get(id)
          │                             #   → Transport.on('produce') → Producer
          │
          └── PeerInfo.recvTransportId  # → RoomInfo.transports.get(id)
                                        #   → Transport.consume() → Consumer
```

**socket 断开时的清理流程**：

```typescript
handleDisconnect(client: Socket): void {
  // 查找该 socket 关联的所有 Room/Peer
  for (const [meetingId, room] of this.mediasoupService.rooms) {
    for (const [peerId, peer] of room.peers) {
      if (peer.socketId === client.id) {
        // 关闭该 Peer 的所有资源
        this.mediasoupService.closePeer(meetingId, peerId);
        // 广播 Peer 离开
        client.to(`meeting:${meetingId}`).emit('rtc:peerLeft', { peerId });
        break;
      }
    }
  }
}
```

### 6.3 内存模型关系图

```
MediasoupService (单例)
  │
  ├── workers[]: Worker[]          # Worker 进程池（按 CPU 核数）
  │
  └── rooms: Map<meetingId, RoomInfo>
        │
        └── RoomInfo
              ├── router: Router          # mediasoup Router（每会议一个）
              ├── transports: Map<transportId, WebRtcTransport>
              └── peers: Map<peerId, PeerInfo>
                    └── PeerInfo
                          ├── socketId: string
                          ├── userId: string
                          ├── producers: Map<producerId, Producer>
                          └── consumers: Map<consumerId, Consumer>
```

---

## 7. 技术选型对比与风险评估

### 7.1 媒体服务器选型对比

| 维度 | mediasoup v3 | Janus Gateway | LiveKit | Pion (Go) |
|------|-------------|---------------|---------|-----------|
| 架构 | SFU | SFU/MCU | SFU | SFU |
| 语言 | Node.js + C++ | C | Go | Go |
| TypeScript 集成 | 原生支持 | 需桥接 | SDK | 需桥接 |
| Simulcast 支持 | 完整 | 部分 | 完整 | 部分 |
| 社区活跃度 | 高 | 中 | 高（新兴） | 中 |
| 文档质量 | 优秀 | 一般 | 优秀 | 良好 |
| 与 NestJS 集成 | 无缝 | 复杂 | 需适配 | 复杂 |
| 商业验证 | Discord/Whereby | 多家 | 新兴 | 少 |
| 学习曲线 | 中 | 高 | 低 | 中 |

**选型决策**：mediasoup v3，与现有 NestJS 技术栈完全兼容，TypeScript 支持最佳，商业验证充分。

### 7.2 信令传输方案对比

| 方案 | 与 REQ-002 集成 | 实现成本 | 扩展性 |
|------|---------------|---------|--------|
| 扩展现有 MeetingGateway | 直接复用连接 | 低 | 中 |
| 新建独立 WebSocket | 两条连接 | 中 | 高 |
| HTTP 长轮询 | 增加接口 | 中 | 低 |

**选型决策**：扩展现有 `MeetingGateway`，在 `MeetingModule` 中注入 `MediasoupService`，复用现有 socket.io 房间机制。

### 7.3 风险评估

| 风险 | 严重程度 | 概率 | 应对措施 |
|------|---------|------|---------|
| mediasoup Worker 进程崩溃 | 高 | 低 | 监听 Worker `died` 事件自动重启，从 Worker 池中移除坏 Worker |
| NAT 穿透失败（对称 NAT） | 高 | 中 | 生产环境部署 coturn TURN 服务器；WebRtcTransport 同时开启 UDP/TCP |
| 公网 IP 未配置 announcedIp | 高 | 中 | 通过环境变量 `MEDIASOUP_ANNOUNCED_IP` 强制配置，启动时校验 |
| 多进程 Router 扩展复杂 | 中 | 低 | MVP 单机多 Worker 足够；多机需引入 mediasoup-cluster（Phase 2） |
| 弱网下视频卡顿 | 中 | 中 | Simulcast 降级 + Consumer 层切换；极端情况关闭视频保音频 |
| 内存泄漏（未清理 Transport） | 中 | 中 | socket 断开时强制清理所有资源；定期扫描孤儿 Transport |
| 浏览器 WebRTC 实现差异 | 低 | 低 | mediasoup-client 已抹平差异；使用 adapter.js 兜底 |

### 7.4 MVP 推荐技术方案总结

| 技术点 | 选型 | 理由 |
|-------|------|------|
| 媒体服务器 | mediasoup v3 | TypeScript 原生，商业验证，文档完善 |
| 信令传输 | 扩展 MeetingGateway（socket.io） | 复用 REQ-002 连接，零额外握手 |
| Worker 数量 | `os.cpus().length` | 充分利用多核 |
| 视频编码 | H.264（主）+ VP8（备）+ Opus（音频） | 最佳浏览器兼容性 |
| 自适应码率 | Simulcast（3层：180p/360p/720p） | 弱网降级无需转码 |
| STUN | Google 公共 STUN | 无成本，MVP 阶段够用 |
| TURN | coturn（生产环境） | 覆盖对称 NAT 场景 |
| 弱网降级 | Consumer.setPreferredLayers + 音频 FEC | 20% 丢包下保障通话质量 |

---

## 8. 完整信令流程图

```
客户端 A（发布者）                服务端                   客户端 B（订阅者）
      │                            │                            │
      │── rtc:join ──────────────> │                            │
      │<─ rtc:joined ─────────────│                            │
      │                            │                            │
      │── rtc:getRouterRtpCaps ──> │                            │
      │<─ rtc:routerRtpCaps ──────│                            │
      │  device.load()             │                            │
      │                            │                            │
      │── rtc:createTransport ───> │（direction: 'send'）       │
      │<─ rtc:transportCreated ───│                            │
      │  createSendTransport()     │                            │
      │                            │                            │
      │── rtc:connectTransport ──> │（DTLS 握手）               │
      │<─ rtc:transportConnected ─│                            │
      │                            │                            │
      │── rtc:produce ───────────> │（kind: 'video', Simulcast）│
      │<─ rtc:produced ───────────│                            │
      │                            │── rtc:newProducer ───────> │
      │                            │                            │
      │                            │ <─ rtc:createTransport ───│（direction: 'recv'）
      │                            │── rtc:transportCreated ──>│
      │                            │                            │
      │                            │ <─ rtc:connectTransport ──│
      │                            │── rtc:transportConnected >│
      │                            │                            │
      │                            │ <─ rtc:consume ───────────│
      │                            │── rtc:consumed ──────────>│
      │                            │                            │
      │                            │ <─ rtc:resumeConsumer ────│
      │                            │   consumer.resume()        │
      │                            │                            │
      │                    [视频流 RTP 转发开始]                  │
      │══════════════════════ DTLS-SRTP 媒体流 ═════════════════│
```

---

## 9. 参考资料

### 9.1 现有代码

- WebSocket Gateway：`apps/backend/src/api/gateways/meeting.gateway.ts`
- 会议服务：`apps/backend/src/application/services/meeting.service.ts`
- 会议实体：`apps/backend/src/infrastructure/database/entities/meeting.entity.ts`
- 会议模块：`apps/backend/src/api/controllers/meeting/meeting.module.ts`
- 音视频架构：`docs/architecture/audio_video.md`
- 后端架构：`docs/architecture/backend.md`
- REQ-002 技术调研：`docs/versions/v0.1/requirements/REQ-002/tech_research.md`

### 9.2 技术文档

- [mediasoup v3 官方文档](https://mediasoup.org/documentation/v3/)
- [mediasoup-client 文档](https://mediasoup.org/documentation/v3/mediasoup-client/)
- [mediasoup-demo（官方示例）](https://github.com/versatica/mediasoup-demo)
- [WebRTC Simulcast 指南](https://webrtc.org/getting-started/rtp-simulcast)
- [coturn 配置文档](https://github.com/coturn/coturn)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)

---

**文档版本**: v1.0
**创建日期**: 2026-02-26
**审核状态**: 待评审
**维护人**: architect
