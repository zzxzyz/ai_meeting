# 容灾与高可用架构设计

## 1. 背景与目标

### 1.1 业务背景
视频会议系统属于实时通信服务,任何故障都会直接影响用户体验,需要设计高可用架构保障服务稳定性。

### 1.2 可用性目标

| 等级 | 可用性 | 年停机时间 | 适用场景 |
|-----|--------|-----------|---------|
| 基础 | 99% | 3.65 天 | 测试环境 |
| 标准 | 99.9% | 8.76 小时 | 一般业务 |
| **高可用（目标）** | **99.95%** | **4.38 小时** | **生产环境** |
| 极高可用 | 99.99% | 52.6 分钟 | 关键业务 |

### 1.3 RTO/RPO 目标

- **RTO (恢复时间目标)**：5 分钟
- **RPO (恢复点目标)**：15 分钟（数据丢失 <15 分钟）

---

## 2. 高可用架构设计

### 2.1 整体架构

```
┌──────────────────────────────────────────────────┐
│              Global Load Balancer                │
│         (DNS-based / GeoDNS / Anycast)          │
└────────────────┬──────────────┬──────────────────┘
                 │              │
    ┌────────────┴──────┐  ┌───┴────────────┐
    │   Region A        │  │   Region B     │
    │   (Primary)       │  │   (Backup)     │
    └────────┬──────────┘  └────────┬───────┘
             │                      │
    ┌────────▼──────────┐  ┌───────▼────────┐
    │   Load Balancer   │  │ Load Balancer  │
    └────────┬──────────┘  └────────┬────────┘
             │                      │
    ┌────────▼──────────┐  ┌───────▼────────┐
    │   App Cluster     │  │  App Cluster   │
    │  (3+ instances)   │  │ (3+ instances) │
    └────────┬──────────┘  └────────┬────────┘
             │                      │
    ┌────────▼──────────┐  ┌───────▼────────┐
    │   DB Master       │  │   DB Master    │
    │   ↓↓↓             │  │   ↓↓↓          │
    │   DB Slaves (2)   │  │  DB Slaves (2) │
    └───────────────────┘  └────────────────┘
             │                      │
        Replication ←──────────────┘
```

---

### 2.2 应用层高可用

#### 2.2.1 无状态设计

**原则**：应用服务不存储状态,可随时销毁和创建

**会话管理**：
```typescript
// 错误：会话存储在内存
const sessions = new Map<string, Session>();

// 正确：会话存储在 Redis
class SessionService {
  async getSession(token: string): Promise<Session> {
    const data = await redis.get(`session:${token}`);
    return JSON.parse(data);
  }

  async saveSession(token: string, session: Session): Promise<void> {
    await redis.setex(`session:${token}`, 3600, JSON.stringify(session));
  }
}
```

---

#### 2.2.2 健康检查

**端点设计**：
```typescript
// /health - 简单检查（存活）
@Get('/health')
async health() {
  return { status: 'ok', timestamp: Date.now() };
}

// /health/ready - 就绪检查（依赖项）
@Get('/health/ready')
async ready() {
  const checks = {
    database: await this.checkDatabase(),
    redis: await this.checkRedis(),
    mediasoup: await this.checkMediasoup()
  };

  const allHealthy = Object.values(checks).every(v => v === true);

  return {
    status: allHealthy ? 'ready' : 'not_ready',
    checks
  };
}
```

**负载均衡器配置**：
```nginx
upstream api_servers {
  server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
  server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
  server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;

  # 健康检查
  check interval=3000 rise=2 fall=3 timeout=1000 type=http;
  check_http_send "GET /health HTTP/1.0\r\n\r\n";
  check_http_expect_alive http_2xx http_3xx;
}
```

---

#### 2.2.3 优雅关闭

**流程**：
```
1. 接收 SIGTERM 信号
   ↓
2. 停止接受新请求（health 返回 not_ready）
   ↓
3. 等待现有请求完成（最多 30 秒）
   ↓
4. 关闭数据库连接
   ↓
5. 退出进程
```

**实现**：
```typescript
class Application {
  private isShuttingDown = false;

  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('Graceful shutdown initiated...');

    // 1. 停止健康检查
    this.healthCheckService.markUnhealthy();

    // 2. 等待现有请求完成（最多 30 秒）
    await new Promise(resolve => {
      this.server.close(resolve);
      setTimeout(resolve, 30000);
    });

    // 3. 关闭数据库连接
    await this.database.close();

    // 4. 关闭 Redis 连接
    await this.redis.quit();

    console.log('Shutdown complete');
    process.exit(0);
  }

  start() {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
}
```

---

