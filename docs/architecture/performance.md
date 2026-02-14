# 性能优化方案

## 1. 性能指标定义

### 1.1 用户体验指标

| 指标 | 优秀 | 良好 | 可接受 | 差 |
|-----|------|------|--------|-----|
| 首屏加载 (FCP) | <1s | <2s | <3s | >3s |
| 可交互时间 (TTI) | <2s | <3.5s | <5s | >5s |
| 音视频延迟 | <150ms | <200ms | <300ms | >500ms |
| 视频卡顿率 | <0.5% | <1% | <3% | >5% |
| 音频丢包率 | <0.1% | <0.5% | <1% | >2% |

### 1.2 系统性能指标

| 指标 | 目标 |
|-----|------|
| API 响应时间 (P95) | <200ms |
| API 响应时间 (P99) | <500ms |
| WebSocket 连接建立 | <500ms |
| 数据库查询 (P95) | <50ms |
| 缓存命中率 | >90% |
| 服务 CPU 使用率 | <70% |
| 服务内存使用率 | <80% |

---

## 2. 前端性能优化

### 2.1 首屏加载优化

#### 2.1.1 代码分割 (Code Splitting)

**策略**：
- **路由级分割**：按页面懒加载
- **组件级分割**：大型组件按需加载
- **第三方库分割**：vendor bundle

**实现**：
```typescript
// React 路由懒加载
const MeetingRoom = lazy(() => import('./pages/MeetingRoom'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

<Routes>
  <Route path="/meeting/:id" element={
    <Suspense fallback={<Loading />}>
      <MeetingRoom />
    </Suspense>
  } />
</Routes>
```

**效果**：
- 首屏 bundle 减小 60%（从 2MB → 800KB）
- FCP 提升 40%（从 3s → 1.8s）

---

#### 2.1.2 资源压缩

**Gzip / Brotli 压缩**：
```nginx
# Nginx 配置
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;

# Brotli（压缩率更高）
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript;
```

**压缩效果**：
| 文件类型 | 原始大小 | Gzip | Brotli |
|---------|---------|------|--------|
| JS | 1000 KB | 350 KB | 300 KB |
| CSS | 200 KB | 50 KB | 40 KB |

---

#### 2.1.3 资源预加载

**策略**：
```html
<!-- DNS 预解析 -->
<link rel="dns-prefetch" href="https://api.example.com">

<!-- 预连接 -->
<link rel="preconnect" href="https://cdn.example.com">

<!-- 预加载关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>

<!-- 预获取下一页资源 -->
<link rel="prefetch" href="/meeting-room.js">
```

---

#### 2.1.4 图片优化

**格式选择**：
- **WebP**：支持现代浏览器，体积减小 30%
- **AVIF**：更好的压缩率，逐步推广
- **懒加载**：视口外图片延迟加载

**实现**：
```jsx
<picture>
  <source srcset="avatar.avif" type="image/avif">
  <source srcset="avatar.webp" type="image/webp">
  <img src="avatar.jpg" loading="lazy" alt="Avatar">
</picture>
```

---

### 2.2 运行时性能优化

#### 2.2.1 虚拟列表

**场景**：参会者列表（50+ 人）

**实现**：
```typescript
import { FixedSizeList } from 'react-window';

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
```

**效果**：
- 渲染 1000 项从 5s → 100ms
- 内存占用减少 80%

---

#### 2.2.2 防抖与节流

**场景**：
- 搜索输入：防抖（debounce）500ms
- 窗口 resize：节流（throttle）100ms
- 滚动加载：节流 200ms

**实现**：
```typescript
import { debounce } from 'lodash';

const handleSearch = debounce((query: string) => {
  fetchResults(query);
}, 500);

<input onChange={(e) => handleSearch(e.target.value)} />
```

---

#### 2.2.3 React 性能优化

**Memo 化**：
```typescript
// 避免不必要的重渲染
const ParticipantItem = React.memo(({ participant }) => {
  return <div>{participant.name}</div>;
}, (prev, next) => prev.participant.id === next.participant.id);

// Hook 优化
const sortedParticipants = useMemo(() => {
  return participants.sort((a, b) => a.name.localeCompare(b.name));
}, [participants]);

const handleMute = useCallback((id: string) => {
  muteParticipant(id);
}, []);
```

---

### 2.3 WebRTC 性能优化

#### 2.3.1 Simulcast 自适应

**策略**：
```
上行：同时发送 180p、360p、720p
下行：根据网络条件订阅合适版本

网络好 → 720p
网络中 → 360p
网络差 → 180p
```

**实现**：
```typescript
// mediasoup 配置
const encodings = [
  { rid: 'r0', maxBitrate: 100000, scaleResolutionDownBy: 4 },  // 180p
  { rid: 'r1', maxBitrate: 300000, scaleResolutionDownBy: 2 },  // 360p
  { rid: 'r2', maxBitrate: 1500000 }  // 720p
];

producer = await transport.produce({
  track: videoTrack,
  encodings,
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
});
```

