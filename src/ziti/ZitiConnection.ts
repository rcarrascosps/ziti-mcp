/**
 * ZitiConnection - Wrapper over OpenZiti SDK for MCP communication
 *
 * Provides a clean async/await interface over the callback-based Ziti SDK,
 * with support for both HTTP requests and streaming connections (for SSE).
 */

import { EventEmitter } from 'events';
import type {
  ZitiSDK,
  ZitiHttpRequestOptions,
  ZitiHttpResponse,
  ZitiConnectionHandle,
  ZitiServiceStatus,
  ZitiLogLevel
} from './types.js';

export interface ZitiConnectionOptions {
  identityPath: string;
  logLevel?: ZitiLogLevel;
  connectTimeout?: number;
  requestTimeout?: number;
}

export interface ZitiStream extends EventEmitter {
  write(data: Buffer | string): void;
  close(): void;
  readonly handle: ZitiConnectionHandle;
  readonly isOpen: boolean;
}

class ZitiStreamImpl extends EventEmitter implements ZitiStream {
  private _handle: ZitiConnectionHandle;
  private _isOpen: boolean = true;
  private ziti: ZitiSDK;

  constructor(handle: ZitiConnectionHandle, ziti: ZitiSDK) {
    super();
    this._handle = handle;
    this.ziti = ziti;
  }

  get handle(): ZitiConnectionHandle {
    return this._handle;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  write(data: Buffer | string): void {
    if (!this._isOpen) {
      throw new Error('Cannot write to closed stream');
    }
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    this.ziti.write(this._handle, buffer, () => {
      this.emit('drain');
    });
  }

  close(): void {
    if (this._isOpen) {
      this._isOpen = false;
      this.ziti.close(this._handle);
      this.emit('close');
    }
  }

  _onData(data: Buffer): void {
    this.emit('data', data);
  }

  _onError(error: Error): void {
    this._isOpen = false;
    this.emit('error', error);
  }
}

export class ZitiConnection extends EventEmitter {
  private ziti: ZitiSDK | null = null;
  private options: ZitiConnectionOptions;
  private initialized: boolean = false;
  private activeStreams: Map<ZitiConnectionHandle, ZitiStreamImpl> = new Map();

  constructor(options: ZitiConnectionOptions) {
    super();
    this.options = {
      connectTimeout: 30000,
      requestTimeout: 60000,
      ...options
    };
  }

  /**
   * Initialize the Ziti SDK with the provided identity
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Dynamic import of the Ziti SDK
      let zitiModule;
      try {
	  // @ts-expect-error - Dynamic import of optional peer dependency
        zitiModule = await import('@openziti/ziti-sdk-nodejs');
      } catch (importError) {
        const err = importError as Error;
        if (err.message?.includes('Cannot find module') || err.message?.includes('MODULE_NOT_FOUND')) {
          throw new Error(
            '@openziti/ziti-sdk-nodejs is not installed. ' +
            'This SDK requires Node.js 18-20 for the Ziti native bindings. ' +
            'Install with: npm install @openziti/ziti-sdk-nodejs'
          );
        }
        throw importError;
      }

      this.ziti = zitiModule.default as ZitiSDK;

      // Set log level if specified
      if (this.options.logLevel !== undefined) {
        this.ziti.setLogLevel(this.options.logLevel);
      }

      // Initialize with identity file
      const status = await this.ziti.init(this.options.identityPath);

      if (status !== 0) {
        throw new Error(`Ziti initialization failed with status: ${status}`);
      }

      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize Ziti connection: ${message}`);
    }
  }

  /**
   * Check if the SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure the SDK is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.ziti) {
      throw new Error('ZitiConnection not initialized. Call init() first.');
    }
  }

  /**
   * Check if a service is available on the Ziti network
   */
  async isServiceAvailable(serviceName: string): Promise<ZitiServiceStatus> {
    this.ensureInitialized();

    return new Promise((resolve) => {
      this.ziti!.serviceAvailable(serviceName, (status: number) => {
        // Status: 0 = available, <0 = not available
        // Permissions bits: 1 = dial, 2 = bind
        const available = status >= 0;
        const permissions = {
          dial: (status & 1) !== 0,
          bind: (status & 2) !== 0
        };

        resolve({ available, permissions });
      });
    });
  }

