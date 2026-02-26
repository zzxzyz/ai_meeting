import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { RoomService, PeerInfo } from './room.service';
import { SignalingService } from './signaling.service';
import { ConfigService } from '@nestjs/config';
import * as mediasoup from 'mediasoup';

export interface PeerControlState {
  peerId: string;
  meetingId: string;
  audioProducerId?: string;
  videoProducerId?: string;
  audioPaused: boolean;
  videoPaused: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  lastUpdated: Date;
}

export interface RoomControlState {
  meetingId: string;
  peers: Map<string, PeerControlState>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomStateResponse {
  meetingId: string;
  peers: Array<{
    peerId: string;
    audioMuted: boolean;
    videoDisabled: boolean;
  }>;
  timestamp: number;
}

@Injectable()
export class ControlService {
  private controlStates: Map<string, RoomControlState> = new Map();

  constructor(
    @Inject(forwardRef(() => RoomService))
    private readonly roomService: RoomService,
    @Inject(forwardRef(() => SignalingService))
    private readonly signalingService: SignalingService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 暂停 Producer
   */
  async pauseProducer(
    meetingId: string,
    peerId: string,
    producerId: string,
  ): Promise<void> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const producer = peer.producers.get(producerId);
    if (!producer) {
      throw new Error('Producer not found');
    }

    if (producer.paused) {
      throw new Error('Producer already paused');
    }

    try {
      await producer.pause();

      // 更新 Peer 状态
      const updates: Partial<PeerInfo> = {
        lastUpdated: new Date(),
      };
      if (producer.kind === 'audio') {
        updates.audioPaused = true;
      } else {
        updates.videoPaused = true;
      }

      await this.roomService.updatePeerState(meetingId, peerId, updates);

      // 广播状态变化
      await this.broadcastStateChange(meetingId, peerId, producer.kind, true);

    } catch (error) {
      throw new Error(`Producer pause failed: ${(error as Error).message}`);
    }
  }

  /**
   * 恢复 Producer
   */
  async resumeProducer(
    meetingId: string,
    peerId: string,
    producerId: string,
  ): Promise<void> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      throw new Error('Peer not found');
    }

    const producer = peer.producers.get(producerId);
    if (!producer) {
      throw new Error('Producer not found');
    }

    if (!producer.paused) {
      throw new Error('Producer not paused');
    }

    try {
      await producer.resume();

      // 更新 Peer 状态
      const updates: Partial<PeerInfo> = {
        lastUpdated: new Date(),
      };
      if (producer.kind === 'audio') {
        updates.audioPaused = false;
      } else {
        updates.videoPaused = false;
      }

      await this.roomService.updatePeerState(meetingId, peerId, updates);

      // 广播状态变化
      await this.broadcastStateChange(meetingId, peerId, producer.kind, false);

    } catch (error) {
      throw new Error(`Producer resume failed: ${(error as Error).message}`);
    }
  }

  /**
   * 获取房间控制状态
   */
  async getRoomState(meetingId: string): Promise<RoomStateResponse> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      return {
        meetingId,
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
      meetingId,
      peers,
      timestamp: Date.now(),
    };
  }

  /**
   * 同步房间状态给新加入的用户
   */
  async syncRoomState(meetingId: string, peerId: string): Promise<void> {
    const roomState = await this.getRoomState(meetingId);

    await this.signalingService.sendToPeer(peerId, {
      type: 'rtc:roomState',
      data: roomState,
    });
  }

  /**
   * 静音音频（便捷方法）
   */
  async muteAudio(meetingId: string, peerId: string): Promise<void> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
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

    return this.pauseProducer(meetingId, peerId, audioProducer.id);
  }

  /**
   * 取消静音音频（便捷方法）
   */
  async unmuteAudio(meetingId: string, peerId: string): Promise<void> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
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

    return this.resumeProducer(meetingId, peerId, audioProducer.id);
  }

  /**
   * 禁用视频（便捷方法）
   */
  async disableVideo(meetingId: string, peerId: string): Promise<void> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
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

    return this.pauseProducer(meetingId, peerId, videoProducer.id);
  }

  /**
   * 启用视频（便捷方法）
   */
  async enableVideo(meetingId: string, peerId: string): Promise<void> {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      throw new Error('Room not found');
    }

    const peer = room.peers.get(peerId);
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

    return this.resumeProducer(meetingId, peerId, videoProducer.id);
  }

  /**
   * 获取 Peer 控制状态
   */
  private getPeerControlState(meetingId: string, peerId: string): { audioPaused: boolean; videoPaused: boolean } | undefined {
    const room = this.roomService.getRoom(meetingId);
    if (!room) {
      return undefined;
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      return undefined;
    }

    return {
      audioPaused: peer.audioPaused || false,
      videoPaused: peer.videoPaused || false,
    };
  }

  /**
   * 广播状态变化给房间内其他用户
   */
  private async broadcastStateChange(
    meetingId: string,
    peerId: string,
    kind: 'audio' | 'video',
    paused: boolean,
  ): Promise<void> {
    const eventType = kind === 'audio'
      ? (paused ? 'rtc:peerMuted' : 'rtc:peerUnmuted')
      : (paused ? 'rtc:peerVideoDisabled' : 'rtc:peerVideoEnabled');

    const eventData = kind === 'audio'
      ? {
          peerId,
          muted: paused,
          timestamp: Date.now(),
        }
      : {
          peerId,
          disabled: paused,
          timestamp: Date.now(),
        };

    await this.signalingService.broadcastToRoom(meetingId, {
      type: eventType,
      data: eventData,
    });
  }

  /**
   * 清理过期的控制状态
   */
  async cleanupExpiredStates(): Promise<void> {
    const now = new Date();
    const expirationTime = this.configService.get<number>('CONTROL_STATE_EXPIRATION') || 30 * 60 * 1000; // 30分钟

    for (const [meetingId, roomState] of this.controlStates.entries()) {
      if (now.getTime() - roomState.updatedAt.getTime() > expirationTime) {
        this.controlStates.delete(meetingId);
      }
    }
  }
}