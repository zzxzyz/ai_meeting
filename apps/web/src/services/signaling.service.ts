import type {
  RtpCapabilities,
  RtpParameters,
  DtlsParameters
} from 'mediasoup-client/lib/types';

interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
}

interface SignalingResponse {
  data?: any;
  error?: string;
}

export interface PeerInfo {
  peerId: string;
  userId: string;
  nickname: string;
  producers: ProducerInfo[];
}

export interface ProducerInfo {
  id: string;
  kind: 'audio' | 'video';
  appData?: any;
}

export interface JoinMeetingResponse {
  peerId: string;
  peers: PeerInfo[];
}

export interface TransportParams {
  transportId: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: DtlsParameters;
}

export interface ConsumerParams {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: RtpParameters;
  type: string;
  producerPaused: boolean;
}

export type SignalingEvent =
  | 'newProducer'
  | 'producerClosed'
  | 'peerJoined'
  | 'peerLeft'
  | 'meetingEnded';

export class SignalingService {
  private socket: Socket;
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupEventListeners();
  }

  /**
   * 加入会议房间
   */
  async joinMeeting(meetingId: string): Promise<JoinMeetingResponse> {
    return this.sendRequest('rtc:join', { meetingId });
  }

  /**
   * 获取路由器 RTP 能力
   */
  async getRouterRtpCapabilities(meetingId: string): Promise<RtpCapabilities> {
    const response = await this.sendRequest('rtc:getRouterRtpCapabilities', { meetingId });
    return response.rtpCapabilities;
  }

  /**
   * 创建 Transport
   */
  async createTransport(meetingId: string, direction: 'send' | 'recv'): Promise<TransportParams> {
    return this.sendRequest('rtc:createTransport', { meetingId, direction });
  }

  /**
   * 连接 Transport
   */
  async connectTransport(
    meetingId: string,
    transportId: string,
    dtlsParameters: DtlsParameters
  ): Promise<void> {
    return this.sendRequest('rtc:connectTransport', {
      meetingId,
      transportId,
      dtlsParameters
    });
  }

  /**
   * 发布媒体流
   */
  async produce(
    meetingId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: RtpParameters,
    appData?: any
  ): Promise<string> {
    const response = await this.sendRequest('rtc:produce', {
      meetingId,
      transportId,
      kind,
      rtpParameters,
      appData
    });
    return response.producerId;
  }

  /**
   * 订阅媒体流
   */
  async consume(
    meetingId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<ConsumerParams> {
    return this.sendRequest('rtc:consume', {
      meetingId,
      producerId,
      rtpCapabilities
    });
  }

  /**
   * 恢复 Consumer
   */
  async resumeConsumer(meetingId: string, consumerId: string): Promise<void> {
    return this.sendRequest('rtc:resumeConsumer', {
      meetingId,
      consumerId
    });
  }

  /**
   * 离开会议
   */
  async leaveMeeting(meetingId: string): Promise<void> {
    return this.sendRequest('rtc:leave', { meetingId });
  }

  /**
   * 注册事件监听器
   */
  on(event: SignalingEvent, callback: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: SignalingEvent, callback: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.eventHandlers.clear();
    this.removeEventListeners();
  }

  /**
   * 发送请求并等待响应
   */
  private sendRequest<T>(event: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, data, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.data) {
          resolve(response.data);
        } else {
          reject(new Error(`No data received from ${event}`));
        }
      });
    });
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 新生产者事件
    this.socket.on('rtc:newProducer', (data: any) => {
      this.emitEvent('newProducer', data);
    });

    // 生产者关闭事件
    this.socket.on('rtc:producerClosed', (data: any) => {
      this.emitEvent('producerClosed', data);
    });

    // 新参与者加入事件
    this.socket.on('rtc:peerJoined', (data: any) => {
      this.emitEvent('peerJoined', data);
    });

    // 参与者离开事件
    this.socket.on('rtc:peerLeft', (data: any) => {
      this.emitEvent('peerLeft', data);
    });

    // 会议结束事件
    this.socket.on('rtc:meetingEnded', (data: any) => {
      this.emitEvent('meetingEnded', data);
    });
  }

  /**
   * 移除事件监听器
   */
  private removeEventListeners(): void {
    this.socket.off('rtc:newProducer', this.emitEvent.bind(this, 'newProducer'));
    this.socket.off('rtc:producerClosed', this.emitEvent.bind(this, 'producerClosed'));
    this.socket.off('rtc:peerJoined', this.emitEvent.bind(this, 'peerJoined'));
    this.socket.off('rtc:peerLeft', this.emitEvent.bind(this, 'peerLeft'));
    this.socket.off('rtc:meetingEnded', this.emitEvent.bind(this, 'meetingEnded'));
  }

  /**
   * 触发事件给所有注册的回调
   */
  private emitEvent(event: SignalingEvent, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }
}