  /**
   * Make an HTTP request to a Ziti service using dial + raw HTTP
   *
   * Note: We use dial() instead of httpRequest() because httpRequest()
   * has issues with callback parameters in the Node.js SDK.
   */
  async httpRequest(
    serviceName: string,
    options: ZitiHttpRequestOptions
  ): Promise<ZitiHttpResponse> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`HTTP request timeout after ${this.options.requestTimeout}ms`));
      }, this.options.requestTimeout);

      let conn: ZitiConnectionHandle | null = null;
      let responseReceived = false;
      const chunks: Buffer[] = [];

      this.ziti!.dial(
        serviceName,
        false,
        // onConnect
        (connHandle: ZitiConnectionHandle) => {
          conn = connHandle;

          // Build raw HTTP request
          const headers: Record<string, string> = {
            'Host': serviceName,
            'Connection': 'close',
            ...options.headers
          };

          if (options.body) {
            const bodyBuffer = typeof options.body === 'string'
              ? Buffer.from(options.body)
              : options.body;
            headers['Content-Length'] = String(bodyBuffer.length);
          }

          const headerLines = Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n');

          let request = `${options.method} ${options.path} HTTP/1.1\r\n${headerLines}\r\n\r\n`;

          if (options.body) {
            request += typeof options.body === 'string' ? options.body : options.body.toString();
          }

          this.ziti!.write(connHandle, Buffer.from(request));
        },
        // onData
        (data: Buffer) => {
          chunks.push(data);

          // Check if we have a complete response (for non-streaming requests)
          const fullResponse = Buffer.concat(chunks).toString();

          // Look for end of HTTP response
          if (fullResponse.includes('\r\n\r\n')) {
            const [headerPart, ...bodyParts] = fullResponse.split('\r\n\r\n');
            const bodyStr = bodyParts.join('\r\n\r\n');

            // Parse status line
            const lines = headerPart.split('\r\n');
            const statusLine = lines[0];
            const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
            const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

            // Parse headers
            const responseHeaders: Record<string, string> = {};
            for (let i = 1; i < lines.length; i++) {
              const colonIdx = lines[i].indexOf(':');
              if (colonIdx > 0) {
                const key = lines[i].slice(0, colonIdx).trim().toLowerCase();
                const value = lines[i].slice(colonIdx + 1).trim();
                responseHeaders[key] = value;
              }
            }

            // For Connection: close, resolve immediately
            if (!responseReceived && responseHeaders['connection'] === 'close') {
              responseReceived = true;
              clearTimeout(timeout);

              if (conn) {
                this.ziti!.close(conn);
              }

              resolve({
                status,
                headers: responseHeaders,
                body: Buffer.from(bodyStr)
              });
            }
          }
        }
      );
    });
  }

  /**
   * Create a streaming connection to a Ziti service (for SSE)
   *
   * This uses the low-level dial API which maintains an open connection
   * and calls onData for each chunk received.
   */
  async createStream(serviceName: string): Promise<ZitiStream> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Stream connection timeout after ${this.options.connectTimeout}ms`));
      }, this.options.connectTimeout);

      let stream: ZitiStreamImpl | null = null;

      this.ziti!.dial(
        serviceName,
        false, // isWebSocket - false for SSE/HTTP streaming
        // onConnect callback
        (conn: ZitiConnectionHandle) => {
          clearTimeout(timeout);
          stream = new ZitiStreamImpl(conn, this.ziti!);
          this.activeStreams.set(conn, stream);

          stream.on('close', () => {
            this.activeStreams.delete(conn);
          });

          resolve(stream);
        },
        // onData callback
        (data: Buffer) => {
          if (stream) {
            stream._onData(data);
          }
        }
      );
    });
  }

  /**
   * Create a streaming HTTP connection for SSE
   *
   * Sends an HTTP request over the raw stream and returns the stream
   * for reading SSE events.
   */
  async createHttpStream(
    serviceName: string,
    options: ZitiHttpRequestOptions
  ): Promise<ZitiStream> {
    const stream = await this.createStream(serviceName);

    // Build HTTP request manually for streaming
    const headers = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...options.headers
    };

    const headerLines = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const request = [
      `${options.method} ${options.path} HTTP/1.1`,
      `Host: ${serviceName}`,
      headerLines,
      '',
      ''
    ].join('\r\n');

    stream.write(request);

    if (options.body) {
      stream.write(options.body);
    }

    return stream;
  }

  /**
   * Close all active streams and cleanup
   */
  async close(): Promise<void> {
    // Close all active streams
    for (const stream of this.activeStreams.values()) {
      stream.close();
    }
    this.activeStreams.clear();

    this.initialized = false;
    this.ziti = null;
    this.emit('closed');
  }

  /**
   * Get the number of active streams
   */
  get activeStreamCount(): number {
    return this.activeStreams.size;
  }
}

export default ZitiConnection;
