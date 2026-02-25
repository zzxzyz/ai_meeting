import { Injectable } from '@nestjs/common';
import {
  MeetingRepository,
  MeetingListQuery,
} from '@/infrastructure/database/repositories/meeting.repository';
import { MeetingGateway } from '@/api/gateways/meeting.gateway';
import { MeetingStatus } from '@/infrastructure/database/entities/meeting.entity';
import { MeetingParticipantEntity } from '@/infrastructure/database/entities/meeting-participant.entity';
import { CreateMeetingDto, MeetingListQueryDto } from '@/api/dto/meeting.dto';
import { generateMeetingNumber } from '@/common/utils/meeting-number.util';
import {
  MeetingNotFoundException,
  MeetingAlreadyEndedException,
  MeetingAlreadyEndedConflictException,
  MeetingForbiddenException,
  MeetingNotCreatorException,
  MeetingNumberGenerationFailedException,
} from '@/common/exceptions/business.exception';

const MAX_RETRY = 3;

export interface MeetingResponseDto {
  id: string;
  meetingNumber: string;
  title: string | null;
  status: string;
  creatorId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  participantCount: number;
  createdAt: Date;
}

export interface ParticipantDto {
  userId: string;
  nickname: string;
  isCreator: boolean;
  joinedAt: Date;
}

export interface MeetingDetailResponseDto extends MeetingResponseDto {
  durationSeconds: number | null;
  participants: ParticipantDto[];
}

export interface MeetingListResultDto {
  items: MeetingResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EndMeetingResultDto {
  meetingId: string;
  endedAt: Date;
  durationSeconds: number;
}

@Injectable()
export class MeetingService {
  constructor(
    private readonly meetingRepository: MeetingRepository,
    private readonly meetingGateway: MeetingGateway,
  ) {}

  /**
   * 创建会议
   */
  async createMeeting(
    dto: CreateMeetingDto,
    creatorId: string,
  ): Promise<MeetingResponseDto> {
    // 生成唯一会议号（最多重试 3 次）
    let meetingNumber: string | null = null;
    for (let i = 0; i < MAX_RETRY; i++) {
      const candidate = generateMeetingNumber();
      const exists = await this.meetingRepository.existsByMeetingNumber(candidate);
      if (!exists) {
        meetingNumber = candidate;
        break;
      }
    }

    if (!meetingNumber) {
      throw new MeetingNumberGenerationFailedException();
    }

    const now = new Date();
    const meeting = await this.meetingRepository.createMeeting({
      meeting_number: meetingNumber,
      title: dto.title ?? null,
      creator_id: creatorId,
      status: MeetingStatus.ACTIVE,
      started_at: now,
    });

    // 创建者自动成为第一个参与者
    await this.meetingRepository.addParticipant(meeting.id, creatorId);

    const participantCount = await this.meetingRepository.countParticipants(meeting.id);

    return this.formatMeetingResponse(meeting, participantCount);
  }

  /**
   * 加入会议（幂等）
   */
  async joinMeeting(
    meetingNumber: string,
    userId: string,
  ): Promise<MeetingDetailResponseDto> {
    const meeting = await this.meetingRepository.findByMeetingNumber(meetingNumber);

    if (!meeting) {
      throw new MeetingNotFoundException();
    }

    if (meeting.status === MeetingStatus.ENDED) {
      throw new MeetingAlreadyEndedException();
    }

    // 幂等：用户已在会议中则不重复添加
    const existingParticipant = await this.meetingRepository.findActiveParticipant(
      meeting.id,
      userId,
    );

    if (!existingParticipant) {
      const newParticipant = await this.meetingRepository.addParticipant(meeting.id, userId);

      // 通知房间内其他参与者
      const user = newParticipant.user;
      if (user) {
        await this.meetingGateway.notifyParticipantJoined({
          meetingId: meeting.id,
          participant: {
            userId,
            nickname: user.nickname,
            joinedAt: newParticipant.joined_at,
          },
        });
      }
    }

    const meetingWithParticipants = await this.meetingRepository.findByMeetingNumberWithParticipants(
      meetingNumber,
    );

    const participantCount = await this.meetingRepository.countParticipants(meeting.id);

    return this.formatMeetingDetailResponse(
      meetingWithParticipants!,
      participantCount,
    );
  }

