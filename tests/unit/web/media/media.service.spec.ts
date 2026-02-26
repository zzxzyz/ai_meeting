import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaService } from '../../../../apps/web/src/services/media.service';

// Mock mediasoup-client
globalThis.Device = vi.fn().mockImplementation(() => ({
  load: vi.fn().mockResolvedValue(undefined),
  rtpCapabilities: {
    codecs: [],
    headerExtensions: []
  },
  canProduce: vi.fn().mockReturnValue(true),
  createSendTransport: vi.fn(),
  createRecvTransport: vi.fn()
}));

// Mock WebSocket
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

// Mock navigator.mediaDevices
globalThis.navigator = {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue({
      getAudioTracks: () => [{ kind: 'audio', id: 'audio-track-1' }],
      getVideoTracks: () => [{ kind: 'video', id: 'video-track-1' }]
    })
  }
} as any;

describe('MediaService', () => {
  let mediaService: MediaService;

  beforeEach(() => {
    vi.clearAllMocks();
    mediaService = new MediaService(mockSocket as any);
  });

  describe('initialize', () => {
    it('should initialize device with router RTP capabilities', async () => {
      const mockRtpCapabilities = {
        codecs: [
          { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000 },
          { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }
        ]
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:getRouterRtpCapabilities') {
          callback({ rtpCapabilities: mockRtpCapabilities });
        }
      });

      await mediaService.initialize('meeting-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:getRouterRtpCapabilities',
        { meetingId: 'meeting-123' },
        expect.any(Function)
      );
      expect(mediaService['device'].load).toHaveBeenCalledWith({
        routerRtpCapabilities: mockRtpCapabilities
      });
    });

    it('should throw error if device initialization fails', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:getRouterRtpCapabilities') {
          callback({ error: 'Failed to get capabilities' });
        }
      });

      await expect(mediaService.initialize('meeting-123')).rejects.toThrow(
        'Failed to get router RTP capabilities'
      );
    });
  });

  describe('createSendTransport', () => {
    beforeEach(async () => {
      // Setup basic initialization
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:getRouterRtpCapabilities') {
          callback({ rtpCapabilities: { codecs: [] } });
        }
      });
      await mediaService.initialize('meeting-123');
    });

    it('should create send transport with correct parameters', async () => {
      const transportParams = {
        id: 'transport-123',
        iceParameters: { usernameFragment: 'test', password: 'pass' },
        iceCandidates: [],
        dtlsParameters: { role: 'auto' }
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:createTransport') {
          callback({ transportId: 'transport-123', ...transportParams });
        }
      });

      const mockTransport = {
        id: 'transport-123',
        on: vi.fn()
      };
      (mediaService['device'].createSendTransport as any).mockReturnValue(mockTransport);

      await mediaService.createSendTransport('meeting-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:createTransport',
        { meetingId: 'meeting-123', direction: 'send' },
        expect.any(Function)
      );
      expect(mediaService['device'].createSendTransport).toHaveBeenCalledWith(transportParams);
    });

    it('should setup transport event listeners', async () => {
      const mockTransport = {
        id: 'transport-123',
        on: vi.fn()
      };
      (mediaService['device'].createSendTransport as any).mockReturnValue(mockTransport);

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:createTransport') {
          callback({ transportId: 'transport-123', iceParameters: {}, iceCandidates: [], dtlsParameters: {} });
        }
      });

      await mediaService.createSendTransport('meeting-123');

      expect(mockTransport.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockTransport.on).toHaveBeenCalledWith('produce', expect.any(Function));
    });
  });

  describe('startLocalStream', () => {
    beforeEach(async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:getRouterRtpCapabilities') {
          callback({ rtpCapabilities: { codecs: [] } });
        }
      });
      await mediaService.initialize('meeting-123');
    });

    it('should get user media with correct constraints', async () => {
      await mediaService.startLocalStream();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
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
    });

    it('should create audio and video producers', async () => {
      const mockTransport = {
        produce: vi.fn().mockResolvedValue({ id: 'producer-123' })
      };
      mediaService['sendTransport'] = mockTransport as any;

      await mediaService.startLocalStream();

      expect(mockTransport.produce).toHaveBeenCalledWith(
        expect.objectContaining({
          track: expect.any(Object),
          codecOptions: expect.objectContaining({
            opusStereo: true,
            opusDtx: true,
            opusFec: true
          })
        })
      );

      expect(mockTransport.produce).toHaveBeenCalledWith(
        expect.objectContaining({
          track: expect.any(Object),
          encodings: expect.arrayContaining([
            { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
            { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
            { rid: 'r2', maxBitrate: 1500000, scalabilityMode: 'S1T3' }
          ])
        })
      );
    });
  });

  describe('consumeRemoteStream', () => {
    beforeEach(async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:getRouterRtpCapabilities') {
          callback({ rtpCapabilities: { codecs: [] } });
        }
      });
      await mediaService.initialize('meeting-123');
    });

    it('should consume remote stream and setup consumer', async () => {
      const consumerParams = {
        id: 'consumer-123',
        producerId: 'producer-456',
        kind: 'video',
        rtpParameters: { codecs: [] },
        type: 'simulcast',
        producerPaused: false
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:consume') {
          callback(consumerParams);
        } else if (event === 'rtc:resumeConsumer') {
          callback({});
        }
      });

      const mockTransport = {
        consume: vi.fn().mockResolvedValue({
          id: 'consumer-123',
          track: { kind: 'video' }
        })
      };
      mediaService['recvTransport'] = mockTransport as any;

      await mediaService.consumeRemoteStream('producer-456', 'peer-789');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:consume',
        {
          meetingId: 'meeting-123',
          producerId: 'producer-456',
          rtpCapabilities: mediaService['device'].rtpCapabilities
        },
        expect.any(Function)
      );

      expect(mockTransport.consume).toHaveBeenCalledWith(consumerParams);
    });
  });

  describe('cleanup', () => {
    it('should close all producers and transports', async () => {
      const mockProducer = { close: vi.fn() };
      const mockTransport = { close: vi.fn() };

      mediaService['audioProducer'] = mockProducer as any;
      mediaService['videoProducer'] = mockProducer as any;
      mediaService['sendTransport'] = mockTransport as any;
      mediaService['recvTransport'] = mockTransport as any;

      await mediaService.cleanup();

      expect(mockProducer.close).toHaveBeenCalledTimes(2);
      expect(mockTransport.close).toHaveBeenCalledTimes(2);
      expect(mockSocket.emit).toHaveBeenCalledWith('rtc:leave', { meetingId: undefined });
    });
  });
});