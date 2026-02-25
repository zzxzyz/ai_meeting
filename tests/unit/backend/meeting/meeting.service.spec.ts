import { Test, TestingModule } from '@nestjs/testing';
import { MeetingService } from '@/application/services/meeting.service';
import { MeetingRepository } from '@/infrastructure/database/repositories/meeting.repository';
import { MeetingGateway } from '@/api/gateways/meeting.gateway';
import { MeetingStatus } from '@/infrastructure/database/entities/meeting.entity';
import {
  MeetingNotFoundException,
  MeetingAlreadyEndedException,
  MeetingAlreadyEndedConflictException,
  MeetingForbiddenException,
  MeetingNotCreatorException,
} from '@/common/exceptions/business.exception';
import * as meetingNumberUtil from '@/common/utils/meeting-number.util';

jest.mock('@/common/utils/meeting-number.util');

describe('MeetingService', () => {
  let service: MeetingService;
  let meetingRepository: jest.Mocked<MeetingRepository>;
  let meetingGateway: jest.Mocked<MeetingGateway>;

  const mockMeeting = {
    id: 'meeting-uuid-001',
    meeting_number: '123456789',
    title: '产品评审会议',
    status: MeetingStatus.ACTIVE,
    creator_id: 'user-uuid-001',
    started_at: new Date('2026-02-25T14:30:00.000Z'),
    ended_at: null,
    created_at: new Date('2026-02-25T14:30:00.000Z'),
    updated_at: new Date('2026-02-25T14:30:00.000Z'),
    creator: null,
  };

  const mockParticipant = {
    id: 'participant-uuid-001',
    meeting_id: 'meeting-uuid-001',
    user_id: 'user-uuid-001',
    joined_at: new Date('2026-02-25T14:30:00.000Z'),
    left_at: null,
    created_at: new Date('2026-02-25T14:30:00.000Z'),
    meeting: null,
    user: {
      id: 'user-uuid-001',
      nickname: '张三',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingService,
        {
          provide: MeetingRepository,
          useValue: {
            createMeeting: jest.fn(),
            findByMeetingNumber: jest.fn(),
            findByMeetingNumberWithParticipants: jest.fn(),
            findById: jest.fn(),
            findByIdWithParticipants: jest.fn(),
            updateStatus: jest.fn(),
            findListByUserId: jest.fn(),
            addParticipant: jest.fn(),
            findActiveParticipant: jest.fn(),
            markAllParticipantsLeft: jest.fn(),
            countParticipants: jest.fn(),
            existsByMeetingNumber: jest.fn(),
          },
        },
        {
          provide: MeetingGateway,
          useValue: {
            notifyMeetingEnded: jest.fn(),
            notifyParticipantJoined: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MeetingService>(MeetingService);
    meetingRepository = module.get(MeetingRepository);
    meetingGateway = module.get(MeetingGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMeeting', () => {
    it('应该成功创建会议并返回会议信息', async () => {
      // Arrange
      const creatorId = 'user-uuid-001';
      const dto = { title: '产品评审会议' };
      const generatedNumber = '123456789';

      (meetingNumberUtil.generateMeetingNumber as jest.Mock).mockReturnValue(generatedNumber);
      meetingRepository.existsByMeetingNumber.mockResolvedValue(false);
      meetingRepository.createMeeting.mockResolvedValue(mockMeeting as any);
      meetingRepository.addParticipant.mockResolvedValue(mockParticipant as any);
      meetingRepository.countParticipants.mockResolvedValue(1);

      // Act
      const result = await service.createMeeting(dto, creatorId);

      // Assert
      expect(meetingRepository.createMeeting).toHaveBeenCalledWith({
        meeting_number: generatedNumber,
        title: dto.title,
        creator_id: creatorId,
        status: MeetingStatus.ACTIVE,
        started_at: expect.any(Date),
      });
      expect(meetingRepository.addParticipant).toHaveBeenCalledWith(
        mockMeeting.id,
        creatorId,
      );
      expect(result).toMatchObject({
        id: mockMeeting.id,
        meetingNumber: mockMeeting.meeting_number,
        title: mockMeeting.title,
        status: 'IN_PROGRESS',
        creatorId: mockMeeting.creator_id,
        participantCount: 1,
      });
    });

    it('会议号冲突时应该重试生成', async () => {
      // Arrange
      const creatorId = 'user-uuid-001';
      const dto = {};

      (meetingNumberUtil.generateMeetingNumber as jest.Mock)
        .mockReturnValueOnce('111111111')
        .mockReturnValueOnce('222222222');

      meetingRepository.existsByMeetingNumber
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      meetingRepository.createMeeting.mockResolvedValue({
        ...mockMeeting,
        meeting_number: '222222222',
        title: null,
      } as any);
      meetingRepository.addParticipant.mockResolvedValue(mockParticipant as any);
      meetingRepository.countParticipants.mockResolvedValue(1);

      // Act
      const result = await service.createMeeting(dto, creatorId);

      // Assert
      expect(meetingNumberUtil.generateMeetingNumber).toHaveBeenCalledTimes(2);
      expect(meetingRepository.existsByMeetingNumber).toHaveBeenCalledTimes(2);
      expect(result.meetingNumber).toBe('222222222');
    });

    it('会议号连续冲突超过 3 次应抛出异常', async () => {
      // Arrange
      const creatorId = 'user-uuid-001';
      const dto = {};

      (meetingNumberUtil.generateMeetingNumber as jest.Mock).mockReturnValue('111111111');
      meetingRepository.existsByMeetingNumber.mockResolvedValue(true);

      // Act & Assert
      await expect(service.createMeeting(dto, creatorId)).rejects.toThrow();
    });
  });

  describe('joinMeeting', () => {
    it('应该成功加入会议', async () => {
      // Arrange
      const meetingNumber = '123456789';
      const userId = 'user-uuid-002';
      const mockMeetingWithParticipants = {
        ...mockMeeting,
        participants: [mockParticipant],
      };

      meetingRepository.findByMeetingNumber.mockResolvedValue(mockMeeting as any);
      meetingRepository.findActiveParticipant.mockResolvedValue(null);
      meetingRepository.addParticipant.mockResolvedValue({
        ...mockParticipant,
        user_id: userId,
        user: { id: userId, nickname: '李四' },
      } as any);
      meetingRepository.findByMeetingNumberWithParticipants.mockResolvedValue(
        mockMeetingWithParticipants as any,
      );
      meetingRepository.countParticipants.mockResolvedValue(2);

      // Act
      const result = await service.joinMeeting(meetingNumber, userId);

      // Assert
      expect(meetingRepository.findByMeetingNumber).toHaveBeenCalledWith(meetingNumber);
      expect(meetingRepository.addParticipant).toHaveBeenCalledWith(
        mockMeeting.id,
        userId,
      );
      expect(result).toHaveProperty('id', mockMeeting.id);
      expect(result).toHaveProperty('meetingNumber', meetingNumber);
    });

    it('会议不存在时应抛出 MeetingNotFoundException', async () => {
      // Arrange
      meetingRepository.findByMeetingNumber.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.joinMeeting('999999999', 'user-uuid-002'),
      ).rejects.toThrow(MeetingNotFoundException);
    });

    it('会议已结束时应抛出 MeetingAlreadyEndedException', async () => {
      // Arrange
      meetingRepository.findByMeetingNumber.mockResolvedValue({
        ...mockMeeting,
        status: MeetingStatus.ENDED,
      } as any);

      // Act & Assert
      await expect(
        service.joinMeeting('123456789', 'user-uuid-002'),
      ).rejects.toThrow(MeetingAlreadyEndedException);
    });

    it('用户已在会议中时应直接返回会议信息（幂等）', async () => {
      // Arrange
      const userId = 'user-uuid-001';
      const mockMeetingWithParticipants = {
        ...mockMeeting,
        participants: [mockParticipant],
      };

      meetingRepository.findByMeetingNumber.mockResolvedValue(mockMeeting as any);
      meetingRepository.findActiveParticipant.mockResolvedValue(mockParticipant as any);
      meetingRepository.findByMeetingNumberWithParticipants.mockResolvedValue(
        mockMeetingWithParticipants as any,
      );
      meetingRepository.countParticipants.mockResolvedValue(1);

      // Act
      const result = await service.joinMeeting('123456789', userId);

      // Assert
      expect(meetingRepository.addParticipant).not.toHaveBeenCalled();
      expect(result).toHaveProperty('id', mockMeeting.id);
    });
  });

  describe('getMeetingList', () => {
    it('应该返回用户的会议列表', async () => {
      // Arrange
      const userId = 'user-uuid-001';
      const query = { page: 1, pageSize: 10 };

      meetingRepository.findListByUserId.mockResolvedValue({
        items: [{ ...mockMeeting, participantCount: 1 }] as any,
        total: 1,
      });

      // Act
      const result = await service.getMeetingList(userId, query);

      // Assert
      expect(meetingRepository.findListByUserId).toHaveBeenCalledWith(
        userId,
        query,
      );
      expect(result).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: mockMeeting.id,
            meetingNumber: mockMeeting.meeting_number,
          }),
        ]),
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });
  });

  describe('getMeetingDetail', () => {
    it('应该返回会议详情（参与者可查看）', async () => {
      // Arrange
      const meetingId = 'meeting-uuid-001';
      const userId = 'user-uuid-001';
      const mockMeetingWithParticipants = {
        ...mockMeeting,
        participants: [mockParticipant],
      };

      meetingRepository.findByIdWithParticipants.mockResolvedValue(
        mockMeetingWithParticipants as any,
      );

      // Act
      const result = await service.getMeetingDetail(meetingId, userId);

      // Assert
      expect(meetingRepository.findByIdWithParticipants).toHaveBeenCalledWith(meetingId);
      expect(result).toHaveProperty('id', meetingId);
      expect(result).toHaveProperty('participants');
    });

    it('会议不存在时应抛出 MeetingNotFoundException', async () => {
      // Arrange
      meetingRepository.findByIdWithParticipants.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getMeetingDetail('non-existent-id', 'user-uuid-001'),
      ).rejects.toThrow(MeetingNotFoundException);
    });

    it('非参与者查询应抛出 MeetingForbiddenException', async () => {
      // Arrange
      meetingRepository.findByIdWithParticipants.mockResolvedValue({
        ...mockMeeting,
        participants: [mockParticipant],
      } as any);

      // Act & Assert
      await expect(
        service.getMeetingDetail('meeting-uuid-001', 'other-user-uuid'),
      ).rejects.toThrow(MeetingForbiddenException);
    });
  });

  describe('endMeeting', () => {
    it('会议创建者应该可以成功结束会议', async () => {
      // Arrange
      const meetingId = 'meeting-uuid-001';
      const creatorId = 'user-uuid-001';

      meetingRepository.findById.mockResolvedValue(mockMeeting as any);
      meetingRepository.updateStatus.mockResolvedValue({
        ...mockMeeting,
        status: MeetingStatus.ENDED,
        ended_at: new Date(),
      } as any);
      meetingRepository.markAllParticipantsLeft.mockResolvedValue(undefined);
      meetingGateway.notifyMeetingEnded.mockResolvedValue(undefined);

      // Act
      const result = await service.endMeeting(meetingId, creatorId);

      // Assert
      expect(meetingRepository.findById).toHaveBeenCalledWith(meetingId);
      expect(meetingRepository.updateStatus).toHaveBeenCalledWith(
        meetingId,
        MeetingStatus.ENDED,
        expect.any(Date),
      );
      expect(meetingRepository.markAllParticipantsLeft).toHaveBeenCalledWith(meetingId);
      expect(meetingGateway.notifyMeetingEnded).toHaveBeenCalledWith(
        expect.objectContaining({ meetingId }),
      );
      expect(result).toHaveProperty('meetingId', meetingId);
      expect(result).toHaveProperty('endedAt');
      expect(result).toHaveProperty('durationSeconds');
    });

    it('会议不存在时应抛出 MeetingNotFoundException', async () => {
      // Arrange
      meetingRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.endMeeting('non-existent-id', 'user-uuid-001'),
      ).rejects.toThrow(MeetingNotFoundException);
    });

    it('非创建者结束会议应抛出 MeetingNotCreatorException', async () => {
      // Arrange
      meetingRepository.findById.mockResolvedValue(mockMeeting as any);

      // Act & Assert
      await expect(
        service.endMeeting('meeting-uuid-001', 'other-user-uuid'),
      ).rejects.toThrow(MeetingNotCreatorException);
    });

    it('会议已结束时应抛出 MeetingAlreadyEndedConflictException', async () => {
      // Arrange
      meetingRepository.findById.mockResolvedValue({
        ...mockMeeting,
        status: MeetingStatus.ENDED,
      } as any);

      // Act & Assert
      await expect(
        service.endMeeting('meeting-uuid-001', 'user-uuid-001'),
      ).rejects.toThrow(MeetingAlreadyEndedConflictException);
    });
  });
});
