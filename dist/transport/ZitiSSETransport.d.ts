/**
 * ZitiSSETransport - SSE transport over OpenZiti network
 *
 * Implements the MCP transport protocol using Server-Sent Events
 * over a Ziti zero-trust network connection.
 *
 * Protocol flow:
 * 1. Connect to /sse endpoint via Ziti stream
 * 2. Receive "endpoint" event with sessionId
 * 3. Send messages via POST to /message?sessionId=xxx
 * 4. Receive responses via SSE "message" events
 */
import { BaseTransport, TransportOptions, MCPMessage } from './ITransport.js';
import { ZitiConnection } from '../ziti/ZitiConnection.js';
import { Logger } from '../utils/Logger.js';
/**
 * Ziti SSE Transport configuration
 */
export interface ZitiSSETransportOptions extends TransportOptions {
    /** The Ziti service name to connect to */
    serviceName: string;
    /** SSE endpoint path (default: /sse) */
    ssePath?: string;
    /** Message endpoint path (default: /message) */
    messagePath?: string;
    /** Logger instance */
    logger?: Logger;
}
/**
 * ZitiSSETransport - MCP transport over Ziti SSE
 *
 * Usage:
 * ```typescript
 * const transport = new ZitiSSETransport(zitiConnection, {
 *   serviceName: 'my-mcp-service'
 * });
 *
 * transport.on('message', (msg) => console.log('Received:', msg));
 * await transport.connect();
 * await transport.send({ jsonrpc: '2.0', method: 'initialize', ... });
 * ```
 */
export declare class ZitiSSETransport extends BaseTransport {
    private zitiConnection;
    private stream;
    private sseParser;
    private serviceName;
    private ssePath;
    private messagePath;
    private logger;
    private messageQueue;
    private pendingRequests;
    private reconnectAttempts;
    private isProcessingQueue;
    constructor(zitiConnection: ZitiConnection, options: ZitiSSETransportOptions);
    /**
     * Set up SSE parser event listeners
     */
    private setupParserListeners;
    /**
     * Handle incoming SSE events
     */
    private handleSSEEvent;
    /**
     * Handle "endpoint" event - extract session ID
     */
    private handleEndpointEvent;
    /**
     * Handle "message" event - parse and emit MCP message
     */
    private handleMessageEvent;
    /**
     * Handle "reconnect" event from server
     */
    private handleReconnectEvent;
    /**
     * Connect to the MCP server via SSE
     */
    connect(): Promise<void>;
    /**
     * Wait for session to be established
     */
    private waitForSession;
    /**
     * Handle stream error
     */
    private handleStreamError;
    /**
     * Handle stream close
     */
    private handleStreamClose;
    /**
     * Attempt to reconnect
     */
    private reconnect;
    /**
     * Send a message to the MCP server
     */
    send(message: MCPMessage): Promise<void>;
    /**
     * Send a message immediately (bypassing queue)
     */
    private sendImmediate;
    /**
     * Send a request and wait for response
     */
    request(message: MCPMessage): Promise<unknown>;
    /**
     * Process queued messages
     */
    private processQueuedMessages;
    /**
     * Disconnect from the MCP server
     */
    disconnect(): Promise<void>;
    /**
     * Clean up resources
     */
    private cleanup;
    /**
     * Get queued message count
     */
    get queuedMessageCount(): number;
    /**
     * Get pending request count
     */
    get pendingRequestCount(): number;
}
export default ZitiSSETransport;
//# sourceMappingURL=ZitiSSETransport.d.ts.map