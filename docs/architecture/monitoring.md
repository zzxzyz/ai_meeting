# 监控与告警方案

## 文档信息

- **版本**: v1.0
- **最后更新**: 2026-02-13
- **负责人**: 运维团队
- **适用范围**: v0.1 MVP 版本

## 一、监控概述

### 1.1 监控目标

- **系统可用性**: 确保服务 7×24 小时稳定运行
- **性能监控**: 实时跟踪系统性能指标
- **异常检测**: 及时发现并响应异常情况
- **容量规划**: 为扩容提供数据支持

### 1.2 技术选型

- **指标采集**: Prometheus
- **可视化**: Grafana
- **告警**: Alertmanager + Slack/邮件
- **日志**: Loki + Promtail
- **APM**: (可选) Sentry / Jaeger

## 二、监控架构

### 2.1 整体架构

\`\`\`
应用层                    采集层             存储层          展示层
┌─────────┐           ┌──────────┐      ┌─────────┐     ┌─────────┐
│  API    │───metrics─→│Prometheus│─────→│ TSDB    │────→│ Grafana │
│ Service │           │ Exporter │      └─────────┘     └─────────┘
└─────────┘           └──────────┘                           │
                                                              │
┌─────────┐           ┌──────────┐      ┌─────────┐         │
│  Web    │───logs───→│ Promtail │─────→│  Loki   │────────┘
│  App    │           └──────────┘      └─────────┘
└─────────┘                                    │
                                               │
┌─────────┐           ┌──────────┐            │           ┌──────────┐
│ Database│───metrics─→│  Node    │────────────┘          │Alertmana │
│  Redis  │           │ Exporter │                        │  ger     │
└─────────┘           └──────────┘                        └──────────┘
                                                                │
                                                                ├→Slack
                                                                └→Email
\`\`\`

### 2.2 监控维度

1. **基础设施监控**: CPU、内存、磁盘、网络
2. **服务监控**: QPS、延迟、错误率、可用性
3. **业务监控**: 会议创建量、在线用户、并发连接
4. **WebRTC 监控**: 丢包率、抖动、码率、延迟

## 三、Prometheus 配置

### 3.1 Prometheus 配置文件

\`\`\`yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'ai-meeting-prod'
    env: 'production'

# 告警规则文件
rule_files:
  - 'alerts/*.yml'

# Alertmanager 配置
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# 采集目标
scrape_configs:
  # Node Exporter (系统指标)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  # API 服务
  - job_name: 'api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'

  # PostgreSQL
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Caddy/Nginx
  - job_name: 'caddy'
    static_configs:
      - targets: ['caddy:2019']
\`\`\`

### 3.2 应用指标暴露

在 NestJS 应用中集成 Prometheus:

\`\`\`typescript
// src/metrics/metrics.module.ts
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      path: '/metrics',
    }),
  ],
})
export class MetricsModule {}
\`\`\`

自定义业务指标:

\`\`\`typescript
// src/metrics/meeting.metrics.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MeetingMetrics {
  constructor(
    @InjectMetric('meetings_total')
    public meetingsTotal: Counter<string>,

    @InjectMetric('meetings_active')
    public meetingsActive: Gauge<string>,

    @InjectMetric('meeting_duration_seconds')
    public meetingDuration: Histogram<string>,

    @InjectMetric('participants_total')
    public participantsTotal: Counter<string>,
  ) {}

  recordMeetingCreated(hostId: string) {
    this.meetingsTotal.inc({ host_id: hostId });
    this.meetingsActive.inc();
  }

  recordMeetingEnded(duration: number) {
    this.meetingsActive.dec();
    this.meetingDuration.observe(duration);
  }

  recordParticipantJoined() {
    this.participantsTotal.inc({ action: 'join' });
  }
}
\`\`\`

## 四、Grafana 仪表板

### 4.1 系统概览仪表板

**面板内容**:
1. 服务状态 (UP/DOWN)
2. QPS (Queries Per Second)
3. 响应时间 (P50/P95/P99)
4. 错误率
5. CPU/内存使用率
6. 磁盘 I/O

**PromQL 查询示例**:

\`\`\`promql
# QPS
rate(http_requests_total[5m])

# P95 响应时间
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 错误率
rate(http_requests_total{status=~"5.."}[5m])
  /
rate(http_requests_total[5m])

# CPU 使用率
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 内存使用率
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
  /
node_memory_MemTotal_bytes * 100
\`\`\`

### 4.2 会议业务仪表板

**面板内容**:
1. 当前在线会议数
2. 当前在线用户数
3. 会议创建速率
4. 平均会议时长
5. WebRTC 连接成功率
6. 音视频质量指标

**PromQL 查询示例**:

\`\`\`promql
# 当前活跃会议
meetings_active

# 会议创建速率 (每分钟)
rate(meetings_total[1m]) * 60

# 平均会议时长
rate(meeting_duration_seconds_sum[5m])
  /
rate(meeting_duration_seconds_count[5m])

# WebRTC 连接成功率
webrtc_connections_established
  /
webrtc_connections_attempted * 100
\`\`\`

### 4.3 WebRTC 质量仪表板

**面板内容**:
1. 平均丢包率
2. 平均抖动
3. 音频码率
4. 视频码率
5. RTT (Round Trip Time)

## 五、告警规则

### 5.1 告警规则文件

\`\`\`yaml
# alerts/service.yml
groups:
  - name: service_alerts
    interval: 30s
    rules:
      # 服务不可用
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"

      # 高错误率
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m])
            /
          rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # 响应时间过长
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time on {{ $labels.job }}"
          description: "P95 response time is {{ $value }}s"

      # CPU 使用率过高
      - alert: HighCPUUsage
        expr: |
          100 - (avg by (instance)
            (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100
          ) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage is {{ $value }}%"

      # 内存使用率过高
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
            /
          node_memory_MemTotal_bytes * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"
          description: "Memory usage is {{ $value }}%"

      # 磁盘空间不足
      - alert: LowDiskSpace
        expr: |
          (node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.lxcfs"}
            /
          node_filesystem_size_bytes) * 100 < 15
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
          description: "Available disk space is {{ $value }}%"

  - name: business_alerts
    interval: 30s
    rules:
      # 会议创建异常
      - alert: AbnormalMeetingCreationRate
        expr: |
          abs(rate(meetings_total[5m]) - rate(meetings_total[5m] offset 1h))
            /
          rate(meetings_total[5m] offset 1h) > 0.5
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "Abnormal meeting creation rate"
          description: "Meeting creation rate changed by {{ $value | humanizePercentage }}"

      # WebRTC 连接成功率过低
      - alert: LowWebRTCConnectionRate
        expr: |
          webrtc_connections_established
            /
          webrtc_connections_attempted < 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low WebRTC connection success rate"
          description: "Success rate is {{ $value | humanizePercentage }}"
\`\`\`

### 5.2 Alertmanager 配置

\`\`\`yaml
# alertmanager.yml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

# 告警路由
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack'

  routes:
    # Critical 告警立即通知
    - match:
        severity: critical
      receiver: 'slack-critical'
      continue: true

    # 工作时间的 Warning 告警
    - match:
        severity: warning
      receiver: 'slack'
      active_time_intervals:
        - work_hours

# 接收器配置
receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#ai-meeting-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'slack-critical'
    slack_configs:
      - channel: '#ai-meeting-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

# 抑制规则
inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']

# 时间窗口
time_intervals:
  - name: work_hours
    time_intervals:
      - times:
          - start_time: '09:00'
            end_time: '18:00'
        weekdays: ['monday:friday']
\`\`\`

## 六、日志监控

### 6.1 Loki 配置

\`\`\`yaml
# loki-config.yml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 15m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 168h

storage_config:
  boltdb:
    directory: /loki/index
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 168h
\`\`\`

### 6.2 Promtail 配置

\`\`\`yaml
# promtail-config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker 容器日志
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'

  # 应用日志文件
  - job_name: app_logs
    static_configs:
      - targets:
          - localhost
        labels:
          job: app
          __path__: /var/log/ai-meeting/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            timestamp: timestamp
            message: message
      - labels:
          level:
      - timestamp:
          source: timestamp
          format: RFC3339
\`\`\`

### 6.3 结构化日志

在应用中使用结构化日志:

\`\`\`typescript
// src/logger/logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class CustomLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }
}
\`\`\`

## 七、部署配置

### 7.1 Docker Compose

\`\`\`yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts:/etc/prometheus/alerts
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3002:3000"
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    ports:
      - "3100:3100"
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log
      - /var/run/docker.sock:/var/run/docker.sock
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - "9100:9100"
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:
\`\`\`

## 八、监控最佳实践

### 8.1 指标命名规范

- 使用小写字母和下划线
- 包含单位后缀 (\_seconds, \_bytes, \_total)
- 使用有意义的标签

### 8.2 告警设计原则

- **可操作**: 每个告警都应该有明确的处理步骤
- **去噪**: 避免告警风暴,合理设置阈值
- **分级**: Critical > Warning > Info
- **时间窗口**: 设置合理的 `for` 持续时间

### 8.3 仪表板设计

- **分层**: 系统 → 服务 → 业务
- **关键指标优先**: RED (Rate, Errors, Duration) / USE (Utilization, Saturation, Errors)
- **可读性**: 合理使用图表类型

## 九、故障排查

### 9.1 常见问题

**Prometheus 数据丢失**:
- 检查存储空间
- 检查采集目标可达性
- 验证 scrape_interval 配置

**Grafana 无数据**:
- 检查数据源配置
- 验证 PromQL 查询
- 检查时间范围选择

**告警未触发**:
- 检查告警规则语法
- 验证 Alertmanager 配置
- 检查路由规则

## 十、相关文档

- [CI/CD 文档](./cicd.md)
- [部署文档](./deployment.md)
- [性能优化](./performance.md)
