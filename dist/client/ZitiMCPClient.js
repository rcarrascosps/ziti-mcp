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
import { TransportState } from '../transport/ITransport.js';
import { LogLevel, defaultLogger } from '../utils/Logger.js';
import { MCPClientError, PROTOCOL_VERSION } from '../protocol/types.js';
// =============================================================================
// Client State
// =============================================================================
export var ClientState;
(function (ClientState) {
    ClientState["DISCONNECTED"] = "disconnected";
    ClientState["CONNECTING"] = "connecting";
    ClientState["INITIALIZING"] = "initializing";
    ClientState["READY"] = "ready";
    ClientState["DISCONNECTING"] = "disconnecting";
})(ClientState || (ClientState = {}));
// =============================================================================
// ZitiMCPClient
// =============================================================================
export class ZitiMCPClient extends EventEmitter {
    options;
    logger;
    identity;
    connection = null;
    transport = null;
    _state = ClientState.DISCONNECTED;
    _serverInfo = null;
    _serverCapabilities = null;
    _requestId = 0;
    constructor(options) {
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
    get state() {
        return this._state;
    }
    get serverInfo() {
        return this._serverInfo;
    }
    get serverCapabilities() {
        return this._serverCapabilities;
    }
    get isReady() {
        return this._state === ClientState.READY;
    }
    get sessionId() {
        return this.transport?.sessionId ?? null;
    }
    // ===========================================================================
    // State Management
    // ===========================================================================
    setState(state) {
        if (this._state !== state) {
            this._state = state;
            this.emit('stateChange', state);
        }
    }
    nextRequestId() {
        return ++this._requestId;
    }
    // ===========================================================================
    // Connection Lifecycle
    // ===========================================================================
    /**
     * Connect to the MCP server
     */
    async connect() {
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
        }
        catch (error) {
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
    async disconnect() {
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
    async cleanup() {
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
    setupTransportListeners() {
        if (!this.transport)
            return;
        this.transport.on('message', (message) => {
            this.handleNotification(message);
        });
        this.transport.on('error', (error) => {
            this.logger.error(`Transport error: ${error.message}`);
            this.emit('error', error);
        });
        this.transport.on('disconnected', (reason) => {
            if (this._state !== ClientState.DISCONNECTING) {
                this.logger.warn(`Unexpected disconnect: ${reason}`);
                this._state = ClientState.DISCONNECTED;
                this.emit('disconnected', reason);
            }
        });
        this.transport.on('reconnecting', (attempt) => {
            this.logger.info(`Reconnecting (attempt ${attempt})...`);
            this.setState(ClientState.CONNECTING);
        });
        this.transport.on('stateChange', (state) => {
            if (state === TransportState.CONNECTED && this._state === ClientState.CONNECTING) {
                // Re-initialize after reconnect
                this.reinitialize();
            }
        });
    }
    /**
     * Handle server notifications
     */
    handleNotification(message) {
        if (!message.method)
            return;
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
                const uri = message.params?.uri;
                if (uri) {
                    this.emit('resourceUpdated', uri);
                }
                break;
            case 'notifications/message':
                const logParams = message.params;
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
    async initialize() {
        this.logger.debug('Sending initialize request...');
        const result = await this.request('initialize', {
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
    async reinitialize() {
        try {
            this.setState(ClientState.INITIALIZING);
            await this.initialize();
            this.setState(ClientState.READY);
            this.logger.info('Reconnected and re-initialized');
        }
        catch (error) {
            this.logger.error(`Re-initialization failed: ${error}`);
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * List available tools
     */
    async listTools(cursor) {
        this.ensureReady();
        return this.request('tools/list', cursor ? { cursor } : {});
    }
    /**
     * Call a tool
     */
    async callTool(name, args) {
        this.ensureReady();
        return this.request('tools/call', {
            name,
            arguments: args || {}
        });
    }
    /**
     * List available resources
     */
    async listResources(cursor) {
        this.ensureReady();
        return this.request('resources/list', cursor ? { cursor } : {});
    }
    /**
     * List resource templates
     */
    async listResourceTemplates(cursor) {
        this.ensureReady();
        return this.request('resources/templates/list', cursor ? { cursor } : {});
    }
    /**
     * Read a resource
     */
    async readResource(uri) {
        this.ensureReady();
        const result = await this.request('resources/read', { uri });
        return result.contents;
    }
    /**
     * Subscribe to resource updates
     */
    async subscribeResource(uri) {
        this.ensureReady();
        if (!this._serverCapabilities?.resources?.subscribe) {
            throw new MCPClientError('Server does not support resource subscriptions', -1);
        }
        await this.request('resources/subscribe', { uri });
    }
    /**
     * Unsubscribe from resource updates
     */
    async unsubscribeResource(uri) {
        this.ensureReady();
        await this.request('resources/unsubscribe', { uri });
    }
    /**
     * List available prompts
     */
    async listPrompts(cursor) {
        this.ensureReady();
        return this.request('prompts/list', cursor ? { cursor } : {});
    }
    /**
     * Get a prompt
     */
    async getPrompt(name, args) {
        this.ensureReady();
        return this.request('prompts/get', {
            name,
            arguments: args
        });
    }
    /**
     * Send a ping to the server
     */
    async ping() {
        this.ensureReady();
        await this.request('ping', {});
    }
    /**
     * Set the logging level on the server
     */
    async setLoggingLevel(level) {
        this.ensureReady();
        await this.request('logging/setLevel', { level });
    }
    // ===========================================================================
    // Helper Methods
    // ===========================================================================
    /**
     * Ensure client is ready for operations
     */
    ensureReady() {
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
    async request(method, params) {
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
            return result;
        }
        catch (error) {
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
    async notify(method, params) {
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
    async getAllTools() {
        const tools = [];
        let cursor;
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
    async getAllResources() {
        const resources = [];
        let cursor;
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
    async getAllPrompts() {
        const prompts = [];
        let cursor;
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
    async hasTool(name) {
        const tools = await this.getAllTools();
        return tools.some(t => t.name === name);
    }
    /**
     * Get a specific tool by name
     */
    async getTool(name) {
        const tools = await this.getAllTools();
        return tools.find(t => t.name === name);
    }
}
export default ZitiMCPClient;
//# sourceMappingURL=ZitiMCPClient.js.map