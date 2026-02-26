import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomService } from '@/application/services/room.service';
import { MeetingGateway } from '@/api/gateways/meeting.gateway';
import * as uuid from 'uuid';

// Mock uuid 模块
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('MeetingGateway', () => {
  let gateway: MeetingGateway;
  let roomService: jest.Mocked<RoomService>;
  let mockServer: jest.Mocked<Server>;
  let mockClient: jest.Mocked<Socket>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingGateway,
        {
          provide: RoomService,
          useValue: {
            getOrCreateRoom: jest.fn(),
            addPeer: jest.fn(),
            removePeer: jest.fn(),
            getRoom: jest.fn(),
            createTransport: jest.fn(),
            createProducer: jest.fn(),
            createConsumer: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<MeetingGateway>(MeetingGateway);
    roomService = module.get(RoomService);

    // Mock WebSocket Server 和 Client
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    mockClient = {
      id: 'client-001',
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    gateway.server = mockServer;

    // Mock Logger
    gateway['logger'] = {
      log: jest.fn(),
    } as any;

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('应该记录客户端连接日志', () => {
      // Act
      gateway.handleConnection(mockClient);

      // Assert
      expect(gateway['logger'].log).toHaveBeenCalledWith('客户端连接: client-001');
    });
  });

  describe('handleDisconnect', () => {
    it('应该清理客户端关联的 Peer', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';

      // 设置客户端映射
      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });

      // Mock handleRtcLeave 方法
      const handleRtcLeaveSpy = jest.spyOn(gateway, 'handleRtcLeave').mockResolvedValue({ peerId });

      // Act
      gateway.handleDisconnect(mockClient);

      // Assert
      expect(handleRtcLeaveSpy).toHaveBeenCalledWith(mockClient, { meetingId });
      expect(gateway['clientPeerMap'].has(mockClient.id)).toBe(false);
    });

    it('客户端未加入房间时应静默处理', () => {
      // Act
      gateway.handleDisconnect(mockClient);

      // Assert - 不应抛出错误
      expect(gateway['clientPeerMap'].has(mockClient.id)).toBe(false);
    });
  });

  describe('handleJoinRoom', () => {
    it('应该成功加入会议房间', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const data = { meetingId };

      // Act
      await gateway.handleJoinRoom(mockClient, data);

      // Assert
      expect(mockClient.join).toHaveBeenCalledWith('meeting:meeting-001');
      expect(gateway['logger'].log).toHaveBeenCalledWith(
        '客户端 client-001 加入房间 meeting:meeting-001'
      );
    });
  });

  describe('handleLeaveRoom', () => {
    it('应该成功离开会议房间', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const data = { meetingId };

      // Act
      await gateway.handleLeaveRoom(mockClient, data);

      // Assert
      expect(mockClient.leave).toHaveBeenCalledWith('meeting:meeting-001');
      expect(gateway['logger'].log).toHaveBeenCalledWith(
        '客户端 client-001 离开房间 meeting:meeting-001'
      );
    });
  });

  describe('handleRtcJoin', () => {
    it('应该成功加入音视频房间', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const data: any = {
        meetingId,
        userId: 'user-001',
        nickname: '张三',
      };

      const mockRoom = {
        meetingId,
        router: { rtpCapabilities: {} },
        peers: new Map([
          ['existing-peer', {
            peerId: 'existing-peer',
            userId: 'user-002',
            nickname: '李四',
            producers: new Map([
              ['producer-001', { id: 'producer-001', kind: 'video', appData: {} }]
            ]),
          }],
        ]),
        transports: new Map(),
        createdAt: new Date(),
      };

      (uuid.v4 as jest.Mock).mockReturnValue(peerId);
      roomService.getOrCreateRoom.mockResolvedValue(mockRoom as any);
      roomService.addPeer.mockResolvedValue({
        peerId,
        userId: data.userId,
        nickname: data.nickname,
        socketId: mockClient.id,
        producers: new Map(),
        consumers: new Map(),
      } as any);

      // Mock 广播方法
      const notifyPeerJoinedSpy = jest.spyOn(gateway, 'notifyPeerJoined').mockResolvedValue();

      // Act
      const result = await gateway.handleRtcJoin(mockClient, data);

      // Assert
      expect(roomService.getOrCreateRoom).toHaveBeenCalledWith(meetingId);
      expect(roomService.addPeer).toHaveBeenCalledWith(meetingId, {
        peerId,
        userId: data.userId,
        nickname: data.nickname,
        socketId: mockClient.id,
      });
      expect(gateway['clientPeerMap'].get(mockClient.id)).toEqual({ meetingId, peerId });
      expect(notifyPeerJoinedSpy).toHaveBeenCalledWith(meetingId, {
        peerId,
        userId: data.userId,
        nickname: data.nickname,
      });
      expect(result).toEqual({
        peerId,
        peers: [
          {
            peerId: 'existing-peer',
            userId: 'user-002',
            nickname: '李四',
            producers: [
              { id: 'producer-001', kind: 'video', appData: {} }
            ],
          },
        ],
      });
    });
  });

  describe('handleGetRouterRtpCapabilities', () => {
    it('应该返回路由器的 RTP 能力', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const data = { meetingId };
      const mockRtpCapabilities = {
        codecs: [{ mimeType: 'video/VP8', clockRate: 90000 }],
      };

      const mockRoom = {
        meetingId,
        router: { rtpCapabilities: mockRtpCapabilities },
        peers: new Map(),
        transports: new Map(),
        createdAt: new Date(),
      };

      roomService.getOrCreateRoom.mockResolvedValue(mockRoom as any);

      // Act
      const result = await gateway.handleGetRouterRtpCapabilities(mockClient, data);

      // Assert
      expect(result).toEqual({
        rtpCapabilities: mockRtpCapabilities,
      });
    });
  });

  describe('handleCreateTransport', () => {
    it('应该成功创建 Transport', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const data: any = {
        meetingId,
        direction: 'send' as const,
      };

      const mockTransport = {
        id: 'transport-001',
        iceParameters: { usernameFragment: 'test', password: 'test' },
        iceCandidates: [{ ip: '127.0.0.1', port: 40000 }],
        dtlsParameters: { role: 'auto', fingerprints: [] },
      };

      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });
      roomService.createTransport.mockResolvedValue(mockTransport as any);

      // Act
      const result = await gateway.handleCreateTransport(mockClient, data);

      // Assert
      expect(roomService.createTransport).toHaveBeenCalledWith(
        meetingId,
        peerId,
        'send'
      );
      expect(result).toEqual({
        transportId: 'transport-001',
        iceParameters: mockTransport.iceParameters,
        iceCandidates: mockTransport.iceCandidates,
        dtlsParameters: mockTransport.dtlsParameters,
      });
    });

    it('客户端未加入房间时应抛出错误', async () => {
      // Arrange
      const data: any = {
        meetingId: 'meeting-001',
        direction: 'send',
      };

      // Act & Assert
      await expect(
        gateway.handleCreateTransport(mockClient, data)
      ).rejects.toThrow('Client not joined any room');
    });
  });

  describe('handleConnectTransport', () => {
    it('应该成功连接 Transport', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const transportId = 'transport-001';
      const data: any = {
        meetingId,
        transportId,
        dtlsParameters: { role: 'client', fingerprints: [] },
      };

      const mockRoom = {
        meetingId,
        router: {},
        peers: new Map(),
        transports: new Map([[transportId, { connect: jest.fn() }]]),
        createdAt: new Date(),
      };

      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });
      roomService.getRoom.mockReturnValue(mockRoom as any);

      // Act
      const result = await gateway.handleConnectTransport(mockClient, data);

      // Assert
      const transport = mockRoom.transports.get(transportId);
      expect(transport?.connect).toHaveBeenCalledWith({
        dtlsParameters: data.dtlsParameters,
      });
      expect(result).toEqual({ transportId });
    });

    it('Transport 不存在时应抛出错误', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const data: any = {
        meetingId,
        transportId: 'non-existent-transport',
        dtlsParameters: {},
      };

      const mockRoom = {
        meetingId,
        router: {},
        peers: new Map(),
        transports: new Map(),
        createdAt: new Date(),
      };

      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });
      roomService.getRoom.mockReturnValue(mockRoom as any);

      // Act & Assert
      await expect(
        gateway.handleConnectTransport(mockClient, data)
      ).rejects.toThrow('Transport not found');
    });
  });

  describe('handleProduce', () => {
    it('应该成功创建 Producer', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const transportId = 'transport-001';
      const data: any = {
        meetingId,
        transportId,
        kind: 'video' as const,
        rtpParameters: { codecs: [] },
        appData: { source: 'camera' },
      };

      const mockProducer = { id: 'producer-001' };

      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });
      roomService.createProducer.mockResolvedValue(mockProducer as any);

      // Mock 广播方法
      const notifyNewProducerSpy = jest.spyOn(gateway, 'notifyNewProducer').mockResolvedValue();

      // Act
      const result = await gateway.handleProduce(mockClient, data);

      // Assert
      expect(roomService.createProducer).toHaveBeenCalledWith(
        meetingId,
        peerId,
        transportId,
        'video',
        data.rtpParameters,
        data.appData
      );
      expect(notifyNewProducerSpy).toHaveBeenCalledWith(meetingId, {
        producerId: 'producer-001',
        peerId,
        kind: 'video',
        appData: { source: 'camera' },
      });
      expect(result).toEqual({ producerId: 'producer-001' });
    });
  });

  describe('handleConsume', () => {
    it('应该成功创建 Consumer', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const producerId = 'producer-002';
      const data: any = {
        meetingId,
        producerId,
        rtpCapabilities: { codecs: [] },
      };

      const mockConsumer = {
        id: 'consumer-001',
        producerId: 'producer-002',
        kind: 'video' as const,
        rtpParameters: {},
        type: 'simulcast',
        producerPaused: false,
      };

      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });
      roomService.createConsumer.mockResolvedValue(mockConsumer as any);

      // Act
      const result = await gateway.handleConsume(mockClient, data);

      // Assert
      expect(roomService.createConsumer).toHaveBeenCalledWith(
        meetingId,
        peerId,
        peerId === producerId ? 'send' : 'recv',
        producerId,
        data.rtpCapabilities
      );
      expect(result).toEqual({
        consumerId: 'consumer-001',
        producerId: 'producer-002',
        kind: 'video',
        rtpParameters: {},
        type: 'simulcast',
        producerPaused: false,
      });
    });
  });

  describe('handleRtcLeave', () => {
    it('应该成功离开音视频房间', async () => {
      // Arrange
      const meetingId = 'meeting-001';
      const peerId = 'peer-001';
      const data = { meetingId };

      gateway['clientPeerMap'].set(mockClient.id, { meetingId, peerId });

      // Mock 广播方法
      const notifyPeerLeftSpy = jest.spyOn(gateway, 'notifyPeerLeft').mockResolvedValue();

      // Act
      const result = await gateway.handleRtcLeave(mockClient, data);

      // Assert
      expect(notifyPeerLeftSpy).toHaveBeenCalledWith(meetingId, {
        peerId,
        userId: peerId, // 简化处理
      });
      expect(roomService.removePeer).toHaveBeenCalledWith(meetingId, peerId);
      expect(gateway['clientPeerMap'].has(mockClient.id)).toBe(false);
      expect(result).toEqual({ peerId });
    });

    it('客户端未加入房间时应静默返回', async () => {
      // Arrange
      const data = { meetingId: 'meeting-001' };

      // Act
      const result = await gateway.handleRtcLeave(mockClient, data);

      // Assert
      expect(result).toEqual({ peerId: '' });
    });
  });

  describe('广播方法', () => {
    describe('notifyMeetingEnded', () => {
      it('应该广播会议结束事件', async () => {
        // Arrange
        const payload: any = {
          meetingId: 'meeting-001',
          meetingNumber: '123456789',
          endedBy: 'user-001',
          endedAt: new Date(),
          durationSeconds: 3600,
        };

        // Act
        await gateway.notifyMeetingEnded(payload);

        // Assert
        expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
        expect(mockServer.emit).toHaveBeenCalledWith('meeting.ended', payload);
      });
    });

    describe('notifyParticipantJoined', () => {
      it('应该广播参与者加入事件', async () => {
        // Arrange
        const payload: any = {
          meetingId: 'meeting-001',
          participant: {
            userId: 'user-001',
            nickname: '张三',
            joinedAt: new Date(),
          },
        };

        // Act
        await gateway.notifyParticipantJoined(payload);

        // Assert
        expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
        expect(mockServer.emit).toHaveBeenCalledWith('meeting.participant_joined', payload);
      });
    });

    describe('notifyNewProducer', () => {
      it('应该广播新 Producer 事件', async () => {
        // Arrange
        const meetingId = 'meeting-001';
        const payload: any = {
          producerId: 'producer-001',
          peerId: 'peer-001',
          kind: 'video',
          appData: { source: 'camera' },
        };

        // Act
        await gateway.notifyNewProducer(meetingId, payload);

        // Assert
        expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
        expect(mockServer.emit).toHaveBeenCalledWith('rtc:newProducer', payload);
      });
    });

    describe('notifyProducerClosed', () => {
      it('应该广播 Producer 关闭事件', async () => {
        // Arrange
        const meetingId = 'meeting-001';
        const payload: any = {
          producerId: 'producer-001',
          peerId: 'peer-001',
        };

        // Act
        await gateway.notifyProducerClosed(meetingId, payload);

        // Assert
        expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
        expect(mockServer.emit).toHaveBeenCalledWith('rtc:producerClosed', payload);
      });
    });

    describe('notifyPeerJoined', () => {
      it('应该广播 Peer 加入事件', async () => {
        // Arrange
        const meetingId = 'meeting-001';
        const payload: any = {
          peerId: 'peer-001',
          userId: 'user-001',
          nickname: '张三',
        };

        // Act
        await gateway.notifyPeerJoined(meetingId, payload);

        // Assert
        expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
        expect(mockServer.emit).toHaveBeenCalledWith('rtc:peerJoined', payload);
      });
    });

    describe('notifyPeerLeft', () => {
      it('应该广播 Peer 离开事件', async () => {
        // Arrange
        const meetingId = 'meeting-001';
        const payload: any = {
          peerId: 'peer-001',
          userId: 'user-001',
        };

        // Act
        await gateway.notifyPeerLeft(meetingId, payload);

        // Assert
        expect(mockServer.to).toHaveBeenCalledWith('meeting:meeting-001');
        expect(mockServer.emit).toHaveBeenCalledWith('rtc:peerLeft', payload);
      });
    });
  });
});