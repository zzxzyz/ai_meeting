import { api } from './client';

// 会议状态枚举
export enum MeetingStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  ENDED = 'ENDED',
}

// 参与者信息
export interface Participant {
  userId: string;
  nickname: string;
  isCreator: boolean;
  joinedAt: string;
}

// 会议基本信息
export interface Meeting {
  id: string;
  meetingNumber: string;
  title: string | null;
  status: MeetingStatus;
  creatorId: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  createdAt: string;
}

// 会议详情（含参与者列表）
export interface MeetingDetail extends Meeting {
  durationSeconds: number;
  participants: Participant[];
}

// 会议列表响应
export interface MeetingListData {
  items: Meeting[];
  total: number;
  page: number;
  pageSize: number;
}

// 创建会议请求参数
export interface CreateMeetingRequest {
  title?: string;
}

// 加入会议请求参数
export interface JoinMeetingRequest {
  meetingNumber: string;
}

// 结束会议响应数据
export interface EndMeetingData {
  meetingId: string;
  endedAt: string;
  durationSeconds: number;
}

// 会议列表查询参数
export interface GetMeetingsParams {
  type?: 'created' | 'joined';
  page?: number;
  pageSize?: number;
}

/**
 * 创建会议
 */
export const createMeeting = async (data?: CreateMeetingRequest): Promise<Meeting> => {
  const response = await api.post<Meeting>('/meetings', data || {});
  return response.data;
};

/**
 * 加入会议
 */
export const joinMeeting = async (data: JoinMeetingRequest): Promise<MeetingDetail> => {
  const response = await api.post<MeetingDetail>('/meetings/join', data);
  return response.data;
};

/**
 * 查询会议列表
 */
export const getMeetings = async (params?: GetMeetingsParams): Promise<MeetingListData> => {
  const response = await api.get<MeetingListData>('/meetings', { params });
  return response.data;
};

/**
 * 查询会议详情
 */
export const getMeetingById = async (meetingId: string): Promise<MeetingDetail> => {
  const response = await api.get<MeetingDetail>(`/meetings/${meetingId}`);
  return response.data;
};

/**
 * 结束会议
 */
export const endMeeting = async (meetingId: string): Promise<EndMeetingData> => {
  const response = await api.post<EndMeetingData>(`/meetings/${meetingId}/end`);
  return response.data;
};

/**
 * 格式化会议号（将9位数字转为 XXX-XXX-XXX 格式）
 */
export const formatMeetingNumber = (meetingNumber: string): string => {
  const digits = meetingNumber.replace(/\D/g, '');
  if (digits.length !== 9) return meetingNumber;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
};

/**
 * 解析会议号（将 XXX-XXX-XXX 格式转为9位纯数字）
 */
export const parseMeetingNumber = (input: string): string => {
  return input.replace(/\D/g, '');
};
