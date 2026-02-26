# REQ-003: 实时音视频通话 - 需求分析

## 文档信息

- **需求编号**: REQ-003
- **需求名称**: 实时音视频通话
- **优先级**: P0
- **负责 Team**: 后端 + 前端 + 客户端
- **依赖需求**: REQ-002（会议管理）
- **创建日期**: 2026-02-26
- **更新日期**: 2026-02-26
- **分析人员**: Product Manager

---

## 1. 需求背景与业务目标

### 1.1 业务背景

实时音视频通话是视频会议平台的核心功能，也是 v0.1 MVP 最重要的技术验证点。在 REQ-001（用户认证）和 REQ-002（会议管理）完成后，本模块负责在会议房间内建立真实的音视频连接，让参会者能够相互看到视频、听到声音。

本模块采用业界成熟的 WebRTC + SFU 架构，以 mediasoup 作为媒体服务器，实现低延迟（<300ms LAN）、高质量（720p@30fps）的多人实时音视频通话。

### 1.2 业务目标

1. **验证核心技术可行性**：通过实际运行的 WebRTC + mediasoup SFU 方案，验证技术栈选型正确性
2. **满足基本通话需求**：支持 2-4 人在会议中进行音视频通话，覆盖主流企业会议场景
3. **保障通话质量**：音视频延迟 < 300ms（LAN），视频 720p@30fps，音频清晰无杂音
4. **具备弱网适应能力**：在 20% 丢包率下仍能维持可用通话，为后续弱网优化奠定基础
5. **跨平台支持**：Web 端（Chrome/Safari/Firefox）+ Electron 桌面端同时支持

### 1.3 依赖说明

- **REQ-001（用户认证）已完成**：信令服务 WebSocket 连接需携带 JWT Token 鉴权
- **REQ-002（会议管理）已完成**：
  - 信令连接以会议号（meeting_no）为入口，用户加入信令房间前必须已通过 REQ-002 API 加入会议
  - 会议结束事件由 REQ-002 触发，信令服务监听后广播给所有参会者
  - `meeting_participants.left_at` 字段由信令层在用户断开连接时更新
- **本模块为 REQ-004（音视频控制）的前置依赖**：控制功能（静音/关闭摄像头）将在 REQ-003 建立的通道上实现

---

## 2. 用户故事（User Stories）

### US-001: 进入会议建立音视频连接

> 作为**已加入会议的用户**，我希望**进入会议室后自动建立音视频连接**，以便**与其他参会者进行实时通话**。

**验收条件**：
- 用户进入会议室页面后，自动请求摄像头和麦克风权限
- 权限获取后，开始与服务器建立 WebRTC 连接
- 连接建立过程中显示"连接中..."状态
- 连接成功后显示本地视频预览，并开始接收其他参会者的音视频流
- 整个连接建立过程（从进入页面到开始接收远端流）< 3s（LAN 环境）

---

### US-002: 查看其他参会者视频

> 作为**会议参与者**，我希望**能够看到其他参会者的视频画面**，以便**进行面对面交流**。

**验收条件**：
- 最多同时展示 4 路参会者视频（含本地）
- 视频分辨率不低于 720p（LAN 良好网络环境）
- 帧率不低于 30fps（LAN 良好网络环境）
- 远端视频画面流畅，无明显卡顿（卡顿率 < 1%）
- 参会者加入/离开时，视频网格自动调整布局

---

### US-003: 收听其他参会者声音

> 作为**会议参与者**，我希望**能够清晰听到其他参会者的声音**，以便**进行正常语音交流**。

**验收条件**：
- 音频清晰，无明显背景噪音
- 端到端音频延迟 < 300ms（LAN）
- 多人同时说话时音频正常混合播放
- 无回声（浏览器内置 AEC 回声消除）

---

### US-004: 让其他人看到和听到自己

> 作为**会议参与者**，我希望**其他人能够看到我的视频并听到我的声音**，以便**双向交流**。

**验收条件**：
- 本地摄像头画面正确采集并上传到 SFU 服务器
- 其他参会者能收到我的视频流
- 本地麦克风音频正确采集并上传
- 其他参会者能听到我的声音
- 本地视频预览与其他人看到的画面一致（无镜像问题）

---

### US-005: 弱网下维持可用通话

