import { Test, TestingModule } from '@nestjs/testing';
import { RoomService } from './room.service';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';
import { ConfigService } from '@nestjs/config';

// Mock mediasoup types
const mockRouter = {
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
};

const mockTransport = {
  id: 'transport-001',
  iceParameters: {
    usernameFragment: 'test-user',
    password: 'test-password',
  },
  iceCandidates: [
    {
      foundation: '1',
      priority: 2122260223,
      ip: '127.0.0.1',
      protocol: 'udp',
      port: 40000,
      type: 'host',
    },
  ],
  dtlsParameters: {
    role: 'auto',
    fingerprints: [
      {
        algorithm: 'sha-256',
        value: 'test-fingerprint',
      },
    ],
  },
  close: jest.fn(),
  connect: jest.fn(),
};

const mockProducer = {
  id: 'producer-001',
  kind: 'video',
  rtpParameters: {
    codecs: [],
    encodings: [],
    headerExtensions: [],
  },
  appData: {},
  close: jest.fn(),
};

const mockConsumer = {
  id: 'consumer-001',
  producerId: 'producer-001',
  kind: 'video',
  rtpParameters: {
    codecs: [],
    encodings: [],
    headerExtensions: [],
  },
  close: jest.fn(),
  resume: jest.fn(),
};

describe('RoomService', () => {
  let service: RoomService;
  let mediasoupService: MediasoupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: MediasoupService,
          useValue: {
            createRouter: jest.fn().mockResolvedValue(mockRouter),
            getNextWorker: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'MEDIASOUP_MAX_PEERS_PER_ROOM': 4,
                'MEDIASOUP_INITIAL_BITRATE': 1000000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
    mediasoupService = module.get<MediasoupService>(MediasoupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateRoom', () => {
    it('should create new room when not exists', async () => {
      const meetingId = 'test-meeting-001';
      const room = await service.getOrCreateRoom(meetingId);

      expect(room).toBeDefined();
      expect(room.meetingId).toBe(meetingId);
      expect(room.router).toBe(mockRouter);
      expect(room.peers.size).toBe(0);
      expect(room.transports.size).toBe(0);
      expect(mediasoupService.createRouter).toHaveBeenCalled();
    });

    it('should return existing room when already created', async () => {
      const meetingId = 'test-meeting-001';
      const room1 = await service.getOrCreateRoom(meetingId);
      const room2 = await service.getOrCreateRoom(meetingId);

      expect(room1).toBe(room2);
      expect(mediasoupService.createRouter).toHaveBeenCalledTimes(1);
    });
  });

  describe('addPeer', () => {
    it('should add peer to room', async () => {
      const meetingId = 'test-meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      await service.getOrCreateRoom(meetingId);
      const peer = await service.addPeer(meetingId, peerInfo);

      expect(peer).toBeDefined();
      expect(peer.peerId).toBe('peer-001');
      expect(peer.userId).toBe('user-001');
      expect(peer.nickname).toBe('张三');
      expect(peer.socketId).toBe('socket-001');
    });

    it('should throw error when room not found', async () => {
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      await expect(
        service.addPeer('non-existent-meeting', peerInfo),
      ).rejects.toThrow('Room not found');
    });

    it('should throw error when room is full', async () => {
      const meetingId = 'test-meeting-001';
      await service.getOrCreateRoom(meetingId);

      // Add 4 peers (max capacity)
      for (let i = 1; i <= 4; i++) {
        await service.addPeer(meetingId, {
          peerId: `peer-${i}`,
          userId: `user-${i}`,
          nickname: `用户${i}`,
          socketId: `socket-${i}`,
        });
      }

      // Try to add 5th peer
      await expect(
        service.addPeer(meetingId, {
          peerId: 'peer-5',
          userId: 'user-5',
          nickname: '用户5',
          socketId: 'socket-5',
        }),
      ).rejects.toThrow('Room is full');
    });
  });

  describe('removePeer', () => {
    it('should remove peer from room', async () => {
      const meetingId = 'test-meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      await service.getOrCreateRoom(meetingId);
      await service.addPeer(meetingId, peerInfo);

      const room = service.getRoom(meetingId);
      expect(room?.peers.size).toBe(1);

      await service.removePeer(meetingId, 'peer-001');
      expect(room?.peers.size).toBe(0);
    });

    it('should cleanup peer resources when removing', async () => {
      const meetingId = 'test-meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      await service.getOrCreateRoom(meetingId);
      const peer = await service.addPeer(meetingId, peerInfo);

      // Mock peer resources
      peer.sendTransportId = 'send-transport-001';
      peer.recvTransportId = 'recv-transport-001';
      peer.producers.set('producer-001', mockProducer as any);
      peer.consumers.set('consumer-001', mockConsumer as any);

      await service.removePeer(meetingId, 'peer-001');

      expect(mockProducer.close).toHaveBeenCalled();
      expect(mockConsumer.close).toHaveBeenCalled();
    });
  });

  describe('createTransport', () => {
    it('should create transport for peer', async () => {
      const meetingId = 'test-meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      };

      await service.getOrCreateRoom(meetingId);
      const peer = await service.addPeer(meetingId, peerInfo);

      // Mock router.createWebRtcTransport
      mockRouter.createWebRtcTransport = jest.fn().mockResolvedValue(mockTransport);

      const transport = await service.createTransport(meetingId, 'peer-001', 'send');

      expect(transport).toBeDefined();
      expect(transport.id).toBe('transport-001');
      expect(peer.sendTransportId).toBe('transport-001');
    });

    it('should throw error when peer not found', async () => {
      const meetingId = 'test-meeting-001';
      await service.getOrCreateRoom(meetingId);

      await expect(
        service.createTransport(meetingId, 'non-existent-peer', 'send'),
      ).rejects.toThrow('Peer not found');
    });
  });

  describe('getRoom', () => {
    it('should return room when exists', async () => {
      const meetingId = 'test-meeting-001';
      await service.getOrCreateRoom(meetingId);

      const room = service.getRoom(meetingId);
      expect(room).toBeDefined();
      expect(room?.meetingId).toBe(meetingId);
    });

    it('should return undefined when room not exists', () => {
      const room = service.getRoom('non-existent-meeting');
      expect(room).toBeUndefined();
    });
  });

  describe('closeRoom', () => {
    it('should close room and cleanup resources', async () => {
      const meetingId = 'test-meeting-001';
      await service.getOrCreateRoom(meetingId);

      // Add a peer with resources
      const peer = await service.addPeer(meetingId, {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
        socketId: 'socket-001',
      });

      peer.producers.set('producer-001', mockProducer as any);
      peer.consumers.set('consumer-001', mockConsumer as any);

      await service.closeRoom(meetingId);

      expect(mockRouter.close).toHaveBeenCalled();
      expect(mockProducer.close).toHaveBeenCalled();
      expect(mockConsumer.close).toHaveBeenCalled();

      const room = service.getRoom(meetingId);
      expect(room).toBeUndefined();
    });
  });
});