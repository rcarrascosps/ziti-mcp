/**
 * MCP Protocol Types
 *
 * Type definitions for the Model Context Protocol (MCP)
 * Based on the MCP specification.
 */

// =============================================================================
// Basic Types
// =============================================================================

export interface ClientInfo {
  name: string;
  version: string;
}

export interface ServerInfo {
  name: string;
  version: string;
}

export interface Implementation {
  name: string;
  version: string;
}

// =============================================================================
// Capabilities
// =============================================================================

export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
}

export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  logging?: Record<string, unknown>;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
}

// =============================================================================
// Tools
// =============================================================================

export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}

export interface ToolCallResult {
  content: Array<TextContent | ImageContent | EmbeddedResource>;
  isError?: boolean;
}

// =============================================================================
// Resources
// =============================================================================

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // base64 encoded
}

// =============================================================================
// Prompts
// =============================================================================

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: TextContent | ImageContent | EmbeddedResource;
}

export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

// =============================================================================
// Content Types
// =============================================================================

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64 encoded
  mimeType: string;
}

export interface EmbeddedResource {
  type: 'resource';
  resource: ResourceContents;
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: ClientInfo;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: ServerInfo;
  instructions?: string;
}

export interface ListToolsResult {
  tools: Tool[];
  nextCursor?: string;
}

export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface ListResourcesResult {
  resources: Resource[];
  nextCursor?: string;
}

export interface ListResourceTemplatesResult {
  resourceTemplates: ResourceTemplate[];
  nextCursor?: string;
}

export interface ReadResourceParams {
  uri: string;
}

export interface ReadResourceResult {
  contents: ResourceContents[];
}

export interface ListPromptsResult {
  prompts: Prompt[];
  nextCursor?: string;
}

export interface GetPromptParams {
  name: string;
  arguments?: Record<string, string>;
}

export interface SubscribeParams {
  uri: string;
}

// =============================================================================
// Notifications
// =============================================================================

export interface ResourceUpdatedNotification {
  uri: string;
}

export interface ResourceListChangedNotification {
  // empty
}

export interface ToolListChangedNotification {
  // empty
}

export interface PromptListChangedNotification {
  // empty
}

export interface LoggingMessageNotification {
  level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  logger?: string;
  data?: unknown;
}

// =============================================================================
// Progress
// =============================================================================

export interface ProgressParams {
  progressToken: string | number;
  progress: number;
  total?: number;
}

// =============================================================================
// Pagination
// =============================================================================

export interface PaginatedRequest {
  cursor?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export class MCPClientError extends Error {
  code: number;
  data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = 'MCPClientError';
    this.code = code;
    this.data = data;
  }
}

// Standard JSON-RPC error codes
export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

// =============================================================================
// Protocol Version
// =============================================================================

export const PROTOCOL_VERSION = '2024-11-05';
