# Ziti MCP SDK - Architecture

## Overview

SDK for consuming MCP Servers exposed as "dark services" over OpenZiti,
providing zero-trust connectivity without exposing services to the internet.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Application                          │
├─────────────────────────────────────────────────────────────────────┤
│                      ZitiMCPClient (Public API)                     │
│                                                                     │
│   - connect(serviceName)                                            │
│   - callTool(name, args)                                            │
│   - listTools()                                                     │
│   - getResource(uri)                                                │
│   - disconnect()                                                    │
├─────────────────────────────────────────────────────────────────────┤
│                        MCP Protocol Layer                           │
│                                                                     │
│   ┌─────────────────┐    ┌─────────────────┐                        │
│   │  MCPSession     │    │  MCPMessage     │                        │
│   │  - sessionId    │    │  - jsonrpc      │                        │
│   │  - state        │    │  - method       │                        │
│   │  - capabilities │    │  - params       │                        │
│   └─────────────────┘    └─────────────────┘                        │
├─────────────────────────────────────────────────────────────────────┤
│                      Abstract Transport Layer                       │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    ITransport (Interface)                   │   │
│   │                                                             │   │
│   │   - connect(): Promise<void>                                │   │
│   │   - send(message: MCPMessage): Promise<void>                │   │
│   │   - onMessage(callback): void                               │   │
│   │   - disconnect(): Promise<void>                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │
│   │ ZitiSSETransport│ │ZitiStdioTransport│ │ZitiWSTransport │       │
│   │                 │ │   (future)      │ │   (future)      │       │
│   └─────────────────┘ └─────────────────┘ └─────────────────┘       │
├─────────────────────────────────────────────────────────────────────┤
│                       Ziti Network Layer                            │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    ZitiConnection                           │   │
│   │                                                             │   │
│   │   - init(identityPath): Promise<void>                       │   │
│   │   - httpRequest(service, options): Promise<Response>        │   │
│   │   - createStream(service): ZitiStream                       │   │
│   │   - isServiceAvailable(name): Promise<boolean>              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                 @openziti/ziti-sdk-nodejs                   │   │
│   │                                                             │   │
│   │   ziti.init() | ziti.httpRequest() | ziti_dial()            │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   OpenZiti Network  │
                    │   (Zero Trust)      │
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   MCP Server        │
                    │   (Dark Service)    │
                    └─────────────────────┘
```

## File Structure

```
ziti-mcp-sdk/
├── src/
│   ├── index.ts                    # Public exports
│   ├── client/
│   │   └── ZitiMCPClient.ts        # High-level main client
│   ├── protocol/
│   │   ├── MCPSession.ts           # MCP session management
│   │   ├── MCPMessage.ts           # JSON-RPC message types
│   │   └── MCPCapabilities.ts      # Capabilities negotiation
│   ├── transport/
│   │   ├── ITransport.ts           # Transport interface
│   │   ├── ZitiSSETransport.ts     # SSE over Ziti
│   │   ├── ZitiEventSource.ts      # EventSource adapted for Ziti
│   │   └── TransportFactory.ts     # Factory to create transports
│   ├── ziti/
│   │   ├── ZitiConnection.ts       # Ziti connection wrapper
│   │   ├── ZitiIdentity.ts         # Identity management
│   │   └── ZitiStreamParser.ts     # SSE stream parser
│   └── utils/
│       ├── Logger.ts               # Logging
│       └── Queue.ts                # Message queue
├── examples/
│   ├── basic-connection.ts
│   └── tool-invocation.ts
├── package.json
└── tsconfig.json
```

## Key Components

### 1. ZitiMCPClient (Public API)

```typescript
interface ZitiMCPClientOptions {
  identityPath: string;           // Path to Ziti identity file
  serviceName: string;            // MCP dark service name
  transport?: 'sse' | 'websocket'; // Transport type (default: sse)
  reconnect?: boolean;            // Auto-reconnection (default: true)
  maxReconnectAttempts?: number;  // Maximum attempts (default: 3)
}

