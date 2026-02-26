import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';
import { RoomService } from '@/application/services/room.service';
import { ControlService } from '@/application/services/control.service';
import { SignalingService } from '@/application/services/signaling.service';
import * as mediasoup from 'mediasoup';

describe('ControlService', () => {
  let service: ControlService;
  let roomService: jest.Mocked<RoomService>;
  let mediasoupService: jest.Mocked<MediasoupService>;
  let signalingService: jest.Mocked<SignalingService>;
  let configService: jest.Mocked<ConfigService>;

  const mockProducer = {
    id: 'producer-001',
    kind: 'audio' as const,
    paused: false,
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };

  const mockPeer = {
    peerId: 'peer-001',
    userId: 'user-001',
    nickname: '张三',
    socketId: 'socket-001',
    producers: new Map([['producer-001', mockProducer as any]]),
    consumers: new Map(),
  };

  const mockRoom = {
    meetingId: 'meeting-001',
    router: {} as any,
    peers: new Map([['peer-001', mockPeer]]),
    transports: new Map(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlService,
        {
          provide: RoomService,
          useValue: {
            getRoom: jest.fn(),
            getPeer: jest.fn(),
            updatePeerState: jest.fn(),
          },
        },
        {
          provide: MediasoupService,
          useValue: {
            // Mock methods as needed
          },
        },
        {
          provide: SignalingService,
          useValue: {
            broadcastToRoom: jest.fn(),
            sendToPeer: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ControlService>(ControlService);
    roomService = module.get(RoomService);
    mediasoupService = module.get(MediasoupService);
    signalingService = module.get(SignalingService);
    configService = module.get(ConfigService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('pauseProducer', () => {
    it('应该成功暂停音频 Producer', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act
      await service.pauseProducer('meeting-001', 'peer-001', 'producer-001');

      // Assert
      expect(mockProducer.pause).toHaveBeenCalledTimes(1);
      expect(roomService.updatePeerState).toHaveBeenCalledWith(
        'meeting-001',
        'peer-001',
        expect.objectContaining({
          audioPaused: true,
        })
      );
      expect(signalingService.broadcastToRoom).toHaveBeenCalledWith(
        'meeting-001',
        expect.objectContaining({
          type: 'rtc:peerMuted',
          data: expect.objectContaining({
            peerId: 'peer-001',
            muted: true,
          }),
        })
      );
    });

    it('Producer 不存在时应抛出错误', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act & Assert
      await expect(
        service.pauseProducer('meeting-001', 'peer-001', 'non-existent-producer')
      ).rejects.toThrow('Producer not found');
    });

    it('Producer 已暂停时应抛出状态冲突错误', async () => {
      // Arrange
      const pausedProducer = { ...mockProducer, paused: true };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['producer-001', pausedProducer as any]]),
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([['peer-001', peerWithPausedProducer]]),
      };

      roomService.getRoom.mockReturnValue(roomWithPausedProducer);
      roomService.getPeer.mockReturnValue(peerWithPausedProducer);

      // Act & Assert
      await expect(
        service.pauseProducer('meeting-001', 'peer-001', 'producer-001')
      ).rejects.toThrow('Producer already paused');
    });
  });

  describe('resumeProducer', () => {
    it('应该成功恢复音频 Producer', async () => {
      // Arrange
      const pausedProducer = { ...mockProducer, paused: true };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['producer-001', pausedProducer as any]]),
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([['peer-001', peerWithPausedProducer]]),
      };

      roomService.getRoom.mockReturnValue(roomWithPausedProducer);
      roomService.getPeer.mockReturnValue(peerWithPausedProducer);

      // Act
      await service.resumeProducer('meeting-001', 'peer-001', 'producer-001');

      // Assert
      expect(pausedProducer.resume).toHaveBeenCalledTimes(1);
      expect(roomService.updatePeerState).toHaveBeenCalledWith(
        'meeting-001',
        'peer-001',
        expect.objectContaining({
          audioPaused: false,
        })
      );
      expect(signalingService.broadcastToRoom).toHaveBeenCalledWith(
        'meeting-001',
        expect.objectContaining({
          type: 'rtc:peerUnmuted',
          data: expect.objectContaining({
            peerId: 'peer-001',
            muted: false,
          }),
        })
      );
    });

    it('Producer 未暂停时应抛出状态冲突错误', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act & Assert
      await expect(
        service.resumeProducer('meeting-001', 'peer-001', 'producer-001')
      ).rejects.toThrow('Producer not paused');
    });
  });

  describe('pauseVideoProducer', () => {
    it('应该成功暂停视频 Producer', async () => {
      // Arrange
      const videoProducer = {
        ...mockProducer,
        kind: 'video' as const,
      };
      const peerWithVideoProducer = {
        ...mockPeer,
        producers: new Map([['producer-001', videoProducer as any]]),
      };
      const roomWithVideoProducer = {
        ...mockRoom,
        peers: new Map([['peer-001', peerWithVideoProducer]]),
      };

      roomService.getRoom.mockReturnValue(roomWithVideoProducer);
      roomService.getPeer.mockReturnValue(peerWithVideoProducer);

      // Act
      await service.pauseProducer('meeting-001', 'peer-001', 'producer-001');

      // Assert
      expect(videoProducer.pause).toHaveBeenCalledTimes(1);
      expect(roomService.updatePeerState).toHaveBeenCalledWith(
        'meeting-001',
        'peer-001',
        expect.objectContaining({
          videoPaused: true,
        })
      );
      expect(signalingService.broadcastToRoom).toHaveBeenCalledWith(
        'meeting-001',
        expect.objectContaining({
          type: 'rtc:peerVideoDisabled',
          data: expect.objectContaining({
            peerId: 'peer-001',
            disabled: true,
          }),
        })
      );
    });
  });

  describe('resumeVideoProducer', () => {
    it('应该成功恢复视频 Producer', async () => {
      // Arrange
      const pausedVideoProducer = {
        ...mockProducer,
        kind: 'video' as const,
        paused: true,
      };
      const peerWithPausedVideoProducer = {
        ...mockPeer,
        producers: new Map([['producer-001', pausedVideoProducer as any]]),
      };
      const roomWithPausedVideoProducer = {
        ...mockRoom,
        peers: new Map([['peer-001', peerWithPausedVideoProducer]]),
      };

      roomService.getRoom.mockReturnValue(roomWithPausedVideoProducer);
      roomService.getPeer.mockReturnValue(peerWithPausedVideoProducer);

      // Act
      await service.resumeProducer('meeting-001', 'peer-001', 'producer-001');

      // Assert
      expect(pausedVideoProducer.resume).toHaveBeenCalledTimes(1);
      expect(roomService.updatePeerState).toHaveBeenCalledWith(
        'meeting-001',
        'peer-001',
        expect.objectContaining({
          videoPaused: false,
        })
      );
      expect(signalingService.broadcastToRoom).toHaveBeenCalledWith(
        'meeting-001',
        expect.objectContaining({
          type: 'rtc:peerVideoEnabled',
          data: expect.objectContaining({
            peerId: 'peer-001',
            disabled: false,
          }),
        })
      );
    });
  });

  describe('getRoomState', () => {
    it('应该返回房间内所有 Peer 的控制状态', async () => {
      // Arrange
      const peer1 = {
        ...mockPeer,
        peerId: 'peer-001',
        audioPaused: true,
        videoPaused: false,
      };
      const peer2 = {
        ...mockPeer,
        peerId: 'peer-002',
        audioPaused: false,
        videoPaused: true,
      };
      const roomWithMultiplePeers = {
        ...mockRoom,
        peers: new Map([
          ['peer-001', peer1 as any],
          ['peer-002', peer2 as any],
        ]),
      };

      roomService.getRoom.mockReturnValue(roomWithMultiplePeers);

      // Act
      const result = await service.getRoomState('meeting-001');

      // Assert
      expect(result).toEqual({
        meetingId: 'meeting-001',
        peers: [
          {
            peerId: 'peer-001',
            audioMuted: true,
            videoDisabled: false,
          },
          {
            peerId: 'peer-002',
            audioMuted: false,
            videoDisabled: true,
          },
        ],
        timestamp: expect.any(Number),
      });
    });

    it('房间不存在时应返回空状态', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(undefined);

      // Act
      const result = await service.getRoomState('non-existent-meeting');

      // Assert
      expect(result).toEqual({
        meetingId: 'non-existent-meeting',
        peers: [],
        timestamp: expect.any(Number),
      });
    });
  });

  describe('错误处理', () => {
    it('Producer pause 失败时应抛出错误', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);
      mockProducer.pause.mockRejectedValue(new Error('Producer pause failed'));

      // Act & Assert
      await expect(
        service.pauseProducer('meeting-001', 'peer-001', 'producer-001')
      ).rejects.toThrow('Producer pause failed');
    });

    it('Producer resume 失败时应抛出错误', async () => {
      // Arrange
      const pausedProducer = { ...mockProducer, paused: true };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['producer-001', pausedProducer as any]]),
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([['peer-001', peerWithPausedProducer]]),
      };

      roomService.getRoom.mockReturnValue(roomWithPausedProducer);
      roomService.getPeer.mockReturnValue(peerWithPausedProducer);
      pausedProducer.resume.mockRejectedValue(new Error('Producer resume failed'));

      // Act & Assert
      await expect(
        service.resumeProducer('meeting-001', 'peer-001', 'producer-001')
      ).rejects.toThrow('Producer resume failed');
    });
  });

  describe('状态同步', () => {
    it('新用户加入时应同步房间状态', async () => {
      // Arrange
      const peer1 = {
        ...mockPeer,
        peerId: 'peer-001',
        audioPaused: true,
        videoPaused: false,
      };
      const roomWithPeers = {
        ...mockRoom,
        peers: new Map([['peer-001', peer1 as any]]),
      };

      roomService.getRoom.mockReturnValue(roomWithPeers);

      // Act
      await service.syncRoomState('meeting-001', 'new-peer-002');

      // Assert
      expect(signalingService.sendToPeer).toHaveBeenCalledWith(
        'new-peer-002',
        expect.objectContaining({
          type: 'rtc:roomState',
          data: expect.objectContaining({
            meetingId: 'meeting-001',
            peers: expect.arrayContaining([
              expect.objectContaining({
                peerId: 'peer-001',
                audioMuted: true,
                videoDisabled: false,
              }),
            ]),
          }),
        })
      );
    });
  });
});