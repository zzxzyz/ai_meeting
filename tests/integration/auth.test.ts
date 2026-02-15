/**
 * REQ-001 认证流程 - API 集成测试
 *
 * 测试范围：
 * 1. 用户注册 (POST /v1/auth/register)
 * 2. 用户登录 (POST /v1/auth/login)
 * 3. Token 刷新 (POST /v1/auth/refresh)
 * 4. 用户登出 (POST /v1/auth/logout)
 * 5. 获取当前用户信息 (GET /v1/users/me)
 *
 * 测试工具：Jest + Supertest + TypeScript
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';

describe('REQ-001 认证流程 - API 集成测试', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshTokenCookie: string;
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Password123',
    nickname: '测试用户',
  };

  beforeAll(async () => {
    // 创建测试应用实例
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 配置全局管道和中间件
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/auth/register - 用户注册', () => {
    it('应该成功注册新用户并返回 201', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201);

      const responseTime = Date.now() - startTime;

      // 验证响应结构
      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', '注册成功');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data).toHaveProperty('token_type', 'Bearer');
      expect(response.body.data).toHaveProperty('expires_in', 3600);

      // 验证用户信息
      const { user } = response.body.data;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email', testUser.email);
      expect(user).toHaveProperty('nickname', testUser.nickname);
      expect(user).toHaveProperty('avatar');
      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
      expect(user).not.toHaveProperty('password_hash');

      // 验证 Refresh Token Cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshTokenCookie = cookies.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('Path=/auth/refresh');
      expect(refreshTokenCookie).toContain('SameSite=Strict');

      // 验证性能（注册应在 500ms 内完成）
      expect(responseTime).toBeLessThan(500);

      // 保存 Token 供后续测试使用
      accessToken = response.body.data.access_token;
    });

    it('应该拒绝邮箱格式不正确的注册请求 (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123',
          nickname: '测试用户',
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 40001);
      expect(response.body.message).toContain('邮箱');
    });

    it('应该拒绝密码过短的注册请求 (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test2@example.com',
          password: '123',
          nickname: '测试用户',
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 40002);
      expect(response.body.message).toContain('密码');
    });

    it('应该拒绝昵称过长的注册请求 (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test3@example.com',
          password: 'Password123',
          nickname: '这是一个非常非常非常非常非常长的昵称超过20个字符',
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 40003);
      expect(response.body.message).toContain('昵称');
    });

    it('应该拒绝重复邮箱的注册请求 (409)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toHaveProperty('code', 40901);
      expect(response.body.message).toContain('邮箱已被注册');
    });

    it('应该在超过限流阈值后返回 429', async () => {
      const newEmail = `rate-limit-${Date.now()}@example.com`;

      // 连续注册 4 次（限流：3 次/60 分钟）
      for (let i = 0; i < 4; i++) {
        const response = await request(app.getHttpServer())
          .post('/v1/auth/register')
          .send({
            email: `${i}-${newEmail}`,
            password: 'Password123',
            nickname: '测试用户',
          });

        if (i < 3) {
          expect([201, 409]).toContain(response.status);
        } else {
          expect(response.status).toBe(429);
          expect(response.body).toHaveProperty('code', 42901);
          expect(response.body.message).toContain('请求过于频繁');
          expect(response.headers).toHaveProperty('x-ratelimit-limit');
          expect(response.headers).toHaveProperty('x-ratelimit-remaining');
          expect(response.headers).toHaveProperty('retry-after');
        }
      }
    });
  });

  describe('POST /v1/auth/login - 用户登录', () => {
    it('应该成功登录并返回 200', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const responseTime = Date.now() - startTime;

      // 验证响应结构
      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', '登录成功');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data).toHaveProperty('token_type', 'Bearer');
      expect(response.body.data).toHaveProperty('expires_in', 3600);

      // 验证用户信息
      const { user } = response.body.data;
      expect(user.email).toBe(testUser.email);
      expect(user).not.toHaveProperty('password_hash');

      // 验证 Refresh Token Cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      refreshTokenCookie = cookies.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(refreshTokenCookie).toBeDefined();

      // 验证性能（登录应在 500ms 内完成，考虑 bcrypt 验证时间）
      expect(responseTime).toBeLessThan(500);

      // 保存新的 Token
      accessToken = response.body.data.access_token;
    });

    it('应该拒绝不存在的邮箱 (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 40101);
      expect(response.body.message).toContain('邮箱或密码错误');
    });

    it('应该拒绝错误的密码 (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 40101);
      expect(response.body.message).toContain('邮箱或密码错误');
    });

    it('应该返回剩余尝试次数在连续登录失败后', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 40101);
      if (response.body.data) {
        expect(response.body.data).toHaveProperty('remaining_attempts');
      }
    });

    it('应该在连续 5 次登录失败后锁定账户 (401)', async () => {
      const testEmail = `locktest-${Date.now()}@example.com`;

      // 先注册一个新用户
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: testEmail,
          password: 'Password123',
          nickname: '锁定测试',
        });

      // 连续 5 次错误登录
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword',
          });
      }

      // 第 6 次应该返回账户锁定
      const response = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: 'Password123', // 即使密码正确也应该被拒绝
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 40102);
      expect(response.body.message).toContain('账户已被锁定');
      if (response.body.data) {
        expect(response.body.data).toHaveProperty('locked_until');
      }
    });
  });

  describe('POST /v1/auth/refresh - Token 刷新', () => {
    it('应该成功刷新 Token 并返回 200', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      const responseTime = Date.now() - startTime;

      // 验证响应结构
      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', 'Token 刷新成功');
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data).toHaveProperty('token_type', 'Bearer');
      expect(response.body.data).toHaveProperty('expires_in', 3600);

      // 验证新的 Refresh Token Cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const newRefreshTokenCookie = cookies.find((c: string) =>
        c.startsWith('refresh_token='),
      );
      expect(newRefreshTokenCookie).toBeDefined();

      // 验证性能（刷新应在 200ms 内完成）
      expect(responseTime).toBeLessThan(200);

      // 更新保存的 Token
      accessToken = response.body.data.access_token;
      refreshTokenCookie = newRefreshTokenCookie;
    });

    it('应该拒绝缺少 Refresh Token 的请求 (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .expect(401);

      expect(response.body).toHaveProperty('code');
      expect(response.body.message).toContain('Token');
    });

    it('应该拒绝无效的 Refresh Token (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', 'refresh_token=invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('code', 40103);
      expect(response.body.message).toContain('Refresh Token 无效');
    });

    it('应该检测并防止重放攻击 (401)', async () => {
      // 先正常刷新一次
      const firstResponse = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      // 保存旧的 Refresh Token
      const oldRefreshToken = refreshTokenCookie;

      // 更新为新的 Refresh Token
      const cookies = firstResponse.headers['set-cookie'];
      refreshTokenCookie = cookies.find((c: string) =>
        c.startsWith('refresh_token='),
      );

      // 尝试使用旧的 Token（重放攻击）
      const replayResponse = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', oldRefreshToken)
        .expect(401);

      expect(replayResponse.body).toHaveProperty('code', 40104);
      expect(replayResponse.body.message).toContain('检测到异常');
    });
  });

  describe('GET /v1/users/me - 获取当前用户信息', () => {
    it('应该成功获取用户信息并返回 200', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      // 验证响应结构
      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', '成功');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email', testUser.email);
      expect(response.body.data).toHaveProperty('nickname', testUser.nickname);
      expect(response.body.data).not.toHaveProperty('password_hash');

      // 验证性能（应在 100ms 内完成）
      expect(responseTime).toBeLessThan(100);
    });

    it('应该拒绝缺少 Token 的请求 (401)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .expect(401);

      expect(response.body).toHaveProperty('code', 40100);
      expect(response.body.message).toContain('缺少认证 Token');
    });

    it('应该拒绝无效的 Token (401)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('code', 40103);
      expect(response.body.message).toContain('Token 无效');
    });

    it('应该拒绝过期的 Token (401)', async () => {
      // 注意：这个测试需要等待 Token 过期，实际测试中可以通过修改 JWT 配置来加速
      // 或者通过 Mock 时间来测试
      // 这里仅作为示例
    });
  });

  describe('POST /v1/auth/logout - 用户登出', () => {
    it('应该成功登出并返回 200', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', '登出成功');

      // 验证 Refresh Token Cookie 被清除
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const clearedCookie = cookies.find((c: string) =>
          c.startsWith('refresh_token='),
        );
        if (clearedCookie) {
          expect(clearedCookie).toContain('Max-Age=0');
        }
      }
    });

    it('应该在登出后拒绝访问受保护的接口 (401)', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('code');
      expect(response.body.message).toContain('Token');
    });

    it('应该拒绝未认证的登出请求 (401)', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('code', 40100);
    });
  });

  describe('跨接口集成测试 - 完整认证流程', () => {
    it('应该完成完整的注册->登录->刷新->获取信息->登出流程', async () => {
      const flowTestUser = {
        email: `flow-${Date.now()}@example.com`,
        password: 'FlowTest123',
        nickname: '流程测试',
      };

      // 1. 注册
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send(flowTestUser)
        .expect(201);

      expect(registerRes.body.data).toHaveProperty('access_token');
      const token1 = registerRes.body.data.access_token;
      const cookies1 = registerRes.headers['set-cookie'];
      const refreshCookie1 = cookies1.find((c: string) =>
        c.startsWith('refresh_token='),
      );

      // 2. 获取用户信息
      const meRes1 = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(meRes1.body.data.email).toBe(flowTestUser.email);

      // 3. 刷新 Token
      const refreshRes = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshCookie1)
        .expect(200);

      const token2 = refreshRes.body.data.access_token;
      const cookies2 = refreshRes.headers['set-cookie'];
      const refreshCookie2 = cookies2.find((c: string) =>
        c.startsWith('refresh_token='),
      );

      // 4. 使用新 Token 获取用户信息
      const meRes2 = await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(meRes2.body.data.email).toBe(flowTestUser.email);

      // 5. 登出
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token2}`)
        .set('Cookie', refreshCookie2)
        .expect(200);

      // 6. 验证登出后无法访问
      await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token2}`)
        .expect(401);

      // 7. 使用原始密码重新登录
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: flowTestUser.email,
          password: flowTestUser.password,
        })
        .expect(200);

      expect(loginRes.body.data).toHaveProperty('access_token');
    });
  });

  describe('性能测试', () => {
    it('API 响应时间应符合要求', async () => {
      const performanceResults = {
        register: 0,
        login: 0,
        refresh: 0,
        getMe: 0,
        logout: 0,
      };

      // 注册
      const t1 = Date.now();
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: `perf-${Date.now()}@example.com`,
          password: 'Password123',
          nickname: '性能测试',
        });
      performanceResults.register = Date.now() - t1;

      // 登录
      const t2 = Date.now();
      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      performanceResults.login = Date.now() - t2;

      const token = loginRes.body.data.access_token;
      const cookies = loginRes.headers['set-cookie'];
      const refreshCookie = cookies.find((c: string) =>
        c.startsWith('refresh_token='),
      );

      // 刷新
      const t3 = Date.now();
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .set('Cookie', refreshCookie);
      performanceResults.refresh = Date.now() - t3;

      // 获取信息
      const t4 = Date.now();
      await request(app.getHttpServer())
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${token}`);
      performanceResults.getMe = Date.now() - t4;

      // 登出
      const t5 = Date.now();
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', refreshCookie);
      performanceResults.logout = Date.now() - t5;

      // 验证性能指标
      console.log('性能测试结果（毫秒）:', performanceResults);
      expect(performanceResults.register).toBeLessThan(500);
      expect(performanceResults.login).toBeLessThan(500);
      expect(performanceResults.refresh).toBeLessThan(200);
      expect(performanceResults.getMe).toBeLessThan(100);
      expect(performanceResults.logout).toBeLessThan(200);
    });
  });
});
