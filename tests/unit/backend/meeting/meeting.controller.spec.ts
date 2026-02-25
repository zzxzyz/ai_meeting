import { Test, TestingModule } from '@nestjs/testing';
import { MeetingController } from '@/api/controllers/meeting/meeting.controller';
import { MeetingService } from '@/application/services/meeting.service';
import { CreateMeetingDto, JoinMeetingDto, MeetingListQueryDto } from '@/api/dto/meeting.dto';
import { MeetingNotFoundException, MeetingNotCreatorException } from '@/common/exceptions/business.exception';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ThrottlerAuthGuard } from '@/common/guards/throttler-auth.guard';

describe('MeetingController', () => {
  let controller: MeetingController;
  let meetingService: jest.Mocked<MeetingService>;

  const mockUser = {
    id: 'user-uuid-001',
    email: 'test@example.com',
    nickname: '张三',
    avatar: null,
  };

  const mockMeetingResponse = {
    id: 'meeting-uuid-001',
    meetingNumber: '123456789',
    title: '产品评审会议',
    status: 'IN_PROGRESS',
    creatorId: 'user-uuid-001',
    startedAt: new Date('2026-02-25T14:30:00.000Z'),
    endedAt: null,
    participantCount: 1,
    createdAt: new Date('2026-02-25T14:30:00.000Z'),
  };

  const mockMeetingDetailResponse = {
    ...mockMeetingResponse,
    durationSeconds: 1920,
    participants: [
      {
        userId: 'user-uuid-001',
        nickname: '张三',
        isCreator: true,
        joinedAt: new Date('2026-02-25T14:30:00.000Z'),
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeetingController],
      providers: [
        {
          provide: MeetingService,
          useValue: {
            createMeeting: jest.fn(),
            joinMeeting: jest.fn(),
            getMeetingList: jest.fn(),
            getMeetingDetail: jest.fn(),
            endMeeting: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ThrottlerAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MeetingController>(MeetingController);
    meetingService = module.get(MeetingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /meetings - createMeeting', () => {
    it('应该成功创建会议', async () => {
      // Arrange
      const dto: CreateMeetingDto = { title: '产品评审会议' };
      meetingService.createMeeting.mockResolvedValue(mockMeetingResponse as any);

      // Act
      const result = await controller.createMeeting(mockUser as any, dto);

      // Assert
      expect(meetingService.createMeeting).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: mockMeetingResponse,
      });
    });

    it('不传标题时也应该成功创建会议', async () => {
      // Arrange
      const dto: CreateMeetingDto = {};
      meetingService.createMeeting.mockResolvedValue({
        ...mockMeetingResponse,
        title: null,
      } as any);

      // Act
      const result = await controller.createMeeting(mockUser as any, dto);

      // Assert
      expect(meetingService.createMeeting).toHaveBeenCalledWith(dto, mockUser.id);
      expect(result.data.title).toBeNull();
    });
  });

  describe('POST /meetings/join - joinMeeting', () => {
    it('应该成功加入会议', async () => {
      // Arrange
      const dto: JoinMeetingDto = { meetingNumber: '123456789' };
      meetingService.joinMeeting.mockResolvedValue(mockMeetingDetailResponse as any);

      // Act
      const result = await controller.joinMeeting(mockUser as any, dto);

      // Assert
      expect(meetingService.joinMeeting).toHaveBeenCalledWith(
        dto.meetingNumber,
        mockUser.id,
      );
      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: mockMeetingDetailResponse,
      });
    });

    it('会议不存在时应向上抛出异常', async () => {
      // Arrange
      const dto: JoinMeetingDto = { meetingNumber: '999999999' };
      meetingService.joinMeeting.mockRejectedValue(new MeetingNotFoundException());

      // Act & Assert
      await expect(
        controller.joinMeeting(mockUser as any, dto),
      ).rejects.toThrow(MeetingNotFoundException);
    });
  });

  describe('GET /meetings - getMeetingList', () => {
    it('应该返回会议列表', async () => {
      // Arrange
      const query: MeetingListQueryDto = { page: 1, pageSize: 10 };
      const mockListResult = {
        items: [mockMeetingResponse],
        total: 1,
        page: 1,
        pageSize: 10,
      };
      meetingService.getMeetingList.mockResolvedValue(mockListResult as any);

      // Act
      const result = await controller.getMeetingList(mockUser as any, query);

      // Assert
      expect(meetingService.getMeetingList).toHaveBeenCalledWith(mockUser.id, query);
      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: mockListResult,
      });
    });
  });

  describe('GET /meetings/:meetingId - getMeetingDetail', () => {
    it('应该返回会议详情', async () => {
      // Arrange
      const meetingId = 'meeting-uuid-001';
      meetingService.getMeetingDetail.mockResolvedValue(mockMeetingDetailResponse as any);

      // Act
      const result = await controller.getMeetingDetail(mockUser as any, meetingId);

      // Assert
      expect(meetingService.getMeetingDetail).toHaveBeenCalledWith(meetingId, mockUser.id);
      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: mockMeetingDetailResponse,
      });
    });
  });

  describe('POST /meetings/:meetingId/end - endMeeting', () => {
    it('应该成功结束会议', async () => {
      // Arrange
      const meetingId = 'meeting-uuid-001';
      const endResult = {
        meetingId,
        endedAt: new Date(),
        durationSeconds: 7200,
      };
      meetingService.endMeeting.mockResolvedValue(endResult as any);

      // Act
      const result = await controller.endMeeting(mockUser as any, meetingId);

      // Assert
      expect(meetingService.endMeeting).toHaveBeenCalledWith(meetingId, mockUser.id);
      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: endResult,
      });
    });

    it('非创建者结束会议时应向上抛出异常', async () => {
      // Arrange
      meetingService.endMeeting.mockRejectedValue(new MeetingNotCreatorException());

      // Act & Assert
      await expect(
        controller.endMeeting(mockUser as any, 'meeting-uuid-001'),
      ).rejects.toThrow(MeetingNotCreatorException);
    });
  });
});
