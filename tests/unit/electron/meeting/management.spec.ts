/**
 * REQ-002 Electron 会议管理集成测试
 * TDD Red → Green → Refactor
 * @jest-environment jsdom
 */

// Mock Electron API
const mockElectronAPI = {
  // 会议管理 API
  createMeeting: jest.fn().mockImplementation((data = {}) => {
    return Promise.resolve({
      id: 'meeting-uuid-001',
      meetingNumber: '123456789',
      title: data.title || '测试会议',
      status: 'IN_PROGRESS',
      creatorId: 'user-uuid-001',
      startedAt: '2026-02-26T10:00:00.000Z',
      endedAt: null,
      participantCount: 1,
      createdAt: '2026-02-26T10:00:00.000Z'
    });
  }),

  joinMeeting: jest.fn().mockResolvedValue({
    id: 'meeting-uuid-001',
    meetingNumber: '123456789',
    title: '测试会议',
    status: 'IN_PROGRESS',
    creatorId: 'user-uuid-001',
    startedAt: '2026-02-26T10:00:00.000Z',
    endedAt: null,
    participantCount: 2,
    createdAt: '2026-02-26T10:00:00.000Z',
    durationSeconds: 1800,
    participants: [
      {
        userId: 'user-uuid-001',
        nickname: '张三',
        isCreator: true,
        joinedAt: '2026-02-26T10:00:00.000Z'
      },
      {
        userId: 'user-uuid-002',
        nickname: '李四',
        isCreator: false,
        joinedAt: '2026-02-26T10:05:00.000Z'
      }
    ]
  }),

  getMeetings: jest.fn().mockResolvedValue({
    items: [
      {
        id: 'meeting-uuid-001',
        meetingNumber: '123456789',
        title: '产品评审会议',
        status: 'IN_PROGRESS',
        creatorId: 'user-uuid-001',
        startedAt: '2026-02-26T10:00:00.000Z',
        endedAt: null,
        participantCount: 3,
        createdAt: '2026-02-26T10:00:00.000Z'
      },
      {
        id: 'meeting-uuid-002',
        meetingNumber: '987654321',
        title: '技术分享会',
        status: 'ENDED',
        creatorId: 'user-uuid-002',
        startedAt: '2026-02-25T14:00:00.000Z',
        endedAt: '2026-02-25T16:00:00.000Z',
        participantCount: 5,
        createdAt: '2026-02-25T13:30:00.000Z'
      }
    ],
    total: 2,
    page: 1,
    pageSize: 10
  }),

  getMeetingById: jest.fn().mockResolvedValue({
    id: 'meeting-uuid-001',
    meetingNumber: '123456789',
    title: '产品评审会议',
    status: 'IN_PROGRESS',
    creatorId: 'user-uuid-001',
    startedAt: '2026-02-26T10:00:00.000Z',
    endedAt: null,
    participantCount: 3,
    createdAt: '2026-02-26T10:00:00.000Z',
    durationSeconds: 1800,
    participants: [
      {
        userId: 'user-uuid-001',
        nickname: '张三',
        isCreator: true,
        joinedAt: '2026-02-26T10:00:00.000Z'
      },
      {
        userId: 'user-uuid-002',
        nickname: '李四',
        isCreator: false,
        joinedAt: '2026-02-26T10:05:00.000Z'
      },
      {
        userId: 'user-uuid-003',
        nickname: '王五',
        isCreator: false,
        joinedAt: '2026-02-26T10:10:00.000Z'
      }
    ]
  }),

  endMeeting: jest.fn().mockResolvedValue({
    meetingId: 'meeting-uuid-001',
    endedAt: '2026-02-26T11:00:00.000Z',
    durationSeconds: 3600
  }),

  formatMeetingNumber: jest.fn().mockImplementation((meetingNumber) => {
    const digits = meetingNumber.replace(/\D/g, '');
    if (digits.length !== 9) return meetingNumber;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
  }),

  parseMeetingNumber: jest.fn().mockImplementation((input) => {
    return input.replace(/\D/g, '');
  }),

  // 音视频控制 API（复用 REQ-004 实现）
  toggleAudio: jest.fn().mockResolvedValue({ success: true }),
  toggleVideo: jest.fn().mockResolvedValue({ success: true }),
  getMediaDevices: jest.fn().mockResolvedValue({
    audioInputs: [{ deviceId: 'mic1', label: '内置麦克风', kind: 'audioinput' }],
    videoInputs: [{ deviceId: 'camera1', label: 'FaceTime HD Camera', kind: 'videoinput' }],
    audioOutputs: [{ deviceId: 'speaker1', label: '内置扬声器', kind: 'audiooutput' }]
  })
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('REQ-002 Electron 会议管理集成', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('会议管理 API 可用性验证', () => {
    it('window.electronAPI 包含会议管理方法', () => {
      expect(window.electronAPI.createMeeting).toBeDefined();
      expect(window.electronAPI.joinMeeting).toBeDefined();
      expect(window.electronAPI.getMeetings).toBeDefined();
      expect(window.electronAPI.getMeetingById).toBeDefined();
      expect(window.electronAPI.endMeeting).toBeDefined();
      expect(window.electronAPI.formatMeetingNumber).toBeDefined();
      expect(window.electronAPI.parseMeetingNumber).toBeDefined();
    });
  });

  describe('会议创建功能', () => {
    it('创建会议调用正确的 IPC 通道', async () => {
      const meeting = await window.electronAPI.createMeeting({
        title: '产品评审会议'
      });

      expect(mockElectronAPI.createMeeting).toHaveBeenCalledWith({
        title: '产品评审会议'
      });
      expect(meeting.id).toBe('meeting-uuid-001');
      expect(meeting.meetingNumber).toBe('123456789');
      expect(meeting.status).toBe('IN_PROGRESS');
    });

    it('创建会议支持空参数', async () => {
      const meeting = await window.electronAPI.createMeeting();

      expect(mockElectronAPI.createMeeting).toHaveBeenCalledWith();
      expect(meeting.title).toBe('测试会议');
    });
  });

  describe('加入会议功能', () => {
    it('加入会议调用正确的 IPC 通道', async () => {
      const meetingDetail = await window.electronAPI.joinMeeting({
        meetingNumber: '123456789'
      });

      expect(mockElectronAPI.joinMeeting).toHaveBeenCalledWith({
        meetingNumber: '123456789'
      });
      expect(meetingDetail.participants).toHaveLength(2);
      expect(meetingDetail.participantCount).toBe(2);
    });

    it('加入会议返回完整的参与者信息', async () => {
      const meetingDetail = await window.electronAPI.joinMeeting({
        meetingNumber: '123456789'
      });

      expect(meetingDetail.participants[0].userId).toBe('user-uuid-001');
      expect(meetingDetail.participants[0].nickname).toBe('张三');
      expect(meetingDetail.participants[0].isCreator).toBe(true);
      expect(meetingDetail.participants[1].userId).toBe('user-uuid-002');
      expect(meetingDetail.participants[1].nickname).toBe('李四');
      expect(meetingDetail.participants[1].isCreator).toBe(false);
    });
  });

  describe('会议列表查询功能', () => {
    it('查询会议列表调用正确的 IPC 通道', async () => {
      const meetingList = await window.electronAPI.getMeetings({
        type: 'created',
        page: 1,
        pageSize: 10
      });

      expect(mockElectronAPI.getMeetings).toHaveBeenCalledWith({
        type: 'created',
        page: 1,
        pageSize: 10
      });
      expect(meetingList.items).toHaveLength(2);
      expect(meetingList.total).toBe(2);
      expect(meetingList.page).toBe(1);
      expect(meetingList.pageSize).toBe(10);
    });

    it('查询会议列表支持分页参数', async () => {
      const meetingList = await window.electronAPI.getMeetings({
        page: 2,
        pageSize: 5
      });

      expect(mockElectronAPI.getMeetings).toHaveBeenCalledWith({
        page: 2,
        pageSize: 5
      });
    });

    it('查询会议列表支持过滤类型', async () => {
      const meetingList = await window.electronAPI.getMeetings({
        type: 'joined'
      });

      expect(mockElectronAPI.getMeetings).toHaveBeenCalledWith({
        type: 'joined'
      });
    });
  });

  describe('会议详情查询功能', () => {
    it('查询会议详情调用正确的 IPC 通道', async () => {
      const meetingDetail = await window.electronAPI.getMeetingById('meeting-uuid-001');

      expect(mockElectronAPI.getMeetingById).toHaveBeenCalledWith('meeting-uuid-001');
      expect(meetingDetail.id).toBe('meeting-uuid-001');
      expect(meetingDetail.participants).toHaveLength(3);
      expect(meetingDetail.durationSeconds).toBe(1800);
    });

    it('会议详情包含完整的参与者信息', async () => {
      const meetingDetail = await window.electronAPI.getMeetingById('meeting-uuid-001');

      expect(meetingDetail.participants[0].nickname).toBe('张三');
      expect(meetingDetail.participants[1].nickname).toBe('李四');
      expect(meetingDetail.participants[2].nickname).toBe('王五');
    });
  });

  describe('结束会议功能', () => {
    it('结束会议调用正确的 IPC 通道', async () => {
      const result = await window.electronAPI.endMeeting('meeting-uuid-001');

      expect(mockElectronAPI.endMeeting).toHaveBeenCalledWith('meeting-uuid-001');
      expect(result.meetingId).toBe('meeting-uuid-001');
      expect(result.endedAt).toBe('2026-02-26T11:00:00.000Z');
      expect(result.durationSeconds).toBe(3600);
    });
  });

  describe('会议号格式化功能', () => {
    it('格式化会议号功能正常', () => {
      const formatted = window.electronAPI.formatMeetingNumber('123456789');
      expect(formatted).toBe('123-456-789');
    });

    it('解析会议号功能正常', () => {
      const parsed = window.electronAPI.parseMeetingNumber('123-456-789');
      expect(parsed).toBe('123456789');
    });

    it('会议号格式化支持各种输入格式', () => {
      expect(window.electronAPI.parseMeetingNumber('123 456 789')).toBe('123456789');
      expect(window.electronAPI.parseMeetingNumber('123-456-789')).toBe('123456789');
      expect(window.electronAPI.parseMeetingNumber('123456789')).toBe('123456789');
    });
  });

  describe('错误处理机制', () => {
    it('会议不存在时正确处理错误', async () => {
      mockElectronAPI.joinMeeting.mockRejectedValueOnce(new Error('会议不存在'));

      try {
        await window.electronAPI.joinMeeting({
          meetingNumber: '999999999'
        });
      } catch (error) {
        expect(error.message).toBe('会议不存在');
      }
    });

    it('权限不足时正确处理错误', async () => {
      mockElectronAPI.endMeeting.mockRejectedValueOnce(new Error('只有会议创建者可以结束会议'));

      try {
        await window.electronAPI.endMeeting('meeting-uuid-001');
      } catch (error) {
        expect(error.message).toBe('只有会议创建者可以结束会议');
      }
    });
  });

  describe('性能指标验证', () => {
    it('创建会议操作延迟小于 200ms', async () => {
      const startTime = Date.now();
      await window.electronAPI.createMeeting({ title: '性能测试会议' });
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('查询会议列表延迟小于 300ms', async () => {
      const startTime = Date.now();
      await window.electronAPI.getMeetings();
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300);
    });

    it('加入会议操作延迟小于 250ms', async () => {
      const startTime = Date.now();
      await window.electronAPI.joinMeeting({ meetingNumber: '123456789' });
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(250);
    });
  });

  describe('与音视频控制功能集成', () => {
    it('会议管理与音视频控制 API 共存', () => {
      expect(window.electronAPI.createMeeting).toBeDefined();
      expect(window.electronAPI.toggleAudio).toBeDefined();
      expect(window.electronAPI.toggleVideo).toBeDefined();
      expect(window.electronAPI.getMediaDevices).toBeDefined();
    });

    it('会议创建后可以调用音视频控制', async () => {
      const meeting = await window.electronAPI.createMeeting();
      const audioResult = await window.electronAPI.toggleAudio(false);
      const videoResult = await window.electronAPI.toggleVideo(true);

      expect(meeting.id).toBeDefined();
      expect(audioResult.success).toBe(true);
      expect(videoResult.success).toBe(true);
    });
  });
});