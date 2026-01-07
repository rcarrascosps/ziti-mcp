# Ziti MCP SDK

[![Node.js](https://img.shields.io/badge/Node.js-18--22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

SDK and CLI for consuming **MCP Servers** over **OpenZiti** zero-trust network.

Connect to MCP (Model Context Protocol) servers that are exposed as "dark services" - invisible to the internet, accessible only through cryptographically verified identities.

## What is a Dark MCP Server?

A **Dark MCP Server** is an MCP server that:

- **Has no public IP address** - completely invisible to port scanners and attackers
- **Requires cryptographic identity** - only authorized clients with valid Ziti identities can connect
- **Uses zero-trust networking** - every connection is authenticated and encrypted end-to-end
- **Works through NATs and firewalls** - no inbound ports required

```
Traditional MCP:
  Client ──── Internet ──── MCP Server (exposed IP:port)
                              ↑
                        Attackers can scan/probe

Dark MCP over OpenZiti:
  Client ──── Ziti Network ──── MCP Server (no public IP)
     ↑            ↑                  ↑
  Identity    Encrypted         Identity
  Required    Overlay           Required
```

## Features

- **Zero Trust Security**: Connect to MCP servers without exposing them to the internet
- **Full MCP Protocol**: Tools, Resources, Prompts, and Notifications
- **Interactive CLI**: REPL-based client for testing and exploration
- **TypeScript**: Fully typed API with IntelliSense support
- **Auto-reconnect**: Built-in reconnection with exponential backoff
- **SSE Transport**: Server-Sent Events over Ziti streams

## Installation

### From GitHub (recommended)

```bash
# Clone the repository
git clone https://github.com/rcarrascosps/ziti-mcp
cd ziti-mcp

# Install dependencies
npm install

# Build
npm run build

# Link for local development (optional)
npm link
```

Then in your project:

```bash
npm link ziti-mcp-sdk
npm install @openziti/ziti-sdk-nodejs
```

### From npm (when published)

```bash
npm install ziti-mcp-sdk @openziti/ziti-sdk-nodejs
```

> **Note**: The `@openziti/ziti-sdk-nodejs` package contains native bindings and requires Node.js 18-22.

## Quick Start

### Using the CLI

```bash
# Set environment variables
export ZITI_IDENTITY_FILE=./my-identity.json
export ZITI_SERVICE_NAME=my-dark-mcp

# Run the CLI
npx ziti-mcp-cli -c
```

### Using the SDK

```typescript
import { ZitiMCPClient } from 'ziti-mcp-sdk';

const client = new ZitiMCPClient({
  identityPath: './my-identity.json',
  serviceName: 'my-dark-mcp'
});

// Connect to the dark MCP server
await client.connect();

// List available tools
const { tools } = await client.listTools();
console.log('Tools:', tools.map(t => t.name));

// Call a tool
const result = await client.callTool('weather', { city: 'Madrid' });
console.log('Result:', result);

// Clean up
await client.disconnect();
```

## CLI Reference

The SDK includes an interactive CLI for connecting to and exploring dark MCP servers.

### Starting the CLI

```bash
# Basic usage
npx ziti-mcp-cli

# With identity and auto-connect
npx ziti-mcp-cli -i ./identity.json -s my-mcp-server -c

# Verbose mode for debugging
npx ziti-mcp-cli -i ./identity.json -s my-server -v
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-i, --identity <path>` | Path to Ziti identity file |
| `-s, --service <name>` | MCP service name to connect to |
| `-c, --connect` | Auto-connect on startup |
| `-v, --verbose` | Enable verbose logging |
| `-h, --help` | Show help |
| `--version` | Show version |

### CLI Commands

#### Connection Commands
| Command | Description |
|---------|-------------|
| `/connect <service>` | Connect to an MCP server |
| `/disconnect` | Disconnect from current server |
| `/status` | Show connection status |
| `/identity <path>` | Set identity file path |

#### Tool Commands
| Command | Description |
|---------|-------------|
| `/tools` | List available tools |
| `/tool <name>` | Show tool details and parameters |
| `/call <name> [json]` | Call a tool with optional JSON arguments |

#### Resource Commands
| Command | Description |
|---------|-------------|
| `/resources` | List available resources |
| `/resource <uri>` | Read a resource by URI |

#### Prompt Commands
| Command | Description |
|---------|-------------|
| `/prompts` | List available prompts |
| `/prompt <name> [json]` | Get a prompt with optional arguments |

#### Utility Commands
| Command | Description |
|---------|-------------|
| `/ping` | Ping the server |
| `/clear` | Clear the screen |
| `/verbose` | Toggle verbose mode |
| `/help` | Show help |
| `/exit` | Exit the CLI |

### CLI Examples

```bash
# Connect and explore
/connect my-dark-mcp
/tools
/tool weather
/call weather {"city": "San Francisco", "units": "metric"}

# Read resources
/resources
/resource file:///config/settings.json

# Get prompts
/prompts
/prompt summarize {"style": "brief"}
```

## SDK API Reference

### ZitiMCPClient

The main client class for interacting with MCP servers.

#### Constructor

```typescript
import { ZitiMCPClient } from 'ziti-mcp-sdk';

const client = new ZitiMCPClient({
  // Required
  identityPath: string,      // Path to Ziti identity file
  serviceName: string,       // Ziti service name

  // Optional
  clientInfo: {              // Client identification
    name: string,
    version: string
  },
  capabilities: {},          // MCP client capabilities
  autoReconnect: true,       // Auto-reconnect on disconnect
  maxReconnectAttempts: 3,   // Max reconnection attempts
  reconnectDelay: 1000,      // Base delay between attempts (ms)
  connectTimeout: 30000,     // Connection timeout (ms)
  requestTimeout: 60000,     // Request timeout (ms)
  logLevel: LogLevel.INFO    // SDK log level
});
```

#### Methods

##### Connection Lifecycle

```typescript
// Connect and initialize MCP session
const initResult = await client.connect();
// Returns: { serverInfo, capabilities, protocolVersion }

// Check if connected
client.isReady; // boolean

// Get server info
client.serverInfo;        // { name, version }
client.serverCapabilities; // { tools, resources, prompts, ... }

// Disconnect
await client.disconnect();
```

##### Tools

```typescript
// List tools (with pagination)
const { tools, nextCursor } = await client.listTools(cursor?);

// Get all tools (handles pagination automatically)
const allTools = await client.getAllTools();

// Call a tool
const result = await client.callTool('toolName', { arg1: 'value' });
// Returns: { content: [...], isError?: boolean }

// Check if tool exists
const exists = await client.hasTool('toolName');

// Get tool details
const tool = await client.getTool('toolName');
```

##### Resources

```typescript
// List resources
const { resources, nextCursor } = await client.listResources(cursor?);

// Get all resources
const allResources = await client.getAllResources();

// Read resource
const contents = await client.readResource('file:///path/to/resource');
// Returns: [{ uri, mimeType?, text?, blob? }]

// Subscribe to updates (if server supports)
await client.subscribeResource('file:///watched/file');
await client.unsubscribeResource('file:///watched/file');
```

##### Prompts

```typescript
// List prompts
const { prompts, nextCursor } = await client.listPrompts(cursor?);

// Get all prompts
const allPrompts = await client.getAllPrompts();

// Get prompt with arguments
const result = await client.getPrompt('promptName', { arg: 'value' });
// Returns: { description?, messages: [...] }
```

##### Utility

```typescript
// Ping server
await client.ping();

// Set server logging level
await client.setLoggingLevel('debug');
```

#### Events

```typescript
// Connection events
client.on('ready', (serverInfo) => {
  console.log(`Connected to ${serverInfo.name}`);
});

client.on('disconnected', (reason) => {
  console.log(`Disconnected: ${reason}`);
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

client.on('stateChange', (state) => {
  // state: 'disconnected' | 'connecting' | 'initializing' | 'ready' | 'disconnecting'
});

// Server notifications
client.on('toolsChanged', async () => {
  const tools = await client.getAllTools();
  console.log('Tools updated:', tools);
});

client.on('resourcesChanged', () => {
  console.log('Resources list changed');
});

client.on('resourceUpdated', (uri) => {
  console.log(`Resource updated: ${uri}`);
});

client.on('promptsChanged', () => {
  console.log('Prompts list changed');
});

client.on('log', (level, message, data) => {
  console.log(`[${level}] ${message}`, data);
});
```

### Low-level Components

For advanced use cases, you can use the lower-level components directly:

```typescript
import {
  ZitiConnection,
  ZitiSSETransport,
  SSEParser
} from 'ziti-mcp-sdk';

// Create Ziti connection
const connection = new ZitiConnection({
  identityPath: './identity.json',
  logLevel: ZitiLogLevel.DEBUG
});

await connection.init();

// Check service availability
const status = await connection.isServiceAvailable('my-service');
console.log('Available:', status.available);
console.log('Can dial:', status.permissions.dial);

// Create SSE transport
const transport = new ZitiSSETransport(connection, {
  serviceName: 'my-service',
  ssePath: '/sse',
  messagePath: '/message'
});

transport.on('message', (msg) => console.log('Message:', msg));
transport.on('connected', () => console.log('Connected!'));

await transport.connect();

// Send raw MCP message
await transport.send({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
});

// Send request and wait for response
const result = await transport.request({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: { name: 'myTool', arguments: {} }
});
```

## OpenZiti Setup

To use this SDK, you need:

1. **An OpenZiti Network** - Self-hosted or [CloudZiti](https://netfoundry.io/)
2. **A Ziti Identity** - For your client application
3. **A Dark MCP Server** - Your MCP server exposed as a Ziti service

### Getting a Ziti Identity

#### Option 1: CloudZiti / NetFoundry

1. Create an account at [NetFoundry Console](https://netfoundry.io/)
2. Create a network
3. Create an identity and download the JWT
4. Enroll the identity:
   ```bash
   ziti edge enroll --jwt ./my-identity.jwt --out ./my-identity.json
   ```

#### Option 2: Self-Hosted OpenZiti

1. Install OpenZiti: https://openziti.io/docs/learn/quickstarts/
2. Create an identity:
   ```bash
   ziti edge create identity device my-client -o ./my-client.jwt
   ziti edge enroll --jwt ./my-client.jwt --out ./my-client.json
   ```

### Creating a Dark MCP Service

On the OpenZiti controller:

```bash
# Create the service
ziti edge create service my-dark-mcp

# Create service policy (who can access)
ziti edge create service-policy my-dark-mcp-dial Dial \
  --identity-roles '#clients' \
  --service-roles '@my-dark-mcp'

# Create service policy (who can host)
ziti edge create service-policy my-dark-mcp-bind Bind \
  --identity-roles '@mcp-server-identity' \
  --service-roles '@my-dark-mcp'
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Application                                │
├──────────────────────────────────────────────────────────────────┤
│                     ZitiMCPClient                                 │
│                   (High-level API)                                │
│   - connect/disconnect                                            │
│   - tools, resources, prompts                                     │
│   - event handling                                                │
├──────────────────────────────────────────────────────────────────┤
│                   ZitiSSETransport                                │
│              (MCP over SSE protocol)                              │
│   - SSE stream management                                         │
│   - Message routing                                               │
│   - Request/response correlation                                  │
├──────────────────────────────────────────────────────────────────┤
│                    ZitiConnection                                 │
│               (Ziti SDK wrapper)                                  │
│   - Identity management                                           │
│   - Stream creation                                               │
│   - HTTP over Ziti                                                │
├──────────────────────────────────────────────────────────────────┤
│               @openziti/ziti-sdk-nodejs                           │
│                  (OpenZiti C SDK)                                 │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │    OpenZiti         │
                │    Overlay Network  │
                │    (Encrypted)      │
                └─────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │    MCP Server       │
                │   (Dark Service)    │
                │   No public IP      │
                └─────────────────────┘
```

## Examples

### Complete Client Example

See [`examples/complete-client.ts`](examples/complete-client.ts) for a full example demonstrating:
- Connection handling
- Event listeners
- Tool discovery and invocation
- Resource reading
- Error handling

### Weather Tool Example

```typescript
import { ZitiMCPClient } from 'ziti-mcp-sdk';

async function getWeather(city: string) {
  const client = new ZitiMCPClient({
    identityPath: process.env.ZITI_IDENTITY_FILE!,
    serviceName: 'weather-mcp'
  });

  try {
    await client.connect();

    const result = await client.callTool('get_weather', {
      city,
      units: 'metric'
    });

    for (const content of result.content) {
      if (content.type === 'text') {
        console.log(content.text);
      }
    }
  } finally {
    await client.disconnect();
  }
}

getWeather('Madrid');
```

### Watch Resources Example

```typescript
import { ZitiMCPClient } from 'ziti-mcp-sdk';

async function watchConfig() {
  const client = new ZitiMCPClient({
    identityPath: './identity.json',
    serviceName: 'config-mcp'
  });

  await client.connect();

  // Subscribe to resource updates
  await client.subscribeResource('file:///config/app.json');

  client.on('resourceUpdated', async (uri) => {
    console.log(`Config changed: ${uri}`);
    const contents = await client.readResource(uri);
    console.log('New config:', contents[0].text);
  });

  // Keep running
  process.on('SIGINT', async () => {
    await client.disconnect();
    process.exit(0);
  });
}

watchConfig();
```

## Troubleshooting

### Connection Issues

**Error: `@openziti/ziti-sdk-nodejs is not installed`**
```bash
npm install @openziti/ziti-sdk-nodejs
```
Note: Requires Node.js 18-22 for native bindings.

**Error: `Ziti initialization failed`**
- Verify your identity file exists and is valid JSON
- Check that the identity hasn't expired
- Ensure the identity has been enrolled (not just the JWT)

**Error: `Service not available`**
- Verify the service name is correct
- Check that your identity has `Dial` permission for the service
- Ensure the MCP server is running and bound to the service

### Timeout Errors

**Error: `Session establishment timeout`**
- The MCP server may not be responding
- Check network connectivity to Ziti edge routers
- Increase `connectTimeout` option

**Error: `Request timeout`**
- The tool/resource operation is taking too long
- Increase `requestTimeout` option
- Check server-side performance

### SSL/TLS Errors

**Error: `unable to verify certificate`**
- Your identity file may be corrupted
- Re-enroll the identity from the JWT

### Debug Mode

Enable verbose logging to diagnose issues:

```typescript
import { ZitiMCPClient, LogLevel, ZitiLogLevel } from 'ziti-mcp-sdk';

const client = new ZitiMCPClient({
  identityPath: './identity.json',
  serviceName: 'my-service',
  logLevel: LogLevel.DEBUG,        // SDK logging
  zitiLogLevel: ZitiLogLevel.DEBUG // Ziti C SDK logging
});
```

Or with the CLI:
```bash
npx ziti-mcp-cli -v
```

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/ziti-mcp-sdk.git
cd ziti-mcp-sdk

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run CLI in development mode
npm run cli:dev -- -i ./identity.json -s my-service -c

# Type checking
npx tsc --noEmit
```

## Related Projects

- [OpenZiti](https://openziti.io/) - Zero Trust Network
- [MCP Protocol](https://modelcontextprotocol.io/) - Model Context Protocol
- [@openziti/ziti-sdk-nodejs](https://github.com/openziti/ziti-sdk-nodejs) - OpenZiti Node.js SDK

## License

MIT
