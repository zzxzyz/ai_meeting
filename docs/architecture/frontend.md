# 前端架构设计

## 1. 背景与目标

### 1.1 业务背景
构建一个现代化的视频会议 Web 应用,需要支持实时音视频通信、屏幕共享、聊天等功能,同时保证代码的可维护性和可扩展性。

### 1.2 技术目标
- **模块化**：清晰的模块边界,易于团队协作
- **可测试性**：单元测试覆盖率 >80%
- **高性能**：首屏加载 <2s,流畅的用户体验
- **可维护性**：统一的代码风格,完善的文档

### 1.3 约束条件
- 浏览器兼容性：Chrome 90+、Firefox 88+、Safari 14+、Edge 90+
- 移动端支持：响应式设计,优先桌面端
- MVP 阶段：优先核心功能,避免过度设计

---

## 2. 技术栈选型

### 2.1 框架选择

#### 2.1.1 React vs Vue vs Angular

| 维度 | React | Vue | Angular |
|-----|-------|-----|---------|
| 学习曲线 | 中 | 低 | 高 |
| 生态系统 | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| 性能 | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| TypeScript | ★★★★★ | ★★★★☆ | ★★★★★ |
| 社区活跃度 | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| WebRTC 支持 | ★★★★★ | ★★★★☆ | ★★★☆☆ |

**选型决策**：React + TypeScript

**理由**：
1. 生态成熟,WebRTC 相关库丰富
2. TypeScript 支持完善,类型安全
3. 团队熟悉,学习成本低
4. 性能优秀,适合实时应用
5. 社区活跃,问题响应快

---

### 2.2 状态管理

#### 2.2.1 方案对比

| 方案 | 复杂度 | 性能 | 学习曲线 | 适用场景 |
|-----|--------|------|---------|---------|
| **Context API** | 低 | 中 | 低 | 简单状态 |
| **Redux** | 高 | 高 | 高 | 复杂应用 |
| **Zustand** | 低 | 高 | 低 | 中小型应用 |
| **Jotai** | 低 | 高 | 低 | 原子化状态 |
| **Recoil** | 中 | 高 | 中 | 复杂状态图 |

**选型决策**：Zustand + Context API

**理由**：
1. Zustand 简洁高效,无样板代码
2. 支持 TypeScript,类型安全
3. 性能优秀,按需订阅
4. 学习成本低,易于上手
5. Context API 处理全局配置（主题、语言）

---

### 2.3 UI 组件库

#### 2.3.1 方案对比

| 组件库 | 组件数 | 定制性 | 文档质量 | 适用场景 |
|-------|--------|--------|---------|---------|
| **Ant Design** | 60+ | 中 | ★★★★★ | 企业应用 |
| **Material-UI** | 60+ | 高 | ★★★★☆ | Material 风格 |
| **Chakra UI** | 50+ | 高 | ★★★★☆ | 现代简洁 |
| **Headless UI** | 10+ | 极高 | ★★★☆☆ | 完全定制 |

**选型决策**：Tailwind CSS + Headless UI

**理由**：
1. 完全控制样式,无冗余 CSS
2. 响应式设计简单
3. 定制性强,符合品牌风格
4. 性能优秀,按需加载
5. Headless UI 提供无样式组件（可访问性好）

---

### 2.4 WebRTC 库

| 库 | 封装程度 | 灵活性 | 文档 | 适用场景 |
|----|---------|--------|------|---------|
| **原生 WebRTC API** | 无 | 极高 | ★★★☆☆ | 完全控制 |
| **mediasoup-client** | 低 | 高 | ★★★★☆ | SFU 架构 |
| **Simple-peer** | 中 | 中 | ★★★☆☆ | P2P 通信 |
| **Agora SDK** | 高 | 低 | ★★★★☆ | 商业方案 |

**选型决策**：mediasoup-client

**理由**：
1. 与服务端 mediasoup 配套
2. SFU 架构,性能优秀
3. 文档完善,示例丰富
4. 灵活性高,可深度定制

---

