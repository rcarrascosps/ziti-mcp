/**
 * ITransport - Abstract transport interface for MCP communication
 *
 * Transports handle the low-level communication with MCP servers,
 * abstracting away the specific protocol (SSE, WebSocket, stdio, etc.)
 */

import { EventEmitter } from 'events';

/**
 * MCP JSON-RPC message structure
 */
export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Transport connection state
 */
export enum TransportState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSED = 'closed'
}

/**
 * Transport configuration options
 */
export interface TransportOptions {
  /** Auto-reconnect on connection loss */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Base delay between reconnection attempts (ms) */
  reconnectDelay?: number;
  /** Connection timeout (ms) */
  connectTimeout?: number;
  /** Request timeout (ms) */
  requestTimeout?: number;
}

/**
 * Transport events
 */
export interface TransportEvents {
  /** Emitted when transport connects successfully */
  connected: () => void;
  /** Emitted when transport disconnects */
  disconnected: (reason?: string) => void;
  /** Emitted when a message is received */
  message: (message: MCPMessage) => void;
  /** Emitted on transport error */
  error: (error: Error) => void;
  /** Emitted when reconnecting */
  reconnecting: (attempt: number) => void;
  /** Emitted when transport state changes */
  stateChange: (state: TransportState) => void;
}

/**
 * Abstract transport interface
 *
 * All MCP transports must implement this interface to ensure
 * consistent behavior across different transport mechanisms.
 */
export interface ITransport extends EventEmitter {
  /** Current transport state */
  readonly state: TransportState;

  /** Session ID (if applicable) */
  readonly sessionId: string | null;

  /**
   * Connect to the MCP server
   */
  connect(): Promise<void>;

  /**
   * Send a message to the MCP server
   */
  send(message: MCPMessage): Promise<void>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<void>;

  /**
   * Check if transport is connected and ready
   */
  isReady(): boolean;

  // Event emitter methods with typed events
  on<K extends keyof TransportEvents>(event: K, listener: TransportEvents[K]): this;
  off<K extends keyof TransportEvents>(event: K, listener: TransportEvents[K]): this;
  emit<K extends keyof TransportEvents>(event: K, ...args: Parameters<TransportEvents[K]>): boolean;
}

/**
 * Base transport class with common functionality
 */
export abstract class BaseTransport extends EventEmitter implements ITransport {
  protected _state: TransportState = TransportState.DISCONNECTED;
  protected _sessionId: string | null = null;
  protected options: Required<TransportOptions>;

  constructor(options: TransportOptions = {}) {
    super();
    this.options = {
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      connectTimeout: 30000,
      requestTimeout: 60000,
      ...options
    };
  }

  get state(): TransportState {
    return this._state;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  protected setState(state: TransportState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit('stateChange', state);
    }
  }

  isReady(): boolean {
    return this._state === TransportState.CONNECTED && this._sessionId !== null;
  }

  abstract connect(): Promise<void>;
  abstract send(message: MCPMessage): Promise<void>;
  abstract disconnect(): Promise<void>;
}

export default ITransport;
