// 类型定义
export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Meeting {
  id: string;
  title: string;
  meetingNumber: string;
  hostId: string;
  status: 'scheduled' | 'active' | 'ended';
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  userId: string;
  meetingId: string;
  role: 'host' | 'participant';
  joinedAt: Date;
  leftAt?: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

// WebRTC 相关类型
export interface MediaTrackSettings {
  audio: boolean;
  video: boolean;
  screen?: boolean;
}

export interface RTCStats {
  bytesReceived: number;
  bytesSent: number;
  packetsLost: number;
  jitter: number;
  rtt: number;
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// WebSocket 消息类型
export enum WSMessageType {
  JOIN_MEETING = 'join_meeting',
  LEAVE_MEETING = 'leave_meeting',
  SIGNAL = 'signal',
  MEDIA_CONTROL = 'media_control',
  CHAT_MESSAGE = 'chat_message',
}

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: number;
}