> 作为**网络条件较差的用户**，我希望**在网络不稳定时仍能维持基本通话**，以便**不被强制中断会议**。

**验收条件**：
- 在 20% 丢包率下，音频仍可正常通话（可能有轻微失真）
- 在 20% 丢包率下，视频自动降级到较低分辨率（如 360p 或 180p），但不完全中断
- 网络恢复后自动提升到高分辨率
- 网络质量指示器实时反映当前网络状态

---

### US-006: 跨浏览器和跨平台通话

> 作为**不同设备的用户**，我希望**无论使用 Chrome、Safari、Firefox 还是 Electron 桌面端，都能与他人正常通话**，以便**不受平台限制**。

**验收条件**：
- Chrome（90+）与 Safari（14+）之间可正常通话
- Chrome（90+）与 Firefox（88+）之间可正常通话
- Web 端与 Electron 桌面端之间可正常通话
- 跨浏览器通话质量与同浏览器通话质量无明显差异

---

## 3. 功能点详细描述

### 3.1 WebRTC 连接建立

#### 3.1.1 信令流程

WebRTC 连接通过自定义 JSON over WebSocket 信令服务器协调建立，具体流程如下：

**发布流程（本地媒体上行）**：
1. 客户端连接 WebSocket 信令服务器（携带 JWT Token + meetingNo）
2. 服务器验证 Token，确认用户已加入对应会议（REQ-002）
3. 客户端调用 `getUserMedia` 获取本地音视频流
4. 客户端发送 `join` 信令，服务器创建 mediasoup WebRTC Transport
5. 客户端发送 SDP Offer，服务器创建 Producer，返回 SDP Answer
6. 双端完成 ICE/DTLS 握手，开始发送 RTP 媒体包

**订阅流程（远端媒体下行）**：
1. 服务器通知客户端新的远端 Producer 已就绪（`new-producer` 事件）
2. 客户端发送 `subscribe` 信令，服务器创建 Consumer
3. 服务器发送 SDP Offer 给客户端，客户端返回 SDP Answer
4. 双端完成握手，开始接收 RTP 媒体包

#### 3.1.2 ICE/STUN/TURN 配置

- **STUN 服务器**：部署 coturn，提供 NAT 穿透所需的公网地址发现
- **TURN 服务器**：部署 coturn 中继服务，处理无法直连的 NAT 场景
- **ICE 策略**：优先直连（host candidate），次选 STUN，最后 TURN 中继

#### 3.1.3 连接状态管理

| 状态 | 描述 | 用户可见提示 |
|------|------|------------|
| `connecting` | 正在建立连接 | "连接中..." |
| `connected` | 连接已建立，媒体流传输中 | 正常显示视频 |
| `reconnecting` | 连接中断，尝试重连 | "网络中断，重新连接中..." |
| `failed` | 连接失败 | "连接失败，请检查网络" |
| `closed` | 连接已关闭（正常离开或会议结束） | 无（已离开会议） |

---

### 3.2 音视频采集

#### 3.2.1 视频采集参数

```
分辨率：1280x720（720p，理想网络）
帧率：30fps
编码器：H.264 Baseline Profile（首选）/ VP8（备选）
Simulcast 层：
  - 低层（rid: r0）：320x180，15fps，100 kbps
  - 中层（rid: r1）：640x360，24fps，300 kbps
  - 高层（rid: r2）：1280x720，30fps，1500 kbps
```

#### 3.2.2 音频采集参数

```
编码器：Opus
采样率：48000 Hz
声道：单声道（语音场景）
码率：32 kbps（语音激活时）
回声消除（AEC）：浏览器内置
噪声抑制（NS）：浏览器内置
自动增益控制（AGC）：浏览器内置
DTX（静音检测）：启用（节省带宽）
FEC（前向纠错）：启用（抵抗丢包）
```

#### 3.2.3 设备权限处理

| 场景 | 处理方式 |
|------|---------|
| 首次请求权限 | 浏览器弹出权限请求对话框，用户选择允许/拒绝 |
| 摄像头权限被拒绝 | 提示用户在浏览器设置中开启，可仅音频入会 |
| 麦克风权限被拒绝 | 提示用户开启麦克风权限，可仅视频入会 |
| 设备不存在 | 提示"未检测到摄像头/麦克风"，可纯音频/视频入会 |
| 设备被其他程序占用 | 提示设备被占用，引导用户关闭其他占用程序 |