## 3. 架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────┐
│           Presentation Layer                │
│  (Pages, Components, Hooks)                 │
├─────────────────────────────────────────────┤
│           Application Layer                 │
│  (State Management, Business Logic)         │
├─────────────────────────────────────────────┤
│           Domain Layer                      │
│  (Models, Services, Utils)                  │
├─────────────────────────────────────────────┤
│           Infrastructure Layer              │
│  (API Client, WebRTC, WebSocket, Storage)   │
└─────────────────────────────────────────────┘
```

---

### 3.2 目录结构

```
src/
├── app/                      # 应用入口
│   ├── App.tsx
│   ├── routes.tsx
│   └── providers.tsx
│
├── pages/                    # 页面组件
│   ├── Home/
│   ├── Login/
│   ├── Dashboard/
│   └── MeetingRoom/
│
├── components/               # 通用组件
│   ├── ui/                   # UI 组件（按钮、输入框）
│   │   ├── Button/
│   │   ├── Input/
│   │   └── Modal/
│   ├── layout/               # 布局组件
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   └── Footer/
│   └── features/             # 功能组件
│       ├── VideoGrid/
│       ├── ParticipantList/
│       └── Chat/
│
├── features/                 # 业务模块（按功能划分）
│   ├── auth/
│   │   ├── hooks/
│   │   │   ├── useLogin.ts
│   │   │   └── useAuth.ts
│   │   ├── stores/
│   │   │   └── authStore.ts
│   │   └── services/
│   │       └── authService.ts
│   │
│   ├── meeting/
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── services/
│   │
│   └── webrtc/
│       ├── hooks/
│       │   ├── useLocalStream.ts
│       │   ├── useRemoteStreams.ts
│       │   └── useScreenShare.ts
│       ├── stores/
│       │   └── webrtcStore.ts
│       └── services/
│           ├── mediasoupService.ts
│           └── deviceManager.ts
│
├── shared/                   # 共享资源
│   ├── api/                  # API 客户端
│   │   ├── client.ts
│   │   ├── endpoints/
│   │   └── types/
│   ├── hooks/                # 通用 Hooks
│   │   ├── useAsync.ts
│   │   └── useDebounce.ts
│   ├── utils/                # 工具函数
│   │   ├── format.ts
│   │   └── validation.ts
│   ├── types/                # 全局类型
│   └── constants/            # 常量
│
├── styles/                   # 样式
│   ├── globals.css
│   └── tailwind.css
│
└── tests/                    # 测试
    ├── unit/
    ├── integration/
    └── e2e/
```

---

### 3.3 状态管理设计

#### 3.3.1 Zustand Store 划分

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const { user, token } = await authService.login(email, password);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  }
}));
```

```typescript
// stores/meetingStore.ts
interface MeetingState {
  currentMeeting: Meeting | null;
  participants: Participant[];
  joinMeeting: (meetingId: string) => Promise<void>;
  leaveMeeting: () => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
}

const useMeetingStore = create<MeetingState>((set, get) => ({
  currentMeeting: null,
  participants: [],

  joinMeeting: async (meetingId) => {
    const meeting = await meetingService.join(meetingId);
    set({ currentMeeting: meeting });
  },

  leaveMeeting: () => {
    set({ currentMeeting: null, participants: [] });
  },

  addParticipant: (participant) => {
    set((state) => ({
      participants: [...state.participants, participant]
    }));
  },

  removeParticipant: (userId) => {
    set((state) => ({
      participants: state.participants.filter(p => p.id !== userId)
    }));
  }
}));
```

```typescript
// stores/webrtcStore.ts
interface WebRTCState {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  addRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;
}

const useWebRTCStore = create<WebRTCState>((set, get) => ({
  localStream: null,
  remoteStreams: new Map(),
  isAudioEnabled: true,
  isVideoEnabled: true,

  toggleAudio: () => {
    const { localStream, isAudioEnabled } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      set({ isAudioEnabled: !isAudioEnabled });
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoEnabled } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      set({ isVideoEnabled: !isVideoEnabled });
    }
  },

  addRemoteStream: (userId, stream) => {
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.set(userId, stream);
      return { remoteStreams: newStreams };
    });
  },

  removeRemoteStream: (userId) => {
    set((state) => {
      const newStreams = new Map(state.remoteStreams);
      newStreams.delete(userId);
      return { remoteStreams: newStreams };
    });
  }
}));
```

