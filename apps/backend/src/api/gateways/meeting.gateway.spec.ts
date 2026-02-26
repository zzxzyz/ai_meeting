import { Test, TestingModule } from '@nestjs/testing';
import { MeetingGateway } from './meeting.gateway';
import { RoomService } from '@/application/services/room.service';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

// Mock socket.io server
const mockServer = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Mock socket client
const mockClient = {
  id: 'socket-001',
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Mock room service
const mockRoomService = {
  getOrCreateRoom: jest.fn().mockResolvedValue({
    meetingId: 'meeting-001',
    router: {
      rtpCapabilities: {
        codecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
          },
        ],
      },
    },
    peers: new Map(),
    transports: new Map(),
  }),
  getRoom: jest.fn().mockImplementation((meetingId: string) => {
    return {
      meetingId: 'meeting-001',
      router: {
        rtpCapabilities: {
          codecs: [
            {
              kind: 'audio',
              mimeType: 'audio/opus',
              clockRate: 48000,
              channels: 2,
            },
          ],
        },
      },
      peers: new Map(),
      transports: new Map([
        ['transport-001', {
          id: 'transport-001',
          connect: jest.fn().mockResolvedValue(undefined),
        }],
      ]),
    };
  }),
  addPeer: jest.fn().mockResolvedValue({
    peerId: 'peer-001',
    userId: 'user-001',
    nickname: '张三',
    socketId: 'socket-001',
    producers: new Map(),
    consumers: new Map(),
  }),
  removePeer: jest.fn().mockResolvedValue(undefined),
  createTransport: jest.fn().mockResolvedValue({
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
  }),
  createProducer: jest.fn().mockResolvedValue({
    id: 'producer-001',
    kind: 'video',
    rtpParameters: {
      codecs: [],
      encodings: [],
      headerExtensions: [],
    },
    appData: { source: 'camera' },
  }),
  createConsumer: jest.fn().mockResolvedValue({
    id: 'consumer-001',
    producerId: 'producer-001',
    kind: 'video',
    rtpParameters: {
      codecs: [],
      encodings: [],
      headerExtensions: [],
    },
    type: 'simulcast',
    producerPaused: false,
  }),
  getRoomProducers: jest.fn().mockReturnValue([
    {
      producerId: 'producer-002',
      peerId: 'peer-002',
      kind: 'audio',
      appData: { source: 'microphone' },
    },
  ]),
};

// Mock mediasoup service
const mockMediasoupService = {
  createRouter: jest.fn().mockResolvedValue({
    rtpCapabilities: {
      codecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
      ],
    },
  }),
};

