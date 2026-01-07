/**
 * ZitiMCPClient - High-level MCP client over OpenZiti
 *
 * Provides a clean, typed API for interacting with MCP servers
 * over a zero-trust OpenZiti network.
 *
 * Usage:
 * ```typescript
 * const client = new ZitiMCPClient({
 *   identityPath: './identity.json',
 *   serviceName: 'my-mcp-server'
 * });
 *
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool('myTool', { arg: 'value' });
 * await client.disconnect();
 * ```
 */

import { EventEmitter } from 'events';
import { ZitiConnection } from '../ziti/ZitiConnection.js';
import { ZitiIdentity } from '../ziti/ZitiIdentity.js';
import { ZitiLogLevel } from '../ziti/types.js';
import { ZitiSSETransport } from '../transport/ZitiSSETransport.js';
import { TransportState, MCPMessage } from '../transport/ITransport.js';
import { Logger, LogLevel, defaultLogger } from '../utils/Logger.js';
import {
  ClientInfo,
  ServerInfo,
  ClientCapabilities,
  ServerCapabilities,
  Tool,
  ToolCallResult,
  Resource,
  ResourceContents,
  Prompt,
  GetPromptResult,
  InitializeResult,
  ListToolsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  ListPromptsResult,
  MCPClientError,
  PROTOCOL_VERSION
} from '../protocol/types.js';

// =============================================================================
// Client Options
// =============================================================================

export interface ZitiMCPClientOptions {
  /** Path to the Ziti identity file */
  identityPath: string;

  /** Name of the Ziti service hosting the MCP server */
  serviceName: string;

  /** Client info to send during initialization */
  clientInfo?: ClientInfo;

  /** Client capabilities */
  capabilities?: ClientCapabilities;

  /** SSE endpoint path (default: /sse) */
  ssePath?: string;

  /** Message endpoint path (default: /message) */
  messagePath?: string;

  /** Auto-reconnect on connection loss */
  autoReconnect?: boolean;

  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;

  /** Reconnection delay in ms */
  reconnectDelay?: number;

  /** Connection timeout in ms */
  connectTimeout?: number;

  /** Request timeout in ms */
  requestTimeout?: number;

  /** Ziti SDK log level */
  zitiLogLevel?: ZitiLogLevel;

  /** SDK log level */
  logLevel?: LogLevel;

  /** Custom logger */
  logger?: Logger;
}

// =============================================================================
// Client State
// =============================================================================

export enum ClientState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  INITIALIZING = 'initializing',
  READY = 'ready',
  DISCONNECTING = 'disconnecting'
}

// =============================================================================
// Client Events
// =============================================================================

export interface ZitiMCPClientEvents {
  /** Client is ready to use */
  ready: (serverInfo: ServerInfo) => void;

  /** Client disconnected */
  disconnected: (reason?: string) => void;

  /** Client error */
  error: (error: Error) => void;

  /** Server notification received */
  notification: (method: string, params?: unknown) => void;

  /** Tools list changed */
  toolsChanged: () => void;

  /** Resources list changed */
  resourcesChanged: () => void;

  /** Prompts list changed */
  promptsChanged: () => void;

  /** Resource updated */
  resourceUpdated: (uri: string) => void;

  /** Log message from server */
  log: (level: string, message: string, data?: unknown) => void;

  /** State changed */
  stateChange: (state: ClientState) => void;
}

// =============================================================================
// ZitiMCPClient
// =============================================================================

export class ZitiMCPClient extends EventEmitter {
  private options: Required<ZitiMCPClientOptions>;
  private logger: Logger;
  private identity: ZitiIdentity;
  private connection: ZitiConnection | null = null;
  private transport: ZitiSSETransport | null = null;
  private _state: ClientState = ClientState.DISCONNECTED;
  private _serverInfo: ServerInfo | null = null;
  private _serverCapabilities: ServerCapabilities | null = null;
  private _requestId: number = 0;

  constructor(options: ZitiMCPClientOptions) {
    super();

    this.options = {
      clientInfo: { name: 'ziti-mcp-sdk', version: '0.1.0' },
      capabilities: {},
      ssePath: '/sse',
      messagePath: '/message',
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      connectTimeout: 30000,
      requestTimeout: 60000,
      zitiLogLevel: ZitiLogLevel.WARN,
      logLevel: LogLevel.INFO,
      logger: defaultLogger,
      ...options
    };

    this.logger = this.options.logger.child('MCPClient');
    this.logger.setLevel(this.options.logLevel);
    this.identity = new ZitiIdentity(this.options.identityPath);
  }

  // ===========================================================================
  // Properties
  // ===========================================================================

  get state(): ClientState {
    return this._state;
  }

  get serverInfo(): ServerInfo | null {
    return this._serverInfo;
  }

  get serverCapabilities(): ServerCapabilities | null {
    return this._serverCapabilities;
  }

  get isReady(): boolean {
    return this._state === ClientState.READY;
  }

  get sessionId(): string | null {
    return this.transport?.sessionId ?? null;
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  private setState(state: ClientState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit('stateChange', state);
    }
  }

