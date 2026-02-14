import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingEntity } from '@/infrastructure/database/entities/meeting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MeetingEntity])],
  controllers: [],
  providers: [],
  exports: [],
})
export class MeetingModule {}