---

### 3.4 WebRTC 封装设计

#### 3.4.1 mediasoup 服务封装

```typescript
// services/mediasoupService.ts
class MediasoupService {
  private device: Device;
  private sendTransport: Transport;
  private recvTransport: Transport;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();

  async init() {
    // 1. 加载设备能力
    this.device = new Device();
    const routerRtpCapabilities = await this.getRouterRtpCapabilities();
    await this.device.load({ routerRtpCapabilities });
  }

  async createSendTransport() {
    const transportOptions = await this.createWebRtcTransport();

    this.sendTransport = this.device.createSendTransport(transportOptions);

    // 监听 connect 事件
    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.connectWebRtcTransport(this.sendTransport.id, dtlsParameters);
        callback();
      } catch (error) {
        errback(error);
      }
    });

    // 监听 produce 事件
    this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const { id } = await this.produce(this.sendTransport.id, kind, rtpParameters);
        callback({ id });
      } catch (error) {
        errback(error);
      }
    });
  }

  async publishStream(track: MediaStreamTrack) {
    const producer = await this.sendTransport.produce({ track });
    this.producers.set(producer.id, producer);
    return producer;
  }

  async subscribeStream(producerId: string) {
    const consumerOptions = await this.consume(this.recvTransport.id, producerId);

    const consumer = await this.recvTransport.consume(consumerOptions);
    this.consumers.set(consumer.id, consumer);

    return consumer.track;
  }

  // API 调用
  private async getRouterRtpCapabilities() {
    const res = await api.get('/webrtc/rtpCapabilities');
    return res.data;
  }

  private async createWebRtcTransport() {
    const res = await api.post('/webrtc/transport/create');
    return res.data;
  }

  private async connectWebRtcTransport(transportId: string, dtlsParameters: any) {
    await api.post(`/webrtc/transport/${transportId}/connect`, { dtlsParameters });
  }

  private async produce(transportId: string, kind: string, rtpParameters: any) {
    const res = await api.post(`/webrtc/transport/${transportId}/produce`, {
      kind,
      rtpParameters
    });
    return res.data;
  }

  private async consume(transportId: string, producerId: string) {
    const res = await api.post(`/webrtc/transport/${transportId}/consume`, {
      producerId
    });
    return res.data;
  }
}

export const mediasoupService = new MediasoupService();
```

---

#### 3.4.2 自定义 Hooks

```typescript
// hooks/useLocalStream.ts
export function useLocalStream() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const start = async (constraints: MediaStreamConstraints = {
    audio: true,
    video: { width: 1280, height: 720 }
  }) => {
    setIsLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const stop = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
  };

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  return { stream, start, stop, error, isLoading };
}
```

```typescript
// hooks/useScreenShare.ts
export function useScreenShare() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const startShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080 },
        audio: false
      });

      // 监听停止分享事件
      screenStream.getVideoTracks()[0].onended = () => {
        stopShare();
      };

      setStream(screenStream);
      setIsSharing(true);

      return screenStream;
    } catch (err) {
      console.error('Screen share failed:', err);
      throw err;
    }
  };

  const stopShare = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsSharing(false);
  };

  return { stream, isSharing, startShare, stopShare };
}
```

```typescript
// hooks/useMeeting.ts
export function useMeeting(meetingId: string) {
  const { joinMeeting, leaveMeeting, addParticipant, removeParticipant } = useMeetingStore();
  const { start: startLocalStream } = useLocalStream();
  const socket = useSocket();

  useEffect(() => {
    // 加入会议
    joinMeeting(meetingId);

    // 获取本地媒体流
    startLocalStream();

    // 监听 WebSocket 事件
    socket.on('participant-joined', (participant) => {
      addParticipant(participant);
    });

    socket.on('participant-left', (userId) => {
      removeParticipant(userId);
    });

    return () => {
      leaveMeeting();
      socket.off('participant-joined');
      socket.off('participant-left');
    };
  }, [meetingId]);
}
```

