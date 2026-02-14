// 常量定义
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const WS_BASE_URL = process.env.VITE_WS_BASE_URL || 'ws://localhost:3000';

export const MAX_PARTICIPANTS = 4; // MVP 版本最多 4 人
export const MAX_VIDEO_BITRATE = 1500000; // 1.5 Mbps
export const MAX_AUDIO_BITRATE = 128000; // 128 kbps

export const TOKEN_KEY = 'ai_meeting_token';
export const REFRESH_TOKEN_KEY = 'ai_meeting_refresh_token';

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MEETING_FULL: 'MEETING_FULL',
  MEETING_ENDED: 'MEETING_ENDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  MEDIA_ERROR: 'MEDIA_ERROR',
} as const;
