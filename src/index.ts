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

// =============================================================================
// Main Client (Primary API)
// =============================================================================

export {
  ZitiMCPClient,
  ClientState,
  type ZitiMCPClientOptions,
  type ZitiMCPClientEvents
} from './client/index.js';

// =============================================================================
// Protocol Types
// =============================================================================

export {
  // Client/Server
  type ClientInfo,
  type ServerInfo,
  type ClientCapabilities,
  type ServerCapabilities,

  // Tools
  type Tool,
  type ToolInputSchema,
  type ToolCallResult,

  // Resources
  type Resource,
  type ResourceTemplate,
  type ResourceContents,

  // Prompts
  type Prompt,
  type PromptArgument,
  type PromptMessage,
  type GetPromptResult,

  // Content
  type TextContent,
  type ImageContent,
  type EmbeddedResource,

  // Results
  type InitializeResult,
  type ListToolsResult,
  type ListResourcesResult,
  type ListPromptsResult,

  // Errors
  MCPClientError,
  ErrorCodes,
  PROTOCOL_VERSION
} from './protocol/index.js';

// =============================================================================
// Ziti Layer (Low-level)
// =============================================================================

export {
  ZitiConnection,
  ZitiIdentity,
  ZitiLogLevel,
  type ZitiConnectionOptions,
  type ZitiStream,
  type ZitiIdentityConfig,
  type IdentityInfo,
  type ZitiHttpRequestOptions,
  type ZitiHttpResponse,
  type ZitiServiceStatus
} from './ziti/index.js';

// =============================================================================
// Transport Layer (Low-level)
// =============================================================================

export {
  ZitiSSETransport,
  SSEParser,
  BaseTransport,
  TransportState,
  type ITransport,
  type MCPMessage,
  type TransportOptions,
  type TransportEvents,
  type ZitiSSETransportOptions,
  type SSEEvent
} from './transport/index.js';

// =============================================================================
// Utilities
// =============================================================================

export {
  Logger,
  LogLevel,
  defaultLogger,
  Queue
} from './utils/index.js';

// =============================================================================
// Version
// =============================================================================

export const VERSION = '0.1.0';
