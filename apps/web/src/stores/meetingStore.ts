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
import { SignalingService } from '../services/signaling.service';

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

  // 音视频控制状态
  signalingService: SignalingService | null;
  localAudioMuted: boolean;
  localVideoEnabled: boolean;
  peers: Map<string, PeerControlState>;
  loading: {
    audio: boolean;
    video: boolean;
    deviceSwitch: boolean;
  };

  // Actions
  setActiveTab: (tab: 'created' | 'joined') => void;
  setCurrentMeeting: (meeting: MeetingDetail | null) => void;
  clearError: () => void;

  // 音视频控制 Actions
  setSignalingService: (service: SignalingService) => void;
  toggleLocalAudio: () => Promise<void>;
  toggleLocalVideo: () => Promise<void>;
  updatePeerState: (peerId: string, state: Partial<PeerControlState>) => void;
  setAudioMuted: (muted: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;

  // 异步 Actions
  createMeeting: (data?: CreateMeetingRequest) => Promise<Meeting>;
  joinMeeting: (data: JoinMeetingRequest) => Promise<MeetingDetail>;
  fetchMeetings: (params?: GetMeetingsParams) => Promise<void>;
  fetchMeetingById: (meetingId: string) => Promise<void>;
  endMeeting: (meetingId: string) => Promise<void>;
}

interface PeerControlState {
  peerId: string;
  userId: string;
  nickname: string;
  audioMuted: boolean;
  videoDisabled: boolean;
  producers: ProducerInfo[];
  networkQuality: 'good' | 'medium' | 'poor';
}

interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  appData?: any;
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

  // 音视频控制初始状态
  signalingService: null,
  localAudioMuted: false,
  localVideoEnabled: true,
  peers: new Map(),
  loading: {
    audio: false,
    video: false,
    deviceSwitch: false,
  },

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

  // 设置信令服务
  setSignalingService: (service) => {
    set({ signalingService: service });
  },

  // 切换本地音频状态
  toggleLocalAudio: async () => {
    const state = get();
    const { signalingService, localAudioMuted } = state;

    if (!signalingService) {
      throw new Error('信令服务未初始化');
    }

    set({ loading: { ...state.loading, audio: true } });

    try {
      // 发送静音/取消静音信令
      const newMutedState = !localAudioMuted;

      // 这里需要根据实际 Producer ID 发送控制指令
      // 暂时模拟实现，实际需要从 MediaService 获取 Producer ID
      if (newMutedState) {
        // 发送静音指令
        await signalingService.pauseProducer('meeting-id', 'audio-producer-id', 'audio');
      } else {
        // 发送取消静音指令
        await signalingService.resumeProducer('meeting-id', 'audio-producer-id', 'audio');
      }

      set({
        localAudioMuted: newMutedState,
        loading: { ...state.loading, audio: false }
      });
    } catch (error: any) {
      set({
        error: error.message || '音频控制失败',
        loading: { ...state.loading, audio: false }
      });
      throw error;
    }
  },

  // 切换本地视频状态
  toggleLocalVideo: async () => {
    const state = get();
    const { signalingService, localVideoEnabled } = state;

    if (!signalingService) {
      throw new Error('信令服务未初始化');
    }

    set({ loading: { ...state.loading, video: true } });

    try {
      const newVideoState = !localVideoEnabled;

      // 这里需要根据实际 Producer ID 发送控制指令
      if (newVideoState) {
        // 发送开启摄像头指令
        await signalingService.resumeProducer('meeting-id', 'video-producer-id', 'video');
      } else {
        // 发送关闭摄像头指令
        await signalingService.pauseProducer('meeting-id', 'video-producer-id', 'video');
      }

      set({
        localVideoEnabled: newVideoState,
        loading: { ...state.loading, video: false }
      });
    } catch (error: any) {
      set({
        error: error.message || '视频控制失败',
        loading: { ...state.loading, video: false }
      });
      throw error;
    }
  },

  // 更新远端用户状态
  updatePeerState: (peerId, stateUpdate) => {
    set((state) => {
      const newPeers = new Map(state.peers);
      const existingPeer = newPeers.get(peerId) || {
        peerId,
        userId: '',
        nickname: '',
        audioMuted: false,
        videoDisabled: false,
        producers: [],
        networkQuality: 'good'
      };

      newPeers.set(peerId, { ...existingPeer, ...stateUpdate });
      return { peers: newPeers };
    });
  },

  // 设置音频静音状态
  setAudioMuted: (muted) => {
    set({ localAudioMuted: muted });
  },

  // 设置视频启用状态
  setVideoEnabled: (enabled) => {
    set({ localVideoEnabled: enabled });
  },

  // 创建会议
  createMeeting: async (data) => {
    set({ isCreating: true, error: null });
    try {
      const meeting = await createMeeting(data);
      set((state) => ({
        meetings: [meeting, ...(state.meetings ?? [])],
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
        meetings: listData?.items ?? [],
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
        meetings: (state.meetings ?? []).map((m) =>
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
