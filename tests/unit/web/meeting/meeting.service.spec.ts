/**
 * meeting.service.spec.ts
 * 测试会议 API 服务层和工具函数
 */

// Mock api/client 模块以避免 import.meta 问题
jest.mock('../../../../apps/web/src/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
  tokenManager: {
    getAccessToken: jest.fn(() => 'mock-access-token'),
    getRefreshToken: jest.fn(() => 'mock-refresh-token'),
    setAccessToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clearTokens: jest.fn(),
    hasTokens: jest.fn(() => true),
  },
  ApiError: class ApiError extends Error {
    constructor(public code: number, message: string, public data?: any) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import {
  formatMeetingNumber,
  parseMeetingNumber,
  MeetingStatus,
  createMeeting,
  joinMeeting,
  getMeetings,
  getMeetingById,
  endMeeting,
} from '../../../../apps/web/src/api/meeting';

// 在 meeting.ts 加载后获取 api mock
const getApiMock = () => require('../../../../apps/web/src/api/client').api;

describe('meeting API - formatMeetingNumber', () => {
  it('应该将9位数字格式化为 XXX-XXX-XXX', () => {
    expect(formatMeetingNumber('123456789')).toBe('123-456-789');
  });

  it('应该正确格式化以0开头的数字', () => {
    expect(formatMeetingNumber('000111222')).toBe('000-111-222');
  });

  it('输入不足9位时应该原样返回', () => {
    expect(formatMeetingNumber('12345')).toBe('12345');
  });

  it('输入包含非数字时应该先提取数字再格式化', () => {
    expect(formatMeetingNumber('123-456-789')).toBe('123-456-789');
  });

  it('输入为空字符串时应该原样返回', () => {
    expect(formatMeetingNumber('')).toBe('');
  });
});

describe('meeting API - parseMeetingNumber', () => {
  it('应该从格式化字符串中提取纯数字', () => {
    expect(parseMeetingNumber('123-456-789')).toBe('123456789');
  });

  it('已经是纯数字时应该原样返回', () => {
    expect(parseMeetingNumber('123456789')).toBe('123456789');
  });

  it('包含空格时应该过滤掉', () => {
    expect(parseMeetingNumber('123 456 789')).toBe('123456789');
  });

  it('空字符串应该返回空字符串', () => {
    expect(parseMeetingNumber('')).toBe('');
  });
});

describe('MeetingStatus 枚举', () => {
  it('应该包含 WAITING 状态', () => {
    expect(MeetingStatus.WAITING).toBe('WAITING');
  });

  it('应该包含 IN_PROGRESS 状态', () => {
    expect(MeetingStatus.IN_PROGRESS).toBe('IN_PROGRESS');
  });

  it('应该包含 ENDED 状态', () => {
    expect(MeetingStatus.ENDED).toBe('ENDED');
  });
});

describe('meeting service API calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMeeting', () => {
    it('应该调用 POST /meetings 接口', async () => {
      const api = getApiMock();
      const mockMeeting = {
        id: 'meeting-uuid-001',
        meetingNumber: '123456789',
        title: '产品评审会议',
        status: MeetingStatus.IN_PROGRESS,
        creatorId: 'user-uuid-001',
        startedAt: '2026-02-25T14:30:00.000Z',
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T14:30:00.000Z',
      };

      api.post.mockResolvedValueOnce({ data: mockMeeting });

      const result = await createMeeting({ title: '产品评审会议' });

      expect(api.post).toHaveBeenCalledWith('/meetings', { title: '产品评审会议' });
      expect(result).toEqual(mockMeeting);
    });

    it('不传参数时应该调用 POST /meetings 接口（传空对象）', async () => {
      const api = getApiMock();
      const mockMeeting = {
        id: 'meeting-uuid-001',
        meetingNumber: '123456789',
        title: null,
        status: MeetingStatus.IN_PROGRESS,
        creatorId: 'user-uuid-001',
        startedAt: null,
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T14:30:00.000Z',
      };

      api.post.mockResolvedValueOnce({ data: mockMeeting });

      const result = await createMeeting();

      expect(api.post).toHaveBeenCalledWith('/meetings', {});
      expect(result).toEqual(mockMeeting);
    });
  });

  describe('joinMeeting', () => {
    it('应该调用 POST /meetings/join 接口', async () => {
      const api = getApiMock();
      const mockDetail = {
        id: 'meeting-uuid-001',
        meetingNumber: '123456789',
        title: '产品评审会议',
        status: MeetingStatus.IN_PROGRESS,
        creatorId: 'user-uuid-001',
        startedAt: '2026-02-25T14:30:00.000Z',
        endedAt: null,
        participantCount: 2,
        createdAt: '2026-02-25T14:30:00.000Z',
        durationSeconds: 120,
        participants: [],
      };

      api.post.mockResolvedValueOnce({ data: mockDetail });

      const result = await joinMeeting({ meetingNumber: '123456789' });

      expect(api.post).toHaveBeenCalledWith('/meetings/join', { meetingNumber: '123456789' });
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getMeetings', () => {
    it('应该调用 GET /meetings 接口', async () => {
      const api = getApiMock();
      const mockListData = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };

      api.get.mockResolvedValueOnce({ data: mockListData });

      const result = await getMeetings({ type: 'created', page: 1, pageSize: 10 });

      expect(api.get).toHaveBeenCalledWith('/meetings', {
        params: { type: 'created', page: 1, pageSize: 10 },
      });
      expect(result).toEqual(mockListData);
    });

    it('不传参数时应该调用 GET /meetings 接口', async () => {
      const api = getApiMock();
      const mockListData = { items: [], total: 0, page: 1, pageSize: 10 };
      api.get.mockResolvedValueOnce({ data: mockListData });

      await getMeetings();

      expect(api.get).toHaveBeenCalledWith('/meetings', { params: undefined });
    });
  });

  describe('getMeetingById', () => {
    it('应该调用 GET /meetings/:id 接口', async () => {
      const api = getApiMock();
      const mockDetail = {
        id: 'meeting-uuid-001',
        meetingNumber: '123456789',
        title: '产品评审会议',
        status: MeetingStatus.IN_PROGRESS,
        creatorId: 'user-uuid-001',
        startedAt: '2026-02-25T14:30:00.000Z',
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T14:30:00.000Z',
        durationSeconds: 300,
        participants: [],
      };

      api.get.mockResolvedValueOnce({ data: mockDetail });

      const result = await getMeetingById('meeting-uuid-001');

      expect(api.get).toHaveBeenCalledWith('/meetings/meeting-uuid-001');
      expect(result).toEqual(mockDetail);
    });
  });

  describe('endMeeting', () => {
    it('应该调用 POST /meetings/:id/end 接口', async () => {
      const api = getApiMock();
      const mockEndData = {
        meetingId: 'meeting-uuid-001',
        endedAt: '2026-02-25T16:30:00.000Z',
        durationSeconds: 7200,
      };

      api.post.mockResolvedValueOnce({ data: mockEndData });

      const result = await endMeeting('meeting-uuid-001');

      expect(api.post).toHaveBeenCalledWith('/meetings/meeting-uuid-001/end');
      expect(result).toEqual(mockEndData);
    });
  });
});
