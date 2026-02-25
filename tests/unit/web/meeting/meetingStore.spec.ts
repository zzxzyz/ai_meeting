import { MeetingStatus } from '../../../../apps/web/src/api/meeting';

// Mock meeting API 模块
jest.mock('../../../../apps/web/src/api/meeting', () => ({
  MeetingStatus: {
    WAITING: 'WAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    ENDED: 'ENDED',
  },
  createMeeting: jest.fn(),
  joinMeeting: jest.fn(),
  getMeetings: jest.fn(),
  getMeetingById: jest.fn(),
  endMeeting: jest.fn(),
  formatMeetingNumber: jest.fn((num: string) => {
    const digits = num.replace(/\D/g, '');
    if (digits.length !== 9) return num;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  }),
  parseMeetingNumber: jest.fn((input: string) => input.replace(/\D/g, '')),
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { baseURL: 'http://localhost:3000/v1' },
  })),
}));

// Mock api client
jest.mock('../../../../apps/web/src/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
  tokenManager: {
    hasTokens: jest.fn(() => true),
    getAccessToken: jest.fn(() => 'mock-token'),
    getRefreshToken: jest.fn(() => 'mock-refresh'),
  },
  ApiError: class ApiError extends Error {
    constructor(public code: number, message: string) {
      super(message);
    }
  },
}));

