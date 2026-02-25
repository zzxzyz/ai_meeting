import { create } from 'zustand';
import {
  Meeting,
  MeetingDetail,
  MeetingListData,
  MeetingStatus,
  CreateMeetingRequest,
  JoinMeetingRequest,
  GetMeetingsParams,
  createMeeting,
  joinMeeting,
  getMeetings,
  getMeetingById,
  endMeeting,
} from '../api/meeting';

interface MeetingState {
  // 状态
  meetings: Meeting[];
  currentMeeting: MeetingDetail | null;
  meetingListData: MeetingListData | null;
  isLoading: boolean;
  isCreating: boolean;
  isJoining: boolean;
  isEnding: boolean;
  error: string | null;
  activeTab: 'created' | 'joined';

  // Actions
  setActiveTab: (tab: 'created' | 'joined') => void;
  setCurrentMeeting: (meeting: MeetingDetail | null) => void;
  clearError: () => void;

  // 异步 Actions
  createMeeting: (data?: CreateMeetingRequest) => Promise<Meeting>;
  joinMeeting: (data: JoinMeetingRequest) => Promise<MeetingDetail>;
  fetchMeetings: (params?: GetMeetingsParams) => Promise<void>;
  fetchMeetingById: (meetingId: string) => Promise<void>;
  endMeeting: (meetingId: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  // 初始状态
  meetings: [],
  currentMeeting: null,
  meetingListData: null,
  isLoading: false,
  isCreating: false,
  isJoining: false,
  isEnding: false,
  error: null,
  activeTab: 'created',

  // 设置当前 Tab
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  // 设置当前会议
  setCurrentMeeting: (meeting) => {
    set({ currentMeeting: meeting });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 创建会议
  createMeeting: async (data) => {
    set({ isCreating: true, error: null });
    try {
      const meeting = await createMeeting(data);
      set((state) => ({
        meetings: [meeting, ...state.meetings],
        isCreating: false,
      }));
      return meeting;
    } catch (error: any) {
      const errorMessage = error.message || '创建会议失败，请稍后重试';
      set({ error: errorMessage, isCreating: false });
      throw error;
    }
  },

  // 加入会议
  joinMeeting: async (data) => {
    set({ isJoining: true, error: null });
    try {
      const meetingDetail = await joinMeeting(data);
      set({ currentMeeting: meetingDetail, isJoining: false });
      return meetingDetail;
    } catch (error: any) {
      const errorMessage = error.message || '加入会议失败，请稍后重试';
      set({ error: errorMessage, isJoining: false });
      throw error;
    }
  },

  // 获取会议列表
  fetchMeetings: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const listData = await getMeetings(params);
      set({
        meetings: listData.items,
        meetingListData: listData,
        isLoading: false,
      });
    } catch (error: any) {
      const errorMessage = error.message || '获取会议列表失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 获取会议详情
  fetchMeetingById: async (meetingId) => {
    set({ isLoading: true, error: null });
    try {
      const meetingDetail = await getMeetingById(meetingId);
      set({ currentMeeting: meetingDetail, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.message || '获取会议详情失败';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // 结束会议
  endMeeting: async (meetingId) => {
    set({ isEnding: true, error: null });
    try {
      await endMeeting(meetingId);
      // 更新本地会议状态
      set((state) => ({
        meetings: state.meetings.map((m) =>
          m.id === meetingId ? { ...m, status: MeetingStatus.ENDED } : m
        ),
        currentMeeting: state.currentMeeting?.id === meetingId
          ? { ...state.currentMeeting, status: MeetingStatus.ENDED }
          : state.currentMeeting,
        isEnding: false,
      }));
    } catch (error: any) {
      const errorMessage = error.message || '结束会议失败，请稍后重试';
      set({ error: errorMessage, isEnding: false });
      throw error;
    }
  },
}));
