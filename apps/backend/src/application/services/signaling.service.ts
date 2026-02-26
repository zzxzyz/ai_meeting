import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

export interface SignalingMessage {
  type: string;
  data: any;
  requestId?: string;
  timestamp?: number;
}

export interface ControlAckMessage {
  requestId?: string;
  success: boolean;
  producerId: string;
  paused: boolean;
  timestamp: number;
  error?: string;
}

export interface PeerStateMessage {
  peerId: string;
  audioMuted: boolean;
  videoDisabled: boolean;
  timestamp: number;
}

export interface RoomStateMessage {
  meetingId: string;
  peers: Array<{
    peerId: string;
    audioMuted: boolean;
    videoDisabled: boolean;
  }>;
  timestamp: number;
}

@Injectable()
export class SignalingService {
  @WebSocketServer()
  private server: Server;

  private clientSocketMap: Map<string, Socket> = new Map();

  /**
   * 注册客户端 Socket
   */
  registerClient(client: Socket): void {
    this.clientSocketMap.set(client.id, client);
  }

  /**
   * 注销客户端 Socket
   */
  unregisterClient(client: Socket): void {
    this.clientSocketMap.delete(client.id);
  }

  /**
   * 向指定 Peer 发送消息
   */
  async sendToPeer(peerId: string, message: SignalingMessage): Promise<void> {
    // 在实际实现中，需要根据 peerId 找到对应的 Socket
    // 这里简化处理，假设 peerId 就是 socket.id
    const socket = this.clientSocketMap.get(peerId);
    if (!socket) {
      throw new Error(`Peer ${peerId} not found`);
    }

    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now(),
    };

    socket.emit(message.type, messageWithTimestamp);
  }

  /**
   * 向房间内所有用户广播消息
   */
  async broadcastToRoom(meetingId: string, message: SignalingMessage): Promise<void> {
    const room = `meeting:${meetingId}`;
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now(),
    };

    this.server.to(room).emit(message.type, messageWithTimestamp);
  }

  /**
   * 向房间内除指定 Peer 外的所有用户广播消息
   */
  async broadcastToRoomExcept(
    meetingId: string,
    excludePeerId: string,
    message: SignalingMessage,
  ): Promise<void> {
    const room = `meeting:${meetingId}`;
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now(),
    };

    // 获取房间内所有客户端
    const sockets = await this.server.in(room).fetchSockets();
    const targetSockets = sockets.filter(socket => socket.id !== excludePeerId);

    for (const socket of targetSockets) {
      socket.emit(message.type, messageWithTimestamp);
    }
  }

  /**
   * 发送控制确认消息
   */
  async sendControlAck(
    peerId: string,
    ack: ControlAckMessage,
  ): Promise<void> {
    await this.sendToPeer(peerId, {
      type: 'rtc:controlAck',
      data: ack,
    });
  }

  /**
   * 广播 Peer 静音状态变化
   */
  async broadcastPeerMuted(
    meetingId: string,
    peerId: string,
    muted: boolean,
  ): Promise<void> {
    await this.broadcastToRoom(meetingId, {
      type: 'rtc:peerMuted',
      data: {
        peerId,
        muted,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 广播 Peer 视频状态变化
   */
  async broadcastPeerVideoDisabled(
    meetingId: string,
    peerId: string,
    disabled: boolean,
  ): Promise<void> {
    await this.broadcastToRoom(meetingId, {
      type: 'rtc:peerVideoDisabled',
      data: {
        peerId,
        disabled,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 发送房间状态给指定 Peer
   */
  async sendRoomState(
    peerId: string,
    roomState: RoomStateMessage,
  ): Promise<void> {
    await this.sendToPeer(peerId, {
      type: 'rtc:roomState',
      data: roomState,
    });
  }

  /**
   * 发送错误消息
   */
  async sendError(
    peerId: string,
    error: string,
    requestId?: string,
  ): Promise<void> {
    await this.sendToPeer(peerId, {
      type: 'rtc:error',
      data: {
        error,
        requestId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * 检查客户端连接状态
   */
  isPeerConnected(peerId: string): boolean {
    return this.clientSocketMap.has(peerId);
  }

  /**
   * 获取房间内所有连接的 Peer
   */
  async getConnectedPeersInRoom(meetingId: string): Promise<string[]> {
    const room = `meeting:${meetingId}`;
    const sockets = await this.server.in(room).fetchSockets();
    return sockets.map(socket => socket.id);
  }

  /**
   * 清理断开的客户端连接
   */
  cleanupDisconnectedClients(): void {
    const disconnectedClients: string[] = [];

    for (const [clientId, socket] of this.clientSocketMap.entries()) {
      if (!socket.connected) {
        disconnectedClients.push(clientId);
      }
    }

    for (const clientId of disconnectedClients) {
      this.clientSocketMap.delete(clientId);
    }

    if (disconnectedClients.length > 0) {
      console.log(`清理了 ${disconnectedClients.length} 个断开的客户端连接`);
    }
  }

  /**
   * 获取服务统计信息
   */
  getStats(): {
    connectedClients: number;
    registeredClients: number;
  } {
    return {
      connectedClients: this.server.engine.clientsCount,
      registeredClients: this.clientSocketMap.size,
    };
  }
}