import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignalingService } from '../../../../apps/web/src/services/signaling.service';

// Mock WebSocket
const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

describe('SignalingService', () => {
  let signalingService: SignalingService;

  beforeEach(() => {
    vi.clearAllMocks();
    signalingService = new SignalingService(mockSocket as any);
  });

  describe('joinMeeting', () => {
    it('should send join request and return peer info', async () => {
      const mockResponse = {
        peerId: 'peer-123',
        peers: [
          {
            peerId: 'peer-456',
            userId: 'user-456',
            nickname: '李四',
            producers: []
          }
        ]
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:join') {
          callback({ data: mockResponse });
        }
      });

      const result = await signalingService.joinMeeting('meeting-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:join',
        { meetingId: 'meeting-123' },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on join failure', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:join') {
          callback({ error: 'Meeting not found' });
        }
      });

      await expect(signalingService.joinMeeting('meeting-123')).rejects.toThrow(
        'Meeting not found'
      );
    });
  });

  describe('getRouterRtpCapabilities', () => {
    it('should request router RTP capabilities', async () => {
      const mockCapabilities = {
        codecs: [
          { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000 },
          { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }
        ]
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:getRouterRtpCapabilities') {
          callback({ data: { rtpCapabilities: mockCapabilities } });
        }
      });

      const result = await signalingService.getRouterRtpCapabilities('meeting-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:getRouterRtpCapabilities',
        { meetingId: 'meeting-123' },
        expect.any(Function)
      );
      expect(result).toEqual(mockCapabilities);
    });
  });

  describe('createTransport', () => {
    it('should create send transport', async () => {
      const mockTransportParams = {
        transportId: 'transport-123',
        iceParameters: { usernameFragment: 'test', password: 'pass' },
        iceCandidates: [],
        dtlsParameters: { role: 'auto' }
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:createTransport') {
          callback({ data: mockTransportParams });
        }
      });

      const result = await signalingService.createTransport('meeting-123', 'send');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:createTransport',
        { meetingId: 'meeting-123', direction: 'send' },
        expect.any(Function)
      );
      expect(result).toEqual(mockTransportParams);
    });

    it('should create receive transport', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:createTransport') {
          callback({ data: { transportId: 'transport-456' } });
        }
      });

      const result = await signalingService.createTransport('meeting-123', 'recv');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:createTransport',
        { meetingId: 'meeting-123', direction: 'recv' },
        expect.any(Function)
      );
      expect(result.transportId).toBe('transport-456');
    });
  });

  describe('connectTransport', () => {
    it('should connect transport with DTLS parameters', async () => {
      const dtlsParameters = {
        role: 'client',
        fingerprints: []
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:connectTransport') {
          callback({ data: { transportId: 'transport-123' } });
        }
      });

      await signalingService.connectTransport('meeting-123', 'transport-123', dtlsParameters);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:connectTransport',
        {
          meetingId: 'meeting-123',
          transportId: 'transport-123',
          dtlsParameters
        },
        expect.any(Function)
      );
    });
  });

  describe('produce', () => {
    it('should produce media stream', async () => {
      const rtpParameters = {
        codecs: [{ mimeType: 'video/VP8', payloadType: 101, clockRate: 90000 }],
        encodings: [{ rid: 'r0', maxBitrate: 100000 }]
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:produce') {
          callback({ data: { producerId: 'producer-123' } });
        }
      });

      const result = await signalingService.produce(
        'meeting-123',
        'transport-123',
        'video',
        rtpParameters,
        { source: 'camera' }
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:produce',
        {
          meetingId: 'meeting-123',
          transportId: 'transport-123',
          kind: 'video',
          rtpParameters,
          appData: { source: 'camera' }
        },
        expect.any(Function)
      );
      expect(result).toBe('producer-123');
    });
  });

  describe('consume', () => {
    it('should consume remote producer', async () => {
      const rtpCapabilities = {
        codecs: [{ mimeType: 'video/VP8', clockRate: 90000 }]
      };

      const mockConsumerParams = {
        id: 'consumer-123',
        producerId: 'producer-456',
        kind: 'video',
        rtpParameters: { codecs: [] },
        type: 'simulcast',
        producerPaused: false
      };

      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:consume') {
          callback({ data: mockConsumerParams });
        }
      });

      const result = await signalingService.consume(
        'meeting-123',
        'producer-456',
        rtpCapabilities
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:consume',
        {
          meetingId: 'meeting-123',
          producerId: 'producer-456',
          rtpCapabilities
        },
        expect.any(Function)
      );
      expect(result).toEqual(mockConsumerParams);
    });
  });

  describe('resumeConsumer', () => {
    it('should resume consumer to start receiving', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:resumeConsumer') {
          callback({ data: { consumerId: 'consumer-123' } });
        }
      });

      await signalingService.resumeConsumer('meeting-123', 'consumer-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:resumeConsumer',
        { meetingId: 'meeting-123', consumerId: 'consumer-123' },
        expect.any(Function)
      );
    });
  });

  describe('leaveMeeting', () => {
    it('should leave the meeting room', async () => {
      mockSocket.emit.mockImplementation((event, data, callback) => {
        if (event === 'rtc:leave') {
          callback({ data: { peerId: 'peer-123' } });
        }
      });

      await signalingService.leaveMeeting('meeting-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'rtc:leave',
        { meetingId: 'meeting-123' },
        expect.any(Function)
      );
    });
  });

  describe('event listeners', () => {
    it('should setup event listeners for server events', () => {
      signalingService.on('newProducer', () => {});
      signalingService.on('producerClosed', () => {});
      signalingService.on('peerJoined', () => {});
      signalingService.on('peerLeft', () => {});

      expect(mockSocket.on).toHaveBeenCalledWith('rtc:newProducer', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('rtc:producerClosed', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('rtc:peerJoined', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('rtc:peerLeft', expect.any(Function));
    });

    it('should remove event listeners on cleanup', () => {
      const newProducerCallback = vi.fn();
      signalingService.on('newProducer', newProducerCallback);

      signalingService.cleanup();

      expect(mockSocket.off).toHaveBeenCalledWith('rtc:newProducer', expect.any(Function));
    });

    it('should forward server events to registered callbacks', () => {
      const newProducerCallback = vi.fn();
      const producerData = {
        producerId: 'producer-123',
        peerId: 'peer-456',
        kind: 'video'
      };

      signalingService.on('newProducer', newProducerCallback);

      // Simulate socket event
      const eventHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'rtc:newProducer'
      )?.[1];

      if (eventHandler) {
        eventHandler(producerData);
      }

      expect(newProducerCallback).toHaveBeenCalledWith(producerData);
    });
  });
});