describe('meetingStore', () => {
  let store: any;
  let meetingApi: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // 重新 mock
    jest.mock('../../../../apps/web/src/api/meeting', () => ({
      MeetingStatus: {
        WAITING: 'WAITING',
        IN_PROGRESS: 'IN_PROGRESS',
        ENDED: 'ENDED',
      },
      createMeeting: jest.fn(),
      joinMeeting: jest.fn(),
      getMeetings: jest.fn(),
      getMeetingById: jest.fn(),
      endMeeting: jest.fn(),
      formatMeetingNumber: jest.fn(),
      parseMeetingNumber: jest.fn(),
    }));

    meetingApi = require('../../../../apps/web/src/api/meeting');
    const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
    store = useMeetingStore.getState();

    // 重置 store 状态
    useMeetingStore.setState({
      meetings: [],
      currentMeeting: null,
      meetingListData: null,
      isLoading: false,
      isCreating: false,
      isJoining: false,
      isEnding: false,
      error: null,
      activeTab: 'created',
    });
  });

  describe('初始状态', () => {
    it('meetings 应该为空数组', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      expect(useMeetingStore.getState().meetings).toEqual([]);
    });

    it('currentMeeting 应该为 null', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      expect(useMeetingStore.getState().currentMeeting).toBeNull();
    });

    it('isLoading 应该为 false', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      expect(useMeetingStore.getState().isLoading).toBe(false);
    });

    it('error 应该为 null', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      expect(useMeetingStore.getState().error).toBeNull();
    });

    it('activeTab 默认应该为 created', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      expect(useMeetingStore.getState().activeTab).toBe('created');
    });
  });

  describe('setActiveTab', () => {
    it('应该切换 activeTab', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      useMeetingStore.getState().setActiveTab('joined');
      expect(useMeetingStore.getState().activeTab).toBe('joined');
    });

    it('应该可以切换回 created', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      useMeetingStore.getState().setActiveTab('joined');
      useMeetingStore.getState().setActiveTab('created');
      expect(useMeetingStore.getState().activeTab).toBe('created');
    });
  });

  describe('clearError', () => {
    it('应该清除 error', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      useMeetingStore.setState({ error: '测试错误' });
      useMeetingStore.getState().clearError();
      expect(useMeetingStore.getState().error).toBeNull();
    });
  });

  describe('setCurrentMeeting', () => {
    it('应该设置当前会议', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      const mockMeeting = {
        id: 'meeting-001',
        meetingNumber: '123456789',
        title: '测试会议',
        status: 'IN_PROGRESS' as any,
        creatorId: 'user-001',
        startedAt: null,
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T00:00:00.000Z',
        durationSeconds: 0,
        participants: [],
      };
      useMeetingStore.getState().setCurrentMeeting(mockMeeting);
      expect(useMeetingStore.getState().currentMeeting).toEqual(mockMeeting);
    });

    it('应该可以设置为 null', () => {
      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      useMeetingStore.getState().setCurrentMeeting(null);
      expect(useMeetingStore.getState().currentMeeting).toBeNull();
    });
  });

  describe('createMeeting action', () => {
    it('成功时应该返回会议并添加到列表', async () => {
      const mockMeeting = {
        id: 'meeting-001',
        meetingNumber: '123456789',
        title: '产品评审',
        status: 'IN_PROGRESS',
        creatorId: 'user-001',
        startedAt: '2026-02-25T14:30:00.000Z',
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T14:30:00.000Z',
      };

      meetingApi.createMeeting.mockResolvedValueOnce(mockMeeting);

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      const result = await useMeetingStore.getState().createMeeting({ title: '产品评审' });

      expect(result).toEqual(mockMeeting);
      expect(useMeetingStore.getState().meetings).toContainEqual(mockMeeting);
      expect(useMeetingStore.getState().isCreating).toBe(false);
    });

    it('失败时应该设置 error', async () => {
      const error = new Error('创建失败');
      meetingApi.createMeeting.mockRejectedValueOnce(error);

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');

      await expect(useMeetingStore.getState().createMeeting()).rejects.toThrow();
      expect(useMeetingStore.getState().error).toBe('创建失败');
      expect(useMeetingStore.getState().isCreating).toBe(false);
    });
  });

  describe('joinMeeting action', () => {
    it('成功时应该设置 currentMeeting', async () => {
      const mockDetail = {
        id: 'meeting-001',
        meetingNumber: '123456789',
        title: '测试会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-001',
        startedAt: '2026-02-25T14:30:00.000Z',
        endedAt: null,
        participantCount: 2,
        createdAt: '2026-02-25T14:30:00.000Z',
        durationSeconds: 300,
        participants: [],
      };

      meetingApi.joinMeeting.mockResolvedValueOnce(mockDetail);

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      const result = await useMeetingStore.getState().joinMeeting({ meetingNumber: '123456789' });

      expect(result).toEqual(mockDetail);
      expect(useMeetingStore.getState().currentMeeting).toEqual(mockDetail);
      expect(useMeetingStore.getState().isJoining).toBe(false);
    });

    it('失败时应该设置 error', async () => {
      meetingApi.joinMeeting.mockRejectedValueOnce(new Error('会议不存在'));

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');

      await expect(
        useMeetingStore.getState().joinMeeting({ meetingNumber: '999999999' })
      ).rejects.toThrow();
      expect(useMeetingStore.getState().error).toBe('会议不存在');
    });
  });

  describe('fetchMeetings action', () => {
    it('成功时应该更新 meetings 和 meetingListData', async () => {
      const mockListData = {
        items: [
          {
            id: 'meeting-001',
            meetingNumber: '123456789',
            title: '测试会议',
            status: 'IN_PROGRESS',
            creatorId: 'user-001',
            startedAt: null,
            endedAt: null,
            participantCount: 1,
            createdAt: '2026-02-25T14:30:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      meetingApi.getMeetings.mockResolvedValueOnce(mockListData);

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      await useMeetingStore.getState().fetchMeetings({ type: 'created' });

      expect(useMeetingStore.getState().meetings).toEqual(mockListData.items);
      expect(useMeetingStore.getState().meetingListData).toEqual(mockListData);
      expect(useMeetingStore.getState().isLoading).toBe(false);
    });

    it('失败时应该设置 error', async () => {
      meetingApi.getMeetings.mockRejectedValueOnce(new Error('获取失败'));

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');

      await expect(useMeetingStore.getState().fetchMeetings()).rejects.toThrow();
      expect(useMeetingStore.getState().error).toBe('获取失败');
    });
  });

  describe('fetchMeetingById action', () => {
    it('成功时应该设置 currentMeeting', async () => {
      const mockDetail = {
        id: 'meeting-001',
        meetingNumber: '123456789',
        title: '测试会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-001',
        startedAt: null,
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T14:30:00.000Z',
        durationSeconds: 0,
        participants: [],
      };

      meetingApi.getMeetingById.mockResolvedValueOnce(mockDetail);

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      await useMeetingStore.getState().fetchMeetingById('meeting-001');

      expect(useMeetingStore.getState().currentMeeting).toEqual(mockDetail);
      expect(useMeetingStore.getState().isLoading).toBe(false);
    });
  });

  describe('endMeeting action', () => {
    it('成功时应该更新会议状态为 ENDED', async () => {
      const existingMeeting = {
        id: 'meeting-001',
        meetingNumber: '123456789',
        title: '测试会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-001',
        startedAt: null,
        endedAt: null,
        participantCount: 1,
        createdAt: '2026-02-25T14:30:00.000Z',
      };

      meetingApi.endMeeting.mockResolvedValueOnce({
        meetingId: 'meeting-001',
        endedAt: '2026-02-25T16:30:00.000Z',
        durationSeconds: 7200,
      });

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');
      useMeetingStore.setState({ meetings: [existingMeeting] });

      await useMeetingStore.getState().endMeeting('meeting-001');

      const meetings = useMeetingStore.getState().meetings;
      expect(meetings[0].status).toBe('ENDED');
      expect(useMeetingStore.getState().isEnding).toBe(false);
    });

    it('失败时应该设置 error', async () => {
      meetingApi.endMeeting.mockRejectedValueOnce(new Error('只有创建者可以结束会议'));

      const { useMeetingStore } = require('../../../../apps/web/src/stores/meetingStore');

      await expect(useMeetingStore.getState().endMeeting('meeting-001')).rejects.toThrow();
      expect(useMeetingStore.getState().error).toBe('只有创建者可以结束会议');
    });
  });
});