---

### 3.5 组件设计

#### 3.5.1 原子组件（UI）

```typescript
// components/ui/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'rounded font-medium transition-colors';

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
}
```

---

#### 3.5.2 功能组件

```typescript
// components/features/VideoGrid.tsx
interface VideoGridProps {
  streams: Map<string, MediaStream>;
  layout?: 'grid' | 'spotlight';
}

export function VideoGrid({ streams, layout = 'grid' }: VideoGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ cols: 2, rows: 2 });

  // 根据参会者数量计算网格布局
  useEffect(() => {
    const count = streams.size;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    setDimensions({ cols, rows });
  }, [streams.size]);

  return (
    <div
      ref={gridRef}
      className="grid gap-2 w-full h-full p-4"
      style={{
        gridTemplateColumns: `repeat(${dimensions.cols}, 1fr)`,
        gridTemplateRows: `repeat(${dimensions.rows}, 1fr)`
      }}
    >
      {Array.from(streams.entries()).map(([userId, stream]) => (
        <VideoTile key={userId} userId={userId} stream={stream} />
      ))}
    </div>
  );
}
```

```typescript
// components/features/VideoTile.tsx
interface VideoTileProps {
  userId: string;
  stream: MediaStream;
}

export function VideoTile({ userId, stream }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const participant = useMeetingStore((state) =>
    state.participants.find(p => p.id === userId)
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream.getVideoTracks().length > 0 &&
                   stream.getVideoTracks()[0].enabled;

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <Avatar name={participant?.name} size="lg" />
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded">
        <span className="text-white text-sm">{participant?.name}</span>
      </div>
    </div>
  );
}
```

---

## 4. 性能优化

### 4.1 代码分割

```typescript
// routes.tsx
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

export function Routes() {
  return (
    <Suspense fallback={<Loading />}>
      <Switch>
        <Route path="/" element={<Home />} />
        <Route path="/meeting/:id" element={<MeetingRoom />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Switch>
    </Suspense>
  );
}
```

---

### 4.2 虚拟滚动

```typescript
// components/ParticipantList.tsx
import { FixedSizeList } from 'react-window';

export function ParticipantList({ participants }: { participants: Participant[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={participants.length}
      itemSize={60}
      width="100%"
    >
      {({ index, style }) => (
        <ParticipantItem
          style={style}
          participant={participants[index]}
        />
      )}
    </FixedSizeList>
  );
}
```

---

### 4.3 Memo 优化

```typescript
// 避免不必要的重渲染
const VideoTile = React.memo(
  ({ userId, stream }: VideoTileProps) => {
    // ...
  },
  (prev, next) => {
    return prev.userId === next.userId && prev.stream === next.stream;
  }
);
```

---

## 5. 测试策略

### 5.1 单元测试

```typescript
// tests/hooks/useAuth.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '@/features/auth/hooks/useAuth';

describe('useAuth', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('user@example.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeDefined();
  });
});
```

---

### 5.2 集成测试

```typescript
// tests/pages/MeetingRoom.test.tsx
import { render, screen } from '@testing-library/react';
import { MeetingRoom } from '@/pages/MeetingRoom';

describe('MeetingRoom', () => {
  it('should render video grid', () => {
    render(<MeetingRoom />);

    expect(screen.getByTestId('video-grid')).toBeInTheDocument();
  });

  it('should toggle audio', async () => {
    render(<MeetingRoom />);

    const muteButton = screen.getByRole('button', { name: /mute/i });
    await userEvent.click(muteButton);

    expect(muteButton).toHaveTextContent('Unmute');
  });
});
```

---

## 6. 参考资料

- [React 官方文档](https://react.dev/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/)
- [mediasoup-client](https://mediasoup.org/documentation/v3/mediasoup-client/api/)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