### 2.3 数据库高可用

#### 2.3.1 主从复制

**架构**：
```
Master (写)
  ↓ 同步复制
Slave 1 (读)
Slave 2 (读)
```

**PostgreSQL 配置**：
```sql
-- Master
# postgresql.conf
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB

-- Slave
# recovery.conf
standby_mode = 'on'
primary_conninfo = 'host=master.db port=5432 user=replicator'
```

---

#### 2.3.2 自动故障切换

**方案**：Patroni + etcd

**架构**：
```
┌─────────────────────────────────────┐
│           etcd Cluster              │
│    (分布式一致性存储)                 │
└────────────┬────────────────────────┘
             │ 监听主节点健康状态
    ┌────────┼────────┐
    │        │        │
┌───▼───┐ ┌──▼───┐ ┌─▼────┐
│Patroni│ │Patroni│ │Patroni│
│  +    │ │  +    │ │  +   │
│ PG    │ │ PG   │ │ PG   │
│Master │ │Standby│ │Standby│
└───────┘ └───────┘ └──────┘
```

**故障切换流程**：
```
1. Patroni 检测到 Master 故障（心跳超时）
   ↓
2. 通过 etcd 进行 Leader 选举
   ↓
3. 提升一个 Standby 为新 Master
   ↓
4. 更新其他 Standby 连接到新 Master
   ↓
5. 更新 DNS 或配置中心
```

**RTO**：<30 秒

---

#### 2.3.3 连接池故障恢复

**实现**：
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: 'master.db',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,

  // 连接失败重试
  retryDelay: 1000,
  maxRetries: 3,

  // 连接验证
  validateConnection: async (client) => {
    try {
      await client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
});

// 错误处理
pool.on('error', (err, client) => {
  console.error('Database pool error:', err);
  // 上报监控
  metrics.increment('db.pool.error');
});
```

---

### 2.4 Redis 高可用

#### 2.4.1 Redis Sentinel

**架构**：
```
┌─────────────────────────────────────┐
│       Sentinel Cluster (3)          │
│   (监控、故障切换、配置提供)          │
└────────────┬────────────────────────┘
             │ 监控
    ┌────────┼────────┐
    │        │        │
┌───▼───┐ ┌──▼───┐ ┌─▼────┐
│ Redis │ │ Redis│ │ Redis│
│Master │ │Slave │ │Slave │
└───────┘ └───────┘ └──────┘
```

**配置**：
```
# sentinel.conf
sentinel monitor mymaster 127.0.0.1 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

**客户端连接**：
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  sentinels: [
    { host: 'sentinel1', port: 26379 },
    { host: 'sentinel2', port: 26379 },
    { host: 'sentinel3', port: 26379 }
  ],
  name: 'mymaster',
  sentinelRetryStrategy: (times) => {
    return Math.min(times * 100, 2000);
  }
});
```

**RTO**：<10 秒

---

### 2.5 媒体服务器高可用

#### 2.5.1 集群部署

**架构**：
```
┌─────────────────┐
│  Signal Server  │
│   (无状态)       │
└────────┬────────┘
         │ 分配媒体服务器
    ┌────┼─────┬─────┐
    │    │     │     │
┌───▼──┐ │  ┌──▼──┐ │
│Media │ │  │Media│ │
│ Srv1 │ │  │Srv2 │ │...
└──────┘ │  └─────┘ │
         │          │
     会议 A      会议 B
```

**负载均衡策略**：
- **一致性哈希**：同一会议的参会者连接到同一媒体服务器
- **最少连接**：新会议分配到连接数最少的服务器

**实现**：
```typescript
class MediaServerPool {
  private servers: MediaServer[] = [];

  // 选择媒体服务器
  selectServer(meetingId: string): MediaServer {
    // 一致性哈希
    const hash = this.hash(meetingId);
    const index = hash % this.servers.length;
    return this.servers[index];
  }

  // 健康检查
  async healthCheck() {
    for (const server of this.servers) {
      try {
        await server.ping();
        server.markHealthy();
      } catch {
        server.markUnhealthy();
        // 迁移会议到其他服务器
        await this.migrateRooms(server);
      }
    }
  }
}
```

---

#### 2.5.2 媒体服务器故障恢复

**流程**：
```
1. 检测到媒体服务器故障
   ↓
2. 通知客户端重新连接
   ↓
3. 信令服务器分配新的媒体服务器
   ↓
4. 客户端建立新连接
   ↓
