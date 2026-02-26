import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
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
  requestId?: string;
  data?: any;
  error?: string;
}

interface TransportParams {
  id: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: DtlsParameters;
}

interface ConsumerParams {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: RtpParameters;
  type: string;
  producerPaused: boolean;
}

export class MediaService {
  private device: Device;
  private socket: Socket;
  private meetingId?: string;

  // Transports
  private sendTransport?: Transport;
  private recvTransport?: Transport;

  // Producers
  private audioProducer?: Producer;
  private videoProducer?: Producer;
  private localStream?: MediaStream;

  // Consumers
  private consumers: Map<string, Consumer> = new Map();

  constructor(socket: Socket) {
    this.socket = socket;
    this.device = new Device();
  }

  /**
   * 初始化设备，加载路由器 RTP 能力
   */
  async initialize(meetingId: string): Promise<void> {
    this.meetingId = meetingId;

    try {
      const rtpCapabilities = await this.getRouterRtpCapabilities(meetingId);
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
    } catch (error) {
      throw new Error(`Failed to initialize media device: ${error}`);
    }
  }

  /**
   * 获取路由器 RTP 能力
   */
  private getRouterRtpCapabilities(meetingId: string): Promise<RtpCapabilities> {
    return new Promise((resolve, reject) => {
      this.socket.emit('rtc:getRouterRtpCapabilities', { meetingId }, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.data?.rtpCapabilities) {
          resolve(response.data.rtpCapabilities);
        } else {
          reject(new Error('Failed to get router RTP capabilities'));
        }
      });
    });
  }

  /**
   * 创建发送 Transport
   */
  async createSendTransport(meetingId: string): Promise<Transport> {
    const transportParams = await this.createTransport(meetingId, 'send');

    this.sendTransport = this.device.createSendTransport(transportParams);

    this.setupTransportEventHandlers(this.sendTransport, 'send');

    return this.sendTransport;
  }

  /**
   * 创建接收 Transport
   */
  async createRecvTransport(meetingId: string): Promise<Transport> {
    const transportParams = await this.createTransport(meetingId, 'recv');

    this.recvTransport = this.device.createRecvTransport(transportParams);

    this.setupTransportEventHandlers(this.recvTransport, 'recv');

    return this.recvTransport;
  }

  /**
   * 创建 Transport
   */
  private createTransport(meetingId: string, direction: 'send' | 'recv'): Promise<TransportParams> {
    return new Promise((resolve, reject) => {
      this.socket.emit('rtc:createTransport', { meetingId, direction }, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.data) {
          resolve(response.data);
        } else {
          reject(new Error('Failed to create transport'));
        }
      });
    });
  }

  /**
   * 设置 Transport 事件处理器
   */
  private setupTransportEventHandlers(transport: Transport, direction: 'send' | 'recv'): void {
    // Connect 事件（DTLS 握手）
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.connectTransport(transport.id, dtlsParameters);
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    // Produce 事件（仅发送 Transport）
    if (direction === 'send') {
      transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const producerId = await this.produce(transport.id, kind, rtpParameters, appData);
          callback({ id: producerId });
        } catch (error) {
          errback(error as Error);
        }
      });
    }
  }

  /**
   * 连接 Transport
   */
  private connectTransport(transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('rtc:connectTransport', {
        meetingId: this.meetingId,
        transportId,
        dtlsParameters
      }, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 发布媒体流
   */
  private produce(
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: RtpParameters,
    appData?: any
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.socket.emit('rtc:produce', {
        meetingId: this.meetingId,
        transportId,
        kind,
        rtpParameters,
        appData
      }, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.data?.producerId) {
          resolve(response.data.producerId);
        } else {
          reject(new Error('Failed to produce media'));
        }
      });
    });
  }

  /**
   * 开始本地音视频流
   */
  async startLocalStream(): Promise<MediaStream> {
    if (!this.sendTransport) {
      throw new Error('Send transport not initialized');
    }

    try {
      // 获取用户媒体
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        },
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        }
      });

      // 发布音频流
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.audioProducer = await this.sendTransport.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
            opusFec: true,
            opusMaxPlaybackRate: 48000
          }
        });
      }

      // 发布视频流（Simulcast）
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.videoProducer = await this.sendTransport.produce({
          track: videoTrack,
          encodings: [
            { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' }, // 低清
            { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' }, // 标清
            { rid: 'r2', maxBitrate: 1500000, scalabilityMode: 'S1T3' } // 高清
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000
          }
        });
      }

      return this.localStream;
    } catch (error) {
      throw new Error(`Failed to start local stream: ${error}`);
    }
  }

  /**
   * 订阅远端流
   */
  async consumeRemoteStream(producerId: string, peerId: string): Promise<Consumer> {
    if (!this.recvTransport) {
      throw new Error('Receive transport not initialized');
    }

    try {
      const consumerParams = await this.consume(producerId);
      const consumer = await this.recvTransport.consume(consumerParams);

      // 恢复 Consumer 开始接收数据
      await this.resumeConsumer(consumer.id);

      this.consumers.set(consumer.id, consumer);

      return consumer;
    } catch (error) {
      throw new Error(`Failed to consume remote stream: ${error}`);
    }
  }

  /**
   * 订阅 Producer
   */
  private consume(producerId: string): Promise<ConsumerParams> {
    return new Promise((resolve, reject) => {
      this.socket.emit('rtc:consume', {
        meetingId: this.meetingId,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      }, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else if (response.data) {
          resolve(response.data);
        } else {
          reject(new Error('Failed to consume producer'));
        }
      });
    });
  }

  /**
   * 恢复 Consumer
   */
  private resumeConsumer(consumerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('rtc:resumeConsumer', {
        meetingId: this.meetingId,
        consumerId
      }, (response: SignalingResponse) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 获取本地流
   */
  getLocalStream(): MediaStream | undefined {
    return this.localStream;
  }

  /**
   * 获取音频 Producer
   */
  getAudioProducer(): Producer | undefined {
    return this.audioProducer;
  }

  /**
   * 获取视频 Producer
   */
  getVideoProducer(): Producer | undefined {
    return this.videoProducer;
  }

  /**
   * 获取 Consumer
   */
  getConsumer(consumerId: string): Consumer | undefined {
    return this.consumers.get(consumerId);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 关闭 Producers
    if (this.audioProducer) {
      this.audioProducer.close();
      this.audioProducer = undefined;
    }
    if (this.videoProducer) {
      this.videoProducer.close();
      this.videoProducer = undefined;
    }

    // 关闭 Consumers
    this.consumers.forEach(consumer => consumer.close());
    this.consumers.clear();

    // 关闭 Transports
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = undefined;
    }
    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = undefined;
    }

    // 关闭本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = undefined;
    }

    // 通知服务端离开
    if (this.meetingId) {
      this.socket.emit('rtc:leave', { meetingId: this.meetingId });
    }
  }
}