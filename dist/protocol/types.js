/**
 * MCP Protocol Types
 *
 * Type definitions for the Model Context Protocol (MCP)
 * Based on the MCP specification.
 */
export class MCPClientError extends Error {
    code;
    data;
    constructor(message, code, data) {
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
};
// =============================================================================
// Protocol Version
// =============================================================================
export const PROTOCOL_VERSION = '2024-11-05';
//# sourceMappingURL=types.js.map