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
import { BaseTransport, TransportState } from './ITransport.js';
import { SSEParser } from './SSEParser.js';
import { Queue } from '../utils/Queue.js';
import { defaultLogger } from '../utils/Logger.js';
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
export class ZitiSSETransport extends BaseTransport {
    zitiConnection;
    stream = null;
    sseParser;
    serviceName;
    ssePath;
    messagePath;
    logger;
    messageQueue;
    pendingRequests = new Map();
    reconnectAttempts = 0;
    isProcessingQueue = false;
    constructor(zitiConnection, options) {
        super(options);
        this.zitiConnection = zitiConnection;
        this.serviceName = options.serviceName;
        this.ssePath = options.ssePath || '/sse';
        this.messagePath = options.messagePath || '/message';
        this.logger = options.logger?.child('SSETransport') || defaultLogger.child('SSETransport');
        this.sseParser = new SSEParser();
        this.messageQueue = new Queue();
        this.setupParserListeners();
    }
    /**
     * Set up SSE parser event listeners
     */
    setupParserListeners() {
        this.sseParser.on('event', (event) => {
            this.handleSSEEvent(event);
        });
        this.sseParser.on('error', (error) => {
            this.logger.error('SSE parser error:', error.message);
            this.emit('error', error);
        });
    }
    /**
     * Handle incoming SSE events
     */
    handleSSEEvent(event) {
        this.logger.debug(`SSE event: type=${event.type}, data=${event.data.slice(0, 100)}...`);
        switch (event.type) {
            case 'endpoint':
                this.handleEndpointEvent(event);
                break;
            case 'message':
                this.handleMessageEvent(event);
                break;
            case 'reconnect':
                this.handleReconnectEvent();
                break;
            default:
                this.logger.debug(`Unknown SSE event type: ${event.type}`);
        }
    }
    /**
     * Handle "endpoint" event - extract session ID
     */
    handleEndpointEvent(event) {
        // Parse sessionId from endpoint data
        // Format: /message?sessionId=abc123
        const match = event.data.match(/sessionId=([^&\s]+)/);
        if (match) {
            this._sessionId = match[1];
            this.logger.info(`Session established: ${this._sessionId}`);
            // Mark as connected and process queued messages
            this.setState(TransportState.CONNECTED);
            this.emit('connected');
            this.reconnectAttempts = 0;
            // Process any queued messages
            this.processQueuedMessages();
        }
        else {
            this.logger.error('Failed to extract sessionId from endpoint event');
            this.emit('error', new Error('Invalid endpoint event: missing sessionId'));
        }
    }
    /**
     * Handle "message" event - parse and emit MCP message
     */
    handleMessageEvent(event) {
        try {
            const message = JSON.parse(event.data);
            // Check if this is a response to a pending request
            if (message.id !== undefined) {
                const pending = this.pendingRequests.get(message.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pendingRequests.delete(message.id);
                    if (message.error) {
                        pending.reject(new Error(message.error.message));
                    }
                    else {
                        pending.resolve(message.result);
                    }
                    return;
                }
            }
            // Emit as notification or unsolicited message
            this.emit('message', message);
        }
        catch (error) {
            this.logger.error('Failed to parse message:', event.data);
            this.emit('error', new Error(`Failed to parse MCP message: ${error}`));
        }
    }
    /**
     * Handle "reconnect" event from server
     */
    handleReconnectEvent() {
        this.logger.info('Server requested reconnect');
        this.reconnect();
    }
    /**
     * Connect to the MCP server via SSE
     */
    async connect() {
        if (this._state === TransportState.CONNECTED) {
            return;
        }
        this.setState(TransportState.CONNECTING);
        this.logger.info(`Connecting to ${this.serviceName}${this.ssePath}`);
        try {
            // Ensure Ziti connection is initialized
            if (!this.zitiConnection.isInitialized()) {
                throw new Error('ZitiConnection not initialized');
            }
            // Create HTTP stream for SSE
            this.stream = await this.zitiConnection.createHttpStream(this.serviceName, {
                method: 'GET',
                path: this.ssePath,
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });
            // Set up stream event handlers
            this.stream.on('data', (chunk) => {
                this.sseParser.feed(chunk);
            });
            this.stream.on('error', (error) => {
                this.logger.error('Stream error:', error.message);
                this.handleStreamError(error);
            });
            this.stream.on('close', () => {
                this.logger.info('Stream closed');
                this.handleStreamClose();
            });
            this.logger.debug('SSE stream established, waiting for endpoint event...');
            // Wait for session to be established (with timeout)
            await this.waitForSession();
        }
        catch (error) {
            this.setState(TransportState.DISCONNECTED);
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('Connection failed:', message);
            throw new Error(`Failed to connect: ${message}`);
        }
    }
    /**
     * Wait for session to be established
     */
    waitForSession() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Session establishment timeout'));
            }, this.options.connectTimeout);
            const checkSession = () => {
                if (this._sessionId) {
                    clearTimeout(timeout);
                    resolve();
                }
                else if (this._state === TransportState.DISCONNECTED) {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed before session established'));
                }
                else {
                    setTimeout(checkSession, 100);
                }
            };
            checkSession();
        });
    }
    /**
     * Handle stream error
     */
    handleStreamError(error) {
        this.emit('error', error);
        if (this.options.autoReconnect && this._state !== TransportState.CLOSED) {
            this.reconnect();
        }
        else {
            this.setState(TransportState.DISCONNECTED);
            this.emit('disconnected', error.message);
        }
    }
    /**
     * Handle stream close
     */
    handleStreamClose() {
        if (this._state === TransportState.CLOSED) {
            return;
        }
        this._sessionId = null;
        if (this.options.autoReconnect) {
            this.reconnect();
        }
        else {
            this.setState(TransportState.DISCONNECTED);
            this.emit('disconnected', 'Stream closed');
        }
    }
    /**
     * Attempt to reconnect
     */
    async reconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this.logger.error(`Max reconnect attempts (${this.options.maxReconnectAttempts}) exceeded`);
            this.setState(TransportState.DISCONNECTED);
            this.emit('disconnected', 'Max reconnect attempts exceeded');
            return;
        }
        this.reconnectAttempts++;
        this.setState(TransportState.RECONNECTING);
        this.emit('reconnecting', this.reconnectAttempts);
        const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
        // Clean up old stream
        this.cleanup();
        await new Promise(resolve => setTimeout(resolve, delay));
        try {
            await this.connect();
        }
        catch (error) {
            this.logger.error('Reconnection failed:', error);
            // Will retry on next reconnect call if within limits
        }
    }
    /**
     * Send a message to the MCP server
     */
    async send(message) {
        if (!this.isReady()) {
            // Queue message if not ready
            this.logger.debug('Session not ready, queuing message');
            this.messageQueue.push(message);
            return;
        }
        await this.sendImmediate(message);
    }
    /**
     * Send a message immediately (bypassing queue)
     */
    async sendImmediate(message) {
        const url = `${this.messagePath}?sessionId=${this._sessionId}`;
        const body = JSON.stringify(message);
        this.logger.debug(`Sending message to ${url}: ${body.slice(0, 100)}...`);
        try {
            const response = await this.zitiConnection.httpRequest(this.serviceName, {
                method: 'POST',
                path: url,
                headers: {
                    'Content-Type': 'application/json'
                },
                body
            });
            if (response.status >= 400) {
                const errorText = response.body.toString('utf-8');
                throw new Error(`Server error ${response.status}: ${errorText}`);
            }
            this.logger.debug(`Message sent successfully, status: ${response.status}`);
        }
        catch (error) {
            const message_error = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to send message:', message_error);
            throw new Error(`Failed to send message: ${message_error}`);
        }
    }
    /**
     * Send a request and wait for response
     */
    async request(message) {
        if (message.id === undefined) {
            throw new Error('Request message must have an id');
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(message.id);
                reject(new Error(`Request timeout for id: ${message.id}`));
            }, this.options.requestTimeout);
            this.pendingRequests.set(message.id, { resolve, reject, timeout });
            this.send(message).catch((error) => {
                clearTimeout(timeout);
                this.pendingRequests.delete(message.id);
                reject(error);
            });
        });
    }
    /**
     * Process queued messages
     */
    async processQueuedMessages() {
        if (this.isProcessingQueue) {
            return;
        }
        this.isProcessingQueue = true;
        try {
            while (!this.messageQueue.isEmpty() && this.isReady()) {
                const message = this.messageQueue.tryPop();
                if (message) {
                    await this.sendImmediate(message);
                }
            }
        }
        catch (error) {
            this.logger.error('Error processing queued messages:', error);
        }
        finally {
            this.isProcessingQueue = false;
        }
    }
    /**
     * Disconnect from the MCP server
     */
    async disconnect() {
        this.logger.info('Disconnecting...');
        this.setState(TransportState.CLOSED);
        this.cleanup();
        this.emit('disconnected', 'User requested disconnect');
    }
    /**
     * Clean up resources
     */
    cleanup() {
        // Cancel pending requests
        for (const [_id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Transport disconnected'));
        }
        this.pendingRequests.clear();
        // Close stream
        if (this.stream) {
            this.stream.close();
            this.stream = null;
        }
        // Reset parser
        this.sseParser.reset();
        // Clear session
        this._sessionId = null;
    }
    /**
     * Get queued message count
     */
    get queuedMessageCount() {
        return this.messageQueue.length;
    }
    /**
     * Get pending request count
     */
    get pendingRequestCount() {
        return this.pendingRequests.size;
    }
}
export default ZitiSSETransport;
//# sourceMappingURL=ZitiSSETransport.js.map