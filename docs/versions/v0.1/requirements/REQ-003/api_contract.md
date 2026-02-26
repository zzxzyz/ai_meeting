# REQ-003 实时音视频通话 API 契约

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 实时音视频通话
- **文档类型**: API 契约
- **版本**: v1.0
- **创建日期**: 2026-02-26
- **作者**: team-lead
- **状态**: 已评审通过

---

## 概述

本文档定义实时音视频通话相关的 WebSocket 信令消息格式、RESTful API 接口及数据模型。所有接口复用 REQ-002 建立的 WebSocket 连接和 JWT 认证体系。

### 核心概念

- **mediasoup SFU 架构**：选择性转发单元，不转码，仅转发媒体流
- **WebRTC Transport**：每个 Peer 有发送（上行）和接收（下行）两个 Transport
- **Producer**：媒体发布者（音频/视频流）
- **Consumer**：媒体订阅者（消费远端流）
- **Simulcast**：同时投流，客户端上传多个分辨率版本

---

## WebSocket 信令消息格式

复用 REQ-002 的 WebSocket 连接（`MeetingGateway`），所有信令通过 socket.io 消息传输。

### 消息格式规范

**请求格式**（客户端 → 服务端）：
```typescript
interface SignalingRequest {
  type: string;     // 消息类型
  data: object;     // 消息数据
  requestId?: string; // 用于匹配响应（可选，客户端生成）
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

### 信令消息清单

#### 1. rtc:join — 加入音视频房间

**客户端 → 服务端**：
```json
{
  "type": "rtc:join",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:joined",
  "data": {
    "peerId": "peer-uuid-001",
    "peers": [
      {
        "peerId": "peer-uuid-002",
        "userId": "user-uuid-002",
        "nickname": "李四",
        "producers": [
          {
            "id": "producer-uuid-001",
            "kind": "video",
            "appData": {}
          },
          {
            "id": "producer-uuid-002",
            "kind": "audio",
            "appData": {}
          }
        ]
      }
    ]
  }
}
```

#### 2. rtc:getRouterRtpCapabilities — 获取路由器 RTP 能力

**客户端 → 服务端**：
```json
{
  "type": "rtc:getRouterRtpCapabilities",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:routerRtpCapabilities",
  "data": {
    "rtpCapabilities": {
      "codecs": [
        {
          "kind": "audio",
          "mimeType": "audio/opus",
          "clockRate": 48000,
          "channels": 2
        },
        {
          "kind": "video",
          "mimeType": "video/VP8",
          "clockRate": 90000
        }
      ],
      "headerExtensions": [
        {
          "uri": "urn:ietf:params:rtp-hdrext:sdes:mid",
          "id": 1
        }
      ]
    }
  }
}
```

#### 3. rtc:createTransport — 创建 Transport

**客户端 → 服务端**：
```json
{
  "type": "rtc:createTransport",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "direction": "send"  // 'send' | 'recv'
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:transportCreated",
  "data": {
    "transportId": "transport-uuid-001",
    "iceParameters": {
      "usernameFragment": "8hhy",
      "password": "ICBxhGBYv9Nl8m"
    },
    "iceCandidates": [
      {
        "foundation": "1",
        "priority": 2122260223,
        "ip": "192.168.1.100",
        "protocol": "udp",
        "port": 40000,
        "type": "host"
      }
    ],
    "dtlsParameters": {
      "role": "auto",
      "fingerprints": [
        {
          "algorithm": "sha-256",
          "value": "82:5A:68:3D:36:C3:0A:DE:AF:67:AC:0C:9F:9D:2B:F4:87:A8:2C:9F:00:2E:33:63:01:63:3D:72:49:60:08:44"
        }
      ]
    }
  }
}
```

#### 4. rtc:connectTransport — 连接 Transport（DTLS 握手）

**客户端 → 服务端**：
```json
{
  "type": "rtc:connectTransport",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "transportId": "transport-uuid-001",
    "dtlsParameters": {
      "role": "client",
      "fingerprints": [
        {
          "algorithm": "sha-256",
          "value": "82:5A:68:3D:36:C3:0A:DE:AF:67:AC:0C:9F:9D:2B:F4:87:A8:2C:9F:00:2E:33:63:01:63:3D:72:49:60:08:44"
        }
      ]
    }
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:transportConnected",
  "data": {
    "transportId": "transport-uuid-001"
  }
}
```

#### 5. rtc:produce — 发布媒体流

**客户端 → 服务端**：
```json
{
  "type": "rtc:produce",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "transportId": "transport-uuid-001",
    "kind": "video",
    "rtpParameters": {
      "codecs": [
        {
          "mimeType": "video/VP8",
          "payloadType": 101,
          "clockRate": 90000,
          "parameters": {}
        }
      ],
      "encodings": [
        {
          "rid": "r0",
          "maxBitrate": 100000,
          "scalabilityMode": "S1T3"
        },
        {
          "rid": "r1",
          "maxBitrate": 300000,
          "scalabilityMode": "S1T3"
        },
        {
          "rid": "r2",
          "maxBitrate": 1500000,
          "scalabilityMode": "S1T3"
        }
      ],
      "headerExtensions": [
        {
          "uri": "urn:ietf:params:rtp-hdrext:sdes:mid",
          "id": 1
        }
      ]
    },
    "appData": {
      "source": "camera"
    }
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:produced",
  "data": {
    "producerId": "producer-uuid-001"
  }
}
```

#### 6. rtc:consume — 订阅媒体流

**客户端 → 服务端**：
```json
{
  "type": "rtc:consume",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "producerId": "producer-uuid-001",
    "rtpCapabilities": {
      "codecs": [
        {
          "kind": "audio",
          "mimeType": "audio/opus",
          "clockRate": 48000,
          "channels": 2
        }
      ]
    }
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:consumed",
  "data": {
    "consumerId": "consumer-uuid-001",
    "producerId": "producer-uuid-001",
    "kind": "video",
    "rtpParameters": {
      "codecs": [
        {
          "mimeType": "video/VP8",
          "payloadType": 101,
          "clockRate": 90000
        }
      ],
      "encodings": [
        {
          "ssrc": 12345678,
          "rid": "r2"
        }
      ]
    },
    "type": "simulcast",
    "producerPaused": false
  }
}
```

#### 7. rtc:resumeConsumer — 恢复 Consumer

**客户端 → 服务端**：
```json
{
  "type": "rtc:resumeConsumer",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "consumerId": "consumer-uuid-001"
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:consumerResumed",
  "data": {
    "consumerId": "consumer-uuid-001"
  }
}
```

#### 8. rtc:leave — 离开音视频房间

**客户端 → 服务端**：
```json
{
  "type": "rtc:leave",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**服务端 → 客户端**：
```json
{
  "type": "rtc:left",
  "data": {
    "peerId": "peer-uuid-001"
  }
}
```

### 服务端广播事件

#### 9. rtc:newProducer — 新生产者通知

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:newProducer",
  "data": {
    "producerId": "producer-uuid-003",
    "peerId": "peer-uuid-003",
    "kind": "video",
    "appData": {
      "source": "camera"
    }
  }
}
```

#### 10. rtc:producerClosed — 生产者关闭通知

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:producerClosed",
  "data": {
    "producerId": "producer-uuid-001",
    "peerId": "peer-uuid-001"
  }
}
```

