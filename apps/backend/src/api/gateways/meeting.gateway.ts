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
import { Logger } from '@nestjs/common';

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

/**
 * 会议 WebSocket Gateway
 * 负责向会议房间内的参与者推送实时事件
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

  handleConnection(client: Socket) {
    this.logger.log(`客户端连接: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`客户端断开: ${client.id}`);
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
}
