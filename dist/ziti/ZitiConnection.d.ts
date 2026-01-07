/**
 * ZitiConnection - Wrapper over OpenZiti SDK for MCP communication
 *
 * Provides a clean async/await interface over the callback-based Ziti SDK,
 * with support for both HTTP requests and streaming connections (for SSE).
 */
import { EventEmitter } from 'events';
import type { ZitiHttpRequestOptions, ZitiHttpResponse, ZitiConnectionHandle, ZitiServiceStatus, ZitiLogLevel } from './types.js';
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
export declare class ZitiConnection extends EventEmitter {
    private ziti;
    private options;
    private initialized;
    private activeStreams;
    constructor(options: ZitiConnectionOptions);
    /**
     * Initialize the Ziti SDK with the provided identity
     */
    init(): Promise<void>;
    /**
     * Check if the SDK is initialized
     */
    isInitialized(): boolean;
    /**
     * Ensure the SDK is initialized before operations
     */
    private ensureInitialized;
    /**
     * Check if a service is available on the Ziti network
     */
    isServiceAvailable(serviceName: string): Promise<ZitiServiceStatus>;
    /**
     * Make an HTTP request to a Ziti service using dial + raw HTTP
     *
     * Note: We use dial() instead of httpRequest() because httpRequest()
     * has issues with callback parameters in the Node.js SDK.
     */
    httpRequest(serviceName: string, options: ZitiHttpRequestOptions): Promise<ZitiHttpResponse>;
    /**
     * Create a streaming connection to a Ziti service (for SSE)
     *
     * This uses the low-level dial API which maintains an open connection
     * and calls onData for each chunk received.
     */
    createStream(serviceName: string): Promise<ZitiStream>;
    /**
     * Create a streaming HTTP connection for SSE
     *
     * Sends an HTTP request over the raw stream and returns the stream
     * for reading SSE events.
     */
    createHttpStream(serviceName: string, options: ZitiHttpRequestOptions): Promise<ZitiStream>;
    /**
     * Close all active streams and cleanup
     */
    close(): Promise<void>;
    /**
     * Get the number of active streams
     */
    get activeStreamCount(): number;
}
export default ZitiConnection;
//# sourceMappingURL=ZitiConnection.d.ts.map