#### 11. rtc:peerJoined — 新参与者加入通知

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:peerJoined",
  "data": {
    "peerId": "peer-uuid-003",
    "userId": "user-uuid-003",
    "nickname": "王五"
  }
}
```

#### 12. rtc:peerLeft — 参与者离开通知

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:peerLeft",
  "data": {
    "peerId": "peer-uuid-001",
    "userId": "user-uuid-001"
  }
}
```

#### 13. rtc:meetingEnded — 会议结束通知

**服务端 → 客户端（广播）**：
```json
{
  "type": "rtc:meetingEnded",
  "data": {
    "meetingId": "550e8400-e29b-41d4-a716-446655440000",
    "endedBy": "user-uuid-001",
    "endedAt": "2026-02-26T16:30:00.000Z"
  }
}
```

---

## RESTful API 接口

### GET /api/meetings/:meetingId/media-config — 获取媒体服务配置

**用途**：获取 STUN/TURN 服务器配置，用于 WebRTC ICE 候选者收集。

**请求**：
```http
GET /api/meetings/550e8400-e29b-41d4-a716-446655440000/media-config
Authorization: Bearer {access_token}
```

**响应**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "iceServers": [
      {
        "urls": "stun:stun.l.google.com:19302"
      },
      {
        "urls": "stun:stun1.l.google.com:19302"
      },
      {
        "urls": "turn:turn.example.com:3478",
        "username": "user",
        "credential": "password"
      }
    ]
  }
}
```

**错误码**：
- `40401`：会议不存在
- `40301`：无权限访问该会议
- `41001`：会议已结束

---

## 数据模型定义

### 内存数据模型（信令服务）

#### Room（信令房间）
```typescript
interface RoomInfo {
  meetingId: string;                    // 对应 REQ-002 会议 UUID
  router: mediasoup.types.Router;      // mediasoup Router
  peers: Map<string, PeerInfo>;        // peerId → PeerInfo
  transports: Map<string, mediasoup.types.WebRtcTransport>; // transportId → Transport
  createdAt: Date;
}
```

#### Peer（参会者）
```typescript
interface PeerInfo {
  peerId: string;                       // 信令层分配的 Peer ID
  userId: string;                      // 用户 UUID（对应 REQ-001）
  nickname: string;                     // 用户昵称
  socketId: string;                     // WebSocket 连接 ID
  sendTransportId?: string;            // 发送 Transport ID
  recvTransportId?: string;            // 接收 Transport ID
  producers: Map<string, mediasoup.types.Producer>;   // producerId → Producer
  consumers: Map<string, mediasoup.types.Consumer>;   // consumerId → Consumer
}
```

### 数据库更新（与 REQ-002 集成）

信令服务在以下时机更新数据库：

| 事件 | 数据库操作 | SQL 示例 |
|------|-----------|---------|
| 用户断开信令连接 | 更新 left_at 字段 | `UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL` |
| 会议结束（被 REQ-002 触发） | 无（REQ-002 负责更新） | - |

---

## 错误码定义

### WebSocket 信令错误码

| 错误码 | 说明 | 触发场景 |
|--------|------|---------|
| `40001` | 请求参数格式错误 | 信令消息 data 字段缺失或格式错误 |
| `40301` | 无权限访问该会议 | 用户未通过 REQ-002 API 加入会议 |
| `40401` | 会议不存在 | meetingId 对应的会议不存在 |
| `40402` | Transport 不存在 | transportId 对应的 Transport 不存在 |
| `40403` | Producer 不存在 | producerId 对应的 Producer 不存在 |
| `40901` | 会议已结束 | 会议状态为 ENDED，无法建立音视频连接 |
| `50001` | 内部服务器错误 | mediasoup Worker 异常等 |

### RESTful API 错误码

复用 REQ-002 的错误码体系，新增：

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `40401` | 404 | 会议不存在 |
| `40301` | 403 | 无权限访问该会议 |
| `41001` | 410 | 会议已结束 |

---

## 前端 SDK 接口约定

### mediasoup-client 使用规范

#### Device 初始化流程
```typescript
import { Device } from 'mediasoup-client';

