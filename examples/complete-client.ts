/**
 * Complete ZitiMCPClient Example
 *
 * This example demonstrates the full capabilities of the Ziti MCP SDK:
 * - Connecting to an MCP server over OpenZiti
 * - Listing and calling tools
 * - Reading resources
 * - Getting prompts
 * - Handling notifications
 * - Error handling
 *
 * Usage:
 *   ZITI_IDENTITY_FILE=./identity.json \
 *   ZITI_SERVICE_NAME=my-mcp-server \
 *   npx tsx examples/complete-client.ts
 */

import {
  ZitiMCPClient,
  ClientState,
  LogLevel,
  Tool,
  Resource,
  Prompt,
  MCPClientError
} from '../src/index.js';

// =============================================================================
// Configuration
// =============================================================================

const config = {
  identityPath: process.env.ZITI_IDENTITY_FILE || './identity.json',
  serviceName: process.env.ZITI_SERVICE_NAME || 'my-mcp-server',
  clientName: 'ziti-mcp-example',
  clientVersion: '1.0.0'
};

// =============================================================================
// Helper Functions
// =============================================================================

function printSection(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(` ${title}`);
  console.log('='.repeat(60));
}

function printTool(tool: Tool): void {
  console.log(`\n  Tool: ${tool.name}`);
  if (tool.description) {
    console.log(`    Description: ${tool.description}`);
  }
  if (tool.inputSchema.properties) {
    console.log('    Parameters:');
    for (const [name, schema] of Object.entries(tool.inputSchema.properties)) {
      const required = tool.inputSchema.required?.includes(name) ? '*' : '';
      console.log(`      - ${name}${required}: ${schema.type}`);
    }
  }
}

function printResource(resource: Resource): void {
  console.log(`\n  Resource: ${resource.name}`);
  console.log(`    URI: ${resource.uri}`);
  if (resource.description) {
    console.log(`    Description: ${resource.description}`);
  }
  if (resource.mimeType) {
    console.log(`    MIME Type: ${resource.mimeType}`);
  }
}

function printPrompt(prompt: Prompt): void {
  console.log(`\n  Prompt: ${prompt.name}`);
  if (prompt.description) {
    console.log(`    Description: ${prompt.description}`);
  }
  if (prompt.arguments && prompt.arguments.length > 0) {
    console.log('    Arguments:');
    for (const arg of prompt.arguments) {
      const required = arg.required ? '*' : '';
      console.log(`      - ${arg.name}${required}: ${arg.description || 'No description'}`);
    }
  }
}

// =============================================================================
// Main Application
// =============================================================================

