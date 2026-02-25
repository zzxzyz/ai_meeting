import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { MeetingEntity, MeetingStatus } from '../entities/meeting.entity';
import { MeetingParticipantEntity } from '../entities/meeting-participant.entity';

export interface MeetingListQuery {
  type?: 'created' | 'joined';
  page?: number;
  pageSize?: number;
}

export interface MeetingWithParticipantCount extends MeetingEntity {
  participantCount: number;
}

@Injectable()
export class MeetingRepository {
  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingRepo: Repository<MeetingEntity>,
    @InjectRepository(MeetingParticipantEntity)
    private readonly participantRepo: Repository<MeetingParticipantEntity>,
  ) {}

  /**
   * 创建会议
   */
  async createMeeting(data: {
    meeting_number: string;
    title?: string | null;
    creator_id: string;
    status: MeetingStatus;
    started_at: Date;
  }): Promise<MeetingEntity> {
    const meeting = this.meetingRepo.create(data);
    return this.meetingRepo.save(meeting);
  }

  /**
   * 检查会议号是否已存在
   */
  async existsByMeetingNumber(meetingNumber: string): Promise<boolean> {
    const count = await this.meetingRepo.count({
      where: { meeting_number: meetingNumber },
    });
    return count > 0;
  }

  /**
   * 根据会议号查找会议
   */
  async findByMeetingNumber(meetingNumber: string): Promise<MeetingEntity | null> {
    return this.meetingRepo.findOne({
      where: { meeting_number: meetingNumber },
    });
  }

  /**
   * 根据会议号查找会议（含参与者）
   */
  async findByMeetingNumberWithParticipants(meetingNumber: string): Promise<MeetingEntity | null> {
    return this.meetingRepo.findOne({
      where: { meeting_number: meetingNumber },
      relations: ['participants', 'participants.user'],
    });
  }

  /**
   * 根据 ID 查找会议
   */
  async findById(id: string): Promise<MeetingEntity | null> {
    return this.meetingRepo.findOne({ where: { id } });
  }

  /**
   * 根据 ID 查找会议（含参与者）
   */
  async findByIdWithParticipants(id: string): Promise<MeetingEntity | null> {
    return this.meetingRepo.findOne({
      where: { id },
      relations: ['participants', 'participants.user'],
    });
  }

  /**
   * 更新会议状态
   */
  async updateStatus(
    id: string,
    status: MeetingStatus,
    endedAt?: Date,
  ): Promise<MeetingEntity | null> {
    const updateData: Partial<MeetingEntity> = { status };
    if (endedAt) {
      updateData.ended_at = endedAt;
    }
    await this.meetingRepo.update(id, updateData);
    return this.findById(id);
  }

  /**
   * 查询用户相关的会议列表
   */
  async findListByUserId(
    userId: string,
    query: MeetingListQuery,
  ): Promise<{ items: MeetingWithParticipantCount[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    if (query.type === 'created') {
      // 查询用户创建的会议
      const [meetings, total] = await this.meetingRepo.findAndCount({
        where: { creator_id: userId },
        order: { created_at: 'DESC' },
        skip,
        take: pageSize,
      });

      const items = await this.attachParticipantCount(meetings);
      return { items, total };
    }

    if (query.type === 'joined') {
      // 查询用户参加的会议（包含自己创建的）
      const participantRecords = await this.participantRepo
        .createQueryBuilder('mp')
        .select('DISTINCT mp.meeting_id', 'meeting_id')
        .where('mp.user_id = :userId', { userId })
        .getRawMany();

      const meetingIds = participantRecords.map((r) => r.meeting_id);

      if (meetingIds.length === 0) {
        return { items: [], total: 0 };
      }

      const [meetings, total] = await this.meetingRepo
        .createQueryBuilder('m')
        .where('m.id IN (:...ids)', { ids: meetingIds })
        .orderBy('m.created_at', 'DESC')
        .skip(skip)
        .take(pageSize)
        .getManyAndCount();

      const items = await this.attachParticipantCount(meetings);
      return { items, total };
    }

    // 查询全部（创建或参加的）
    const participantRecords = await this.participantRepo
      .createQueryBuilder('mp')
      .select('DISTINCT mp.meeting_id', 'meeting_id')
      .where('mp.user_id = :userId', { userId })
      .getRawMany();

    const joinedMeetingIds = participantRecords.map((r) => r.meeting_id);

    const qb = this.meetingRepo
      .createQueryBuilder('m')
      .where('m.creator_id = :userId', { userId });

    if (joinedMeetingIds.length > 0) {
      qb.orWhere('m.id IN (:...ids)', { ids: joinedMeetingIds });
    }

    const [meetings, total] = await qb
      .orderBy('m.created_at', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    const items = await this.attachParticipantCount(meetings);
    return { items, total };
  }

  /**
   * 添加会议参与者
   */
  async addParticipant(
    meetingId: string,
    userId: string,
  ): Promise<MeetingParticipantEntity> {
    const participant = this.participantRepo.create({
      meeting_id: meetingId,
      user_id: userId,
    });
    return this.participantRepo.save(participant);
  }

  /**
   * 查找当前在会议中的参与者记录（left_at 为 null）
   */
  async findActiveParticipant(
    meetingId: string,
    userId: string,
  ): Promise<MeetingParticipantEntity | null> {
    return this.participantRepo.findOne({
      where: {
        meeting_id: meetingId,
        user_id: userId,
        left_at: IsNull(),
      },
    });
  }

  /**
   * 标记会议所有在线参与者已离开
   */
  async markAllParticipantsLeft(meetingId: string): Promise<void> {
    await this.participantRepo
      .createQueryBuilder()
      .update()
      .set({ left_at: new Date() })
      .where('meeting_id = :meetingId AND left_at IS NULL', { meetingId })
      .execute();
  }

  /**
   * 统计会议当前参与人数
   */
  async countParticipants(meetingId: string): Promise<number> {
    return this.participantRepo.count({
      where: { meeting_id: meetingId },
    });
  }

  /**
   * 为会议列表附加参与人数
   */
  private async attachParticipantCount(
    meetings: MeetingEntity[],
  ): Promise<MeetingWithParticipantCount[]> {
    if (meetings.length === 0) return [];

    const meetingIds = meetings.map((m) => m.id);
    const counts = await this.participantRepo
      .createQueryBuilder('mp')
      .select('mp.meeting_id', 'meeting_id')
      .addSelect('COUNT(mp.id)', 'count')
      .where('mp.meeting_id IN (:...ids)', { ids: meetingIds })
      .groupBy('mp.meeting_id')
      .getRawMany();

    const countMap = new Map<string, number>(
      counts.map((c) => [c.meeting_id, parseInt(c.count, 10)]),
    );

    return meetings.map((m) => ({
      ...m,
      participantCount: countMap.get(m.id) ?? 0,
    }));
  }
}
