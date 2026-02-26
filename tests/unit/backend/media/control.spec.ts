import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';
import { RoomService } from '@/application/services/room.service';
import { ControlService } from '@/application/services/control.service';
import { SignalingService } from '@/application/services/signaling.service';
import * as mediasoup from 'mediasoup';

describe('ControlService Integration Tests', () => {
  let controlService: ControlService;
  let roomService: jest.Mocked<RoomService>;
  let signalingService: jest.Mocked<SignalingService>;

  const mockProducer = {
    id: 'producer-001',
    kind: 'audio' as const,
    paused: false,
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };

  const mockVideoProducer = {
    id: 'producer-002',
    kind: 'video' as const,
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
    producers: new Map([
      ['producer-001', mockProducer as any],
      ['producer-002', mockVideoProducer as any],
    ]),
    consumers: new Map(),
    audioPaused: false,
    videoPaused: false,
    lastUpdated: new Date(),
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
            getRoomControlState: jest.fn(),
          },
        },
        {
          provide: SignalingService,
          useValue: {
            broadcastToRoom: jest.fn(),
            sendToPeer: jest.fn(),
            sendControlAck: jest.fn(),
          },
        },
        {
          provide: MediasoupService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controlService = module.get<ControlService>(ControlService);
    roomService = module.get(RoomService);
    signalingService = module.get(SignalingService);

    jest.clearAllMocks();
  });

  describe('音频控制功能', () => {
    it('应该成功静音音频', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act
      await controlService.pauseProducer('meeting-001', 'peer-001', 'producer-001');

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

    it('应该成功取消静音音频', async () => {
      // Arrange
      const pausedProducer = { ...mockProducer, paused: true };
      const pausedPeer = {
        ...mockPeer,
        producers: new Map([['producer-001', pausedProducer as any]]),
        audioPaused: true,
      };
      const pausedRoom = {
        ...mockRoom,
        peers: new Map([['peer-001', pausedPeer]]),
      };

      roomService.getRoom.mockReturnValue(pausedRoom);
      roomService.getPeer.mockReturnValue(pausedPeer);

      // Act
      await controlService.resumeProducer('meeting-001', 'peer-001', 'producer-001');

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
          type: 'rtc:peerMuted',
          data: expect.objectContaining({
            peerId: 'peer-001',
            muted: false,
          }),
        })
      );
    });
  });

  describe('视频控制功能', () => {
    it('应该成功禁用视频', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act
      await controlService.pauseProducer('meeting-001', 'peer-001', 'producer-002');

      // Assert
      expect(mockVideoProducer.pause).toHaveBeenCalledTimes(1);
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

    it('应该成功启用视频', async () => {
      // Arrange
      const pausedVideoProducer = { ...mockVideoProducer, paused: true };
      const pausedVideoPeer = {
        ...mockPeer,
        producers: new Map([['producer-002', pausedVideoProducer as any]]),
        videoPaused: true,
      };
      const pausedVideoRoom = {
        ...mockRoom,
        peers: new Map([['peer-001', pausedVideoPeer]]),
      };

      roomService.getRoom.mockReturnValue(pausedVideoRoom);
      roomService.getPeer.mockReturnValue(pausedVideoPeer);

      // Act
      await controlService.resumeProducer('meeting-001', 'peer-001', 'producer-002');

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
          type: 'rtc:peerVideoDisabled',
          data: expect.objectContaining({
            peerId: 'peer-001',
            disabled: false,
          }),
        })
      );
    });
  });

  describe('房间状态同步', () => {
    it('应该返回正确的房间控制状态', async () => {
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
      const result = await controlService.getRoomState('meeting-001');

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

    it('新用户加入时应同步房间状态', async () => {
      // Arrange
      const peer1 = {
        ...mockPeer,
        peerId: 'peer-001',
        audioPaused: true,
        videoPaused: false,
      };
      const roomWithPeer = {
        ...mockRoom,
        peers: new Map([['peer-001', peer1 as any]]),
      };

      roomService.getRoom.mockReturnValue(roomWithPeer);

      // Act
      await controlService.syncRoomState('meeting-001', 'new-peer-002');

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

  describe('错误处理', () => {
    it('Producer 不存在时应抛出错误', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act & Assert
      await expect(
        controlService.pauseProducer('meeting-001', 'peer-001', 'non-existent-producer')
      ).rejects.toThrow('Producer not found');
    });

    it('Producer 已暂停时重复暂停应抛出错误', async () => {
      // Arrange
      const pausedProducer = { ...mockProducer, paused: true };
      const pausedPeer = {
        ...mockPeer,
        producers: new Map([['producer-001', pausedProducer as any]]),
        audioPaused: true,
      };
      const pausedRoom = {
        ...mockRoom,
        peers: new Map([['peer-001', pausedPeer]]),
      };

      roomService.getRoom.mockReturnValue(pausedRoom);
      roomService.getPeer.mockReturnValue(pausedPeer);

      // Act & Assert
      await expect(
        controlService.pauseProducer('meeting-001', 'peer-001', 'producer-001')
      ).rejects.toThrow('Producer already paused');
    });

    it('Producer 未暂停时恢复应抛出错误', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act & Assert
      await expect(
        controlService.resumeProducer('meeting-001', 'peer-001', 'producer-001')
      ).rejects.toThrow('Producer not paused');
    });
  });

  describe('便捷方法', () => {
    it('muteAudio 应该成功静音音频', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act
      await controlService.muteAudio('meeting-001', 'peer-001');

      // Assert
      expect(mockProducer.pause).toHaveBeenCalledTimes(1);
      expect(roomService.updatePeerState).toHaveBeenCalledWith(
        'meeting-001',
        'peer-001',
        expect.objectContaining({
          audioPaused: true,
        })
      );
    });

    it('disableVideo 应该成功禁用视频', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(mockRoom);
      roomService.getPeer.mockReturnValue(mockPeer);

      // Act
      await controlService.disableVideo('meeting-001', 'peer-001');

      // Assert
      expect(mockVideoProducer.pause).toHaveBeenCalledTimes(1);
      expect(roomService.updatePeerState).toHaveBeenCalledWith(
        'meeting-001',
        'peer-001',
        expect.objectContaining({
          videoPaused: true,
        })
      );
    });
  });
});