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
import { ZitiLogLevel } from '../ziti/types.js';
import { Logger, LogLevel } from '../utils/Logger.js';
import { ClientInfo, ServerInfo, ClientCapabilities, ServerCapabilities, Tool, ToolCallResult, Resource, ResourceContents, Prompt, GetPromptResult, InitializeResult, ListToolsResult, ListResourcesResult, ListResourceTemplatesResult, ListPromptsResult } from '../protocol/types.js';
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
export declare enum ClientState {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    INITIALIZING = "initializing",
    READY = "ready",
    DISCONNECTING = "disconnecting"
}
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
export declare class ZitiMCPClient extends EventEmitter {
    private options;
    private logger;
    private identity;
    private connection;
    private transport;
    private _state;
    private _serverInfo;
    private _serverCapabilities;
    private _requestId;
    constructor(options: ZitiMCPClientOptions);
    get state(): ClientState;
    get serverInfo(): ServerInfo | null;
    get serverCapabilities(): ServerCapabilities | null;
    get isReady(): boolean;
    get sessionId(): string | null;
    private setState;
    private nextRequestId;
    /**
     * Connect to the MCP server
     */
    connect(): Promise<InitializeResult>;
    /**
     * Disconnect from the MCP server
     */
    disconnect(): Promise<void>;
    /**
     * Clean up resources
     */
    private cleanup;
    /**
     * Set up transport event listeners
     */
    private setupTransportListeners;
    /**
     * Handle server notifications
     */
    private handleNotification;
    /**
     * Initialize the MCP session
     */
    private initialize;
    /**
     * Re-initialize after reconnect
     */
    private reinitialize;
    /**
     * List available tools
     */
    listTools(cursor?: string): Promise<ListToolsResult>;
    /**
     * Call a tool
     */
    callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
    /**
     * List available resources
     */
    listResources(cursor?: string): Promise<ListResourcesResult>;
    /**
     * List resource templates
     */
    listResourceTemplates(cursor?: string): Promise<ListResourceTemplatesResult>;
    /**
     * Read a resource
     */
    readResource(uri: string): Promise<ResourceContents[]>;
    /**
     * Subscribe to resource updates
     */
    subscribeResource(uri: string): Promise<void>;
    /**
     * Unsubscribe from resource updates
     */
    unsubscribeResource(uri: string): Promise<void>;
    /**
     * List available prompts
     */
    listPrompts(cursor?: string): Promise<ListPromptsResult>;
    /**
     * Get a prompt
     */
    getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>;
    /**
     * Send a ping to the server
     */
    ping(): Promise<void>;
    /**
     * Set the logging level on the server
     */
    setLoggingLevel(level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'): Promise<void>;
    /**
     * Ensure client is ready for operations
     */
    private ensureReady;
    /**
     * Send a request and wait for response
     */
    private request;
    /**
     * Send a notification (no response expected)
     */
    private notify;
    /**
     * Get all tools (handles pagination)
     */
    getAllTools(): Promise<Tool[]>;
    /**
     * Get all resources (handles pagination)
     */
    getAllResources(): Promise<Resource[]>;
    /**
     * Get all prompts (handles pagination)
     */
    getAllPrompts(): Promise<Prompt[]>;
    /**
     * Check if a specific tool exists
     */
    hasTool(name: string): Promise<boolean>;
    /**
     * Get a specific tool by name
     */
    getTool(name: string): Promise<Tool | undefined>;
}
export default ZitiMCPClient;
//# sourceMappingURL=ZitiMCPClient.d.ts.map