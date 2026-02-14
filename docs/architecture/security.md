# 安全架构设计

## 1. 背景与目标

### 1.1 业务背景
视频会议系统涉及用户敏感信息、实时音视频数据、会议内容等,需要全方位的安全防护。

### 1.2 安全目标
- **机密性**：防止未授权访问和数据泄露
- **完整性**：防止数据篡改
- **可用性**：防止拒绝服务攻击
- **合规性**：满足 GDPR、等保等法规要求

### 1.3 威胁模型
- **认证攻击**：暴力破解、凭证泄露
- **授权绕过**：越权访问他人会议
- **中间人攻击**：窃听音视频数据
- **注入攻击**：SQL 注入、XSS、CSRF
- **DDoS 攻击**：大流量攻击导致服务不可用

---

## 2. 认证方案

### 2.1 JWT (JSON Web Token) 认证

#### 2.1.1 架构设计

```
客户端 → POST /auth/login (email + password)
           ↓
      验证密码（bcrypt）
           ↓
      生成 JWT Token
           ↓
      返回 { accessToken, refreshToken }
           ↓
客户端存储 Token (localStorage/Secure Cookie)
           ↓
后续请求携带 Token (Authorization: Bearer <token>)
           ↓
服务端验证 Token (签名 + 过期时间)
```

#### 2.1.2 Token 设计

**Access Token**（短期）：
```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "roles": ["user"],
  "iat": 1678886400,
  "exp": 1678890000  // 1小时后过期
}
```

**Refresh Token**（长期）：
```json
{
  "sub": "user-123",
  "type": "refresh",
  "iat": 1678886400,
  "exp": 1686662400  // 90天后过期
}
```

**签名算法**：
- **算法**：RS256（RSA + SHA-256）
- **密钥长度**：2048 位
- **密钥轮换**：每 90 天

#### 2.1.3 Token 刷新流程

```
Access Token 过期 → 使用 Refresh Token 请求新 Token
                      ↓
                  验证 Refresh Token
                      ↓
                  生成新的 Access Token
                      ↓
                  返回新 Token
```

**安全措施**：
- Refresh Token 使用一次失效（防止重放）
- Refresh Token 存储在数据库，支持撤销
- 异常登录检测（IP、设备指纹变化）

---

### 2.2 OAuth 2.0 / OpenID Connect（第三方登录）

**支持的提供商**：
- Google
- GitHub
- Microsoft

**流程**：
```
客户端 → 重定向到 OAuth Provider
          ↓
     用户授权
          ↓
     返回 Authorization Code
          ↓
后端用 Code 换 Access Token
          ↓
获取用户信息
          ↓
创建/更新本地用户
          ↓
返回 JWT Token
```

---

### 2.3 多因素认证 (MFA)

**方案**：TOTP (Time-based One-Time Password)

**流程**：
```
1. 用户启用 MFA
   ↓ 生成密钥
   ↓ 返回 QR 码
   ↓ 用户扫码（Google Authenticator）

2. 登录时验证
   ↓ 输入密码（第一因素）
   ↓ 输入 6 位数字（第二因素）
   ↓ 验证通过，返回 Token
```

**实现库**：
- Node.js: `speakeasy`
- Go: `pquerna/otp`

---

## 3. 授权方案

### 3.1 RBAC (Role-Based Access Control)

#### 3.1.1 角色定义

| 角色 | 权限 |
|-----|------|
| **Guest** | 加入公开会议 |
| **User** | 创建会议、邀请他人、管理自己的会议 |
| **Moderator** | 管理会议（静音他人、踢出参会者） |
| **Admin** | 管理所有用户和会议、查看系统监控 |

#### 3.1.2 权限检查

```typescript
// 装饰器实现
@RequirePermission('meeting:manage')
async updateMeeting(@Param('id') id: string) {
  // ...
}

// 实现
class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    const requiredPermission = this.reflector.get('permission', context.getHandler());

    return user.permissions.includes(requiredPermission);
  }
}
```

---

### 3.2 资源级授权（会议权限）

**规则**：
```
会议创建者：完全控制（修改、删除、管理参会者）
参会者：仅能查看和参与会议
非参会者：无法访问
```

**实现**：
```typescript
async canAccessMeeting(userId: string, meetingId: string): Promise<boolean> {
  const meeting = await this.meetingRepo.findById(meetingId);

  // 检查是否为创建者
  if (meeting.hostId === userId) return true;

  // 检查是否为参会者
  return meeting.participants.some(p => p.userId === userId);
}
```

---

## 4. 数据加密

### 4.1 传输层加密

#### 4.1.1 HTTPS (TLS 1.3)

**配置要求**：
- **协议版本**：TLS 1.3（禁用 TLS 1.0/1.1）
- **加密套件**：
  - TLS_AES_256_GCM_SHA384
  - TLS_CHACHA20_POLY1305_SHA256
