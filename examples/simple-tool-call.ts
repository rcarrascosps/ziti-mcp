/**
 * Simple Tool Call Example
 *
 * The simplest possible example of connecting to a dark MCP server
 * and calling a tool.
 *
 * Usage:
 *   ZITI_IDENTITY_FILE=./identity.json \
 *   ZITI_SERVICE_NAME=my-dark-mcp \
 *   npx tsx examples/simple-tool-call.ts [tool-name] [json-args]
 *
 * Examples:
 *   npx tsx examples/simple-tool-call.ts
 *   npx tsx examples/simple-tool-call.ts get_weather '{"city":"Madrid"}'
 */

import { ZitiMCPClient } from '../src/index.js';

async function main(): Promise<void> {
  // Get configuration from environment
  const identityPath = process.env.ZITI_IDENTITY_FILE;
  const serviceName = process.env.ZITI_SERVICE_NAME;

  if (!identityPath || !serviceName) {
    console.error('Error: Set ZITI_IDENTITY_FILE and ZITI_SERVICE_NAME environment variables');
    process.exit(1);
  }

  // Get optional tool name and args from command line
  const toolName = process.argv[2];
  const toolArgsJson = process.argv[3];

  // Create client
  const client = new ZitiMCPClient({
    identityPath,
    serviceName
  });

  try {
    // Connect
    console.log(`Connecting to ${serviceName}...`);
    const { serverInfo } = await client.connect();
    console.log(`Connected to ${serverInfo.name} v${serverInfo.version}\n`);

    if (toolName) {
      // Call specific tool
      const args = toolArgsJson ? JSON.parse(toolArgsJson) : {};
      console.log(`Calling tool: ${toolName}`);
      console.log(`Arguments: ${JSON.stringify(args)}\n`);

      const result = await client.callTool(toolName, args);

      console.log('Result:');
      for (const content of result.content) {
        if (content.type === 'text') {
          console.log(content.text);
        } else {
          console.log(`[${content.type}]`);
        }
      }

      if (result.isError) {
        console.log('\n(Tool returned an error)');
      }
    } else {
      // List available tools
      const { tools } = await client.listTools();
      console.log('Available tools:');
      for (const tool of tools) {
        console.log(`  - ${tool.name}`);
        if (tool.description) {
          console.log(`    ${tool.description}`);
        }
      }

      if (tools.length > 0) {
        console.log(`\nTo call a tool: npx tsx examples/simple-tool-call.ts ${tools[0].name} '{}'`);
      }
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main();