  /**
   * 查询会议列表
   */
  async getMeetingList(
    userId: string,
    query: MeetingListQueryDto,
  ): Promise<MeetingListResultDto> {
    const listQuery: MeetingListQuery = {
      type: query.type,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    };

    const { items, total } = await this.meetingRepository.findListByUserId(
      userId,
      listQuery,
    );

    return {
      items: items.map((m) => this.formatMeetingResponse(m, m.participantCount)),
      total,
      page: listQuery.page!,
      pageSize: listQuery.pageSize!,
    };
  }

  /**
   * 查询会议详情
   */
  async getMeetingDetail(
    meetingId: string,
    userId: string,
  ): Promise<MeetingDetailResponseDto> {
    const meeting = await this.meetingRepository.findByIdWithParticipants(meetingId);

    if (!meeting) {
      throw new MeetingNotFoundException('会议不存在');
    }

    // 权限检查：只有参与者或创建者可以查看
    const participants = (meeting as any).participants as MeetingParticipantEntity[];
    const isParticipant =
      meeting.creator_id === userId ||
      participants.some((p) => p.user_id === userId);

    if (!isParticipant) {
      throw new MeetingForbiddenException();
    }

    const participantCount = await this.meetingRepository.countParticipants(meetingId);

    return this.formatMeetingDetailResponse(meeting, participantCount);
  }

  /**
   * 结束会议（仅创建者）
   */
  async endMeeting(
    meetingId: string,
    creatorId: string,
  ): Promise<EndMeetingResultDto> {
    const meeting = await this.meetingRepository.findById(meetingId);

    if (!meeting) {
      throw new MeetingNotFoundException();
    }

    if (meeting.creator_id !== creatorId) {
      throw new MeetingNotCreatorException();
    }

    if (meeting.status === MeetingStatus.ENDED) {
      throw new MeetingAlreadyEndedConflictException();
    }

    const endedAt = new Date();

    await this.meetingRepository.updateStatus(
      meetingId,
      MeetingStatus.ENDED,
      endedAt,
    );

    await this.meetingRepository.markAllParticipantsLeft(meetingId);

    // 计算持续时长（秒）
    const durationSeconds = meeting.started_at
      ? Math.floor((endedAt.getTime() - meeting.started_at.getTime()) / 1000)
      : 0;

    // 通过 WebSocket 通知所有参与者
    await this.meetingGateway.notifyMeetingEnded({
      meetingId,
      meetingNumber: meeting.meeting_number,
      endedBy: creatorId,
      endedAt,
      durationSeconds,
    });

    return {
      meetingId,
      endedAt,
      durationSeconds,
    };
  }

  /**
   * 格式化会议列表响应
   */
  private formatMeetingResponse(
    meeting: any,
    participantCount: number,
  ): MeetingResponseDto {
    return {
      id: meeting.id,
      meetingNumber: meeting.meeting_number,
      title: meeting.title ?? null,
      status: this.mapStatus(meeting.status),
      creatorId: meeting.creator_id,
      startedAt: meeting.started_at ?? null,
      endedAt: meeting.ended_at ?? null,
      participantCount,
      createdAt: meeting.created_at,
    };
  }

  /**
   * 格式化会议详情响应
   */
  private formatMeetingDetailResponse(
    meeting: any,
    participantCount: number,
  ): MeetingDetailResponseDto {
    const participants: MeetingParticipantEntity[] = meeting.participants ?? [];
    const now = new Date();

    let durationSeconds: number | null = null;
    if (meeting.status === MeetingStatus.ENDED && meeting.started_at && meeting.ended_at) {
      durationSeconds = Math.floor(
        (new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 1000,
      );
    } else if (meeting.status === MeetingStatus.ACTIVE && meeting.started_at) {
      durationSeconds = Math.floor(
        (now.getTime() - new Date(meeting.started_at).getTime()) / 1000,
      );
    }

    const participantDtos: ParticipantDto[] = participants.map((p) => ({
      userId: p.user_id,
      nickname: p.user?.nickname ?? '',
      isCreator: p.user_id === meeting.creator_id,
      joinedAt: p.joined_at,
    }));

    return {
      ...this.formatMeetingResponse(meeting, participantCount),
      durationSeconds,
      participants: participantDtos,
    };
  }

  /**
   * 映射状态枚举
   */
  private mapStatus(status: MeetingStatus): string {
    switch (status) {
      case MeetingStatus.WAITING:
        return 'WAITING';
      case MeetingStatus.ACTIVE:
        return 'IN_PROGRESS';
      case MeetingStatus.ENDED:
        return 'ENDED';
      default:
        return status;
    }
  }
}
