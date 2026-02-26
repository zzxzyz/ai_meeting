import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { RoomService } from '@/application/services/room.service';
import { v4 as uuidv4 } from 'uuid';

export interface MeetingEndedPayload {
  meetingId: string;
  meetingNumber: string;
  endedBy: string;
  endedAt: Date;
  durationSeconds: number;
}

export interface ParticipantJoinedPayload {
  meetingId: string;
  participant: {
    userId: string;
    nickname: string;
    joinedAt: Date;
  };
}

export interface RtcJoinRequest {
  meetingId: string;
  userId?: string;
  nickname?: string;
}

export interface RtcJoinResponse {
  peerId: string;
  peers: Array<{
    peerId: string;
    userId: string;
    nickname: string;
    producers: Array<{
      id: string;
      kind: 'audio' | 'video';
      appData?: any;
    }>;
  }>;
}

export interface CreateTransportRequest {
  meetingId: string;
  direction: 'send' | 'recv';
}

export interface ConnectTransportRequest {
  meetingId: string;
  transportId: string;
  dtlsParameters: any;
}

export interface ProduceRequest {
  meetingId: string;
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  appData?: any;
}

export interface ConsumeRequest {
  meetingId: string;
  producerId: string;
  rtpCapabilities: any;
}

export interface NewProducerPayload {
  producerId: string;
  peerId: string;
  kind: 'audio' | 'video';
  appData?: any;
}

export interface ProducerClosedPayload {
  producerId: string;
  peerId: string;
}

export interface PeerJoinedPayload {
  peerId: string;
  userId: string;
  nickname: string;
}

export interface PeerLeftPayload {
  peerId: string;
  userId: string;
}

