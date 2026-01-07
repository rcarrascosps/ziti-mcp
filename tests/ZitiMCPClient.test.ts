/**
 * Tests for ZitiMCPClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ZitiMCPClient, ClientState } from '../src/client/ZitiMCPClient.js';
import { MCPClientError } from '../src/protocol/types.js';

// Mock ZitiIdentity
vi.mock('../src/ziti/ZitiIdentity.js', () => ({
  ZitiIdentity: vi.fn().mockImplementation(() => ({
    getPath: () => '/mock/identity.json',
    validate: vi.fn().mockResolvedValue({
      isValid: true,
      path: '/mock/identity.json',
      apiEndpoint: 'https://controller.example.com'
    })
  }))
}));

// Mock ZitiConnection
const mockZitiConnection = {
  init: vi.fn().mockResolvedValue(undefined),
  isInitialized: vi.fn().mockReturnValue(true),
  isServiceAvailable: vi.fn().mockResolvedValue({
    available: true,
    permissions: { dial: true, bind: false }
  }),
  close: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../src/ziti/ZitiConnection.js', () => ({
  ZitiConnection: vi.fn().mockImplementation(() => mockZitiConnection)
}));

// Mock ZitiSSETransport
class MockTransport extends EventEmitter {
  sessionId = 'mock-session-id';

  connect = vi.fn().mockResolvedValue(undefined);
  disconnect = vi.fn().mockResolvedValue(undefined);
  send = vi.fn().mockResolvedValue(undefined);
  request = vi.fn();
  isReady = vi.fn().mockReturnValue(true);
}

let mockTransport: MockTransport;

vi.mock('../src/transport/ZitiSSETransport.js', () => ({
  ZitiSSETransport: vi.fn().mockImplementation(() => {
    mockTransport = new MockTransport();
    return mockTransport;
  })
}));

describe('ZitiMCPClient', () => {
  let client: ZitiMCPClient;

  const defaultInitResponse = {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true }
    },
    serverInfo: {
      name: 'test-server',
      version: '1.0.0'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    client = new ZitiMCPClient({
      identityPath: '/mock/identity.json',
      serviceName: 'test-service'
    });
  });

  afterEach(async () => {
    if (client.state !== ClientState.DISCONNECTED) {
      await client.disconnect();
    }
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      expect(client.state).toBe(ClientState.DISCONNECTED);
      expect(client.serverInfo).toBeNull();
      expect(client.serverCapabilities).toBeNull();
      expect(client.isReady).toBe(false);
    });

    it('should accept custom options', () => {
      const customClient = new ZitiMCPClient({
        identityPath: '/custom/identity.json',
        serviceName: 'custom-service',
        clientInfo: { name: 'custom-client', version: '2.0.0' },
        autoReconnect: false,
        connectTimeout: 5000
      });

      expect(customClient).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect and initialize successfully', async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);

      const readyHandler = vi.fn();
      client.on('ready', readyHandler);

      await client.connect();

      expect(client.state).toBe(ClientState.READY);
      expect(client.isReady).toBe(true);
      expect(client.serverInfo).toEqual(defaultInitResponse.serverInfo);
      expect(client.serverCapabilities).toEqual(defaultInitResponse.capabilities);
      expect(readyHandler).toHaveBeenCalledWith(defaultInitResponse.serverInfo);
    });

    it('should throw if already connected', async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);

      await client.connect();

      await expect(client.connect()).rejects.toThrow('Already connected');
    });

    it('should throw on invalid identity', async () => {
      const { ZitiIdentity } = await import('../src/ziti/ZitiIdentity.js');
      (ZitiIdentity as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        getPath: () => '/invalid/identity.json',
        validate: vi.fn().mockResolvedValue({
          isValid: false,
          error: 'File not found'
        })
      }));

      const invalidClient = new ZitiMCPClient({
        identityPath: '/invalid/identity.json',
        serviceName: 'test-service'
      });

      await expect(invalidClient.connect()).rejects.toThrow('Invalid identity');
    });

    it('should throw if service not available', async () => {
      mockZitiConnection.isServiceAvailable.mockResolvedValueOnce({
        available: false,
        permissions: { dial: false, bind: false }
      });

      await expect(client.connect()).rejects.toThrow('not available');
    });

    it('should emit stateChange events', async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);

      const stateChanges: ClientState[] = [];
      client.on('stateChange', (state) => stateChanges.push(state));

      await client.connect();

      expect(stateChanges).toContain(ClientState.CONNECTING);
      expect(stateChanges).toContain(ClientState.INITIALIZING);
      expect(stateChanges).toContain(ClientState.READY);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should disconnect successfully', async () => {
      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      await client.disconnect();

      expect(client.state).toBe(ClientState.DISCONNECTED);
      expect(client.isReady).toBe(false);
      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await client.disconnect();
      await client.disconnect();

      expect(client.state).toBe(ClientState.DISCONNECTED);
    });
  });

  describe('listTools', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should list tools', async () => {
      const toolsResponse = {
        tools: [
          { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } },
          { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object' } }
        ]
      };
      mockTransport.request.mockResolvedValueOnce(toolsResponse);

      const result = await client.listTools();

      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].name).toBe('tool1');
      expect(mockTransport.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'tools/list' })
      );
    });

    it('should throw if not connected', async () => {
      await client.disconnect();

      await expect(client.listTools()).rejects.toThrow('not ready');
    });
  });

  describe('callTool', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should call tool with arguments', async () => {
      const toolResult = {
        content: [{ type: 'text', text: 'Result' }]
      };
      mockTransport.request.mockResolvedValueOnce(toolResult);

      const result = await client.callTool('myTool', { arg1: 'value1' });

      expect(result.content).toHaveLength(1);
      expect(mockTransport.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'tools/call',
          params: { name: 'myTool', arguments: { arg1: 'value1' } }
        })
      );
    });

    it('should call tool without arguments', async () => {
      mockTransport.request.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }]
      });

      await client.callTool('simpleTool');

      expect(mockTransport.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { name: 'simpleTool', arguments: {} }
        })
      );
    });
  });

  describe('listResources', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should list resources', async () => {
      const resourcesResponse = {
        resources: [
          { uri: 'file:///test.txt', name: 'test.txt' }
        ]
      };
      mockTransport.request.mockResolvedValueOnce(resourcesResponse);

      const result = await client.listResources();

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].uri).toBe('file:///test.txt');
    });
  });

  describe('readResource', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should read resource contents', async () => {
      const readResult = {
        contents: [
          { uri: 'file:///test.txt', text: 'Hello World', mimeType: 'text/plain' }
        ]
      };
      mockTransport.request.mockResolvedValueOnce(readResult);

      const contents = await client.readResource('file:///test.txt');

      expect(contents).toHaveLength(1);
      expect(contents[0].text).toBe('Hello World');
      expect(mockTransport.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'resources/read',
          params: { uri: 'file:///test.txt' }
        })
      );
    });
  });

  describe('listPrompts', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should list prompts', async () => {
      const promptsResponse = {
        prompts: [
          { name: 'greeting', description: 'A greeting prompt' }
        ]
      };
      mockTransport.request.mockResolvedValueOnce(promptsResponse);

      const result = await client.listPrompts();

      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].name).toBe('greeting');
    });
  });

  describe('getPrompt', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should get prompt with arguments', async () => {
      const promptResult = {
        messages: [
          { role: 'user', content: { type: 'text', text: 'Hello John!' } }
        ]
      };
      mockTransport.request.mockResolvedValueOnce(promptResult);

      const result = await client.getPrompt('greeting', { name: 'John' });

      expect(result.messages).toHaveLength(1);
      expect(mockTransport.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'prompts/get',
          params: { name: 'greeting', arguments: { name: 'John' } }
        })
      );
    });
  });

  describe('notifications', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should emit toolsChanged event', () => {
      const handler = vi.fn();
      client.on('toolsChanged', handler);

      mockTransport.emit('message', {
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed'
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit resourcesChanged event', () => {
      const handler = vi.fn();
      client.on('resourcesChanged', handler);

      mockTransport.emit('message', {
        jsonrpc: '2.0',
        method: 'notifications/resources/list_changed'
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit resourceUpdated event with uri', () => {
      const handler = vi.fn();
      client.on('resourceUpdated', handler);

      mockTransport.emit('message', {
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: { uri: 'file:///updated.txt' }
      });

      expect(handler).toHaveBeenCalledWith('file:///updated.txt');
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should get all tools with pagination', async () => {
      mockTransport.request
        .mockResolvedValueOnce({
          tools: [{ name: 'tool1', inputSchema: { type: 'object' } }],
          nextCursor: 'cursor1'
        })
        .mockResolvedValueOnce({
          tools: [{ name: 'tool2', inputSchema: { type: 'object' } }]
        });

      const tools = await client.getAllTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    it('should check if tool exists', async () => {
      mockTransport.request.mockResolvedValueOnce({
        tools: [
          { name: 'existingTool', inputSchema: { type: 'object' } }
        ]
      });

      const exists = await client.hasTool('existingTool');
      expect(exists).toBe(true);
    });

    it('should get tool by name', async () => {
      const tool = { name: 'myTool', description: 'My tool', inputSchema: { type: 'object' } };
      mockTransport.request.mockResolvedValueOnce({ tools: [tool] });

      const result = await client.getTool('myTool');

      expect(result).toEqual(tool);
    });
  });

  describe('ping', () => {
    beforeEach(async () => {
      mockTransport = new MockTransport();
      mockTransport.request.mockResolvedValue(defaultInitResponse);
      await client.connect();
    });

    it('should ping server', async () => {
      mockTransport.request.mockResolvedValueOnce({});

      await client.ping();

      expect(mockTransport.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'ping' })
      );
    });
  });
});
