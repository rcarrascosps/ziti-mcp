/**
 * Protocol layer exports
 */

export {
  // Client/Server info
  type ClientInfo,
  type ServerInfo,
  type Implementation,

  // Capabilities
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

  // Content types
  type TextContent,
  type ImageContent,
  type EmbeddedResource,

  // Request/Response types
  type InitializeParams,
  type InitializeResult,
  type ListToolsResult,
  type CallToolParams,
  type ListResourcesResult,
  type ListResourceTemplatesResult,
  type ReadResourceParams,
  type ReadResourceResult,
  type ListPromptsResult,
  type GetPromptParams,
  type SubscribeParams,

  // Notifications
  type ResourceUpdatedNotification,
  type ResourceListChangedNotification,
  type ToolListChangedNotification,
  type PromptListChangedNotification,
  type LoggingMessageNotification,

  // Progress
  type ProgressParams,

  // Pagination
  type PaginatedRequest,

  // Errors
  type MCPError,
  MCPClientError,
  ErrorCodes,

  // Protocol version
  PROTOCOL_VERSION
} from './types.js';
