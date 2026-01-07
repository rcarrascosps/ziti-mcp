/**
 * Ziti MCP SDK
 *
 * SDK for consuming MCP Servers over OpenZiti zero-trust network
 *
 * @example
 * ```typescript
 * import { ZitiMCPClient } from 'ziti-mcp-sdk';
 *
 * const client = new ZitiMCPClient({
 *   identityPath: './identity.json',
 *   serviceName: 'my-mcp-server'
 * });
 *
 * await client.connect();
 * const tools = await client.listTools();
 * await client.disconnect();
 * ```
 */
export { ZitiMCPClient, ClientState, type ZitiMCPClientOptions, type ZitiMCPClientEvents } from './client/index.js';
export { type ClientInfo, type ServerInfo, type ClientCapabilities, type ServerCapabilities, type Tool, type ToolInputSchema, type ToolCallResult, type Resource, type ResourceTemplate, type ResourceContents, type Prompt, type PromptArgument, type PromptMessage, type GetPromptResult, type TextContent, type ImageContent, type EmbeddedResource, type InitializeResult, type ListToolsResult, type ListResourcesResult, type ListPromptsResult, MCPClientError, ErrorCodes, PROTOCOL_VERSION } from './protocol/index.js';
export { ZitiConnection, ZitiIdentity, ZitiLogLevel, type ZitiConnectionOptions, type ZitiStream, type ZitiIdentityConfig, type IdentityInfo, type ZitiHttpRequestOptions, type ZitiHttpResponse, type ZitiServiceStatus } from './ziti/index.js';
export { ZitiSSETransport, SSEParser, BaseTransport, TransportState, type ITransport, type MCPMessage, type TransportOptions, type TransportEvents, type ZitiSSETransportOptions, type SSEEvent } from './transport/index.js';
export { Logger, LogLevel, defaultLogger, Queue } from './utils/index.js';
export declare const VERSION = "0.1.0";
//# sourceMappingURL=index.d.ts.map