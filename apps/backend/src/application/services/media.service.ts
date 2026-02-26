import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IceServerConfig {
  urls: string;
  username?: string;
  credential?: string;
}

export interface MediaConfig {
  iceServers: IceServerConfig[];
}

@Injectable()
export class MediaService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取会议媒体配置
   * 返回 STUN/TURN 服务器配置，用于 WebRTC ICE 候选者收集
   */
  async getMediaConfig(meetingId: string): Promise<MediaConfig> {
    // 验证会议存在性和权限（这里需要集成会议服务）
    await this.validateMeetingAccess(meetingId);

    const iceServers = this.getIceServers();

    return {
      iceServers,
    };
  }

  /**
   * 验证会议访问权限
   */
  private async validateMeetingAccess(meetingId: string): Promise<void> {
    // TODO: 集成会议服务，验证会议存在性、状态和用户权限
    // 这里暂时返回成功，实际实现需要调用会议管理服务
    // throw new Error('Meeting not found');
    // throw new Error('Unauthorized access');
    // throw new Error('Meeting has ended');
  }

  /**
   * 获取 ICE 服务器配置
   */
  private getIceServers(): IceServerConfig[] {
    const iceServers: IceServerConfig[] = [];

    // 添加 STUN 服务器
    const stunServers = this.configService.get<string>('MEDIASOUP_STUN_SERVERS') ||
      'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';

    stunServers.split(',').forEach(url => {
      iceServers.push({
        urls: url.trim(),
      });
    });

    // 添加 TURN 服务器（如果配置了）
    const turnServer = this.configService.get<string>('MEDIASOUP_TURN_SERVER');
    const turnUsername = this.configService.get<string>('MEDIASOUP_TURN_USERNAME');
    const turnPassword = this.configService.get<string>('MEDIASOUP_TURN_PASSWORD');

    if (turnServer && turnUsername && turnPassword) {
      iceServers.push({
        urls: turnServer,
        username: turnUsername,
        credential: turnPassword,
      });
    }

    return iceServers;
  }

  /**
   * 获取默认媒体配置（开发环境使用）
   */
  getDefaultMediaConfig(): MediaConfig {
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // 开发环境可以添加测试 TURN 服务器
        {
          urls: 'turn:localhost:3478',
          username: 'test',
          credential: 'test',
        },
      ],
    };
  }
}