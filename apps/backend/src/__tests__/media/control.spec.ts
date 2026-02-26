import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { MeetingGateway } from '@/api/gateways/meeting.gateway';
import { RoomService } from '@/application/services/room.service';
import { Logger } from '@nestjs/common';

describe('MeetingGateway - 音视频控制信令', () => {
  let gateway: MeetingGateway;
  let roomService: jest.Mocked<RoomService>;
  let mockServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  const mockMeetingId = 'meeting-001';
  const mockPeerId = 'peer-001';
  const mockClientId = 'client-001';

  const mockAudioProducer = {
    id: 'audio-producer-001',
    kind: 'audio' as const,
    paused: false,
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };

  const mockVideoProducer = {
    id: 'video-producer-001',
    kind: 'video' as const,
    paused: false,
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };

  const mockPeer = {
    peerId: mockPeerId,
    userId: 'user-001',
    nickname: '张三',
    socketId: mockClientId,
    producers: new Map([
      ['audio-producer-001', mockAudioProducer as any],
      ['video-producer-001', mockVideoProducer as any],
    ]),
    consumers: new Map(),
    audioPaused: false,
    videoPaused: false,
    lastUpdated: new Date(),
  };

  const mockRoom = {
    meetingId: mockMeetingId,
    router: {} as any,
    peers: new Map([[mockPeerId, mockPeer]]),
    transports: new Map(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    mockSocket = {
      id: mockClientId,
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    } as any;

    roomService = {
      getOrCreateRoom: jest.fn().mockResolvedValue(mockRoom),
      getRoom: jest.fn().mockReturnValue(mockRoom),
      addPeer: jest.fn().mockResolvedValue(mockPeer),
      removePeer: jest.fn().mockResolvedValue(undefined),
      createTransport: jest.fn().mockResolvedValue({
        id: 'transport-001',
        iceParameters: {},
        iceCandidates: [],
        dtlsParameters: {},
      }),
      createProducer: jest.fn().mockResolvedValue(mockAudioProducer),
      createConsumer: jest.fn().mockResolvedValue({
        id: 'consumer-001',
        producerId: 'producer-001',
        kind: 'audio',
        rtpParameters: {},
        type: 'simple',
        producerPaused: false,
      }),
      getRoomProducers: jest.fn().mockReturnValue([]),
      closeRoom: jest.fn().mockResolvedValue(undefined),
      getRoomStats: jest.fn().mockReturnValue({
        peerCount: 1,
        producerCount: 2,
        consumerCount: 0,
        transportCount: 1,
      }),
      getPeer: jest.fn().mockReturnValue(mockPeer),
      updatePeerState: jest.fn().mockResolvedValue(undefined),
      getRoomControlState: jest.fn().mockReturnValue([
        {
          peerId: mockPeerId,
          audioMuted: false,
          videoDisabled: false,
          lastUpdated: new Date(),
        },
      ]),
      setPeerAudioMuted: jest.fn().mockResolvedValue(undefined),
      setPeerVideoDisabled: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingGateway,
        {
          provide: RoomService,
          useValue: roomService,
        },
      ],
    }).compile();

    gateway = module.get<MeetingGateway>(MeetingGateway);
    gateway.server = mockServer;

    // 设置客户端与 Peer 的映射
    (gateway as any).clientPeerMap.set(mockClientId, {
      meetingId: mockMeetingId,
      peerId: mockPeerId,
    });

    // 禁用日志输出
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    (gateway as any).clientPeerMap.clear();
  });

  describe('rtc:producerPause - 暂停 Producer', () => {
    it('应该成功暂停音频 Producer 并广播静音状态', async () => {
      // Arrange
      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-001',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result).toEqual({
        requestId: 'req-001',
        success: true,
        producerId: 'audio-producer-001',
        paused: true,
        timestamp: expect.any(Number),
      });

      expect(mockAudioProducer.pause).toHaveBeenCalledTimes(1);
      expect(roomService.setPeerAudioMuted).toHaveBeenCalledWith(
        mockMeetingId,
        mockPeerId,
        true
      );

      expect(mockServer.to).toHaveBeenCalledWith(`meeting:${mockMeetingId}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'rtc:peerMuted',
        expect.objectContaining({
          peerId: mockPeerId,
          muted: true,
          timestamp: expect.any(Number),
        })
      );
    });

    it('应该成功暂停视频 Producer 并广播摄像头关闭状态', async () => {
      // Arrange
      const data = {
        meetingId: mockMeetingId,
        producerId: 'video-producer-001',
        kind: 'video' as const,
        requestId: 'req-002',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result).toEqual({
        requestId: 'req-002',
        success: true,
        producerId: 'video-producer-001',
        paused: true,
        timestamp: expect.any(Number),
      });

      expect(mockVideoProducer.pause).toHaveBeenCalledTimes(1);
      expect(roomService.setPeerVideoDisabled).toHaveBeenCalledWith(
        mockMeetingId,
        mockPeerId,
        true
      );

      expect(mockServer.to).toHaveBeenCalledWith(`meeting:${mockMeetingId}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'rtc:peerVideoDisabled',
        expect.objectContaining({
          peerId: mockPeerId,
          disabled: true,
          timestamp: expect.any(Number),
        })
      );
    });

    it('Producer 不存在时应返回错误', async () => {
      // Arrange
      const data = {
        meetingId: mockMeetingId,
        producerId: 'non-existent-producer',
        kind: 'audio' as const,
        requestId: 'req-003',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result).toEqual({
        requestId: 'req-003',
        success: false,
        producerId: 'non-existent-producer',
        paused: false,
        timestamp: expect.any(Number),
        error: 'Producer not found',
      });
    });

    it('Producer 已暂停时应返回状态冲突错误', async () => {
      // Arrange
      const pausedProducer = {
        ...mockAudioProducer,
        paused: true,
      };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['audio-producer-001', pausedProducer as any]]),
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([[mockPeerId, peerWithPausedProducer]]),
      };
      roomService.getRoom.mockReturnValue(roomWithPausedProducer);

      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-004',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result).toEqual({
        requestId: 'req-004',
        success: false,
        producerId: 'audio-producer-001',
        paused: false,
        timestamp: expect.any(Number),
        error: 'Producer already paused',
      });
    });
  });

  describe('rtc:producerResume - 恢复 Producer', () => {
    it('应该成功恢复音频 Producer 并广播取消静音状态', async () => {
      // Arrange
      const pausedProducer = {
        ...mockAudioProducer,
        paused: true,
      };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['audio-producer-001', pausedProducer as any]]),
        audioPaused: true,
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([[mockPeerId, peerWithPausedProducer]]),
      };
      roomService.getRoom.mockReturnValue(roomWithPausedProducer);

      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-005',
      };

      // Act
      const result = await gateway.handleProducerResume(mockSocket, data);

      // Assert
      expect(result).toEqual({
        requestId: 'req-005',
        success: true,
        producerId: 'audio-producer-001',
        paused: false,
        timestamp: expect.any(Number),
      });

      expect(pausedProducer.resume).toHaveBeenCalledTimes(1);
      expect(roomService.setPeerAudioMuted).toHaveBeenCalledWith(
        mockMeetingId,
        mockPeerId,
        false
      );

      expect(mockServer.to).toHaveBeenCalledWith(`meeting:${mockMeetingId}`);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'rtc:peerMuted',
        expect.objectContaining({
          peerId: mockPeerId,
          muted: false,
          timestamp: expect.any(Number),
        })
      );
    });

    it('Producer 未暂停时应返回状态冲突错误', async () => {
      // Arrange
      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-006',
      };

      // Act
      const result = await gateway.handleProducerResume(mockSocket, data);

      // Assert
      expect(result).toEqual({
        requestId: 'req-006',
        success: false,
        producerId: 'audio-producer-001',
        paused: false,
        timestamp: expect.any(Number),
        error: 'Producer not paused',
      });
    });
  });

  describe('rtc:getRoomState - 获取房间状态', () => {
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

      const data = {
        meetingId: mockMeetingId,
      };

      // Act
      const result = await gateway.handleGetRoomState(mockSocket, data);

      // Assert
      expect(result).toEqual({
        meetingId: mockMeetingId,
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
      const data = {
        meetingId: 'non-existent-meeting',
      };

      // Act
      const result = await gateway.handleGetRoomState(mockSocket, data);

      // Assert
      expect(result).toEqual({
        meetingId: 'non-existent-meeting',
        peers: [],
        timestamp: expect.any(Number),
      });
    });
  });

  describe('便捷方法 - 音视频控制', () => {
    it('rtc:muteAudio 应该成功静音音频', async () => {
      // Arrange
      const data = {
        meetingId: mockMeetingId,
      };

      // Act
      const result = await gateway.handleMuteAudio(mockSocket, data);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAudioProducer.pause).toHaveBeenCalledTimes(1);
    });

    it('rtc:unmuteAudio 应该成功取消静音音频', async () => {
      // Arrange
      const pausedProducer = {
        ...mockAudioProducer,
        paused: true,
      };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['audio-producer-001', pausedProducer as any]]),
        audioPaused: true,
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([[mockPeerId, peerWithPausedProducer]]),
      };
      roomService.getRoom.mockReturnValue(roomWithPausedProducer);

      const data = {
        meetingId: mockMeetingId,
      };

      // Act
      const result = await gateway.handleUnmuteAudio(mockSocket, data);

      // Assert
      expect(result.success).toBe(true);
      expect(pausedProducer.resume).toHaveBeenCalledTimes(1);
    });

    it('rtc:disableVideo 应该成功关闭摄像头', async () => {
      // Arrange
      const data = {
        meetingId: mockMeetingId,
      };

      // Act
      const result = await gateway.handleDisableVideo(mockSocket, data);

      // Assert
      expect(result.success).toBe(true);
      expect(mockVideoProducer.pause).toHaveBeenCalledTimes(1);
    });

    it('rtc:enableVideo 应该成功开启摄像头', async () => {
      // Arrange
      const pausedProducer = {
        ...mockVideoProducer,
        paused: true,
      };
      const peerWithPausedProducer = {
        ...mockPeer,
        producers: new Map([['video-producer-001', pausedProducer as any]]),
        videoPaused: true,
      };
      const roomWithPausedProducer = {
        ...mockRoom,
        peers: new Map([[mockPeerId, peerWithPausedProducer]]),
      };
      roomService.getRoom.mockReturnValue(roomWithPausedProducer);

      const data = {
        meetingId: mockMeetingId,
      };

      // Act
      const result = await gateway.handleEnableVideo(mockSocket, data);

      // Assert
      expect(result.success).toBe(true);
      expect(pausedProducer.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe('错误处理', () => {
    it('客户端未加入房间时应返回错误', async () => {
      // Arrange
      (gateway as any).clientPeerMap.clear();
      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-007',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Client not joined any room');
    });

    it('房间不存在时应返回错误', async () => {
      // Arrange
      roomService.getRoom.mockReturnValue(undefined);
      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-008',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room not found');
    });

    it('Peer 不存在时应返回错误', async () => {
      // Arrange
      const roomWithoutPeer = {
        ...mockRoom,
        peers: new Map(),
      };
      roomService.getRoom.mockReturnValue(roomWithoutPeer);
      const data = {
        meetingId: mockMeetingId,
        producerId: 'audio-producer-001',
        kind: 'audio' as const,
        requestId: 'req-009',
      };

      // Act
      const result = await gateway.handleProducerPause(mockSocket, data);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Peer not found');
    });
  });
});