import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediasoupService } from '@/infrastructure/mediasoup/mediasoup.service';
import * as mediasoup from 'mediasoup';

export interface PeerInfo {
  peerId: string;
  userId: string;
  nickname: string;
  socketId: string;
  sendTransportId?: string;
  recvTransportId?: string;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  // 新增控制状态字段
  audioPaused?: boolean;
  videoPaused?: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  lastUpdated?: Date;
}

export interface RoomInfo {
  meetingId: string;
  router: mediasoup.types.Router;
  peers: Map<string, PeerInfo>;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  createdAt: Date;
}

@Injectable()
export class RoomService {
  private rooms: Map<string, RoomInfo> = new Map();

  constructor(
    @Inject(forwardRef(() => MediasoupService))
    private readonly mediasoupService: MediasoupService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 获取或创建会议房间
   */
  async getOrCreateRoom(meetingId: string): Promise<RoomInfo> {
    if (this.rooms.has(meetingId)) {
      return this.rooms.get(meetingId)!;
    }

    const router = await this.mediasoupService.createRouter();
    const room: RoomInfo = {
      meetingId,
      router,
      peers: new Map(),
      transports: new Map(),
      createdAt: new Date(),
    };

    this.rooms.set(meetingId, room);
    return room;
  }

  /**
   * 获取会议房间
   */
  getRoom(meetingId: string): RoomInfo | undefined {
    return this.rooms.get(meetingId);
  }

  /**
   * 向房间添加参会者
   */
  async addPeer(meetingId: string, peerInfo: Omit<PeerInfo, 'producers' | 'consumers'>): Promise<PeerInfo> {
    const room = this.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const maxPeers = this.configService.get<number>('MEDIASOUP_MAX_PEERS_PER_ROOM') || 4;
    if (room.peers.size >= maxPeers) {
      throw new Error('Room is full');
    }

    const peer: PeerInfo = {
      ...peerInfo,
      producers: new Map(),
      consumers: new Map(),
    };

    room.peers.set(peerInfo.peerId, peer);
    return peer;
  }

  /**
   * 从房间移除参会者
   */
  async removePeer(meetingId: string, peerId: string): Promise<void> {
    const room = this.getRoom(meetingId);
    if (!room) {
      return;
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      return;
    }

    // 清理 Producer
    for (const producer of peer.producers.values()) {
      try {
        producer.close();
      } catch (error) {
        console.warn('Error closing producer:', error);
      }
    }

    // 清理 Consumer
    for (const consumer of peer.consumers.values()) {
      try {
        consumer.close();
      } catch (error) {
        console.warn('Error closing consumer:', error);
      }
    }

    // 清理 Transport
    if (peer.sendTransportId) {
      const transport = room.transports.get(peer.sendTransportId);
      if (transport) {
        try {
          transport.close();
          room.transports.delete(peer.sendTransportId);
        } catch (error) {
          console.warn('Error closing send transport:', error);
        }
      }
    }

    if (peer.recvTransportId) {
      const transport = room.transports.get(peer.recvTransportId);
      if (transport) {
        try {
          transport.close();
          room.transports.delete(peer.recvTransportId);
        } catch (error) {
          console.warn('Error closing recv transport:', error);
        }
      }
    }

    room.peers.delete(peerId);

    // 如果房间为空，关闭房间
    if (room.peers.size === 0) {
      await this.closeRoom(meetingId);
    }
  }

  /**
   * 为参会者创建 Transport
   */
  async createTransport(
    meetingId: string,
    peerId: string,
    direction: 'send' | 'recv',
  ): Promise<mediasoup.types.WebRtcTransport> {
    const room = this.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: this.configService.get<string>('MEDIASOUP_ANNOUNCED_IP') || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: this.configService.get<number>('MEDIASOUP_INITIAL_BITRATE') || 1000000,
    });

    room.transports.set(transport.id, transport);

    if (direction === 'send') {
      peer.sendTransportId = transport.id;
    } else {
      peer.recvTransportId = transport.id;
    }

