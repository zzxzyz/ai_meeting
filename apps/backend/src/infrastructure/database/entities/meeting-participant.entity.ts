import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { MeetingEntity } from './meeting.entity';

@Entity('meeting_participants')
export class MeetingParticipantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  meeting_id: string;

  @ManyToOne(() => MeetingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: MeetingEntity;

  @Column({ type: 'uuid' })
  @Index()
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @CreateDateColumn({ type: 'timestamp' })
  joined_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  left_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