5. 恢复媒体流
```

**实现**：
```typescript
// 信令服务器
class SignalingService {
  async handleMediaServerFailure(serverId: string) {
    // 1. 获取受影响的会议
    const rooms = await this.getRoomsByServer(serverId);

    for (const room of rooms) {
      // 2. 分配新服务器
      const newServer = this.mediaServerPool.selectServer(room.id);

      // 3. 通知所有客户端
      room.broadcast({
        type: 'media-server-changed',
        newServer: newServer.url
      });

      // 4. 更新会议记录
      await this.updateRoomServer(room.id, newServer.id);
    }
  }
}

// 客户端
socket.on('media-server-changed', async ({ newServer }) => {
  console.log('Media server changed, reconnecting...');

  // 关闭旧连接
  await pc.close();

  // 建立新连接
  await connectToMediaServer(newServer);

  // 恢复媒体流
  await publishStream();
  await subscribeStreams();
});
```

**RTO**：<15 秒

---

## 3. 故障场景与应对

### 3.1 应用服务器故障

**场景**：单个应用实例崩溃

**影响**：该实例上的请求失败

**应对**：
- 负载均衡器自动摘除故障实例（30 秒内）
- 自动重启容器（Kubernetes）
- 监控告警

**RTO**：30 秒

---

### 3.2 数据库主库故障

**场景**：PostgreSQL Master 宕机

**影响**：所有写操作失败,读操作正常

**应对**：
- Patroni 自动提升 Standby 为 Master（30 秒）
- 应用连接池自动重连
- 监控告警

**RTO**：30 秒
**RPO**：0（同步复制）

---

### 3.3 Redis 主库故障

**场景**：Redis Master 宕机

**影响**：缓存写入失败,会话可能丢失

**应对**：
- Sentinel 自动故障切换（10 秒）
- 应用降级（直接查询数据库）
- 会话重新登录

**RTO**：10 秒
**RPO**：<10 秒（可能丢失部分会话）

---

### 3.4 机房故障

**场景**：整个数据中心不可用（火灾、地震、网络中断）

**影响**：该区域所有服务不可用

**应对**：
- DNS 切换到备用区域（5 分钟）
- 数据库跨区域复制（异步,延迟 <1 分钟）
- 监控告警,手动确认切换

**RTO**：5 分钟
**RPO**：1 分钟

---

### 3.5 DDoS 攻击

**场景**：大流量攻击导致服务不可用

**影响**：正常用户无法访问

**应对**：
- 云厂商 DDoS 防护（自动）
- CDN 防护（限流、黑名单）
- API 网关限流
- 监控告警

**RTO**：<5 分钟（自动防护）

---

## 4. 数据备份与恢复

### 4.1 备份策略

#### 4.1.1 数据库备份

**策略**：
- **全量备份**：每天 00:00（保留 30 天）
- **增量备份**：每小时（保留 7 天）
- **WAL 归档**：实时（保留 7 天）

**实现**：
```bash
#!/bin/bash
# 全量备份脚本

BACKUP_DIR="/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)

# 使用 pg_basebackup
pg_basebackup -h localhost -U postgres \
  -D ${BACKUP_DIR}/full_${DATE} \
  -Fp -Xs -P -v

# 压缩
tar -czf ${BACKUP_DIR}/full_${DATE}.tar.gz ${BACKUP_DIR}/full_${DATE}
rm -rf ${BACKUP_DIR}/full_${DATE}

# 上传到 S3
aws s3 cp ${BACKUP_DIR}/full_${DATE}.tar.gz \
  s3://backups/postgresql/full_${DATE}.tar.gz

# 删除本地文件
rm ${BACKUP_DIR}/full_${DATE}.tar.gz

