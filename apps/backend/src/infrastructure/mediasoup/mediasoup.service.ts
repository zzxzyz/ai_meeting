import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';

@Injectable()
export class MediasoupService implements OnModuleDestroy {
  private workers: mediasoup.types.Worker[] = [];
  private workerIndex = 0;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 初始化 mediasoup Worker 池
   */
  async initialize(): Promise<void> {
    const workerNum = this.configService.get<number>('MEDIASOUP_WORKER_NUM') || 1;

    for (let i = 0; i < workerNum; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: (this.configService.get<string>('MEDIASOUP_LOG_LEVEL') || 'warn') as mediasoup.types.WorkerLogLevel,
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: this.configService.get<number>('MEDIASOUP_RTC_MIN_PORT') || 40000,
        rtcMaxPort: this.configService.get<number>('MEDIASOUP_RTC_MAX_PORT') || 49999,
      });

      worker.on('died', () => {
        console.error('mediasoup Worker died, exiting in 2 seconds...');
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }
  }

  /**
   * 获取下一个可用的 Worker（轮询策略）
   */
  getNextWorker(): mediasoup.types.Worker {
    if (this.workers.length === 0) {
      throw new Error('No mediasoup workers available');
    }

    const worker = this.workers[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * 创建 Router（对应一个会议房间）
   */
  async createRouter(): Promise<mediasoup.types.Router> {
    const worker = this.getNextWorker();

    const mediaCodecs: mediasoup.types.RouterRtpCodecCapability[] = [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ];

    return await worker.createRouter({ mediaCodecs });
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
    this.workerIndex = 0;
  }

  /**
   * 模块销毁时清理资源
   */
  async onModuleDestroy(): Promise<void> {
    await this.cleanup();
  }
}