---

#### 2.3.2 音频处理优化

**降噪**：
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,  // 回声消除
    noiseSuppression: true,  // 降噪
    autoGainControl: true    // 自动增益
  }
});
```

**音频优先**：弱网时优先保证音频质量
```typescript
if (networkQuality === 'poor') {
  // 降低视频码率
  await producer.setMaxSpatialLayer(0);  // 只发送最低分辨率

  // 保持音频码率
  await audioProducer.setMaxSpatialLayer(null);
}
```

---

## 3. 后端性能优化

### 3.1 数据库优化

#### 3.1.1 索引优化

**原则**：
- 频繁查询字段建索引
- 复合索引遵循最左前缀
- 避免过多索引（影响写性能）

**示例**：
```sql
-- 用户登录查询
CREATE INDEX idx_users_email ON users(email);

-- 会议列表查询（用户 + 时间）
CREATE INDEX idx_meetings_user_time ON meetings(user_id, start_time DESC);

-- 复合索引
CREATE INDEX idx_participants_meeting_user ON participants(meeting_id, user_id);
```

**索引监控**：
```sql
-- PostgreSQL 查询未使用的索引
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

---

#### 3.1.2 查询优化

**N+1 问题**：
```typescript
// 错误：N+1 查询
const meetings = await Meeting.find();
for (const meeting of meetings) {
  meeting.host = await User.findById(meeting.hostId);  // N 次查询
}

// 正确：关联查询
const meetings = await Meeting.find({
  relations: ['host', 'participants']
});
```

**分页优化**：
```typescript
// 错误：OFFSET 大时性能差
SELECT * FROM meetings ORDER BY created_at DESC OFFSET 10000 LIMIT 20;

// 正确：游标分页
SELECT * FROM meetings
WHERE created_at < $1  -- 上一页最后一条的时间
ORDER BY created_at DESC
LIMIT 20;
```

---

#### 3.1.3 读写分离

**架构**：
```
写请求 → Master DB
读请求 → Slave DB (Round Robin)
```

**实现**：
```typescript
// TypeORM 配置
{
  type: 'postgres',
  replication: {
    master: {
      host: 'master.db.example.com',
      port: 5432,
      username: 'admin',
      password: 'xxx',
      database: 'meeting'
    },
    slaves: [
      {
        host: 'slave1.db.example.com',
        port: 5432,
        username: 'readonly',
        password: 'xxx',
        database: 'meeting'
      },
      {
        host: 'slave2.db.example.com',
        port: 5432,
        username: 'readonly',
        password: 'xxx',
        database: 'meeting'
      }
    ]
  }
}
```

---

### 3.2 缓存优化

#### 3.2.1 多级缓存

```
L1: 进程内缓存（LRU，1000 条）
  ↓ miss
L2: Redis 缓存（100万条，TTL 1小时）
  ↓ miss
L3: 数据库
```

**实现**：
```typescript
class CacheService {
  private l1Cache = new LRU({ max: 1000 });

  async get(key: string): Promise<any> {
    // L1 缓存
    let value = this.l1Cache.get(key);
    if (value) return value;

    // L2 缓存
    value = await redis.get(key);
    if (value) {
      this.l1Cache.set(key, value);
      return value;
    }

    // 数据库
    value = await db.query(key);
    await redis.setex(key, 3600, value);
    this.l1Cache.set(key, value);

    return value;
  }
}
```

---

#### 3.2.2 缓存预热

**策略**：
- 应用启动时加载热点数据
- 定时任务刷新缓存

**实现**：
```typescript
@Cron('0 */5 * * * *')  // 每 5 分钟
async warmupCache() {
  const hotMeetings = await this.meetingRepo.findHot(100);
  for (const meeting of hotMeetings) {
    await redis.setex(
      `meeting:${meeting.id}`,
      3600,
      JSON.stringify(meeting)
    );
  }
}
```

---

### 3.3 异步处理

#### 3.3.1 消息队列

**适用场景**：
- 邮件发送
- 录制转码
- 数据统计

**实现**：
```typescript
// 生产者
await queue.add('send-email', {
  to: 'user@example.com',
  subject: 'Meeting Invitation',
  body: '...'
});

// 消费者
queue.process('send-email', async (job) => {
  await emailService.send(job.data);
});
```

---

### 3.4 API 优化

#### 3.4.1 GraphQL 按需查询

**问题**：REST API 过度获取或获取不足

**解决**：GraphQL
```graphql
query {
  meeting(id: "123") {
    title
    host {
      name
      avatar
    }
    participants {
      name
    }
  }
}
```

