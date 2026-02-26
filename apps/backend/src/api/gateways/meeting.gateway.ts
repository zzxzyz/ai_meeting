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

export interface ProducerPauseRequest {
  meetingId: string;
  producerId: string;
  kind: 'audio' | 'video';
  requestId?: string;
}

export interface ProducerResumeRequest {
  meetingId: string;
  producerId: string;
  kind: 'audio' | 'video';
  requestId?: string;
}

export interface ControlAckResponse {
  requestId?: string;
  success: boolean;
  producerId: string;
  paused: boolean;
  timestamp: number;
  error?: string;
}

export interface PeerMutedPayload {
  peerId: string;
  muted: boolean;
  timestamp: number;
}

export interface PeerVideoDisabledPayload {
  peerId: string;
  disabled: boolean;
  timestamp: number;
}

export interface RoomStatePayload {
  meetingId: string;
  peers: Array<{
    peerId: string;
    audioMuted: boolean;
    videoDisabled: boolean;
  }>;
  timestamp: number;
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

  /**
   * RTC: 暂停 Producer（静音/关闭摄像头）
   */
  @SubscribeMessage('rtc:producerPause')
  async handleProducerPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ProducerPauseRequest,
  ): Promise<ControlAckResponse> {
    try {
      const clientInfo = this.clientPeerMap.get(client.id);
      if (!clientInfo) {
        throw new Error('Client not joined any room');
      }

      if (clientInfo.meetingId !== data.meetingId) {
        throw new Error('Client not in the specified meeting');
      }

      const room = this.roomService.getRoom(data.meetingId);
      if (!room) {
        throw new Error('Room not found');
      }

      const peer = room.peers.get(clientInfo.peerId);
      if (!peer) {
        throw new Error('Peer not found');
      }

      const producer = peer.producers.get(data.producerId);
      if (!producer) {
        throw new Error('Producer not found');
      }

      if (producer.paused) {
        throw new Error('Producer already paused');
      }

      // 暂停 Producer
      await producer.pause();

      // 更新 Peer 状态
      if (data.kind === 'audio') {
        await this.roomService.setPeerAudioMuted(data.meetingId, clientInfo.peerId, true);
      } else {
        await this.roomService.setPeerVideoDisabled(data.meetingId, clientInfo.peerId, true);
      }

      // 广播状态变化
      await this.broadcastControlStateChange(data.meetingId, clientInfo.peerId, data.kind, true);

      this.logger.log(`Producer ${data.producerId} paused by peer ${clientInfo.peerId}`);

      return {
        requestId: data.requestId,
        success: true,
        producerId: data.producerId,
        paused: true,
        timestamp: Date.now(),
      };

    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`Producer pause failed: ${errMsg}`);
      return {
        requestId: data.requestId,
        success: false,
        producerId: data.producerId,
        paused: false,
        timestamp: Date.now(),
        error: errMsg,
      };
    }
  }

  /**
   * RTC: 恢复 Producer（取消静音/开启摄像头）
   */
  @SubscribeMessage('rtc:producerResume')
  async handleProducerResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ProducerResumeRequest,
  ): Promise<ControlAckResponse> {
    try {
      const clientInfo = this.clientPeerMap.get(client.id);
      if (!clientInfo) {
        throw new Error('Client not joined any room');
      }

      if (clientInfo.meetingId !== data.meetingId) {
        throw new Error('Client not in the specified meeting');
      }

      const room = this.roomService.getRoom(data.meetingId);
      if (!room) {
        throw new Error('Room not found');
      }

      const peer = room.peers.get(clientInfo.peerId);
      if (!peer) {
        throw new Error('Peer not found');
      }

      const producer = peer.producers.get(data.producerId);
      if (!producer) {
        throw new Error('Producer not found');
      }

      if (!producer.paused) {
        throw new Error('Producer not paused');
      }

      // 恢复 Producer
      await producer.resume();

      // 更新 Peer 状态
      if (data.kind === 'audio') {
        await this.roomService.setPeerAudioMuted(data.meetingId, clientInfo.peerId, false);
      } else {
        await this.roomService.setPeerVideoDisabled(data.meetingId, clientInfo.peerId, false);
      }

      // 广播状态变化
      await this.broadcastControlStateChange(data.meetingId, clientInfo.peerId, data.kind, false);

      this.logger.log(`Producer ${data.producerId} resumed by peer ${clientInfo.peerId}`);

      return {
        requestId: data.requestId,
        success: true,
        producerId: data.producerId,
        paused: false,
        timestamp: Date.now(),
      };

    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`Producer resume failed: ${errMsg}`);
      return {
        requestId: data.requestId,
        success: false,
        producerId: data.producerId,
        paused: false,
        timestamp: Date.now(),
        error: errMsg,
      };
    }
  }

  /**
   * RTC: 获取房间状态（新用户加入时同步）
   */
  @SubscribeMessage('rtc:getRoomState')
  async handleGetRoomState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ): Promise<RoomStatePayload> {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const room = this.roomService.getRoom(data.meetingId);
    if (!room) {
      return {
        meetingId: data.meetingId,
        peers: [],
        timestamp: Date.now(),
      };
    }

    const peers = Array.from(room.peers.values()).map(peer => ({
      peerId: peer.peerId,
      audioMuted: peer.audioPaused || false,
      videoDisabled: peer.videoPaused || false,
    }));

    return {
      meetingId: data.meetingId,
      peers,
      timestamp: Date.now(),
    };
  }

  /**
   * 便捷方法：静音音频
   */
  @SubscribeMessage('rtc:muteAudio')
  async handleMuteAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ): Promise<ControlAckResponse> {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const room = this.roomService.getRoom(data.meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(clientInfo.peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    // 查找音频 Producer
    const audioProducer = Array.from(peer.producers.values()).find(
      producer => producer.kind === 'audio'
    );

    if (!audioProducer) {
      throw new Error('Audio producer not found');
    }

    return this.handleProducerPause(client, {
      meetingId: data.meetingId,
      producerId: audioProducer.id,
      kind: 'audio',
      requestId: `mute-${Date.now()}`,
    });
  }

  /**
   * 便捷方法：取消静音音频
   */
  @SubscribeMessage('rtc:unmuteAudio')
  async handleUnmuteAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ): Promise<ControlAckResponse> {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const room = this.roomService.getRoom(data.meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(clientInfo.peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    // 查找音频 Producer
    const audioProducer = Array.from(peer.producers.values()).find(
      producer => producer.kind === 'audio'
    );

    if (!audioProducer) {
      throw new Error('Audio producer not found');
    }

    return this.handleProducerResume(client, {
      meetingId: data.meetingId,
      producerId: audioProducer.id,
      kind: 'audio',
      requestId: `unmute-${Date.now()}`,
    });
  }

  /**
   * 便捷方法：禁用视频
   */
  @SubscribeMessage('rtc:disableVideo')
  async handleDisableVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ): Promise<ControlAckResponse> {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const room = this.roomService.getRoom(data.meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(clientInfo.peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    // 查找视频 Producer
    const videoProducer = Array.from(peer.producers.values()).find(
      producer => producer.kind === 'video'
    );

    if (!videoProducer) {
      throw new Error('Video producer not found');
    }

    return this.handleProducerPause(client, {
      meetingId: data.meetingId,
      producerId: videoProducer.id,
      kind: 'video',
      requestId: `disable-video-${Date.now()}`,
    });
  }

  /**
   * 便捷方法：启用视频
   */
  @SubscribeMessage('rtc:enableVideo')
  async handleEnableVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ): Promise<ControlAckResponse> {
    const clientInfo = this.clientPeerMap.get(client.id);
    if (!clientInfo) {
      throw new Error('Client not joined any room');
    }

    const room = this.roomService.getRoom(data.meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(clientInfo.peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    // 查找视频 Producer
    const videoProducer = Array.from(peer.producers.values()).find(
      producer => producer.kind === 'video'
    );

    if (!videoProducer) {
      throw new Error('Video producer not found');
    }

    return this.handleProducerResume(client, {
      meetingId: data.meetingId,
      producerId: videoProducer.id,
      kind: 'video',
      requestId: `enable-video-${Date.now()}`,
    });
  }

  /**
   * 广播控制状态变化
   */
  private async broadcastControlStateChange(
    meetingId: string,
    peerId: string,
    kind: 'audio' | 'video',
    paused: boolean,
  ): Promise<void> {
    const room = `meeting:${meetingId}`;

    if (kind === 'audio') {
      const payload: PeerMutedPayload = {
        peerId,
        muted: paused,
        timestamp: Date.now(),
      };
      this.server.to(room).emit('rtc:peerMuted', payload);
      this.logger.log(`广播音频静音状态变化: peer=${peerId}, muted=${paused}`);
    } else {
      const payload: PeerVideoDisabledPayload = {
        peerId,
        disabled: paused,
        timestamp: Date.now(),
      };
      this.server.to(room).emit('rtc:peerVideoDisabled', payload);
      this.logger.log(`广播视频禁用状态变化: peer=${peerId}, disabled=${paused}`);
    }
  }

  /**
   * 新用户加入时自动同步房间状态
   */
  async syncRoomStateToNewPeer(meetingId: string, peerId: string): Promise<void> {
    const roomState = await this.handleGetRoomState(null as any, { meetingId });

    // 查找 peerId 对应的 socketId
    let targetSocketId: string | undefined;
    for (const [socketId, info] of this.clientPeerMap.entries()) {
      if (info.peerId === peerId && info.meetingId === meetingId) {
        targetSocketId = socketId;
        break;
      }
    }

    if (targetSocketId) {
      this.server.to(targetSocketId).emit('rtc:roomState', roomState);
    }
  }
}