---

### 3.3 SFU 媒体转发（mediasoup）

#### 3.3.1 Room 模型

- 每个会议（meetingNo）对应一个 mediasoup Router
- Router 在第一个参会者加入时创建，最后一个参会者离开后销毁
- 每个参会者拥有独立的 WebRTC Transport（上行发布 + 下行订阅各一个）

#### 3.3.2 Producer / Consumer 管理

- 每个参会者上行两个 Producer：视频 Producer（含 Simulcast 三层）+ 音频 Producer
- 订阅时，服务器为每对（订阅者, Producer）创建 Consumer
- 参会者离开时，销毁其所有 Producer 和对应的所有 Consumer，通知其他参会者

#### 3.3.3 多路流管理（最多 4 路）

- MVP 阶段支持最多 4 路参会者（即 4 个 Producer 集合）
- 第 5 人尝试加入时，信令服务拒绝其建立媒体连接，并提示"当前会议已达到最大参会人数"
- 视频接收策略：所有参会者默认订阅所有其他人的音视频流

#### 3.3.4 Simulcast 层切换策略

mediasoup 根据消费者（接收方）的下行带宽估算自动选择合适的 Simulcast 层：
- 带宽充足（>1500 kbps）：下发 720p（高层 r2）
- 带宽一般（300-1500 kbps）：下发 360p（中层 r1）
- 带宽不足（<300 kbps）：下发 180p（低层 r0）

---

### 3.4 音视频解码与渲染

#### 3.4.1 视频渲染

- 使用 HTML `<video>` 元素接收并渲染 MediaStream
- 本地视频：`muted` 属性避免回声，`mirror` 水平翻转（镜像显示）
- 远端视频：正常方向显示，`autoplay` 自动播放
- 视频布局：CSS Grid 响应式网格，根据参会人数动态调整（1人全屏、2人左右分栏、3-4人四宫格）

#### 3.4.2 音频播放

- 远端音频通过浏览器自动播放（Web Audio API / HTML audio）
- 本地音频不播放（避免自我听到自己声音）
- 多路音频由浏览器自动混合输出

#### 3.4.3 音视频同步

- 依赖浏览器原生 WebRTC 实现（RTP 时间戳同步机制）
- 音视频同步误差目标 < 100ms

---

### 3.5 网络自适应

#### 3.5.1 Simulcast 自适应（已在 3.3.4 描述）

#### 3.5.2 弱网对抗策略

| 丢包率 | 策略 |
|--------|------|
| < 1% | 正常传输，无特殊处理 |
| 1% - 5% | NACK 重传 + 动态码率调整（GCC 拥塞控制） |
| 5% - 20% | NACK + Opus FEC + 视频降级到 360p |
| > 20% | 音频优先（视频降到最低层或暂停），Opus FEC 增强 |

#### 3.5.3 连接重试

- WebSocket 信令断开后，客户端每 3 秒尝试重连，最多 5 次
- WebRTC 连接 ICE 失败后，触发 ICE Restart，重新协商 ICE 候选
- 重连成功后自动恢复之前的订阅状态

---

### 3.6 会议生命周期集成（与 REQ-002 联动）

#### 3.6.1 用户进入信令房间的前提

- 用户必须先通过 REQ-002 `POST /api/v1/meetings/join` 加入会议
- 信令服务在接收到 `join` 信令时，调用会议管理服务验证用户身份和会议状态
- 若会议已结束（`ended`），信令服务拒绝连接

#### 3.6.2 会议结束事件

- REQ-002 的"结束会议" API 触发后，会议管理服务通知信令服务关闭对应 Router
- 信令服务向该 Router 内所有客户端广播 `meeting-ended` 事件
- 客户端收到 `meeting-ended` 后关闭 WebRTC 连接，跳转到会议结束页

#### 3.6.3 参会者离开记录

- 用户断开 WebSocket 连接时（正常离开或网络中断超时），信令服务更新 `meeting_participants.left_at`

---

## 4. Team 拆分

### 4.1 后端 Team