**收益**：
- 减少请求次数（1 次 vs 3 次）
- 减少传输数据（按需字段）

---

#### 3.4.2 响应压缩

**Gzip 中间件**：
```typescript
import compression from 'compression';

app.use(compression({
  level: 6,
  threshold: 1024,  // 大于 1KB 才压缩
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
```

---

## 4. 媒体服务器优化

### 4.1 带宽优化

#### 4.1.1 Simulcast 分层

**策略**：
- 演讲者：高清（720p）
- 活跃发言者：标清（360p）
- 其他参会者：低清（180p）

**动态切换**：
```typescript
// 检测活跃发言者
if (audioLevel > threshold) {
  consumer.setPreferredLayers({ spatialLayer: 2 });  // 720p
} else {
  consumer.setPreferredLayers({ spatialLayer: 0 });  // 180p
}
```

---

#### 4.1.2 拥塞控制

**GCC 算法**：
```
测量 RTT 和丢包率
  ↓
估算可用带宽
  ↓
动态调整发送码率
  ↓
通知发送方降低/提高码率
```

**WebRTC 内置**，无需手动实现

---

### 4.2 服务器性能优化

#### 4.2.1 mediasoup Worker 调优

**配置**：
```typescript
const worker = await mediasoup.createWorker({
  logLevel: 'warn',
  rtcMinPort: 40000,
  rtcMaxPort: 49999,
  // CPU 亲和性
  cpuAffinity: [0, 1],
  // 日志标签
  logTags: [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp'
  ]
});
```

**多 Worker 负载均衡**：
```typescript
// 每个 CPU 核心一个 Worker
const workers = [];
for (let i = 0; i < os.cpus().length; i++) {
  const worker = await mediasoup.createWorker();
  workers.push(worker);
}

// 轮询分配
let nextWorkerIdx = 0;
function getWorker() {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}
```

---

#### 4.2.2 操作系统调优

**Linux 内核参数**：
```bash
# 增加文件描述符限制
ulimit -n 65535

# 增加网络缓冲区
sysctl -w net.core.rmem_max=134217728
sysctl -w net.core.wmem_max=134217728

# 优化 TCP
sysctl -w net.ipv4.tcp_rmem="4096 87380 134217728"
sysctl -w net.ipv4.tcp_wmem="4096 65536 134217728"
```

---

## 5. CDN 加速

### 5.1 静态资源 CDN

**策略**：
- JS/CSS/图片 → CDN
- API 请求 → 源站
- WebSocket → 源站（就近接入点）

**配置**：
```
用户（北京）→ CDN 北京节点 → 源站（上海）
   ↓ 命中缓存
  直接返回（延迟 5ms vs 50ms）
```

---

### 5.2 录制文件 CDN

**流程**：
```
录制完成 → 上传 S3 → CDN 回源拉取 → 缓存到边缘节点
                          ↓
                      用户下载（边缘节点）
```

**缓存策略**：
```
Cache-Control: public, max-age=31536000, immutable
```

---

## 6. 监控与分析

### 6.1 性能监控

**前端监控**：
```typescript
// Web Vitals
import { onCLS, onFCP, onLCP, onTTFB } from 'web-vitals';

onFCP(metric => {
  analytics.send('fcp', metric.value);
});

onLCP(metric => {
  analytics.send('lcp', metric.value);
});
```

**后端监控**：
```typescript
// Prometheus metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDuration
      .labels(req.method, req.route.path, res.statusCode)
      .observe(duration);
  });
  next();
});
```

---

### 6.2 性能基准测试

**工具**：
- **Lighthouse**：前端性能评分
- **WebPageTest**：多地域性能测试
- **JMeter**：API 压力测试
- **K6**：现代化负载测试

**压测场景**：
```javascript
// K6 脚本
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 },   // 爬升到 100 并发
    { duration: '3m', target: 100 },   // 保持 100 并发
    { duration: '1m', target: 0 },     // 降到 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% 请求 < 200ms
  },
};

export default function () {
  const res = http.get('https://api.example.com/meetings');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

---

## 7. 优化效果评估

### 7.1 优化前后对比

| 指标 | 优化前 | 优化后 | 提升 |
|-----|--------|--------|------|
| 首屏加载 (FCP) | 3.2s | 1.5s | 53% |
| 可交互时间 (TTI) | 5.1s | 2.8s | 45% |
| API 响应 (P95) | 380ms | 150ms | 61% |
| 缓存命中率 | 65% | 92% | 42% |
| 服务器成本 | $500/月 | $300/月 | 40% |

---

## 8. 参考资料

- [Web Vitals](https://web.dev/vitals/)
- [mediasoup 性能调优](https://mediasoup.org/documentation/v3/scalability/)
- [PostgreSQL 性能优化](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis 最佳实践](https://redis.io/topics/optimization)
