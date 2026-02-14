import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum MeetingStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  ENDED = 'ended',
}

@Entity('meetings')
export class MeetingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 9 })
  @Index()
  meeting_number: string;

  @Column({ length: 100, nullable: true })
  title: string | null;

  @Column({ type: 'uuid' })
  creator_id: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'creator_id' })
  creator: UserEntity;

  @Column({
    type: 'enum',
    enum: MeetingStatus,
    default: MeetingStatus.WAITING,
  })
  status: MeetingStatus;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  ended_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