| 工作内容 | 描述 | 交付物 |
|---------|------|--------|
| WebSocket 信令服务 | 实现 join/leave/offer/answer/ice-candidate/subscribe 等信令处理 | 信令 Gateway（NestJS WebSocket） |
| mediasoup Worker 管理 | Worker 进程池初始化、健康监控 | mediasoup Worker 管理模块 |
| mediasoup Router 管理 | 每会议一个 Router，生命周期管理 | Room/Router 管理服务 |
| WebRTC Transport 管理 | 创建/关闭发布和订阅 Transport | Transport 管理模块 |
| Producer/Consumer 管理 | Simulcast Producer 创建、Consumer 创建与管理 | 媒体流管理服务 |
| 与 REQ-002 集成 | 信令鉴权、会议状态验证、left_at 更新、会议结束事件监听 | 集成服务 |
| STUN/TURN 配置 | coturn 服务部署配置文档 | 部署配置文档 |
| 单元测试 | 信令逻辑、Room 管理、Producer/Consumer 生命周期 | Jest 测试文件（覆盖率 > 80%） |

### 4.2 前端 Team

| 工作内容 | 描述 | 交付物 |
|---------|------|--------|
| WebRTC 客户端封装 | RTCPeerConnection 创建、ICE 处理、SDP 交换 | WebRTC 客户端 Hook/Service |
| 信令客户端 | WebSocket 连接管理、信令消息收发、重连逻辑 | 信令客户端模块 |
| 音视频采集 | getUserMedia 封装，权限处理，设备枚举 | 媒体采集模块 |
| 视频渲染组件 | 本地/远端视频 `<video>` 渲染，布局管理 | VideoGrid、LocalVideo、RemoteVideo 组件 |
| 网络状态指示 | 实时网络质量指示器（强/中/弱/断开） | NetworkIndicator 组件 |
| Simulcast 配置 | RTCRtpSender encodings 配置，3 层 Simulcast | Simulcast 配置模块 |
| 连接状态管理 | 连接状态机，连接/重连/失败 UI 提示 | 连接状态 Store + UI |
| 浏览器兼容适配 | Chrome/Safari/Firefox 差异抹平（adapter.js） | 兼容适配层 |
| 单元测试 | WebRTC Hook、组件渲染、信令处理 | Jest + Testing Library（覆盖率 > 80%） |

### 4.3 客户端 Team（Electron）

| 工作内容 | 描述 | 交付物 |
|---------|------|--------|
| 复用 Web 端音视频组件 | 80% 代码复用，Electron 渲染进程直接集成 Web 端组件 | Electron 渲染进程集成 |
| 摄像头/麦克风权限 | Electron 主进程 systemPreferences API 处理权限 | 权限管理模块 |
| 设备热插拔处理 | 摄像头/麦克风插拔事件监听，动态更新设备列表 | 设备事件监听模块 |
| 系统通知集成 | 参会者加入/离开的系统级通知 | Electron Notification 模块 |
| 单元测试 | Electron 特有逻辑测试（权限、热插拔） | Jest 测试文件（覆盖率 > 80%） |

### 4.4 测试 Team

| 工作内容 | 描述 | 交付物 |
|---------|------|--------|
| 测试用例设计 | 功能、性能、弱网、跨平台测试用例 | test_cases.md |
| 互通测试 | 2/3/4 人通话，Web-Web/Web-Electron/跨浏览器 | 互通测试报告 |
| 性能测试 | 延迟测量（< 300ms）、分辨率验证（720p@30fps） | 性能测试报告 |
| 弱网测试 | 使用 tc netem 模拟 20% 丢包，验证可用性 | 弱网测试报告 |
| 稳定性测试 | 30 分钟连续通话，动态加入/离开 | 稳定性测试报告 |
| 兼容性测试 | Chrome/Safari/Firefox/Electron 互通矩阵 | 兼容性测试报告 |
| 测试报告汇总 | 汇总所有测试结果和问题清单 | test_report.md |

---

## 5. 验收标准