  private nextRequestId(): number {
    return ++this._requestId;
  }

  // ===========================================================================
  // Connection Lifecycle
  // ===========================================================================

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<InitializeResult> {
    if (this._state === ClientState.READY) {
      throw new MCPClientError('Already connected', -1);
    }

    if (this._state === ClientState.CONNECTING || this._state === ClientState.INITIALIZING) {
      throw new MCPClientError('Connection in progress', -1);
    }

    this.setState(ClientState.CONNECTING);
    this.logger.info(`Connecting to ${this.options.serviceName}...`);

    try {
      // Validate identity
      const identityInfo = await this.identity.validate();
      if (!identityInfo.isValid) {
        throw new MCPClientError(`Invalid identity: ${identityInfo.error}`, -1);
      }

      // Create Ziti connection
      this.connection = new ZitiConnection({
        identityPath: this.identity.getPath(),
        logLevel: this.options.zitiLogLevel,
        connectTimeout: this.options.connectTimeout,
        requestTimeout: this.options.requestTimeout
      });

      // Initialize Ziti SDK
      this.logger.debug('Initializing Ziti SDK...');
      await this.connection.init();

      // Note: We skip the serviceAvailable check because the Ziti SDK returns
      // an object instead of a status code. The actual availability will be
      // verified when we try to connect via the transport.

      // Create transport
      this.transport = new ZitiSSETransport(this.connection, {
        serviceName: this.options.serviceName,
        ssePath: this.options.ssePath,
        messagePath: this.options.messagePath,
        autoReconnect: this.options.autoReconnect,
        maxReconnectAttempts: this.options.maxReconnectAttempts,
        reconnectDelay: this.options.reconnectDelay,
        connectTimeout: this.options.connectTimeout,
        requestTimeout: this.options.requestTimeout,
        logger: this.logger
      });

      // Set up transport event handlers
      this.setupTransportListeners();

      // Connect transport
      this.logger.debug('Connecting transport...');
      await this.transport.connect();

      // Initialize MCP session
      this.setState(ClientState.INITIALIZING);
      const result = await this.initialize();

      this.setState(ClientState.READY);
      this.logger.info(`Connected to ${result.serverInfo.name} v${result.serverInfo.version}`);

      this.emit('ready', result.serverInfo);
      return result;

    } catch (error) {
      this.setState(ClientState.DISCONNECTED);
      await this.cleanup();

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Connection failed: ${message}`);

      throw error instanceof MCPClientError
        ? error
        : new MCPClientError(`Connection failed: ${message}`, -1);
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this._state === ClientState.DISCONNECTED) {
      return;
    }

    this.setState(ClientState.DISCONNECTING);
    this.logger.info('Disconnecting...');

    await this.cleanup();

    this.setState(ClientState.DISCONNECTED);
    this.emit('disconnected', 'User requested disconnect');
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this._serverInfo = null;
    this._serverCapabilities = null;
  }

  /**
   * Set up transport event listeners
   */
  private setupTransportListeners(): void {
    if (!this.transport) return;

    this.transport.on('message', (message: MCPMessage) => {
      this.handleNotification(message);
    });

    this.transport.on('error', (error: Error) => {
      this.logger.error(`Transport error: ${error.message}`);
      this.emit('error', error);
    });

    this.transport.on('disconnected', (reason?: string) => {
      if (this._state !== ClientState.DISCONNECTING) {
        this.logger.warn(`Unexpected disconnect: ${reason}`);
        this._state = ClientState.DISCONNECTED;
        this.emit('disconnected', reason);
      }
    });

    this.transport.on('reconnecting', (attempt: number) => {
      this.logger.info(`Reconnecting (attempt ${attempt})...`);
      this.setState(ClientState.CONNECTING);
    });

    this.transport.on('stateChange', (state: TransportState) => {
      if (state === TransportState.CONNECTED && this._state === ClientState.CONNECTING) {
        // Re-initialize after reconnect
        this.reinitialize();
      }
    });
  }

  /**
   * Handle server notifications
   */
  private handleNotification(message: MCPMessage): void {
    if (!message.method) return;

    this.emit('notification', message.method, message.params);

    switch (message.method) {
      case 'notifications/tools/list_changed':
        this.emit('toolsChanged');
        break;

      case 'notifications/resources/list_changed':
        this.emit('resourcesChanged');
        break;

      case 'notifications/prompts/list_changed':
        this.emit('promptsChanged');
        break;

      case 'notifications/resources/updated':
        const uri = (message.params as { uri: string })?.uri;
        if (uri) {
          this.emit('resourceUpdated', uri);
        }
        break;

      case 'notifications/message':
        const logParams = message.params as { level: string; data?: unknown };
        if (logParams) {
          this.emit('log', logParams.level, String(logParams.data), logParams.data);
        }
        break;

      default:
        this.logger.debug(`Unknown notification: ${message.method}`);
    }
  }

  // ===========================================================================
  // MCP Protocol Methods
  // ===========================================================================

  /**
   * Initialize the MCP session
   */
  private async initialize(): Promise<InitializeResult> {
    this.logger.debug('Sending initialize request...');

    const result = await this.request<InitializeResult>('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: this.options.capabilities,
      clientInfo: this.options.clientInfo
    });

    this._serverInfo = result.serverInfo;
    this._serverCapabilities = result.capabilities;

    // Send initialized notification
    await this.notify('notifications/initialized');

    return result;
  }

  /**
   * Re-initialize after reconnect
   */
  private async reinitialize(): Promise<void> {
    try {
      this.setState(ClientState.INITIALIZING);
      await this.initialize();
      this.setState(ClientState.READY);
      this.logger.info('Reconnected and re-initialized');
    } catch (error) {
      this.logger.error(`Re-initialization failed: ${error}`);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * List available tools
   */
  async listTools(cursor?: string): Promise<ListToolsResult> {
    this.ensureReady();
    return this.request<ListToolsResult>('tools/list', cursor ? { cursor } : {});
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult> {
    this.ensureReady();
    return this.request<ToolCallResult>('tools/call', {
      name,
      arguments: args || {}
    });
  }

  /**
   * List available resources
   */
  async listResources(cursor?: string): Promise<ListResourcesResult> {
    this.ensureReady();
    return this.request<ListResourcesResult>('resources/list', cursor ? { cursor } : {});
  }

  /**
   * List resource templates
   */
  async listResourceTemplates(cursor?: string): Promise<ListResourceTemplatesResult> {
    this.ensureReady();
    return this.request<ListResourceTemplatesResult>('resources/templates/list', cursor ? { cursor } : {});
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<ResourceContents[]> {
    this.ensureReady();
    const result = await this.request<ReadResourceResult>('resources/read', { uri });
    return result.contents;
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeResource(uri: string): Promise<void> {
    this.ensureReady();
    if (!this._serverCapabilities?.resources?.subscribe) {
      throw new MCPClientError('Server does not support resource subscriptions', -1);
    }
    await this.request('resources/subscribe', { uri });
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeResource(uri: string): Promise<void> {
    this.ensureReady();
    await this.request('resources/unsubscribe', { uri });
  }

  /**
   * List available prompts
   */
  async listPrompts(cursor?: string): Promise<ListPromptsResult> {
    this.ensureReady();
    return this.request<ListPromptsResult>('prompts/list', cursor ? { cursor } : {});
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    this.ensureReady();
    return this.request<GetPromptResult>('prompts/get', {
      name,
      arguments: args
    });
  }

  /**
   * Send a ping to the server
   */
  async ping(): Promise<void> {
    this.ensureReady();
    await this.request('ping', {});
  }

  /**
   * Set the logging level on the server
   */
  async setLoggingLevel(level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'): Promise<void> {
    this.ensureReady();
    await this.request('logging/setLevel', { level });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Ensure client is ready for operations
   */
  private ensureReady(): void {
    if (this._state !== ClientState.READY) {
      throw new MCPClientError(`Client not ready (state: ${this._state})`, -1);
    }
    if (!this.transport || !this.transport.isReady()) {
      throw new MCPClientError('Transport not ready', -1);
    }
  }

  /**
   * Send a request and wait for response
   */
  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.transport) {
      throw new MCPClientError('No transport available', -1);
    }

    const id = this.nextRequestId();

    this.logger.debug(`Request [${id}]: ${method}`);

    try {
      const result = await this.transport.request({
        jsonrpc: '2.0',
        id,
        method,
        params
      });

      this.logger.debug(`Response [${id}]: success`);
      return result as T;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Request [${id}] failed: ${message}`);
      throw error instanceof MCPClientError
        ? error
        : new MCPClientError(message, -1);
    }
  }

  /**
   * Send a notification (no response expected)
   */
  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.transport) {
      throw new MCPClientError('No transport available', -1);
    }

    await this.transport.send({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Get all tools (handles pagination)
   */
  async getAllTools(): Promise<Tool[]> {
    const tools: Tool[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.listTools(cursor);
      tools.push(...result.tools);
      cursor = result.nextCursor;
    } while (cursor);

    return tools;
  }

  /**
   * Get all resources (handles pagination)
   */
  async getAllResources(): Promise<Resource[]> {
    const resources: Resource[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.listResources(cursor);
      resources.push(...result.resources);
      cursor = result.nextCursor;
    } while (cursor);

    return resources;
  }

  /**
   * Get all prompts (handles pagination)
   */
  async getAllPrompts(): Promise<Prompt[]> {
    const prompts: Prompt[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.listPrompts(cursor);
      prompts.push(...result.prompts);
      cursor = result.nextCursor;
    } while (cursor);

    return prompts;
  }

  /**
   * Check if a specific tool exists
   */
  async hasTool(name: string): Promise<boolean> {
    const tools = await this.getAllTools();
    return tools.some(t => t.name === name);
  }

  /**
   * Get a specific tool by name
   */
  async getTool(name: string): Promise<Tool | undefined> {
    const tools = await this.getAllTools();
    return tools.find(t => t.name === name);
  }
}

export default ZitiMCPClient;