- **证书**：Let's Encrypt 自动续期
- **HSTS**：启用（强制 HTTPS）

**Nginx 配置**：
```nginx
ssl_protocols TLSv1.3;
ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';
ssl_prefer_server_ciphers on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

#### 4.1.2 WebRTC 加密（DTLS-SRTP）

**媒体流加密**：
- **DTLS**：用于密钥交换（基于 TLS）
- **SRTP**：用于 RTP 媒体加密（AES-128）
- **SRTCP**：用于 RTCP 控制加密

**默认启用**：WebRTC 强制加密，无需额外配置

---

### 4.2 端到端加密 (E2EE)

**适用场景**：高安全要求的会议（金融、医疗）

**架构**：
```
客户端 A 生成密钥对（公钥 + 私钥）
    ↓
交换公钥（通过信令服务器）
    ↓
使用对方公钥加密媒体流
    ↓
服务器只转发加密数据（无法解密）
    ↓
接收方使用私钥解密
```

**实现方案**：
- **WebRTC Insertable Streams**（浏览器支持）
- **加密算法**：AES-256-GCM
- **密钥交换**：ECDH (Elliptic Curve Diffie-Hellman)

**MVP 阶段**：暂不实现（复杂度高）
**长期计划**：作为高级功能提供

---

### 4.3 存储加密

#### 4.3.1 数据库字段加密

**敏感字段**：
- 用户密码：bcrypt (cost=12)
- API 密钥：AES-256-GCM
- 支付信息：AES-256-GCM + 独立密钥管理

**实现**：
```typescript
class User {
  @Column({ type: 'varchar', transformer: new EncryptionTransformer() })
  apiKey: string;
}

class EncryptionTransformer {
  to(value: string): string {
    return encrypt(value, process.env.ENCRYPTION_KEY);
  }

  from(value: string): string {
    return decrypt(value, process.env.ENCRYPTION_KEY);
  }
}
```

#### 4.3.2 录制文件加密

**对象存储加密**：
- **服务端加密**：SSE-S3（S3 托管密钥）
- **客户端加密**：上传前加密（高安全场景）

---

## 5. API 安全

### 5.1 限流 (Rate Limiting)

**策略**：

| 端点 | 限制 | 窗口 |
|-----|------|------|
| 登录 | 5 次 | 15 分钟 |
| 注册 | 3 次 | 60 分钟 |
| API 调用 | 100 次 | 1 分钟 |
| WebSocket | 10 连接 | 每 IP |

**实现**：
```typescript
// Redis 滑动窗口
class RateLimiter {
  async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
    const now = Date.now();
    const pipeline = redis.pipeline();

    // 删除过期请求
    pipeline.zremrangebyscore(key, 0, now - window * 1000);

    // 添加当前请求
    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    // 统计请求数
    pipeline.zcard(key);

    // 设置过期时间
    pipeline.expire(key, window);

    const results = await pipeline.exec();
    const count = results[2][1];

    return count <= limit;
  }
}
```

---

### 5.2 防止重放攻击

**方案**：Nonce + Timestamp

```typescript
// 请求头
Authorization: Bearer <token>
X-Nonce: <随机字符串>
X-Timestamp: <UNIX时间戳>

// 服务端验证
async validateRequest(nonce: string, timestamp: number): Promise<boolean> {
  // 1. 检查时间戳（5分钟内有效）
  if (Math.abs(Date.now() - timestamp) > 300000) {
    return false;
  }

  // 2. 检查 Nonce 是否已使用
  const key = `nonce:${nonce}`;
  const exists = await redis.exists(key);
  if (exists) return false;

  // 3. 记录 Nonce（5分钟过期）
  await redis.setex(key, 300, '1');

  return true;
}
```

---

### 5.3 防止注入攻击

#### 5.3.1 SQL 注入

**防护措施**：
- 使用参数化查询（Prepared Statements）
- 永不拼接 SQL 字符串

**错误示例**：
```typescript
// 危险！
const sql = `SELECT * FROM users WHERE email = '${email}'`;
```

**正确示例**：
```typescript
// 安全
const user = await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

#### 5.3.2 XSS (跨站脚本)

**防护措施**：
- 输出转义（HTML Entity Encoding）
- Content Security Policy (CSP)
- HttpOnly Cookie

**CSP 配置**：
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.example.com;
  connect-src 'self' wss://signal.example.com;