| 验收项 | 验收条件 | 优先级 |
|--------|---------|--------|
| 2-4 人可建立音视频连接 | 2、3、4 人分别加入会议，所有参与者能互相看到视频、听到声音 | P0 |
| 音视频延迟 < 300ms（LAN） | 工具测量端到端延迟，P95 < 300ms | P0 |
| 视频分辨率 720p@30fps | 良好网络下，视频分辨率达到 1280x720，帧率 ≥ 30fps | P0 |
| 音频清晰无杂音 | 主观听感清晰，无明显背景噪音、无回声 | P0 |
| 支持 Chrome/Safari/Firefox | 三种浏览器两两互通测试全部通过 | P0 |
| 弱网（20% 丢包）下仍可用 | 模拟 20% 丢包，音频可正常通话，视频降级但不中断 | P0 |
| 单元测试覆盖率 > 80% | CI 管道中后端/前端单元测试覆盖率 ≥ 80% | P0 |
| Electron 桌面端正常工作 | Windows 10+ / macOS 11+ Electron 客户端可正常通话 | P0 |
| Web 端与 Electron 互通 | Web 端与 Electron 端可相互通话，质量达标 | P0 |
| 连接失败有友好提示 | 权限拒绝、网络异常等场景有明确错误提示 | P1 |
| 网络质量指示器正常 | 网络状态变化时，指示器实时反映（强/中/弱） | P1 |

### 5.1 补充验收标准

- [ ] 参会者加入/离开时，视频网格自动调整（无需刷新页面）
- [ ] 4 人以上尝试建立媒体连接时给出友好提示
- [ ] 会议结束后所有参会者自动关闭媒体连接
- [ ] 信令 WebSocket 断开后自动重连（最多 5 次）
- [ ] 重连成功后媒体流自动恢复
- [ ] 本地视频预览镜像正确（水平翻转）
- [ ] 浏览器 Tab 切换后音视频不中断

---

## 6. 优先级与边界条件

### 6.1 In Scope（v0.1 MVP 范围内）

- 2-4 人实时音视频通话（Web 端 + Electron 端）
- WebRTC 连接建立（ICE/STUN/TURN）
- 音视频采集（摄像头/麦克风）
- 音视频编码（H.264 + Opus，Simulcast 3 层）
- mediasoup SFU 媒体转发
- 音视频解码与渲染（<video> 元素）
- Simulcast 自适应码率
- 弱网基础对抗（NACK + FEC + 降级）
- 连接状态管理与重连
- 跨浏览器兼容（Chrome/Safari/Firefox）
- Electron 桌面端集成

### 6.2 Out of Scope（不在 v0.1 范围内）

- 静音/关闭摄像头控制（REQ-004，P0，下一个需求）
- 屏幕共享（REQ-005，P1）
- 会议录制（REQ-007，P1）
- 虚拟背景（REQ-008，P2）
- iOS/Android 原生客户端（v0.2）
- 超过 4 人的大型会议
- 端到端加密（DTLS-SRTP 已保证传输加密，E2E 暂不支持）
- 弱网下的主动降帧/降分辨率的手动控制（仅自动）
- 音频降噪增强（浏览器内置基础降噪，高级降噪 v0.2）

### 6.3 边界条件说明

| 边界场景 | 处理规则 |
|---------|---------|
| 第 5 人尝试加入音视频 | 拒绝建立媒体连接，提示"会议已满（最多4人）" |
| 用户拒绝摄像头权限 | 允许仅音频入会，视频位置显示用户头像 |
| 用户拒绝麦克风权限 | 允许仅视频入会，提示"您的麦克风权限未开启" |
| 用户同时拒绝两个权限 | 仍允许进入会议（可观看和收听），提示无法发布自己的媒体 |
| 会议已结束再尝试加入信令 | 信令服务拒绝，返回 `meeting-ended` 事件 |
| 网络中断超过 30 秒 | 视为离开，信令服务清理该用户的 Producer/Consumer |
| 参会者中途刷新页面 | 视为重新加入，重建 WebRTC 连接 |
| 浏览器不支持 WebRTC | 提示"您的浏览器不支持实时通话，请使用 Chrome/Safari/Firefox" |

---

## 7. 非功能性需求

### 7.1 性能需求

| 指标 | 目标值 | 可接受值 | 不可接受 |
|------|--------|---------|---------|
| 端到端延迟（LAN） | < 200ms | < 300ms | > 500ms |
| 端到端延迟（WAN） | < 400ms | < 500ms | > 800ms |
| 视频分辨率（良好网络） | 1280x720 | 640x360 | 320x180 |
| 视频帧率（良好网络） | 30fps | 24fps | < 15fps |
| 音频码率 | 32 kbps | 16 kbps | < 8 kbps |
| 连接建立时间（LAN） | < 2s | < 5s | > 10s |
| 首帧渲染时间 | < 1s | < 2s | > 3s |
| mediasoup 单节点并发流 | 500+ | 200+ | < 100 |