async function main(): Promise<void> {
  printSection('Ziti MCP SDK - Complete Example');

  console.log('\nConfiguration:');
  console.log(`  Identity: ${config.identityPath}`);
  console.log(`  Service: ${config.serviceName}`);

  // Create client
  const client = new ZitiMCPClient({
    identityPath: config.identityPath,
    serviceName: config.serviceName,
    clientInfo: {
      name: config.clientName,
      version: config.clientVersion
    },
    capabilities: {
      roots: { listChanged: true }
    },
    autoReconnect: true,
    maxReconnectAttempts: 3,
    logLevel: LogLevel.INFO
  });

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  client.on('ready', (serverInfo) => {
    console.log(`\nConnected to: ${serverInfo.name} v${serverInfo.version}`);
  });

  client.on('disconnected', (reason) => {
    console.log(`\nDisconnected: ${reason}`);
  });

  client.on('error', (error) => {
    console.error(`\nClient error: ${error.message}`);
  });

  client.on('toolsChanged', () => {
    console.log('\n[Notification] Tools list changed');
  });

  client.on('resourcesChanged', () => {
    console.log('\n[Notification] Resources list changed');
  });

  client.on('promptsChanged', () => {
    console.log('\n[Notification] Prompts list changed');
  });

  client.on('resourceUpdated', (uri) => {
    console.log(`\n[Notification] Resource updated: ${uri}`);
  });

  client.on('log', (level, message, data) => {
    console.log(`\n[Server Log] [${level}] ${message}`);
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  });

  client.on('stateChange', (state) => {
    console.log(`\n[State] ${state}`);
  });

  // ==========================================================================
  // Main Logic
  // ==========================================================================

  try {
    // Connect
    printSection('Connecting');
    const initResult = await client.connect();

    console.log('\nServer Info:');
    console.log(`  Name: ${initResult.serverInfo.name}`);
    console.log(`  Version: ${initResult.serverInfo.version}`);
    if (initResult.instructions) {
      console.log(`  Instructions: ${initResult.instructions}`);
    }

    console.log('\nServer Capabilities:');
    console.log(`  Tools: ${JSON.stringify(initResult.capabilities.tools || {})}`);
    console.log(`  Resources: ${JSON.stringify(initResult.capabilities.resources || {})}`);
    console.log(`  Prompts: ${JSON.stringify(initResult.capabilities.prompts || {})}`);

    // List Tools
    printSection('Available Tools');
    const tools = await client.getAllTools();

    if (tools.length === 0) {
      console.log('\n  No tools available');
    } else {
      console.log(`\n  Found ${tools.length} tool(s):`);
      for (const tool of tools) {
        printTool(tool);
      }
    }

    // List Resources
    printSection('Available Resources');
    const resources = await client.getAllResources();

    if (resources.length === 0) {
      console.log('\n  No resources available');
    } else {
      console.log(`\n  Found ${resources.length} resource(s):`);
      for (const resource of resources) {
        printResource(resource);
      }
    }

    // List Prompts
    printSection('Available Prompts');
    const prompts = await client.getAllPrompts();

    if (prompts.length === 0) {
      console.log('\n  No prompts available');
    } else {
      console.log(`\n  Found ${prompts.length} prompt(s):`);
      for (const prompt of prompts) {
        printPrompt(prompt);
      }
    }

    // Example: Call a tool (if available)
    if (tools.length > 0) {
      printSection('Calling First Tool');
      const firstTool = tools[0];
      console.log(`\n  Calling: ${firstTool.name}`);

      try {
        const result = await client.callTool(firstTool.name, {});
        console.log('\n  Result:');
        for (const content of result.content) {
          if (content.type === 'text') {
            console.log(`    [text] ${content.text}`);
          } else if (content.type === 'image') {
            console.log(`    [image] ${content.mimeType} (${content.data.length} bytes base64)`);
          } else if (content.type === 'resource') {
            console.log(`    [resource] ${content.resource.uri}`);
          }
        }
        if (result.isError) {
          console.log('    (Tool returned an error)');
        }
      } catch (error) {
        console.log(`    Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Example: Read a resource (if available)
    if (resources.length > 0) {
      printSection('Reading First Resource');
      const firstResource = resources[0];
      console.log(`\n  Reading: ${firstResource.uri}`);

      try {
        const contents = await client.readResource(firstResource.uri);
        console.log('\n  Contents:');
        for (const content of contents) {
          console.log(`    URI: ${content.uri}`);
          if (content.mimeType) {
            console.log(`    MIME: ${content.mimeType}`);
          }
          if (content.text) {
            const preview = content.text.slice(0, 200);
            console.log(`    Text: ${preview}${content.text.length > 200 ? '...' : ''}`);
          }
          if (content.blob) {
            console.log(`    Blob: ${content.blob.length} bytes (base64)`);
          }
        }
      } catch (error) {
        console.log(`    Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Example: Get a prompt (if available)
    if (prompts.length > 0) {
      printSection('Getting First Prompt');
      const firstPrompt = prompts[0];
      console.log(`\n  Getting: ${firstPrompt.name}`);

      try {
        const promptResult = await client.getPrompt(firstPrompt.name, {});
        console.log('\n  Messages:');
        for (const message of promptResult.messages) {
          console.log(`    [${message.role}]:`);
          if (message.content.type === 'text') {
            const preview = message.content.text.slice(0, 200);
            console.log(`      ${preview}${message.content.text.length > 200 ? '...' : ''}`);
          }
        }
      } catch (error) {
        console.log(`    Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Ping
    printSection('Ping Test');
    console.log('\n  Sending ping...');
    await client.ping();
    console.log('  Pong received!');

    // Interactive mode
    printSection('Interactive Mode');
    console.log('\n  Client is now listening for server notifications.');
    console.log('  Press Ctrl+C to exit.\n');

    // Handle shutdown
    const shutdown = async () => {
      console.log('\n\nShutting down...');
      await client.disconnect();
      console.log('Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    if (error instanceof MCPClientError) {
      console.error(`\nMCP Error [${error.code}]: ${error.message}`);
      if (error.data) {
        console.error('Data:', JSON.stringify(error.data, null, 2));
      }
    } else {
      console.error('\nUnexpected error:', error);
    }

    await client.disconnect();
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