describe('MeetingGateway', () => {
  let gateway: MeetingGateway;
  let roomService: RoomService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingGateway,
        {
          provide: RoomService,
          useValue: mockRoomService,
        },
        {
          provide: MediasoupService,
          useValue: mockMediasoupService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'MEDIASOUP_MAX_PEERS_PER_ROOM': 4,
                'MEDIASOUP_ANNOUNCED_IP': '127.0.0.1',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<MeetingGateway>(MeetingGateway);
    roomService = module.get<RoomService>(RoomService);

    // Set up WebSocket server mock
    gateway['server'] = mockServer as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('RTC 信令处理', () => {
    beforeEach(async () => {
      // 先让客户端加入房间，建立映射关系
      const joinData = { meetingId: 'meeting-001' };
      await gateway.handleRtcJoin(mockClient as any, joinData);
    });

    describe('rtc:join - 加入音视频房间', () => {
      it('应该成功加入房间并返回 peerId', async () => {
        const data = {
          meetingId: 'meeting-001',
        };

        const result = await gateway.handleRtcJoin(mockClient as any, data);

        expect(result.peerId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
        expect(result.peers).toEqual([]);
        expect(mockRoomService.getOrCreateRoom).toHaveBeenCalledWith('meeting-001');
        expect(mockRoomService.addPeer).toHaveBeenCalledWith('meeting-001', {
          peerId: expect.any(String),
          userId: undefined,
          nickname: undefined,
          socketId: 'socket-001',
        });
      });

      it('应该包含房间内已有 peers 信息', async () => {
        // Mock existing peers
        mockRoomService.getOrCreateRoom.mockResolvedValueOnce({
          meetingId: 'meeting-001',
          router: { rtpCapabilities: {} },
          peers: new Map([
            ['peer-002', {
              peerId: 'peer-002',
              userId: 'user-002',
              nickname: '李四',
              socketId: 'socket-002',
              producers: new Map([
                ['producer-002', { id: 'producer-002', kind: 'audio', appData: undefined }],
              ]),
              consumers: new Map(),
            }],
          ]),
          transports: new Map(),
        });

        const data = { meetingId: 'meeting-001' };
        const result = await gateway.handleRtcJoin(mockClient as any, data);

        expect(result.peers).toHaveLength(1);
        expect(result.peers[0]).toEqual({
          peerId: 'peer-002',
          userId: 'user-002',
          nickname: '李四',
          producers: [
            {
              id: 'producer-002',
              kind: 'audio',
              appData: undefined,
            },
          ],
        });
      });
    });

    describe('rtc:getRouterRtpCapabilities - 获取路由器 RTP 能力', () => {
      it('应该返回路由器的 RTP 能力', async () => {
        const data = { meetingId: 'meeting-001' };
        const result = await gateway.handleGetRouterRtpCapabilities(mockClient as any, data);

        expect(result).toEqual({
          rtpCapabilities: {
            codecs: [
              {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
              },
            ],
          },
        });
      });
    });

    describe('rtc:createTransport - 创建 Transport', () => {
      it('应该成功创建发送 Transport', async () => {
        const data = {
          meetingId: 'meeting-001',
          direction: 'send' as const,
        };

        const result = await gateway.handleCreateTransport(mockClient as any, data);

        expect(result.transportId).toBe('transport-001');
        expect(result.iceParameters).toEqual({
          usernameFragment: 'test-user',
          password: 'test-password',
        });
        expect(result.iceCandidates).toHaveLength(1);
        expect(result.dtlsParameters).toEqual({
          role: 'auto',
          fingerprints: [
            {
              algorithm: 'sha-256',
              value: 'test-fingerprint',
            },
          ],
        });
        expect(mockRoomService.createTransport).toHaveBeenCalledWith(
          'meeting-001',
          expect.any(String),
          'send'
        );
      });

      it('应该成功创建接收 Transport', async () => {
        const data = {
          meetingId: 'meeting-001',
          direction: 'recv' as const,
        };

        await gateway.handleCreateTransport(mockClient as any, data);

        expect(mockRoomService.createTransport).toHaveBeenCalledWith(
          'meeting-001',
          expect.any(String),
          'recv'
        );
      });
    });

    describe('rtc:connectTransport - 连接 Transport', () => {
      it('应该成功连接 Transport', async () => {
        const data = {
          meetingId: 'meeting-001',
          transportId: 'transport-001',
          dtlsParameters: {
            role: 'client',
            fingerprints: [],
          },
        };

        const result = await gateway.handleConnectTransport(mockClient as any, data);

        expect(result).toEqual({
          transportId: 'transport-001',
        });
      });
    });

    describe('rtc:produce - 发布媒体流', () => {
      it('应该成功创建 Producer', async () => {
        const data = {
          meetingId: 'meeting-001',
          transportId: 'transport-001',
          kind: 'video' as const,
          rtpParameters: {
            codecs: [],
            encodings: [],
            headerExtensions: [],
          },
          appData: { source: 'camera' },
        };

        const result = await gateway.handleProduce(mockClient as any, data);

        expect(result).toEqual({
          producerId: 'producer-001',
        });
        expect(mockRoomService.createProducer).toHaveBeenCalledWith(
          'meeting-001',
          expect.any(String),
          'transport-001',
          'video',
          data.rtpParameters,
          { source: 'camera' }
        );
      });
    });

    describe('rtc:consume - 订阅媒体流', () => {
      it('应该成功创建 Consumer', async () => {
        const data = {
          meetingId: 'meeting-001',
          producerId: 'producer-001',
          rtpCapabilities: {
            codecs: [],
            headerExtensions: [],
          },
        };

        const result = await gateway.handleConsume(mockClient as any, data);

        expect(result).toEqual({
          consumerId: 'consumer-001',
          producerId: 'producer-001',
          kind: 'video',
          rtpParameters: {
            codecs: [],
            encodings: [],
            headerExtensions: [],
          },
          type: 'simulcast',
          producerPaused: false,
        });
      });
    });

    describe('rtc:leave - 离开音视频房间', () => {
      it('应该成功移除 Peer 并清理资源', async () => {
        const data = { meetingId: 'meeting-001' };

        const result = await gateway.handleRtcLeave(mockClient as any, data);

        expect(result.peerId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
        expect(mockRoomService.removePeer).toHaveBeenCalledWith(
          'meeting-001',
          expect.any(String)
        );
      });
    });
  });

  describe('广播事件', () => {
    it('应该广播新 Producer 事件', async () => {
      const meetingId = 'meeting-001';
      const producerInfo = {
        producerId: 'producer-001',
        peerId: 'peer-001',
        kind: 'video' as const,
        appData: { source: 'camera' },
      };

      await gateway.notifyNewProducer(meetingId, producerInfo);

      expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
      expect(mockServer.emit).toHaveBeenCalledWith('rtc:newProducer', producerInfo);
    });

    it('应该广播 Producer 关闭事件', async () => {
      const meetingId = 'meeting-001';
      const producerInfo = {
        producerId: 'producer-001',
        peerId: 'peer-001',
      };

      await gateway.notifyProducerClosed(meetingId, producerInfo);

      expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
      expect(mockServer.emit).toHaveBeenCalledWith('rtc:producerClosed', producerInfo);
    });

    it('应该广播 Peer 加入事件', async () => {
      const meetingId = 'meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
        nickname: '张三',
      };

      await gateway.notifyPeerJoined(meetingId, peerInfo);

      expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
      expect(mockServer.emit).toHaveBeenCalledWith('rtc:peerJoined', peerInfo);
    });

    it('应该广播 Peer 离开事件', async () => {
      const meetingId = 'meeting-001';
      const peerInfo = {
        peerId: 'peer-001',
        userId: 'user-001',
      };

      await gateway.notifyPeerLeft(meetingId, peerInfo);

      expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
      expect(mockServer.emit).toHaveBeenCalledWith('rtc:peerLeft', peerInfo);
    });
  });

  describe('错误处理', () => {
    it('应该处理房间不存在错误', async () => {
      mockRoomService.getOrCreateRoom.mockRejectedValueOnce(new Error('Room not found'));

      const data = { meetingId: 'non-existent-meeting' };

      await expect(gateway.handleRtcJoin(mockClient as any, data)).rejects.toThrow('Room not found');
    });

    it('应该处理房间已满错误', async () => {
      mockRoomService.addPeer.mockRejectedValueOnce(new Error('Room is full'));

      const data = { meetingId: 'meeting-001' };

      await expect(gateway.handleRtcJoin(mockClient as any, data)).rejects.toThrow('Room is full');
    });
  });
});