# 删除 30 天前的备份
find ${BACKUP_DIR} -name "full_*.tar.gz" -mtime +30 -delete
```

**自动化**：
```cron
# crontab
0 0 * * * /scripts/backup_full.sh
0 * * * * /scripts/backup_incremental.sh
```

---

#### 4.1.2 对象存储备份

**策略**：
- **跨区域复制**：实时（S3 Cross-Region Replication）
- **版本控制**：启用（可恢复误删除）
- **生命周期管理**：30 天后归档到 Glacier

**S3 配置**：
```json
{
  "Rules": [
    {
      "Id": "Archive old recordings",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        },
        {
          "Days": 90,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ]
    },
    {
      "Id": "Delete old backups",
      "Status": "Enabled",
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

---

### 4.2 恢复演练

**频率**：每季度一次

**场景**：
1. 数据库误删除数据
2. 数据库主库故障
3. 整个机房故障

**演练步骤**：
```
1. 从备份恢复数据库（RTO 目标 <30 分钟）
   ↓
2. 验证数据完整性
   ↓
3. 应用 WAL 日志（恢复到最新状态）
   ↓
4. 切换应用连接
   ↓
5. 验证服务可用性
```

**恢复脚本**：
```bash
#!/bin/bash
# 数据库恢复脚本

BACKUP_FILE=$1
RECOVERY_TARGET_TIME=$2  # 可选,恢复到指定时间点

# 1. 停止 PostgreSQL
systemctl stop postgresql

# 2. 清空数据目录
rm -rf /var/lib/postgresql/data/*

# 3. 解压备份
tar -xzf ${BACKUP_FILE} -C /var/lib/postgresql/data

# 4. 配置恢复
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'cp /backups/wal_archive/%f %p'
recovery_target_time = '${RECOVERY_TARGET_TIME}'
recovery_target_action = 'promote'
EOF

# 5. 启动 PostgreSQL
systemctl start postgresql

# 6. 等待恢复完成
while ! pg_isready; do
  sleep 1
done

echo "Recovery completed"
```

---

## 5. 监控与告警

### 5.1 监控指标

#### 5.1.1 系统指标

| 指标 | 告警阈值 | 严重程度 |
|-----|---------|---------|
| CPU 使用率 | >80% | Warning |
| 内存使用率 | >85% | Warning |
| 磁盘使用率 | >90% | Critical |
| 磁盘 I/O 等待 | >20% | Warning |
| 网络流量 | >80% 容量 | Warning |

#### 5.1.2 应用指标

| 指标 | 告警阈值 | 严重程度 |
|-----|---------|---------|
| API 错误率 | >5% | Critical |
| API P95 延迟 | >500ms | Warning |
| WebSocket 连接数 | >10000 | Warning |
| 活跃会议数 | >100 | Info |

#### 5.1.3 数据库指标

| 指标 | 告警阈值 | 严重程度 |
|-----|---------|---------|
| 连接数 | >80% | Warning |
| 慢查询 | >100ms | Warning |
| 主从延迟 | >10s | Critical |
| 死锁数量 | >0 | Warning |

---

### 5.2 告警渠道

**多级告警**：
```
Info → 记录日志
Warning → 企业微信/钉钉
Critical → 短信 + 电话 + 企业微信
```

**告警规则**：
```yaml
# Prometheus AlertManager 配置
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "API error rate is {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
```

---

### 5.3 可观测性

**三大支柱**：
- **Metrics**：Prometheus + Grafana
- **Logs**：ELK (Elasticsearch + Logstash + Kibana)
- **Traces**：Jaeger

**关联查询**：
```
告警 → Trace ID → 查看完整请求链路 → 定位慢查询
```

---

## 6. 应急响应

### 6.1 故障等级

| 等级 | 影响范围 | 响应时间 | 解决时间 |
|-----|---------|---------|---------|
| **P0** | 全站不可用 | 15 分钟 | 1 小时 |
| **P1** | 核心功能不可用 | 30 分钟 | 4 小时 |
| **P2** | 部分功能异常 | 2 小时 | 1 天 |
| **P3** | 小范围影响 | 1 天 | 1 周 |

---

### 6.2 应急流程

```
1. 监控告警触发
   ↓
2. 值班人员响应（15 分钟内）
   ↓
3. 初步诊断（查看监控、日志）
   ↓
4. 确定故障等级
   ↓ P0/P1
5. 拉群通知相关人员
   ↓
6. 执行应急预案
   ↓
7. 问题解决,服务恢复
   ↓
8. 事后复盘,输出故障报告
```

---

### 6.3 故障复盘

**模板**：
```markdown
# 故障报告

## 故障概述
- 故障时间：2024-01-01 10:00 - 10:30
- 故障等级：P0
- 影响范围：全站不可用
- 用户影响：500 个在线会议中断

## 故障原因
数据库主库磁盘写满,无法写入

## 时间线
- 10:00 监控告警：数据库连接失败
- 10:05 值班人员响应
- 10:10 确认磁盘写满
- 10:15 清理磁盘空间
- 10:20 服务恢复
- 10:30 确认服务正常

## 根本原因
日志文件未配置自动清理,持续写入导致磁盘写满

## 改进措施
1. 配置日志自动清理（7 天）
2. 增加磁盘使用率告警（>80%）
3. 增加数据库写入失败告警
4. 定期检查磁盘空间

## 经验教训
- 监控覆盖不足（未监控磁盘使用率）
- 应急预案不完善（未预案磁盘写满场景）
```

---

## 7. 参考资料

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [PostgreSQL HA](https://wiki.postgresql.org/wiki/Replication,_Clustering,_and_Connection_Pooling)
- [Redis Sentinel](https://redis.io/topics/sentinel)
