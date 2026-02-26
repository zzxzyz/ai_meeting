import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';

// Mock mediasoup 模块
jest.mock('mediasoup', () => ({
  createWorker: jest.fn(),
}));

describe('MediasoupService', () => {
  let service: MediasoupService;
  let configService: jest.Mocked<ConfigService>;

  const mockWorker = {
    on: jest.fn(),
    close: jest.fn(),
    createRouter: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasoupService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MediasoupService>(MediasoupService);
    configService = module.get(ConfigService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('应该使用默认配置初始化单个 Worker', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'MEDIASOUP_WORKER_NUM':
            return undefined; // 使用默认值
          case 'MEDIASOUP_LOG_LEVEL':
            return undefined;
          case 'MEDIASOUP_RTC_MIN_PORT':
            return undefined;
          case 'MEDIASOUP_RTC_MAX_PORT':
            return undefined;
          default:
            return undefined;
        }
      });

      (mediasoup.createWorker as jest.Mock).mockResolvedValue(mockWorker);

      // Act
      await service.initialize();

      // Assert
      expect(mediasoup.createWorker).toHaveBeenCalledWith({
        logLevel: 'warn',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
      });
      expect(mockWorker.on).toHaveBeenCalledWith('died', expect.any(Function));
    });

    it('应该使用自定义配置初始化多个 Worker', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'MEDIASOUP_WORKER_NUM':
            return 3;
          case 'MEDIASOUP_LOG_LEVEL':
            return 'debug';
          case 'MEDIASOUP_RTC_MIN_PORT':
            return 30000;
          case 'MEDIASOUP_RTC_MAX_PORT':
            return 39999;
          default:
            return undefined;
        }
      });

      (mediasoup.createWorker as jest.Mock).mockResolvedValue(mockWorker);

      // Act
      await service.initialize();

      // Assert
      expect(mediasoup.createWorker).toHaveBeenCalledTimes(3);
      expect(mediasoup.createWorker).toHaveBeenCalledWith({
        logLevel: 'debug',
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: 30000,
        rtcMaxPort: 39999,
      });
    });

    it('Worker 死亡时应触发进程退出', async () => {
      // Arrange
      configService.get.mockReturnValue(1);
      (mediasoup.createWorker as jest.Mock).mockResolvedValue(mockWorker);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation();
      const mockSetTimeout = jest.spyOn(global, 'setTimeout');

      // Act
      await service.initialize();

      // 触发 died 事件
      const diedCallback = mockWorker.on.mock.calls.find(call => call[0] === 'died')[1];
      diedCallback();

      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

      // 清理
      mockExit.mockRestore();
    });
  });

  describe('getNextWorker', () => {
    beforeEach(async () => {
      // 初始化 Worker 池
      configService.get.mockReturnValue(2);
      (mediasoup.createWorker as jest.Mock)
        .mockResolvedValueOnce({ ...mockWorker, id: 'worker-1' })
        .mockResolvedValueOnce({ ...mockWorker, id: 'worker-2' });

      await service.initialize();
    });

    it('应该使用轮询策略返回 Worker', () => {
      // Act & Assert
      const worker1 = service.getNextWorker();
      expect(worker1.id).toBe('worker-1');

      const worker2 = service.getNextWorker();
      expect(worker2.id).toBe('worker-2');

      const worker3 = service.getNextWorker();
      expect(worker3.id).toBe('worker-1'); // 回到第一个
    });

    it('没有可用 Worker 时应抛出错误', () => {
      // Arrange
      (service as any).workers = [];

      // Act & Assert
      expect(() => service.getNextWorker()).toThrow('No mediasoup workers available');
    });
  });

  describe('createRouter', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue(1);
      (mediasoup.createWorker as jest.Mock).mockResolvedValue(mockWorker);
      await service.initialize();
    });

    it('应该创建包含正确媒体编解码器的 Router', async () => {
      // Arrange
      const mockRouter = { id: 'router-001' };
      mockWorker.createRouter.mockResolvedValue(mockRouter);

      // Act
      const router = await service.createRouter();

      // Assert
      expect(mockWorker.createRouter).toHaveBeenCalledWith({
        mediaCodecs: expect.arrayContaining([
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
        ]),
      });
      expect(router).toBe(mockRouter);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue(2);
      (mediasoup.createWorker as jest.Mock)
        .mockResolvedValueOnce({ ...mockWorker, id: 'worker-1' })
        .mockResolvedValueOnce({ ...mockWorker, id: 'worker-2' });

      await service.initialize();
    });

    it('应该清理所有 Worker 并重置状态', async () => {
      // Act
      await service.cleanup();

      // Assert
      expect(mockWorker.close).toHaveBeenCalledTimes(2);
      expect((service as any).workers).toEqual([]);
      expect((service as any).workerIndex).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('模块销毁时应调用 cleanup', async () => {
      // Arrange
      const cleanupSpy = jest.spyOn(service, 'cleanup');

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});