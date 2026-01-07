/**
 * Tests for ZitiConnection
 *
 * Note: These tests mock the Ziti SDK since actual Ziti network
 * connectivity requires infrastructure setup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZitiConnection, ZitiLogLevel } from '../src/ziti/ZitiConnection.js';

// Mock the Ziti SDK
const mockZitiSDK = {
  init: vi.fn(),
  httpRequest: vi.fn(),
  dial: vi.fn(),
  write: vi.fn(),
  close: vi.fn(),
  serviceAvailable: vi.fn(),
  setLogLevel: vi.fn()
};

// Mock dynamic import
vi.mock('@openziti/ziti-sdk-nodejs', () => ({
  default: mockZitiSDK
}));

describe('ZitiConnection', () => {
  let connection: ZitiConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    connection = new ZitiConnection({
      identityPath: '/path/to/identity.json',
      logLevel: ZitiLogLevel.DEBUG
    });
  });

  afterEach(async () => {
    if (connection.isInitialized()) {
      await connection.close();
    }
  });

  describe('init', () => {
    it('should initialize successfully with valid identity', async () => {
      mockZitiSDK.init.mockResolvedValue(0);

      await connection.init();

      expect(connection.isInitialized()).toBe(true);
      expect(mockZitiSDK.init).toHaveBeenCalledWith('/path/to/identity.json');
      expect(mockZitiSDK.setLogLevel).toHaveBeenCalledWith(ZitiLogLevel.DEBUG);
    });

    it('should throw error on initialization failure', async () => {
      mockZitiSDK.init.mockResolvedValue(1);

      await expect(connection.init()).rejects.toThrow('Ziti initialization failed');
    });

    it('should not reinitialize if already initialized', async () => {
      mockZitiSDK.init.mockResolvedValue(0);

      await connection.init();
      await connection.init();

      expect(mockZitiSDK.init).toHaveBeenCalledTimes(1);
    });

    it('should emit initialized event', async () => {
      mockZitiSDK.init.mockResolvedValue(0);
      const handler = vi.fn();
      connection.on('initialized', handler);

      await connection.init();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('isServiceAvailable', () => {
    beforeEach(async () => {
      mockZitiSDK.init.mockResolvedValue(0);
      await connection.init();
    });

    it('should return available with dial permission', async () => {
      mockZitiSDK.serviceAvailable.mockImplementation((name, cb) => cb(1));

      const status = await connection.isServiceAvailable('test-service');

      expect(status.available).toBe(true);
      expect(status.permissions.dial).toBe(true);
      expect(status.permissions.bind).toBe(false);
    });

    it('should return available with bind permission', async () => {
      mockZitiSDK.serviceAvailable.mockImplementation((name, cb) => cb(2));

      const status = await connection.isServiceAvailable('test-service');

      expect(status.available).toBe(true);
      expect(status.permissions.dial).toBe(false);
      expect(status.permissions.bind).toBe(true);
    });

    it('should return unavailable for negative status', async () => {
      mockZitiSDK.serviceAvailable.mockImplementation((name, cb) => cb(-1));

      const status = await connection.isServiceAvailable('test-service');

      expect(status.available).toBe(false);
    });

    it('should throw if not initialized', async () => {
      const uninitConnection = new ZitiConnection({
        identityPath: '/path/to/identity.json'
      });

      await expect(uninitConnection.isServiceAvailable('test'))
        .rejects.toThrow('not initialized');
    });
  });

  describe('httpRequest', () => {
    beforeEach(async () => {
      mockZitiSDK.init.mockResolvedValue(0);
      await connection.init();
    });

    it('should make HTTP GET request', async () => {
      mockZitiSDK.httpRequest.mockImplementation(
        (service, scheme, method, path, headers, body, onReq, onRes, onData) => {
          onRes?.({ status: 200, headers: { 'content-type': 'application/json' } });
          onData?.({ body: Buffer.from('{"ok":true}') });
        }
      );

      const response = await connection.httpRequest('test-service', {
        method: 'GET',
        path: '/api/test',
        headers: { 'Accept': 'application/json' }
      });

      expect(response.status).toBe(200);
      expect(response.body.toString()).toBe('{"ok":true}');
      expect(mockZitiSDK.httpRequest).toHaveBeenCalledWith(
        'test-service',
        undefined,
        'GET',
        '/api/test',
        ['Accept: application/json'],
        undefined,
        undefined,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should make HTTP POST request with body', async () => {
      mockZitiSDK.httpRequest.mockImplementation(
        (service, scheme, method, path, headers, body, onReq, onRes, onData) => {
          onRes?.({ status: 201, headers: {} });
          onData?.({ body: Buffer.from('created') });
        }
      );

      const response = await connection.httpRequest('test-service', {
        method: 'POST',
        path: '/api/create',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}'
      });

      expect(response.status).toBe(201);
      expect(mockZitiSDK.httpRequest).toHaveBeenCalledWith(
        'test-service',
        undefined,
        'POST',
        '/api/create',
        ['Content-Type: application/json'],
        expect.any(Buffer),
        undefined,
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('createStream', () => {
    beforeEach(async () => {
      mockZitiSDK.init.mockResolvedValue(0);
      await connection.init();
    });

    it('should create a stream connection', async () => {
      const mockHandle = 42;
      mockZitiSDK.dial.mockImplementation((service, isWs, onConnect, onData) => {
        onConnect(mockHandle);
      });

      const stream = await connection.createStream('test-service');

      expect(stream.handle).toBe(mockHandle);
      expect(stream.isOpen).toBe(true);
      expect(connection.activeStreamCount).toBe(1);
    });

    it('should emit data events on stream', async () => {
      const mockHandle = 42;
      let dataCallback: (data: Buffer) => void = () => {};

      mockZitiSDK.dial.mockImplementation((service, isWs, onConnect, onData) => {
        dataCallback = onData;
        onConnect(mockHandle);
      });

      const stream = await connection.createStream('test-service');
      const dataHandler = vi.fn();
      stream.on('data', dataHandler);

      // Simulate incoming data
      dataCallback(Buffer.from('test data'));

      expect(dataHandler).toHaveBeenCalledWith(Buffer.from('test data'));
    });

    it('should close stream and cleanup', async () => {
      const mockHandle = 42;
      mockZitiSDK.dial.mockImplementation((service, isWs, onConnect) => {
        onConnect(mockHandle);
      });

      const stream = await connection.createStream('test-service');
      stream.close();

      expect(stream.isOpen).toBe(false);
      expect(mockZitiSDK.close).toHaveBeenCalledWith(mockHandle);
      expect(connection.activeStreamCount).toBe(0);
    });
  });

  describe('close', () => {
    it('should close all active streams', async () => {
      mockZitiSDK.init.mockResolvedValue(0);
      await connection.init();

      let handleCounter = 0;
      mockZitiSDK.dial.mockImplementation((service, isWs, onConnect) => {
        onConnect(++handleCounter);
      });

      await connection.createStream('service1');
      await connection.createStream('service2');

      expect(connection.activeStreamCount).toBe(2);

      await connection.close();

      expect(connection.activeStreamCount).toBe(0);
      expect(mockZitiSDK.close).toHaveBeenCalledTimes(2);
      expect(connection.isInitialized()).toBe(false);
    });

    it('should emit closed event', async () => {
      mockZitiSDK.init.mockResolvedValue(0);
      await connection.init();

      const handler = vi.fn();
      connection.on('closed', handler);

      await connection.close();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
