import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';
import { RoomService, RoomInfo, PeerInfo } from '@/application/services/room.service';
import * as mediasoup from 'mediasoup';

describe('RoomService', () => {
  let service: RoomService;
  let mediasoupService: jest.Mocked<MediasoupService>;
  let configService: jest.Mocked<ConfigService>;

  const mockRouter = {
    createWebRtcTransport: jest.fn(),
    close: jest.fn(),
  };

  const mockTransport = {
    id: 'transport-001',
    produce: jest.fn(),
    consume: jest.fn(),
    close: jest.fn(),
  };

  const mockProducer = {
    id: 'producer-001',
    kind: 'video' as const,
    close: jest.fn(),
  };

  const mockConsumer = {
    id: 'consumer-001',
    producerId: 'producer-001',
    kind: 'video' as const,
    rtpParameters: {},
    type: 'simulcast',
    producerPaused: false,
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: MediasoupService,
          useValue: {
            createRouter: jest.fn(),
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

    service = module.get<RoomService>(RoomService);
    mediasoupService = module.get(MediasoupService);
    configService = module.get(ConfigService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('getOrCreateRoom', () => {
    it('应该返回已存在的房间', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const existingRoom: RoomInfo = {
        meetingId,
        router: mockRouter as any,
        peers: new Map(),
        transports: new Map(),
        createdAt: new Date(),
      };

      (service as any).rooms.set(meetingId, existingRoom);

      // Act
      const result = await service.getOrCreateRoom(meetingId);

      // Assert
      expect(result).toBe(existingRoom);
      expect(mediasoupService.createRouter).not.toHaveBeenCalled();
    });

    it('应该创建新房间', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      mediasoupService.createRouter.mockResolvedValue(mockRouter as any);

      // Act
      const result = await service.getOrCreateRoom(meetingId);

      // Assert
      expect(mediasoupService.createRouter).toHaveBeenCalled();
      expect(result.meetingId).toBe(meetingId);
      expect(result.router).toBe(mockRouter);
      expect(result.peers).toBeInstanceOf(Map);
      expect(result.transports).toBeInstanceOf(Map);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getRoom', () => {
    it('应该返回存在的房间', () => {
      // Arrange
      const meetingId = 'meeting-001';
      const room: RoomInfo = {
        meetingId,
        router: mockRouter as any,
        peers: new Map(),
        transports: new Map(),
        createdAt: new Date(),
      };
      (service as any).rooms.set(meetingId, room);

      // Act
      const result = service.getRoom(meetingId);

      // Assert
      expect(result).toBe(room);
    });

    it('房间不存在时应返回 undefined', () => {
      // Act
      const result = service.getRoom('non-existent-meeting');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('addPeer', () => {
    beforeEach(async () => {
      // 创建一个房间
      const meetingId = 'meeting-001';
      mediasoupService.createRouter.mockResolvedValue(mockRouter as any);
      await service.getOrCreateRoom(meetingId);
    });

    it('应该成功添加 Peer', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      configService.get.mockReturnValue(10); // 设置较大的房间容量

      // Act
      const result = await service.addPeer(meetingId, peerInfo);

      // Assert
      expect(result).toMatchObject({
        ...peerInfo,
        producers: expect.any(Map),
        consumers: expect.any(Map),
      });

      const room = service.getRoom(meetingId);
      expect(room?.peers.has('peer-001')).toBe(true);
    });

    it('房间不存在时应抛出错误', async () => {
      // Arrange
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      // Act & Assert
      await expect(
        service.addPeer('non-existent-meeting', peerInfo)
      ).rejects.toThrow('Room not found');
    });

    it('房间已满时应抛出错误', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      configService.get.mockReturnValue(1); // 设置房间容量为1

      // 先添加一个 Peer
      await service.addPeer(meetingId, {
        peerId: 'peer-002',
        userId: 'user-002',
        nickname: '李四',
        socketId: 'socket-002',
      });

      // Act & Assert
      await expect(
        service.addPeer(meetingId, peerInfo)
      ).rejects.toThrow('Room is full');
    });
  });

  describe('removePeer', () => {
    let meetingId: string;
    let peerId: string;

    beforeEach(async () => {
      // 创建房间并添加 Peer
      meetingId = 'meeting-001';
      peerId = 'peer-001';

      mediasoupService.createRouter.mockResolvedValue(mockRouter as any);
      await service.getOrCreateRoom(meetingId);

      await service.addPeer(meetingId, {
        peerId,
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      });
    });

    it('应该成功移除 Peer 并清理资源', async () => {
      // Arrange
      const peer = service.getRoom(meetingId)?.peers.get(peerId);
      if (peer) {
        // 添加一些资源
        peer.producers.set('producer-001', mockProducer as any);
        peer.consumers.set('consumer-001', mockConsumer as any);
        peer.sendTransportId = 'transport-001';
        peer.recvTransportId = 'transport-002';

        const room = service.getRoom(meetingId);
        room?.transports.set('transport-001', mockTransport as any);
        room?.transports.set('transport-002', mockTransport as any);
      }

      // Act
      await service.removePeer(meetingId, peerId);

      // Assert
      const room = service.getRoom(meetingId);
      expect(room?.peers.has(peerId)).toBe(false);
      expect(mockProducer.close).toHaveBeenCalled();
      expect(mockConsumer.close).toHaveBeenCalled();
      expect(mockTransport.close).toHaveBeenCalledTimes(2);
    });

    it('房间不存在时应静默返回', async () => {
      // Act
      await service.removePeer('non-existent-meeting', peerId);

      // Assert - 不应抛出错误
      expect(true).toBe(true);
    });

    it('Peer 不存在时应静默返回', async () => {
      // Act
      await service.removePeer(meetingId, 'non-existent-peer');

      // Assert - 不应抛出错误
      expect(true).toBe(true);
    });

    it('房间为空时应关闭房间', async () => {
      // Arrange
      const closeRoomSpy = jest.spyOn(service, 'closeRoom');

      // Act
      await service.removePeer(meetingId, peerId);

      // Assert
      expect(closeRoomSpy).toHaveBeenCalledWith(meetingId);
    });
  });

  describe('createTransport', () => {
    let meetingId: string;
    let peerId: string;

    beforeEach(async () => {
      // 创建房间并添加 Peer
      meetingId = 'meeting-001';
      peerId = 'peer-001';

      mediasoupService.createRouter.mockResolvedValue(mockRouter as any);
      await service.getOrCreateRoom(meetingId);
      await service.addPeer(meetingId, {
        peerId,
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      });

      mockRouter.createWebRtcTransport.mockResolvedValue(mockTransport as any);
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'MEDIASOUP_ANNOUNCED_IP':
            return '192.168.1.100';
          case 'MEDIASOUP_INITIAL_BITRATE':
            return 2000000;
          default:
            return undefined;
        }
      });
    });

    it('应该成功创建发送 Transport', async () => {
      // Act
      const result = await service.createTransport(meetingId, peerId, 'send');

      // Assert
      expect(mockRouter.createWebRtcTransport).toHaveBeenCalledWith({
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: '192.168.1.100',
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 2000000,
        minimumAvailableOutgoingBitrate: 600000,
      });
      expect(result).toBe(mockTransport);

      const room = service.getRoom(meetingId);
      const peer = room?.peers.get(peerId);
      expect(peer?.sendTransportId).toBe('transport-001');
    });

    it('应该成功创建接收 Transport', async () => {
      // Act
      const result = await service.createTransport(meetingId, peerId, 'recv');

      // Assert
      const room = service.getRoom(meetingId);
      const peer = room?.peers.get(peerId);
      expect(peer?.recvTransportId).toBe('transport-001');
    });

    it('房间不存在时应抛出错误', async () => {
      // Act & Assert
      await expect(
        service.createTransport('non-existent-meeting', peerId, 'send')
      ).rejects.toThrow('Room not found');
    });

    it('Peer 不存在时应抛出错误', async () => {
      // Act & Assert
      await expect(
        service.createTransport(meetingId, 'non-existent-peer', 'send')
      ).rejects.toThrow('Peer not found');
    });
  });

  describe('createProducer', () => {
    let meetingId: string;
    let peerId: string;

    beforeEach(async () => {
      // 创建房间、Peer 和 Transport
      meetingId = 'meeting-001';
      peerId = 'peer-001';

      mediasoupService.createRouter.mockResolvedValue(mockRouter as any);
      await service.getOrCreateRoom(meetingId);
      await service.addPeer(meetingId, {
        peerId,
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      });

      mockRouter.createWebRtcTransport.mockResolvedValue(mockTransport as any);
      await service.createTransport(meetingId, peerId, 'send');

      mockTransport.produce.mockResolvedValue(mockProducer as any);
    });

    it('应该成功创建 Producer', async () => {
      // Arrange
      const rtpParameters = {
        codecs: [{ mimeType: 'video/VP8', clockRate: 90000 }],
        encodings: [{ maxBitrate: 1000000 }],
      };

      // Act
      const result = await service.createProducer(
        meetingId,
        peerId,
        'transport-001',
        'video',
        rtpParameters as any,
        { source: 'camera' }
      );

      // Assert
      expect(mockTransport.produce).toHaveBeenCalledWith({
        kind: 'video',
        rtpParameters,
        appData: { source: 'camera' },
      });
      expect(result).toBe(mockProducer);

      const room = service.getRoom(meetingId);
      const peer = room?.peers.get(peerId);
      expect(peer?.producers.has('producer-001')).toBe(true);
    });

    it('Transport 不存在时应抛出错误', async () => {
      // Act & Assert
      await expect(
        service.createProducer(meetingId, peerId, 'non-existent-transport', 'video', {} as any)
      ).rejects.toThrow('Transport not found');
    });
  });

  describe('createConsumer', () => {
    let meetingId: string;
    let producerPeerId: string;
    let consumerPeerId: string;

    beforeEach(async () => {
      // 创建房间和两个 Peer
      meetingId = 'meeting-001';
      producerPeerId = 'peer-producer';
      consumerPeerId = 'peer-consumer';

      mediasoupService.createRouter.mockResolvedValue(mockRouter as any);
      await service.getOrCreateRoom(meetingId);

      // 添加生产者 Peer
      await service.addPeer(meetingId, {
        peerId: producerPeerId,
        userId: 'user-producer',
        nickname: '生产者',
        socketId: 'socket-producer',
      });

      // 添加消费者 Peer
      await service.addPeer(meetingId, {
        peerId: consumerPeerId,
        userId: 'user-consumer',
        nickname: '消费者',
        socketId: 'socket-consumer',
      });

      // 为消费者创建接收 Transport
      mockRouter.createWebRtcTransport.mockResolvedValue(mockTransport as any);
      await service.createTransport(meetingId, consumerPeerId, 'recv');

      // 为生产者创建 Producer
      const producerPeer = service.getRoom(meetingId)?.peers.get(producerPeerId);
      if (producerPeer) {
        producerPeer.producers.set('producer-001', mockProducer as any);
      }

      mockTransport.consume.mockResolvedValue(mockConsumer as any);
    });

    it('应该成功创建 Consumer', async () => {
      // Arrange
      const rtpCapabilities = {
        codecs: [{ mimeType: 'video/VP8', clockRate: 90000 }],
      };

      // Act
      const result = await service.createConsumer(
        meetingId,
        consumerPeerId,
        'transport-001',
        'producer-001',
        rtpCapabilities as any
      );

      // Assert
      expect(mockTransport.consume).toHaveBeenCalledWith({
        producerId: 'producer-001',
        rtpCapabilities,
        paused: true,
      });
      expect(result).toBe(mockConsumer);

      const room = service.getRoom(meetingId);
      const consumerPeer = room?.peers.get(consumerPeerId);
      expect(consumerPeer?.consumers.has('consumer-001')).toBe(true);
    });

    it('Producer 不存在时应抛出错误', async () => {
      // Act & Assert
      await expect(
        service.createConsumer(meetingId, consumerPeerId, 'transport-001', 'non-existent-producer', {} as any)
      ).rejects.toThrow('Producer not found');
    });
  });

  describe('getRoomProducers', () => {
    it('应该返回房间内所有 Producer 列表', () => {
      // Arrange
      const meetingId = 'meeting-001';
      const room: RoomInfo = {
        meetingId,
        router: mockRouter as any,
        peers: new Map(),
        transports: new Map(),
        createdAt: new Date(),
      };

      // 添加两个 Peer，每个都有 Producer
      const peer1: PeerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
        producers: new Map([['producer-001', mockProducer as any]]),
        consumers: new Map(),
      };

      const peer2: PeerInfo = {
        peerId: 'peer-002',
        userId: 'user-002',
        nickname: '李四',
        socketId: 'socket-002',
        producers: new Map([['producer-002', mockProducer as any]]),
        consumers: new Map(),
      };

      room.peers.set('peer-001', peer1);
      room.peers.set('peer-002', peer2);
      (service as any).rooms.set(meetingId, room);

      // Act
      const result = service.getRoomProducers(meetingId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            producerId: 'producer-001',
            peerId: 'peer-001',
            kind: 'video',
          }),
          expect.objectContaining({
            producerId: 'producer-002',
            peerId: 'peer-002',
            kind: 'video',
          }),
        ])
      );
    });

    it('房间不存在时应返回空数组', () => {
      // Act
      const result = service.getRoomProducers('non-existent-meeting');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getRoomStats', () => {
    it('应该返回房间统计信息', () => {
      // Arrange
      const meetingId = 'meeting-001';
      const room: RoomInfo = {
        meetingId,
        router: mockRouter as any,
        peers: new Map(),
        transports: new Map([
          ['transport-001', mockTransport as any],
          ['transport-002', mockTransport as any],
        ]),
        createdAt: new Date(),
      };

      // 添加有 Producer 和 Consumer 的 Peer
      const peer: PeerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
        producers: new Map([
          ['producer-001', mockProducer as any],
          ['producer-002', mockProducer as any],
        ]),
        consumers: new Map([['consumer-001', mockConsumer as any]]),
      };

      room.peers.set('peer-001', peer);
      (service as any).rooms.set(meetingId, room);

      // Act
      const result = service.getRoomStats(meetingId);

      // Assert
      expect(result).toEqual({
        peerCount: 1,
        producerCount: 2,
        consumerCount: 1,
        transportCount: 2,
      });
    });

    it('房间不存在时应返回零统计', () => {
      // Act
      const result = service.getRoomStats('non-existent-meeting');

      // Assert
      expect(result).toEqual({
        peerCount: 0,
        producerCount: 0,
        consumerCount: 0,
        transportCount: 0,
      });
    });
  });

  describe('closeRoom', () => {
    it('应该关闭房间并清理所有资源', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const room: RoomInfo = {
        meetingId,
        router: mockRouter as any,
        peers: new Map(),
        transports: new Map(),
        createdAt: new Date(),
      };

      // 添加一个 Peer
      const peer: PeerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
        producers: new Map([['producer-001', mockProducer as any]]),
        consumers: new Map([['consumer-001', mockConsumer as any]]),
      };

      room.peers.set('peer-001', peer);
      (service as any).rooms.set(meetingId, room);

      const removePeerSpy = jest.spyOn(service, 'removePeer');

      // Act
      await service.closeRoom(meetingId);

      // Assert
      expect(removePeerSpy).toHaveBeenCalledWith(meetingId, 'peer-001');
      expect(mockRouter.close).toHaveBeenCalled();
      expect((service as any).rooms.has(meetingId)).toBe(false);
    });

    it('房间不存在时应静默返回', async () => {
      // Act
      await service.closeRoom('non-existent-meeting');

      // Assert - 不应抛出错误
      expect(true).toBe(true);
    });
  });
});