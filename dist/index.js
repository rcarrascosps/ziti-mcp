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
export { ZitiMCPClient, ClientState } from './client/index.js';
// =============================================================================
// Protocol Types
// =============================================================================
export { 
// Errors
MCPClientError, ErrorCodes, PROTOCOL_VERSION } from './protocol/index.js';
// =============================================================================
// Ziti Layer (Low-level)
// =============================================================================
export { ZitiConnection, ZitiIdentity, ZitiLogLevel } from './ziti/index.js';
// =============================================================================
// Transport Layer (Low-level)
// =============================================================================
export { ZitiSSETransport, SSEParser, BaseTransport, TransportState } from './transport/index.js';
// =============================================================================
// Utilities
// =============================================================================
export { Logger, LogLevel, defaultLogger, Queue } from './utils/index.js';
// =============================================================================
// Version
// =============================================================================
export const VERSION = '0.1.0';
//# sourceMappingURL=index.js.map