    return transport;
  }

  /**
   * 为参会者创建 Producer
   */
  async createProducer(
    meetingId: string,
    peerId: string,
    transportId: string,
    kind: mediasoup.types.MediaKind,
    rtpParameters: mediasoup.types.RtpParameters,
    appData?: any,
  ): Promise<mediasoup.types.Producer> {
    const room = this.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = room.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData,
    });

    peer.producers.set(producer.id, producer);
    return producer;
  }

  /**
   * 为参会者创建 Consumer
   */
  async createConsumer(
    meetingId: string,
    peerId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities,
  ): Promise<mediasoup.types.Consumer> {
    const room = this.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const transport = room.transports.get(transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    // 查找对应的 Producer
    let producer: mediasoup.types.Producer | undefined;
    for (const otherPeer of room.peers.values()) {
      if (otherPeer.producers.has(producerId)) {
        producer = otherPeer.producers.get(producerId);
        break;
      }
    }

    if (!producer) {
      throw new Error('Producer not found');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // 初始暂停，等待客户端准备好
    });

    peer.consumers.set(consumer.id, consumer);
    return consumer;
  }

  /**
   * 获取房间内所有 Producer 列表（用于新加入者订阅）
   */
  getRoomProducers(meetingId: string): Array<{
    producerId: string;
    peerId: string;
    kind: mediasoup.types.MediaKind;
    appData?: any;
  }> {
    const room = this.getRoom(meetingId);
    if (!room) {
      return [];
    }

    const producers = [];
    for (const peer of room.peers.values()) {
      for (const producer of peer.producers.values()) {
        producers.push({
          producerId: producer.id,
          peerId: peer.peerId,
          kind: producer.kind,
          appData: producer.appData,
        });
      }
    }
    return producers;
  }

  /**
   * 关闭会议房间
   */
  async closeRoom(meetingId: string): Promise<void> {
    const room = this.getRoom(meetingId);
    if (!room) {
      return;
    }

    // 清理所有参会者
    for (const peerId of room.peers.keys()) {
      await this.removePeer(meetingId, peerId);
    }

    // 关闭 Router
    try {
      room.router.close();
    } catch (error) {
      console.warn('Error closing router:', error);
    }

    this.rooms.delete(meetingId);
  }

  /**
   * 获取房间统计信息
   */
  getRoomStats(meetingId: string): {
    peerCount: number;
    producerCount: number;
    consumerCount: number;
    transportCount: number;
  } {
    const room = this.getRoom(meetingId);
    if (!room) {
      return { peerCount: 0, producerCount: 0, consumerCount: 0, transportCount: 0 };
    }

    let producerCount = 0;
    let consumerCount = 0;
    for (const peer of room.peers.values()) {
      producerCount += peer.producers.size;
      consumerCount += peer.consumers.size;
    }

    return {
      peerCount: room.peers.size,
      producerCount,
      consumerCount,
      transportCount: room.transports.size,
    };
  }

  /**
   * 获取指定 Peer 信息
   */
  getPeer(meetingId: string, peerId: string): PeerInfo | undefined {
    const room = this.getRoom(meetingId);
    if (!room) {
      return undefined;
    }
    return room.peers.get(peerId);
  }

  /**
   * 更新 Peer 控制状态
   */
  async updatePeerState(
    meetingId: string,
    peerId: string,
    updates: Partial<PeerInfo>,
  ): Promise<void> {
    const room = this.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    Object.assign(peer, updates, { lastUpdated: new Date() });
  }

  /**
   * 获取房间内所有 Peer 的控制状态
   */
  getRoomControlState(meetingId: string): Array<{
    peerId: string;
    audioMuted: boolean;
    videoDisabled: boolean;
    lastUpdated: Date;
  }> {
    const room = this.getRoom(meetingId);
    if (!room) {
      return [];
    }

    return Array.from(room.peers.values()).map(peer => ({
      peerId: peer.peerId,
      audioMuted: peer.audioPaused || false,
      videoDisabled: peer.videoPaused || false,
      lastUpdated: peer.lastUpdated || new Date(),
    }));
  }

  /**
   * 设置音频静音状态
   */
  async setPeerAudioMuted(meetingId: string, peerId: string, muted: boolean): Promise<void> {
    return this.updatePeerState(meetingId, peerId, { audioPaused: muted });
  }

  /**
   * 设置视频禁用状态
   */
  async setPeerVideoDisabled(meetingId: string, peerId: string, disabled: boolean): Promise<void> {
    return this.updatePeerState(meetingId, peerId, { videoPaused: disabled });
  }

  /**
   * 获取指定 Producer 信息
   */
  getProducer(meetingId: string, peerId: string, producerId: string): mediasoup.types.Producer | undefined {
    const peer = this.getPeer(meetingId, peerId);
    if (!peer) {
      return undefined;
    }
    return peer.producers.get(producerId);
  }

  /**
   * 查找指定类型的 Producer
   */
  findProducerByKind(meetingId: string, peerId: string, kind: 'audio' | 'video'): mediasoup.types.Producer | undefined {
    const peer = this.getPeer(meetingId, peerId);
    if (!peer) {
      return undefined;
    }

    return Array.from(peer.producers.values()).find(
      producer => producer.kind === kind
    );
  }
}