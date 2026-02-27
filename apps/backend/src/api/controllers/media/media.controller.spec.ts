import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from '@/application/services/media.service';
import { ConfigService } from '@nestjs/config';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: {
            getMediaConfig: jest.fn().mockResolvedValue({
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                {
                  urls: 'turn:turn.example.com:3478',
                  username: 'test-user',
                  credential: 'test-password',
                },
              ],
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'MEDIASOUP_STUN_SERVERS': 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302',
                'MEDIASOUP_TURN_SERVER': 'turn:turn.example.com:3478',
                'MEDIASOUP_TURN_USERNAME': 'test-user',
                'MEDIASOUP_TURN_PASSWORD': 'test-password',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    mediaService = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/meetings/:meetingId/media-config', () => {
    it('should return media configuration for meeting', async () => {
      const meetingId = 'meeting-001';
      const result = await controller.getMediaConfig(meetingId);

      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:turn.example.com:3478',
              username: 'test-user',
              credential: 'test-password',
            },
          ],
        },
      });
      expect(mediaService.getMediaConfig).toHaveBeenCalledWith(meetingId);
    });

    it('should handle meeting not found error', async () => {
      (mediaService.getMediaConfig as jest.Mock).mockRejectedValueOnce(new Error('Meeting not found'));

      const meetingId = 'non-existent-meeting';

      await expect(controller.getMediaConfig(meetingId)).rejects.toThrow('Meeting not found');
    });

    it('should handle unauthorized access error', async () => {
      (mediaService.getMediaConfig as jest.Mock).mockRejectedValueOnce(new Error('Unauthorized access'));

      const meetingId = 'meeting-001';

      await expect(controller.getMediaConfig(meetingId)).rejects.toThrow('Unauthorized access');
    });
  });
});