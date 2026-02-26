import { Test, TestingModule } from '@nestjs/testing';
import { MediasoupService } from './mediasoup.service';
import { ConfigService } from '@nestjs/config';

// Mock mediasoup module
jest.mock('mediasoup', () => ({
  createWorker: jest.fn().mockResolvedValue({
    pid: 12345,
    close: jest.fn(),
    on: jest.fn(),
    createRouter: jest.fn().mockResolvedValue({
      id: 'router-001',
      rtpCapabilities: {
        codecs: [
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
          },
        ],
      },
      close: jest.fn(),
    }),
  }),
}), { virtual: true });

describe('MediasoupService', () => {
  let service: MediasoupService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediasoupService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'MEDIASOUP_WORKER_NUM': 2,
                'MEDIASOUP_RTC_MIN_PORT': 40000,
                'MEDIASOUP_RTC_MAX_PORT': 49999,
                'MEDIASOUP_ANNOUNCED_IP': '127.0.0.1',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MediasoupService>(MediasoupService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize worker pool with correct number of workers', async () => {
      await service.initialize();

      expect(service['workers']).toHaveLength(2);
      expect(service['workerIndex']).toBe(0);
    });

    it('should handle worker initialization errors', async () => {
      // 创建一个新的服务实例来避免状态污染
      const errorService = new MediasoupService(configService);

      const mockCreateWorker = require('mediasoup').createWorker;
      mockCreateWorker.mockRejectedValueOnce(new Error('Worker creation failed'));

      // 确保使用新的 mock 配置
      await expect(errorService.initialize()).rejects.toThrow('Worker creation failed');
    });
  });

  describe('getNextWorker', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return workers in round-robin fashion', () => {
      const worker1 = service.getNextWorker();
      const worker2 = service.getNextWorker();
      const worker3 = service.getNextWorker();

      expect(worker1.pid).toBeGreaterThan(0);
      expect(worker2.pid).toBeGreaterThan(0);
      expect(worker3.pid).toBeGreaterThan(0);
      expect(service['workerIndex']).toBe(1); // After 3 calls, index should be 1 (2 % 2 = 0)
    });
  });

  describe('createRouter', () => {
    beforeEach(async () => {
      // 重置 mock 确保每次测试都使用正确的 mock 配置
      const mockCreateWorker = require('mediasoup').createWorker;
      mockCreateWorker.mockClear();

      await service.initialize();
    });

    it('should create router with correct media codecs', async () => {
      const router = await service.createRouter();

      expect(router).toBeDefined();
      expect(router.id).toBe('router-001');
      expect(router.rtpCapabilities.codecs).toHaveLength(2);
      expect(router.rtpCapabilities.codecs[0].mimeType).toBe('audio/opus');
      expect(router.rtpCapabilities.codecs[1].mimeType).toBe('video/VP8');
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should close all workers', async () => {
      await service.cleanup();

      service['workers'].forEach(worker => {
        expect(worker.close).toHaveBeenCalled();
      });
    });
  });
});