### 7.2 安全需求

- **传输加密**：WebRTC 媒体流必须经过 DTLS-SRTP 加密（WebRTC 标准强制）
- **信令鉴权**：WebSocket 连接携带 JWT Token，服务器验证有效性
- **会议身份验证**：加入信令房间前，服务器验证用户是否已通过 REQ-002 API 加入该会议
- **信令限流**：每用户每秒最多 10 条信令消息，防止信令洪泛攻击

### 7.3 兼容性需求

#### Web 端浏览器

| 浏览器 | 最低版本 | WebRTC 特性支持 |
|--------|---------|----------------|
| Chrome | 90+ | H.264、VP8、Opus、Simulcast，完整支持 |
| Safari | 14+ | H.264、Opus 支持，Simulcast 部分支持（需测试） |
| Firefox | 88+ | H.264（需许可证）、VP8、Opus，Simulcast 支持 |
| Edge | 90+ | 同 Chrome（Chromium 内核） |

#### 桌面端

- Windows 10+（Electron）
- macOS 11+（Electron）

### 7.4 可靠性需求

- 信令服务可用性 > 99.9%
- 媒体服务（mediasoup）可用性 > 99.9%
- 单节点故障不影响其他节点（为 v0.2 集群部署做准备）
- 信令服务优雅关闭：服务重启时通知所有客户端，客户端自动重连

---

## 8. 数据模型设计

### 8.1 信令层数据结构（内存，非持久化）

信令服务维护内存中的 Room 状态，不持久化到数据库（媒体连接状态为实时状态）：

**Room（信令房间）**：
```
Room {
  meetingNo: string           // 对应 REQ-002 会议号
  routerId: string            // mediasoup Router ID
  peers: Map<userId, Peer>    // 参会者集合
}
```

**Peer（参会者）**：
```
Peer {
  userId: string
  nickname: string
  socket: WebSocket
  publishTransport: Transport   // 上行 Transport
  subscribeTransport: Transport // 下行 Transport
  producers: Map<kind, Producer>  // video + audio
  consumers: Map<producerId, Consumer>
}
```

### 8.2 数据库更新（持久化到 REQ-002 数据库）

信令服务在以下时机更新数据库：

| 事件 | 数据库操作 |
|------|----------|
| 用户建立信令连接 | 无（REQ-002 加入会议时已记录） |
| 用户断开信令连接 | `UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = ? AND user_id = ? AND left_at IS NULL` |
| 会议结束（被 REQ-002 触发） | 无（REQ-002 负责更新 meetings 表） |

---

## 9. API 接口概览

> 完整接口契约见评审阶段产出的 `api_contract.md`

### 9.1 WebSocket 信令消息（客户端 → 服务器）

| 消息类型 | 用途 |
|---------|------|
| `join` | 加入信令房间，携带 meetingNo + JWT Token |
| `publish` | 发布本地媒体，携带 SDP Offer（含 Simulcast encodings） |
| `subscribe` | 订阅远端 Producer |
| `ice-candidate` | 传递 ICE Candidate |
| `leave` | 主动离开信令房间 |
| `get-router-rtp-capabilities` | 获取 Router 的 RTP 能力（mediasoup 协商用） |
| `create-transport` | 请求创建 WebRTC Transport |
| `connect-transport` | 完成 Transport 的 DTLS 连接 |
| `produce` | 在 Transport 上创建 Producer |
| `consume` | 在 Transport 上创建 Consumer |

### 9.2 WebSocket 信令消息（服务器 → 客户端）

| 消息类型 | 用途 |
|---------|------|
| `joined` | 加入成功，返回房间内已有 Producer 列表 |
| `new-producer` | 通知新 Producer 就绪（其他用户发布了媒体） |
| `producer-closed` | 通知 Producer 已关闭（其他用户离开） |
| `peer-joined` | 其他参会者加入 |
| `peer-left` | 其他参会者离开 |
| `meeting-ended` | 会议已结束（由创建者结束会议触发） |
| `error` | 信令错误 |

---

## 10. 风险评估

