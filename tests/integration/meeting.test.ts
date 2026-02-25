/**
 * REQ-002 会议管理 - API 集成测试
 *
 * 测试范围：
 * 1. 创建会议 (POST /v1/meetings)
 * 2. 加入会议 (POST /v1/meetings/join)
 * 3. 查询会议列表 (GET /v1/meetings)
 * 4. 查询会议详情 (GET /v1/meetings/:meetingId)
 * 5. 结束会议 (POST /v1/meetings/:meetingId/end)
 *
 * 测试工具：Jest + Supertest + TypeScript
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '@/app.module';

describe('REQ-002 会议管理 - API 集成测试', () => {
  let app: INestApplication;

  // 测试用户 A（会议创建者）
  let userAToken: string;
  let userAId: string;

  // 测试用户 B（会议参与者）
  let userBToken: string;
  let userBId: string;

  // 测试用户 C（非参与者，用于权限测试）
  let userCToken: string;

  // 共享会议数据
  let createdMeetingId: string;
  let createdMeetingNumber: string;

  const userA = {
    email: `meeting-test-a-${Date.now()}@example.com`,
    password: 'Password123',
    nickname: '会议测试用户A',
  };

  const userB = {
    email: `meeting-test-b-${Date.now()}@example.com`,
    password: 'Password123',
    nickname: '会议测试用户B',
  };

  const userC = {
    email: `meeting-test-c-${Date.now()}@example.com`,
    password: 'Password123',
    nickname: '会议测试用户C',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // 注册并登录用户 A
    const regResA = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(userA);
    userAToken = regResA.body.data.access_token;
    userAId = regResA.body.data.user.id;

    // 注册并登录用户 B
    const regResB = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(userB);
    userBToken = regResB.body.data.access_token;
    userBId = regResB.body.data.user.id;

    // 注册用户 C（非参与者）
    const regResC = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(userC);
    userCToken = regResC.body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // POST /v1/meetings - 创建会议
  // ==========================================

  describe('POST /v1/meetings - 创建会议', () => {
    it('TC-001: 已登录用户成功创建会议（带标题）', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: '产品评审会议' })
        .expect(201);

      const responseTime = Date.now() - startTime;

      // 验证响应格式
      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', 'success');
      expect(response.body).toHaveProperty('data');

      // 验证会议数据
      const { data } = response.body;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('meetingNumber');
      expect(data).toHaveProperty('title', '产品评审会议');
      expect(data).toHaveProperty('status', 'IN_PROGRESS');
      expect(data).toHaveProperty('creatorId', userAId);
      expect(data).toHaveProperty('participantCount', 1);
      expect(data).toHaveProperty('startedAt');
      expect(data).toHaveProperty('createdAt');

      // 验证会议号格式：9 位纯数字
      expect(data.meetingNumber).toMatch(/^\d{9}$/);

      // 保存供后续测试使用
      createdMeetingId = data.id;
      createdMeetingNumber = data.meetingNumber;

      // 性能验证：P95 < 200ms
      expect(responseTime).toBeLessThan(2000); // 集成测试允许宽松时间
    });

    it('TC-002: 已登录用户成功创建会议（不带标题）', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({})
        .expect(201);

      expect(response.body.code).toBe(0);
      expect(response.body.data.title).toBeNull();
      expect(response.body.data.meetingNumber).toMatch(/^\d{9}$/);
      expect(response.body.data.status).toBe('IN_PROGRESS');
    });

    it('TC-003: 未认证用户创建会议返回 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/meetings')
        .send({ title: '测试会议' })
        .expect(401);

      expect(response.body).toHaveProperty('code');
    });

    it('TC-005: 会议标题超过 50 字符返回 400', async () => {
      const longTitle = 'A'.repeat(51);
      await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: longTitle })
        .expect(400);
    });

    it('TC-006: 同一用户可连续创建多个会议且会议号唯一', async () => {
      const meetingNumbers = new Set<string>();

      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post('/v1/meetings')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ title: `连续创建会议 ${i + 1}` })
          .expect(201);

        expect(response.body.code).toBe(0);
        const { meetingNumber } = response.body.data;
        expect(meetingNumber).toMatch(/^\d{9}$/);
        meetingNumbers.add(meetingNumber);
      }

      // 三个会议号应该都不同
      expect(meetingNumbers.size).toBe(3);
    });
  });

  // ==========================================
  // POST /v1/meetings/join - 加入会议
  // ==========================================

  describe('POST /v1/meetings/join - 加入会议', () => {
    it('TC-008: 通过有效会议号成功加入会议', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: createdMeetingNumber })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('code', 0);
      expect(response.body).toHaveProperty('message', 'success');

      const { data } = response.body;
      expect(data).toHaveProperty('id', createdMeetingId);
      expect(data).toHaveProperty('meetingNumber', createdMeetingNumber);
      expect(data).toHaveProperty('status', 'IN_PROGRESS');
      expect(data).toHaveProperty('participants');
      expect(Array.isArray(data.participants)).toBe(true);
      expect(data).toHaveProperty('durationSeconds');
      expect(data.durationSeconds).toBeGreaterThanOrEqual(0);

      // 验证参与者列表包含创建者和加入者
      const participantIds = data.participants.map((p: any) => p.userId);
      expect(participantIds).toContain(userAId);
      expect(participantIds).toContain(userBId);

      expect(responseTime).toBeLessThan(2000);
    });

    it('TC-009: 会议号不存在返回 404', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: '000000001' })
        .expect(404);

      expect(response.body).toHaveProperty('code', 40401);
      expect(response.body.message).toBeTruthy();
    });

    it('TC-010a: 会议号少于 9 位返回 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: '12345678' })
        .expect(400);

      expect(response.body.code).toBeDefined();
    });

    it('TC-010b: 会议号多于 9 位返回 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: '1234567890' })
        .expect(400);
    });

    it('TC-010c: 会议号含字母返回 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: '12345678a' })
        .expect(400);
    });

    it('TC-010d: 会议号为空字符串返回 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: '' })
        .expect(400);
    });

    it('TC-010e: 缺少 meetingNumber 字段返回 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({})
        .expect(400);
    });

    it('TC-012: 重复加入同一会议（幂等性）', async () => {
      // 用户 B 第二次加入同一会议
      const response = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: createdMeetingNumber })
        .expect(200);

      expect(response.body.code).toBe(0);

      // 参与者列表中用户 B 不应重复
      const { participants } = response.body.data;
      const bParticipants = participants.filter((p: any) => p.userId === userBId);
      expect(bParticipants.length).toBe(1);
    });

    it('TC-013: 创建者加入自己创建的会议（幂等）', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ meetingNumber: createdMeetingNumber })
        .expect(200);

      expect(response.body.code).toBe(0);

      // 验证创建者的 isCreator 标志
      const { participants } = response.body.data;
      const creatorParticipant = participants.find((p: any) => p.userId === userAId);
      expect(creatorParticipant).toBeDefined();
      expect(creatorParticipant.isCreator).toBe(true);
    });

    it('TC-014: 未认证用户加入会议返回 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .send({ meetingNumber: createdMeetingNumber })
        .expect(401);
    });

    it('TC-011: 加入已结束的会议返回 410', async () => {
      // 先创建并结束一个会议
      const createRes = await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: '即将结束的会议' })
        .expect(201);

      const endedMeetingId = createRes.body.data.id;
      const endedMeetingNumber = createRes.body.data.meetingNumber;

      await request(app.getHttpServer())
        .post(`/v1/meetings/${endedMeetingId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // 尝试加入已结束的会议
      const response = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: endedMeetingNumber })
        .expect(410);

      expect(response.body).toHaveProperty('code', 41001);
      expect(response.body.message).toBeTruthy();
    });
  });

  // ==========================================
  // GET /v1/meetings - 查询会议列表
  // ==========================================

  describe('GET /v1/meetings - 查询会议列表', () => {
    it('TC-019: 查询当前用户创建的会议列表（type=created）', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ type: 'created', page: 1, pageSize: 10 })
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.code).toBe(0);
      const { data } = response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page', 1);
      expect(data).toHaveProperty('pageSize', 10);
      expect(Array.isArray(data.items)).toBe(true);

      // 所有返回的会议创建者均为当前用户
      data.items.forEach((item: any) => {
        expect(item.creatorId).toBe(userAId);
      });

      expect(responseTime).toBeLessThan(2000);
    });

    it('TC-020: 查询当前用户参与的会议列表（type=joined）', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userBToken}`)
        .query({ type: 'joined', page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body.code).toBe(0);
      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
      // 用户 B 参与过的会议应出现在列表中
      expect(data.total).toBeGreaterThanOrEqual(1);
    });

    it('TC-021: 不传 type 返回全部相关会议', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('TC-023: 不传分页参数时使用默认值', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(10);
    });

    it('TC-024: pageSize 超过 50 返回 400', async () => {
      await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ pageSize: 51 })
        .expect(400);
    });

    it('TC-025: page=0 返回 400', async () => {
      await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ page: 0 })
        .expect(400);
    });

    it('TC-026: 未认证请求列表返回 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/meetings')
        .expect(401);
    });

    it('TC-022: 分页参数正确工作（创建多个会议验证分页）', async () => {
      // 确保有足够的会议用于分页测试
      // 用户 A 在前面的测试中已创建多个会议

      const page1Res = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ type: 'created', page: 1, pageSize: 3 })
        .expect(200);

      const { total, items: page1Items } = page1Res.body.data;

      if (total > 3) {
        const page2Res = await request(app.getHttpServer())
          .get('/v1/meetings')
          .set('Authorization', `Bearer ${userAToken}`)
          .query({ type: 'created', page: 2, pageSize: 3 })
          .expect(200);

        const { items: page2Items } = page2Res.body.data;

        // 两页的 ID 不重叠
        const page1Ids = page1Items.map((m: any) => m.id);
        const page2Ids = page2Items.map((m: any) => m.id);
        const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(intersection.length).toBe(0);
      }
    });
  });

  // ==========================================
  // GET /v1/meetings/:meetingId - 查询会议详情
  // ==========================================

  describe('GET /v1/meetings/:meetingId - 查询会议详情', () => {
    it('TC-028: 创建者查询自己会议的详情', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get(`/v1/meetings/${createdMeetingId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.code).toBe(0);
      const { data } = response.body;

      expect(data).toHaveProperty('id', createdMeetingId);
      expect(data).toHaveProperty('meetingNumber', createdMeetingNumber);
      expect(data).toHaveProperty('status', 'IN_PROGRESS');
      expect(data).toHaveProperty('creatorId', userAId);
      expect(data).toHaveProperty('participants');
      expect(data).toHaveProperty('durationSeconds');
      expect(data).toHaveProperty('startedAt');
      expect(Array.isArray(data.participants)).toBe(true);

      // 创建者在参与者列表中的 isCreator 为 true
      const creatorEntry = data.participants.find((p: any) => p.userId === userAId);
      expect(creatorEntry).toBeDefined();
      expect(creatorEntry.isCreator).toBe(true);

      expect(responseTime).toBeLessThan(2000);
    });

    it('TC-029: 参与者查询会议详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/meetings/${createdMeetingId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.id).toBe(createdMeetingId);
    });

    it('TC-030: 非参与者查询会议详情返回 403', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/meetings/${createdMeetingId}`)
        .set('Authorization', `Bearer ${userCToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('code', 40301);
      expect(response.body.message).toBeTruthy();
    });

    it('TC-031: 会议不存在返回 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000001';
      const response = await request(app.getHttpServer())
        .get(`/v1/meetings/${fakeId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('code', 40401);
    });

    it('TC-033: 进行中会议的 durationSeconds 为实时值', async () => {
      // 等待 2 秒
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await request(app.getHttpServer())
        .get(`/v1/meetings/${createdMeetingId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body.data.durationSeconds).toBeGreaterThanOrEqual(2);
    });

    it('TC-034: 未认证请求详情返回 401', async () => {
      await request(app.getHttpServer())
        .get(`/v1/meetings/${createdMeetingId}`)
        .expect(401);
    });
  });

  // ==========================================
  // POST /v1/meetings/:meetingId/end - 结束会议
  // ==========================================

  describe('POST /v1/meetings/:meetingId/end - 结束会议', () => {
    let meetingToEndId: string;
    let meetingToEndNumber: string;

    beforeEach(async () => {
      // 每个测试前创建新会议
      const createRes = await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: '待结束会议' })
        .expect(201);
      meetingToEndId = createRes.body.data.id;
      meetingToEndNumber = createRes.body.data.meetingNumber;
    });

    it('TC-035: 会议创建者成功结束会议', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.code).toBe(0);
      const { data } = response.body;
      expect(data).toHaveProperty('meetingId', meetingToEndId);
      expect(data).toHaveProperty('endedAt');
      expect(data).toHaveProperty('durationSeconds');
      expect(data.durationSeconds).toBeGreaterThanOrEqual(0);

      expect(responseTime).toBeLessThan(2000);
    });

    it('TC-036: 结束后再次查询会议状态为 ENDED', async () => {
      // 先加入会议再结束
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: meetingToEndNumber });

      // 结束会议
      await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // 查询会议详情
      const detailRes = await request(app.getHttpServer())
        .get(`/v1/meetings/${meetingToEndId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(detailRes.body.data.status).toBe('ENDED');
      expect(detailRes.body.data.endedAt).not.toBeNull();
      expect(detailRes.body.data.durationSeconds).toBeGreaterThanOrEqual(0);
    });

    it('TC-032: 已结束会议的详情可正常查询', async () => {
      // 结束会议
      await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // 查询已结束会议详情
      const response = await request(app.getHttpServer())
        .get(`/v1/meetings/${meetingToEndId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('ENDED');
      expect(response.body.data.endedAt).toBeTruthy();
    });

    it('TC-037: 非创建者结束会议返回 403', async () => {
      // 用户 B 加入会议
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: meetingToEndNumber });

      // 用户 B 尝试结束（非创建者）
      const response = await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('code', 40302);
      expect(response.body.message).toBeTruthy();
    });

    it('TC-038: 重复结束会议返回 409', async () => {
      // 先结束一次
      await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // 再次结束
      const response = await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(409);

      expect(response.body).toHaveProperty('code', 40901);
    });

    it('TC-039: 结束不存在的会议返回 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000002';
      const response = await request(app.getHttpServer())
        .post(`/v1/meetings/${fakeId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('code', 40401);
    });

    it('TC-040: 未认证用户结束会议返回 401', async () => {
      await request(app.getHttpServer())
        .post(`/v1/meetings/${meetingToEndId}/end`)
        .expect(401);
    });
  });

  // ==========================================
  // E2E 完整会议生命周期流程
  // ==========================================

  describe('TC-046: 完整会议生命周期流程', () => {
    it('应该支持完整的创建-加入-查询-结束流程', async () => {
      // Step 1: 用户 A 创建会议
      const createRes = await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: '完整流程测试会议' })
        .expect(201);

      const { id: lifecycleMeetingId, meetingNumber: lifecycleMeetingNumber } =
        createRes.body.data;

      expect(createRes.body.data.status).toBe('IN_PROGRESS');
      expect(lifecycleMeetingNumber).toMatch(/^\d{9}$/);

      // Step 2: 用户 B 加入会议
      const joinRes = await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: lifecycleMeetingNumber })
        .expect(200);

      expect(joinRes.body.data.participants.length).toBe(2);

      // Step 3: 查询会议详情（验证参与者数量）
      const detailRes = await request(app.getHttpServer())
        .get(`/v1/meetings/${lifecycleMeetingId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(detailRes.body.data.participantCount).toBe(2);

      // Step 4: 用户 A 结束会议
      const endRes = await request(app.getHttpServer())
        .post(`/v1/meetings/${lifecycleMeetingId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(endRes.body.data.meetingId).toBe(lifecycleMeetingId);

      // Step 5: 验证会议状态为 ENDED
      const afterEndRes = await request(app.getHttpServer())
        .get(`/v1/meetings/${lifecycleMeetingId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(afterEndRes.body.data.status).toBe('ENDED');

      // Step 6: 用户 B 尝试加入已结束会议
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: lifecycleMeetingNumber })
        .expect(410);
    });
  });

  // ==========================================
  // 边界条件测试
  // ==========================================

  describe('边界条件测试', () => {
    it('TC-051a: 会议标题恰好 50 字符时成功创建', async () => {
      const title50 = 'A'.repeat(50);
      const response = await request(app.getHttpServer())
        .post('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ title: title50 })
        .expect(201);

      expect(response.body.data.title).toBe(title50);
    });

    it('TC-050a: pageSize=1 只返回 1 条记录', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ page: 1, pageSize: 1 })
        .expect(200);

      expect(response.body.data.items.length).toBeLessThanOrEqual(1);
      expect(response.body.data.pageSize).toBe(1);
    });

    it('TC-050b: pageSize=50 为最大合法值', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/meetings')
        .set('Authorization', `Bearer ${userAToken}`)
        .query({ page: 1, pageSize: 50 })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.pageSize).toBe(50);
    });

    it('TC-048: 会议号含空格返回 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/meetings/join')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ meetingNumber: ' 12345678' })
        .expect(400);
    });
  });
});
