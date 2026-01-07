/**
 * Tests for ZitiSSETransport
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ZitiSSETransport } from '../src/transport/ZitiSSETransport.js';
import { TransportState } from '../src/transport/ITransport.js';
import { ZitiConnection, ZitiStream } from '../src/ziti/ZitiConnection.js';

// Mock ZitiStream
class MockZitiStream extends EventEmitter implements Partial<ZitiStream> {
  private _isOpen = true;
  readonly handle = 1;

  get isOpen() {
    return this._isOpen;
  }

  write = vi.fn();

  close() {
    this._isOpen = false;
    this.emit('close');
  }

  // Helper to simulate incoming data
  simulateData(data: string) {
    this.emit('data', Buffer.from(data));
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Mock ZitiConnection
const createMockConnection = () => {
  const mockStream = new MockZitiStream();

  return {
    connection: {
      isInitialized: vi.fn().mockReturnValue(true),
      createHttpStream: vi.fn().mockResolvedValue(mockStream),
      httpRequest: vi.fn().mockResolvedValue({
        status: 202,
        headers: {},
        body: Buffer.from('Accepted')
      })
    } as unknown as ZitiConnection,
    stream: mockStream
  };
};

describe('ZitiSSETransport', () => {
  let transport: ZitiSSETransport;
  let mockConnection: ZitiConnection;
  let mockStream: MockZitiStream;

  beforeEach(() => {
    const mock = createMockConnection();
    mockConnection = mock.connection;
    mockStream = mock.stream;

    transport = new ZitiSSETransport(mockConnection, {
      serviceName: 'test-service',
      connectTimeout: 5000,
      requestTimeout: 5000,
      autoReconnect: false
    });
  });

  afterEach(async () => {
    await transport.disconnect();
  });

  describe('connect', () => {
    it('should connect and establish session', async () => {
      const connectedHandler = vi.fn();
      transport.on('connected', connectedHandler);

      const connectPromise = transport.connect();

      // Simulate SSE response with endpoint event
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n' +
          'Content-Type: text/event-stream\r\n' +
          '\r\n' +
          'event: endpoint\n' +
          'data: /message?sessionId=test-session-123\n\n'
        );
      }, 10);

      await connectPromise;

      expect(transport.state).toBe(TransportState.CONNECTED);
      expect(transport.sessionId).toBe('test-session-123');
      expect(transport.isReady()).toBe(true);
      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should timeout if no session established', async () => {
      transport = new ZitiSSETransport(mockConnection, {
        serviceName: 'test-service',
        connectTimeout: 100,
        autoReconnect: false
      });

      await expect(transport.connect()).rejects.toThrow('timeout');
    });

    it('should throw if connection not initialized', async () => {
      (mockConnection.isInitialized as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await expect(transport.connect()).rejects.toThrow('not initialized');
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess123\n\n'
        );
      }, 10);
      await connectPromise;
    });

    it('should send message via HTTP POST', async () => {
      const message = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/list',
        params: {}
      };

      await transport.send(message);

      expect(mockConnection.httpRequest).toHaveBeenCalledWith(
        'test-service',
        expect.objectContaining({
          method: 'POST',
          path: '/message?sessionId=sess123',
          body: JSON.stringify(message)
        })
      );
    });

    it('should queue messages if not ready', async () => {
      await transport.disconnect();

      // Create new transport (not connected)
      transport = new ZitiSSETransport(mockConnection, {
        serviceName: 'test-service',
        autoReconnect: false
      });

      const message = { jsonrpc: '2.0' as const, method: 'test' };
      await transport.send(message);

      expect(transport.queuedMessageCount).toBe(1);
      expect(mockConnection.httpRequest).not.toHaveBeenCalled();
    });

    it('should process queued messages on connect', async () => {
      await transport.disconnect();

      transport = new ZitiSSETransport(mockConnection, {
        serviceName: 'test-service',
        connectTimeout: 5000,
        autoReconnect: false
      });

      // Queue some messages
      await transport.send({ jsonrpc: '2.0', method: 'msg1' });
      await transport.send({ jsonrpc: '2.0', method: 'msg2' });

      expect(transport.queuedMessageCount).toBe(2);

      // Connect
      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess456\n\n'
        );
      }, 10);
      await connectPromise;

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(transport.queuedMessageCount).toBe(0);
    });
  });

  describe('receive messages', () => {
    beforeEach(async () => {
      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess123\n\n'
        );
      }, 10);
      await connectPromise;
    });

    it('should emit message events', async () => {
      const messageHandler = vi.fn();
      transport.on('message', messageHandler);

      const mcpMessage = {
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed'
      };

      mockStream.simulateData(`data: ${JSON.stringify(mcpMessage)}\n\n`);

      expect(messageHandler).toHaveBeenCalledWith(mcpMessage);
    });

    it('should resolve pending requests', async () => {
      const responseMessage = {
        jsonrpc: '2.0',
        id: 42,
        result: { tools: ['tool1', 'tool2'] }
      };

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/list'
      });

      // Simulate response
      setTimeout(() => {
        mockStream.simulateData(`data: ${JSON.stringify(responseMessage)}\n\n`);
      }, 10);

      const result = await requestPromise;
      expect(result).toEqual({ tools: ['tool1', 'tool2'] });
    });

    it('should reject pending requests on error response', async () => {
      const errorMessage = {
        jsonrpc: '2.0',
        id: 43,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 43,
        method: 'invalid'
      });

      setTimeout(() => {
        mockStream.simulateData(`data: ${JSON.stringify(errorMessage)}\n\n`);
      }, 10);

      await expect(requestPromise).rejects.toThrow('Invalid Request');
    });

    it('should timeout pending requests', async () => {
      transport = new ZitiSSETransport(mockConnection, {
        serviceName: 'test-service',
        requestTimeout: 100,
        autoReconnect: false
      });

      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess789\n\n'
        );
      }, 10);
      await connectPromise;

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 99,
        method: 'slow/method'
      });

      await expect(requestPromise).rejects.toThrow('timeout');
    });
  });

  describe('disconnect', () => {
    it('should clean up on disconnect', async () => {
      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess123\n\n'
        );
      }, 10);
      await connectPromise;

      const disconnectedHandler = vi.fn();
      transport.on('disconnected', disconnectedHandler);

      await transport.disconnect();

      expect(transport.state).toBe(TransportState.CLOSED);
      expect(transport.sessionId).toBeNull();
      expect(transport.isReady()).toBe(false);
      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should reject pending requests on disconnect', async () => {
      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess123\n\n'
        );
      }, 10);
      await connectPromise;

      const requestPromise = transport.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'test'
      });

      await transport.disconnect();

      await expect(requestPromise).rejects.toThrow('disconnected');
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnect on stream error with autoReconnect', async () => {
      transport = new ZitiSSETransport(mockConnection, {
        serviceName: 'test-service',
        connectTimeout: 5000,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 50
      });

      const reconnectingHandler = vi.fn();
      transport.on('reconnecting', reconnectingHandler);

      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess123\n\n'
        );
      }, 10);
      await connectPromise;

      // Simulate error
      mockStream.simulateError(new Error('Connection lost'));

      // Wait for reconnect attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(reconnectingHandler).toHaveBeenCalledWith(1);
    });

    it('should handle server-requested reconnect', async () => {
      const connectPromise = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess123\n\n'
        );
      }, 10);
      await connectPromise;

      transport = new ZitiSSETransport(mockConnection, {
        serviceName: 'test-service',
        autoReconnect: true,
        reconnectDelay: 10
      });

      const stateChangeHandler = vi.fn();
      transport.on('stateChange', stateChangeHandler);

      // Start new connection
      const connectPromise2 = transport.connect();
      setTimeout(() => {
        mockStream.simulateData(
          'HTTP/1.1 200 OK\r\n\r\n' +
          'event: endpoint\ndata: /message?sessionId=sess456\n\n'
        );
      }, 10);
      await connectPromise2;

      // Simulate reconnect event
      mockStream.simulateData('event: reconnect\ndata: \n\n');

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have attempted reconnection
      expect(stateChangeHandler).toHaveBeenCalledWith(TransportState.RECONNECTING);
    });
  });
});