class ZitiMCPClient extends EventEmitter {
  constructor(options: ZitiMCPClientOptions);

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // MCP Operations
  initialize(clientInfo: ClientInfo): Promise<ServerCapabilities>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: object): Promise<ToolResult>;
  listResources(): Promise<Resource[]>;
  readResource(uri: string): Promise<ResourceContent>;
  listPrompts(): Promise<Prompt[]>;
  getPrompt(name: string, args?: object): Promise<PromptResult>;

  // Events
  on(event: 'connected', listener: () => void): this;
  on(event: 'disconnected', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'notification', listener: (notification: MCPNotification) => void): this;
}
```

### 2. ZitiSSETransport

The most critical component - adapts SSE to work over Ziti:

```typescript
class ZitiSSETransport implements ITransport {
  private zitiConnection: ZitiConnection;
  private sessionId: string | null = null;
  private streamParser: ZitiStreamParser;
  private messageQueue: Queue<MCPMessage>;

  constructor(zitiConnection: ZitiConnection, serviceName: string);

  async connect(): Promise<void> {
    // 1. Make initial HTTP request to /sse endpoint via Ziti
    // 2. Keep connection open and parse SSE events
    // 3. Extract sessionId from "endpoint" event
  }

  async send(message: MCPMessage): Promise<void> {
    // POST to /message?sessionId=xxx via ziti.httpRequest()
  }

  onMessage(callback: (msg: MCPMessage) => void): void {
    // Register callback for incoming messages
  }
}
```

### 3. ZitiEventSource (SSE Adapter)

EventSource reimplementation using Ziti connections:

```typescript
class ZitiEventSource extends EventEmitter {
  private buffer: string = '';
  private zitiStream: ZitiStream;

  constructor(zitiConnection: ZitiConnection, url: string);

  private parseSSE(chunk: string): SSEEvent[] {
    // Parse SSE format:
    // event: endpoint
    // data: /message?sessionId=abc123
    //
    // event: message
    // data: {"jsonrpc":"2.0",...}
  }

  close(): void;
}
```

### 4. ZitiConnection (Wrapper)

Abstracts OpenZiti APIs:

```typescript
class ZitiConnection {
  private initialized: boolean = false;

  async init(identityPath: string): Promise<void> {
    await ziti.init(identityPath);
    this.initialized = true;
  }

  async httpRequest(
    serviceName: string,
    path: string,
    options: RequestOptions
  ): Promise<Response> {
    return ziti.httpRequest(serviceName, path, options);
  }

  async createStream(serviceName: string, path: string): Promise<ZitiStream> {
    // For SSE we need a long-lived stream
    // Use low-level ziti_dial() if httpRequest doesn't support streaming
  }

  async isServiceAvailable(serviceName: string): Promise<boolean> {
    return ziti.serviceAvailable(serviceName);
  }
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INITIAL CONNECTION FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

  Client                    SDK                      Ziti              MCP Server
     │                        │                        │                    │
     │  new ZitiMCPClient()   │                        │                    │
     │───────────────────────>│                        │                    │
     │                        │                        │                    │
     │  connect()             │                        │                    │
     │───────────────────────>│                        │                    │
     │                        │  ziti.init(identity)   │                    │
     │                        │───────────────────────>│                    │
     │                        │        OK              │                    │
     │                        │<───────────────────────│                    │
     │                        │                        │                    │
     │                        │  GET /sse (stream)     │                    │
     │                        │───────────────────────>│  GET /sse          │
     │                        │                        │───────────────────>│
     │                        │                        │  SSE: endpoint     │
     │                        │  SSE: endpoint         │<───────────────────│
     │                        │<───────────────────────│                    │
     │                        │                        │                    │
     │                        │  [Extract sessionId]   │                    │
     │                        │                        │                    │
     │  'connected' event     │                        │                    │
     │<───────────────────────│                        │                    │
     │                        │                        │                    │


┌─────────────────────────────────────────────────────────────────────┐
│                     TOOL CALL FLOW                                  │
└─────────────────────────────────────────────────────────────────────┘