/**
 * 会议 WebSocket Gateway
 * 负责向会议房间内的参与者推送实时事件和 RTC 信令处理
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
})
export class MeetingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingGateway.name);

  // 存储客户端与 Peer 的映射关系
  private clientPeerMap: Map<string, { meetingId: string; peerId: string }> = new Map();

  constructor(
    @Inject(forwardRef(() => RoomService))
    private readonly roomService: RoomService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`客户端连接: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`客户端断开: ${client.id}`);

    // 清理客户端关联的 Peer
    const clientInfo = this.clientPeerMap.get(client.id);
    if (clientInfo) {
      this.handleRtcLeave(client, { meetingId: clientInfo.meetingId });
      this.clientPeerMap.delete(client.id);
    }
  }

  /**
   * 客户端加入会议房间
   */
  @SubscribeMessage('join_meeting_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const room = `meeting:${data.meetingId}`;
    await client.join(room);
    this.logger.log(`客户端 ${client.id} 加入房间 ${room}`);
  }

  /**
   * 客户端离开会议房间
   */
  @SubscribeMessage('leave_meeting_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const room = `meeting:${data.meetingId}`;
    await client.leave(room);
    this.logger.log(`客户端 ${client.id} 离开房间 ${room}`);
  }

  /**
   * RTC: 加入音视频房间
   */
  @SubscribeMessage('rtc:join')
  async handleRtcJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RtcJoinRequest,
  ): Promise<RtcJoinResponse> {
    const room = await this.roomService.getOrCreateRoom(data.meetingId);

    // 生成唯一的 Peer ID
    const peerId = uuidv4();

    // 添加 Peer 到房间
    const peer = await this.roomService.addPeer(data.meetingId, {
      peerId,
      userId: data.userId,
      nickname: data.nickname,
      socketId: client.id,
    });

    // 存储客户端与 Peer 的映射关系
    this.clientPeerMap.set(client.id, { meetingId: data.meetingId, peerId });

    // 获取房间内已有的 peers 信息
    const peers = Array.from(room.peers.values())
      .filter(p => p.peerId !== peerId)
      .map(p => ({
        peerId: p.peerId,
        userId: p.userId,
        nickname: p.nickname,
        producers: Array.from(p.producers.values()).map(producer => ({
          id: producer.id,
          kind: producer.kind,
          appData: producer.appData,
        })),
      }));

    // 广播新 Peer 加入事件
    await this.notifyPeerJoined(data.meetingId, {
      peerId,
      userId: data.userId || '',
      nickname: data.nickname || '',
    });

    this.logger.log(`Peer ${peerId} 加入音视频房间 ${data.meetingId}`);

    return {
      peerId,
      peers,
    };
  }

  /**
   * RTC: 获取路由器 RTP 能力
   */
  @SubscribeMessage('rtc:getRouterRtpCapabilities')
  async handleGetRouterRtpCapabilities(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const room = await this.roomService.getOrCreateRoom(data.meetingId);

    return {
      rtpCapabilities: room.router.rtpCapabilities,
    };
  }

  /**
   * RTC: 创建 Transport
   */
  @SubscribeMessage('rtc:createTransport')
  async handleCreateTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateTransportRequest,
  ) {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const transport = await this.roomService.createTransport(
      data.meetingId,
      clientInfo.peerId,
      data.direction,
    );

    return {
      transportId: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /**
   * RTC: 连接 Transport
   */
  @SubscribeMessage('rtc:connectTransport')
  async handleConnectTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ConnectTransportRequest,
  ) {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const room = this.roomService.getRoom(data.meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const transport = room.transports.get(data.transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    await transport.connect({ dtlsParameters: data.dtlsParameters });

    return {
      transportId: data.transportId,
    };
  }

  /**
   * RTC: 发布媒体流
   */
  @SubscribeMessage('rtc:produce')
  async handleProduce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ProduceRequest,
  ) {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const producer = await this.roomService.createProducer(
      data.meetingId,
      clientInfo.peerId,
      data.transportId,
      data.kind,
      data.rtpParameters,
      data.appData,
    );

    // 广播新 Producer 事件
    await this.notifyNewProducer(data.meetingId, {
      producerId: producer.id,
      peerId: clientInfo.peerId,
      kind: producer.kind,
      appData: producer.appData,
    });

    return {
      producerId: producer.id,
    };
  }

  /**
   * RTC: 订阅媒体流
   */
  @SubscribeMessage('rtc:consume')
  async handleConsume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ConsumeRequest,
  ) {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const consumer = await this.roomService.createConsumer(
      data.meetingId,
      clientInfo.peerId,
      clientInfo.peerId === data.producerId ? 'send' : 'recv',
      data.producerId,
      data.rtpCapabilities,
    );

    return {
      consumerId: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    };
  }

  /**
   * RTC: 离开音视频房间
   */
  @SubscribeMessage('rtc:leave')
  async handleRtcLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      return { peerId: '' };
    }

    // 广播 Peer 离开事件
    await this.notifyPeerLeft(data.meetingId, {
      peerId: clientInfo.peerId,
      userId: clientInfo.peerId, // 简化处理，实际应从 Peer 信息获取
    });

    // 从房间移除 Peer
    await this.roomService.removePeer(data.meetingId, clientInfo.peerId);
    this.clientPeerMap.delete(client.id);

    this.logger.log(`Peer ${clientInfo.peerId} 离开音视频房间 ${data.meetingId}`);

    return {
      peerId: clientInfo.peerId,
    };
  }

  /**
   * 广播会议结束事件
   */
  async notifyMeetingEnded(payload: MeetingEndedPayload): Promise<void> {
    const room = `meeting:${payload.meetingId}`;
    this.server.to(room).emit('meeting.ended', payload);
    this.logger.log(`广播会议结束事件到房间 ${room}`);
  }

  /**
   * 广播参与者加入事件
   */
  async notifyParticipantJoined(payload: ParticipantJoinedPayload): Promise<void> {
    const room = `meeting:${payload.meetingId}`;
    this.server.to(room).emit('meeting.participant_joined', payload);
    this.logger.log(`广播参与者加入事件到房间 ${room}`);
  }

  /**
   * 广播新 Producer 事件
   */
  async notifyNewProducer(meetingId: string, payload: NewProducerPayload): Promise<void> {
    const room = `meeting:${meetingId}`;
    this.server.to(room).emit('rtc:newProducer', payload);
    this.logger.log(`广播新 Producer 事件到房间 ${room}: ${payload.producerId}`);
  }

  /**
   * 广播 Producer 关闭事件
   */
  async notifyProducerClosed(meetingId: string, payload: ProducerClosedPayload): Promise<void> {
    const room = `meeting:${meetingId}`;
    this.server.to(room).emit('rtc:producerClosed', payload);
    this.logger.log(`广播 Producer 关闭事件到房间 ${room}: ${payload.producerId}`);
  }

  /**
   * 广播 Peer 加入事件
   */
  async notifyPeerJoined(meetingId: string, payload: PeerJoinedPayload): Promise<void> {
    const room = `meeting:${meetingId}`;
    this.server.to(room).emit('rtc:peerJoined', payload);
    this.logger.log(`广播 Peer 加入事件到房间 ${room}: ${payload.peerId}`);
  }

  /**
   * 广播 Peer 离开事件
   */
  async notifyPeerLeft(meetingId: string, payload: PeerLeftPayload): Promise<void> {
    const room = `meeting:${meetingId}`;
    this.server.to(room).emit('rtc:peerLeft', payload);
    this.logger.log(`广播 Peer 离开事件到房间 ${room}: ${payload.peerId}`);
  }
}