```

#### 5.3.3 CSRF (跨站请求伪造)

**防护措施**：
- SameSite Cookie
- CSRF Token

**实现**：
```typescript
// 设置 SameSite Cookie
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
});
```

---

### 5.4 输入验证

**原则**：白名单 > 黑名单

**示例**：
```typescript
class CreateMeetingDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z0-9\s\-_]+$/)  // 只允许字母数字空格
  title: string;

  @IsDate()
  @MinDate(new Date())  // 不能是过去时间
  startTime: Date;

  @IsArray()
  @ArrayMaxSize(100)  // 最多邀请 100 人
  @IsEmail({}, { each: true })
  invitees: string[];
}
```

---

## 6. 会议安全

### 6.1 会议 ID 生成

**方案**：UUID v4（128 位随机）

**理由**：
- 不可预测（vs 自增 ID）
- 冲突概率极低
- 无需额外的"会议密码"

**示例**：
```
会议 ID: 550e8400-e29b-41d4-a716-446655440000
会议链接: https://meet.example.com/550e8400-e29b-41d4-a716-446655440000
```

---

### 6.2 等候室 (Waiting Room)

**流程**：
```
参会者加入 → 进入等候室 → 主持人批准 → 进入会议
```

**实现**：
```typescript
class Meeting {
  waitingRoom: Participant[] = [];

  addToWaitingRoom(user: User): void {
    this.waitingRoom.push(new Participant(user));
    this.notifyHost(`${user.name} 正在等待加入`);
  }

  admitParticipant(userId: string): void {
    const participant = this.waitingRoom.find(p => p.userId === userId);
    if (!participant) throw new Error('Participant not found');

    this.participants.push(participant);
    this.waitingRoom = this.waitingRoom.filter(p => p.userId !== userId);
  }
}
```

---

### 6.3 会议锁定

**功能**：主持人锁定会议，禁止新参会者加入

```typescript
class Meeting {
  isLocked: boolean = false;

  lock(): void {
    if (!this.isHost(currentUser)) {
      throw new UnauthorizedError();
    }
    this.isLocked = true;
  }

  join(user: User): void {
    if (this.isLocked) {
      throw new MeetingLockedError();
    }
    // ...
  }
}
```

---

## 7. 监控与审计

### 7.1 安全日志

**记录内容**：
- 登录/登出（IP、设备、时间）
- 权限变更
- 敏感操作（删除会议、导出数据）
- API 异常（401、403、429）

**格式**：
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "level": "security",
  "event": "login_failed",
  "userId": "user-123",
  "ip": "203.0.113.1",
  "userAgent": "Mozilla/5.0...",
  "reason": "invalid_password"
}
```

---

### 7.2 异常检测

**检测规则**：
- 短时间内多次登录失败
- 异常 IP 登录（地理位置变化）
- 大量 API 调用（可能的爬虫）
- 权限越界尝试

**响应措施**：
- 自动锁定账户（15 分钟）
- 发送邮件通知
- 要求 MFA 验证

---

## 8. 合规性

### 8.1 GDPR (欧盟通用数据保护条例)

**要求**：
- **数据最小化**：只收集必要数据
- **用户同意**：明确的隐私政策和同意机制
- **数据导出**：用户可导出所有个人数据
- **被遗忘权**：用户可删除账户和所有数据
- **数据泄露通知**：72 小时内通知监管机构

**实现**：
```typescript
// 用户数据导出
async exportUserData(userId: string): Promise<any> {
  return {
    profile: await this.userRepo.findById(userId),
    meetings: await this.meetingRepo.findByUserId(userId),
    recordings: await this.storageService.listByUserId(userId)
  };
}

// 删除用户数据
async deleteUser(userId: string): Promise<void> {
  await this.userRepo.delete(userId);
  await this.meetingRepo.deleteByUserId(userId);
  await this.storageService.deleteByUserId(userId);
}
```

---

### 8.2 等保 2.0 (中国信息安全等级保护)

**二级要求**：
- 身份认证（用户名 + 密码）
- 访问控制（RBAC）
- 安全审计（日志保留 6 个月）
- 数据备份（每日备份）

**三级要求**（增加）：
- 多因素认证
- 数据加密（传输 + 存储）
- 入侵检测
- 应急响应

---

## 9. 安全检查清单

### 9.1 开发阶段

- [ ] 所有 API 需要认证
- [ ] 所有 API 输入验证
- [ ] 敏感数据加密存储
- [ ] 使用参数化查询
- [ ] 设置 CSP 头
- [ ] 启用 HTTPS
- [ ] 依赖包漏洞扫描（npm audit）

### 9.2 部署阶段

- [ ] 使用 TLS 1.3
- [ ] 配置防火墙
- [ ] 最小权限原则（数据库用户、文件权限）
- [ ] 关闭不必要的端口
- [ ] 定期更新系统补丁

### 9.3 运维阶段

- [ ] 监控异常登录
- [ ] 定期检查安全日志
- [ ] 定期备份数据
- [ ] 定期渗透测试
- [ ] 制定应急响应计划

---

## 10. 参考资料

### 10.1 标准规范
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR 官方文档](https://gdpr.eu/)
- [等保 2.0 标准](http://www.djbh.net/)

### 10.2 工具
- [OWASP ZAP](https://www.zaproxy.org/)（渗透测试）
- [SonarQube](https://www.sonarqube.org/)（代码安全扫描）
- [Let's Encrypt](https://letsencrypt.org/)（免费 SSL 证书）