// 1. 创建 Device 实例
const device = new Device();

// 2. 获取 Router RTP 能力并加载
const { rtpCapabilities } = await getRouterRtpCapabilities(meetingId);
await device.load({ routerRtpCapabilities: rtpCapabilities });
```

#### SendTransport 建立流程
```typescript
// 1. 创建 SendTransport
const sendTransport = device.createSendTransport({
  id: transportId,
  iceParameters,
  iceCandidates,
  dtlsParameters
});

// 2. 监听 connect 事件
sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
  try {
    await connectTransport(meetingId, transportId, dtlsParameters);
    callback();
  } catch (error) {
    errback(error);
  }
});

// 3. 监听 produce 事件
sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
  try {
    const { producerId } = await produce(meetingId, transportId, kind, rtpParameters, appData);
    callback({ id: producerId });
  } catch (error) {
    errback(error);
  }
});
```

#### 媒体流发布流程
```typescript
// 1. 获取本地媒体流
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
});

// 2. 发布音频 Producer
const audioTrack = stream.getAudioTracks()[0];
const audioProducer = await sendTransport.produce({
  track: audioTrack,
  codecOptions: {
    opusStereo: true,
    opusDtx: true,
    opusFec: true
  }
});

// 3. 发布视频 Producer（Simulcast）
const videoTrack = stream.getVideoTracks()[0];
const videoProducer = await sendTransport.produce({
  track: videoTrack,
  encodings: [
    { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
    { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
    { rid: 'r2', maxBitrate: 1500000, scalabilityMode: 'S1T3' }
  ]
});
```

#### 远端流订阅流程
```typescript
// 1. 监听新 Producer 通知
socket.on('rtc:newProducer', async ({ producerId, peerId }) => {
  // 2. 订阅该 Producer
  const consumerParams = await consume(meetingId, producerId, device.rtpCapabilities);

  // 3. 创建 Consumer
  const consumer = await recvTransport.consume(consumerParams);

  // 4. 恢复 Consumer 开始接收数据
  await resumeConsumer(meetingId, consumer.id);

  // 5. 渲染到 video 元素
  const stream = new MediaStream([consumer.track]);
  const videoEl = document.getElementById(`video-${peerId}`);
  videoEl.srcObject = stream;
  videoEl.play();
});
```

---

## 性能与安全要求

### 性能指标

| 指标 | 目标值 | 可接受值 |
|------|--------|---------|
| 端到端延迟（LAN） | < 200ms | < 300ms |
| 连接建立时间 | < 2s | < 5s |
| 首帧渲染时间 | < 1s | < 2s |
| 弱网下音频可用性 | 20% 丢包 | 30% 丢包 |

### 安全要求

- **传输加密**：所有媒体流通过 DTLS-SRTP 加密
- **信令鉴权**：WebSocket 连接携带 JWT Token 验证
- **会议身份验证**：加入信令房间前验证用户已通过 REQ-002 API 加入会议
- **信令限流**：每用户每秒最多 10 条信令消息

---

## 兼容性要求

### 浏览器支持

| 浏览器 | 最低版本 | WebRTC 特性支持 |
|--------|---------|----------------|
| Chrome | 90+ | H.264、VP8、Opus、Simulcast |
| Safari | 14+ | H.264、Opus、Simulcast（部分） |
| Firefox | 88+ | VP8、Opus、Simulcast |

### 桌面端支持

- Windows 10+（Electron）
- macOS 11+（Electron）

---

## 附录

### 参考文档

- [mediasoup v3 官方文档](https://mediasoup.org/documentation/v3/)
- [mediasoup-client 文档](https://mediasoup.org/documentation/v3/mediasoup-client/)
- [WebRTC Simulcast 指南](https://webrtc.org/getting-started/rtp-simulcast)
- [REQ-002 API 契约](../REQ-002/api_contract.md)

**文档状态**: 已评审通过
**维护人**: team-lead