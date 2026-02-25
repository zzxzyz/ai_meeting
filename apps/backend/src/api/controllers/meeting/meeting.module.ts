import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MeetingEntity } from '@/infrastructure/database/entities/meeting.entity';
import { MeetingParticipantEntity } from '@/infrastructure/database/entities/meeting-participant.entity';
import { UserEntity } from '@/infrastructure/database/entities/user.entity';
import { RefreshTokenEntity } from '@/infrastructure/database/entities/refresh-token.entity';
import { MeetingRepository } from '@/infrastructure/database/repositories/meeting.repository';
import { UserRepository } from '@/infrastructure/database/repositories/user.repository';
import { RefreshTokenRepository } from '@/infrastructure/database/repositories/refresh-token.repository';
import { MeetingService } from '@/application/services/meeting.service';
import { MeetingController } from './meeting.controller';
import { MeetingGateway } from '@/api/gateways/meeting.gateway';
import { JwtStrategy } from '@/common/strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeetingEntity,
      MeetingParticipantEntity,
      UserEntity,
      RefreshTokenEntity,
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MeetingController],
  providers: [
    MeetingService,
    MeetingRepository,
    MeetingGateway,
    UserRepository,
    RefreshTokenRepository,
    JwtStrategy,
  ],
  exports: [MeetingService, MeetingGateway],
})
export class MeetingModule {}