  Client                    SDK                      Ziti              MCP Server
     │                        │                        │                    │
     │  callTool('foo',{})    │                        │                    │
     │───────────────────────>│                        │                    │
     │                        │  POST /message         │                    │
     │                        │  {jsonrpc, method:     │                    │
     │                        │   tools/call, ...}     │                    │
     │                        │───────────────────────>│  POST /message     │
     │                        │                        │───────────────────>│
     │                        │                        │      202           │
     │                        │      202               │<───────────────────│
     │                        │<───────────────────────│                    │
     │                        │                        │                    │
     │                        │                        │  SSE: message      │
     │                        │  SSE: message          │  {result: ...}     │
     │                        │  {result: ...}         │<───────────────────│
     │                        │<───────────────────────│                    │
     │                        │                        │                    │
     │  Promise<ToolResult>   │                        │                    │
     │<───────────────────────│                        │                    │
     │                        │                        │                    │
```

## Technical Challenges and Solutions

### 1. SSE Streaming over Ziti

**Problem**: `ziti.httpRequest()` may not support long-lived streaming.

**Solution**: Use the low-level API:
```typescript
// Option A: If httpRequest supports streaming
const response = await ziti.httpRequest(service, '/sse', {
  headers: { 'Accept': 'text/event-stream' }
});
for await (const chunk of response.body) {
  this.parseSSE(chunk);
}

// Option B: Use ziti_dial for raw connection
const socket = await ziti_dial(service);
socket.write('GET /sse HTTP/1.1\r\nAccept: text/event-stream\r\n\r\n');
socket.on('data', (chunk) => this.parseSSE(chunk));
```

### 2. Identity Management

**Problem**: Ziti identities require certificates/tokens.

**Solution**: Support multiple formats:
```typescript
interface IdentityConfig {
  // Identity file (JWT enrollment or certificate)
  identityFile?: string;

  // Or inline credentials
  certificate?: string;
  privateKey?: string;
  ca?: string;
}
```

### 3. Automatic Reconnection

**Problem**: Ziti connections may drop.

**Solution**: Implement reconnection with exponential backoff:
```typescript
class ReconnectionManager {
  private attempts = 0;
  private maxAttempts = 5;
  private baseDelay = 1000;

  async reconnect(): Promise<void> {
    while (this.attempts < this.maxAttempts) {
      const delay = this.baseDelay * Math.pow(2, this.attempts);
      await sleep(delay);
      try {
        await this.transport.connect();
        this.attempts = 0;
        return;
      } catch (e) {
        this.attempts++;
      }
    }
    throw new Error('Max reconnection attempts exceeded');
  }
}
```

## Final Usage Example

```typescript
import { ZitiMCPClient } from 'ziti-mcp-sdk';

async function main() {
  const client = new ZitiMCPClient({
    identityPath: './my-identity.json',
    serviceName: 'my-dark-mcp-server',
  });

  client.on('error', (err) => console.error('Error:', err));
  client.on('notification', (n) => console.log('Notification:', n));

  await client.connect();

  // Initialize MCP session
  const capabilities = await client.initialize({
    name: 'my-app',
    version: '1.0.0'
  });

  console.log('Server capabilities:', capabilities);

  // List available tools
  const tools = await client.listTools();
  console.log('Available tools:', tools.map(t => t.name));

  // Call a tool
  const result = await client.callTool('weather', {
    location: 'San Francisco'
  });
  console.log('Weather:', result);

  await client.disconnect();
}

main().catch(console.error);
```

## Dependencies

```json
{
  "dependencies": {
    "@openziti/ziti-sdk-nodejs": "^0.x.x"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

## Next Steps

1. [ ] Verify streaming capabilities of `@openziti/ziti-sdk-nodejs`
2. [ ] Implement `ZitiConnection` as wrapper
3. [ ] Implement `ZitiEventSource` for SSE
4. [ ] Implement `ZitiSSETransport`
5. [ ] Implement `ZitiMCPClient`
6. [ ] Write tests with Ziti mock
7. [ ] Document usage examples
