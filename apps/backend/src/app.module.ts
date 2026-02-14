import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { UserModule } from '@/api/controllers/user/user.module';
import { MeetingModule } from '@/api/controllers/meeting/meeting.module';
import { AuthModule } from '@/api/controllers/auth/auth.module';
import { HealthModule } from '@/api/controllers/health/health.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 数据库模块
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<boolean>('DATABASE_SYNCHRONIZE', false),
        logging: configService.get<boolean>('DATABASE_LOGGING', false),
        migrations: [__dirname + '/infrastructure/database/migrations/*{.ts,.js}'],
        migrationsRun: true,
      }),
      inject: [ConfigService],
    }),

    // Redis 缓存模块
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get<number>('REDIS_DB', 0),
        ttl: 3600, // 默认 TTL 1 小时
      }),
      inject: [ConfigService],
    }),

    // 业务模块
    AuthModule,
    UserModule,
    MeetingModule,
    HealthModule,
  ],
})
export class AppModule {}