### 10.1 技术风险

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| Safari 对 Simulcast 支持不完整 | 高 | Safari 端视频质量差或无法自适应码率 | 针对 Safari 做特殊处理，降级为单层传输；充分测试 |
| STUN/TURN 穿透失败（对称型 NAT） | 中 | 部分用户无法建立 P2P 连接 | 部署 TURN 中继服务（coturn）兜底 |
| mediasoup v3 与 Node.js 版本兼容性 | 低 | 服务启动失败 | 锁定 Node.js 版本，使用 .nvmrc；参考 mediasoup 官方要求 |
| 多人 Simulcast 带宽消耗超预期 | 中 | 服务器带宽成本高 | 监控实际带宽使用，评估是否需要限制层数 |
| 浏览器 autoplay 策略限制音频播放 | 中 | 远端音频无声 | 遵循浏览器 autoplay 策略（用户交互后播放），在 UI 上引导用户交互 |

### 10.2 业务风险

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| 延迟目标（300ms）在部分网络环境下无法达到 | 中 | 用户体验下降，验收标准不过 | 明确以 LAN 环境作为验收基准；提供网络质量指示器 |
| 4 人上限在测试场景中难以充分覆盖 | 低 | 多人场景问题遗漏 | 设计自动化测试工具模拟多路媒体流 |

### 10.3 进度风险

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| mediasoup 集成学习曲线陡峭 | 中 | 后端开发延期 | 提前参考 mediasoup-demo 示例；架构师提供技术方案文档 |
| Safari 兼容性调试耗时 | 中 | 前端测试延期 | 尽早开展 Safari 兼容性测试，问题提前暴露 |
| WebRTC 信令与媒体服务联调复杂 | 中 | 集成测试延期 | 前端使用 Mock 信令服务先行开发组件；后端先完成单元测试 |

---

## 11. 后续版本规划

### v0.2 音视频增强

- 增加参会人数上限（10 人，需验证 mediasoup 性能）
- iOS/Android 原生客户端（WebRTC 原生 SDK）
- 高级弱网对抗（丢包率 > 30% 场景优化）
- 音频降噪增强（WebRTC 内置 + 可选 RNNoise）
- 网络质量统计上报（延迟/丢包率/码率）

### v0.3 媒体高级功能

- 多媒体流布局自定义（演讲者模式）
- VP9 SVC 码率自适应（替代 Simulcast，节省上行带宽）
- mediasoup 集群部署（多区域低延迟）
- 媒体录制（SFU 流转 MCU 录制）

---

## 12. 附录

### 12.1 术语表

- **WebRTC**: Web Real-Time Communication，浏览器原生实时通信协议
- **SFU**: Selective Forwarding Unit，选择性转发单元，只转发不转码
- **mediasoup**: 基于 Node.js + libwebrtc 的高性能 SFU 库
- **ICE**: Interactive Connectivity Establishment，交互式连接建立（NAT 穿透）
- **STUN**: Session Traversal Utilities for NAT，NAT 地址发现
- **TURN**: Traversal Using Relays around NAT，TURN 中继服务器
- **DTLS-SRTP**: WebRTC 媒体流加密协议
- **Simulcast**: 同时投流，客户端上传多个分辨率版本
- **SDP**: Session Description Protocol，会话描述协议（WebRTC 能力协商）
- **Producer**: mediasoup 中的媒体发布者
- **Consumer**: mediasoup 中的媒体订阅者
- **Router**: mediasoup 中的媒体路由器（对应一个会议房间）
- **Transport**: mediasoup 中的 WebRTC 传输通道
- **GCC**: Google Congestion Control，Google 拥塞控制算法
- **NACK**: Negative Acknowledgement，丢包重传机制
- **FEC**: Forward Error Correction，前向纠错
- **DTX**: Discontinuous Transmission，静音检测（节省音频带宽）

### 12.2 参考文档

- [v0.1 需求列表](../../requirements.md)
- [音视频架构设计](../../../../architecture/audio_video.md)
- [后端架构设计](../../../../architecture/backend.md)
- [REQ-002 需求分析](../REQ-002/analysis.md)
- [REQ-002 API 契约](../REQ-002/api_contract.md)

---

**文档状态**: 已完成
**审批人**: Team Lead
**审批时间**: 待定
