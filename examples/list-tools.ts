/**
 * Example: List tools from an MCP Server over Ziti
 */
import { ZitiMCPClient } from '../src/index.js';

async function main() {
  const identityPath = process.env.ZITI_IDENTITY_FILE;
  const serviceName = process.env.ZITI_SERVICE_NAME;

  if (!identityPath || !serviceName) {
    console.error('Error: Set ZITI_IDENTITY_FILE and ZITI_SERVICE_NAME environment variables');
    process.exit(1);
  }

  console.log('=== Ziti MCP SDK - List Tools Example ===');
  console.log(`Identity: ${identityPath}`);
  console.log(`Service: ${serviceName}`);
  console.log('');

  const client = new ZitiMCPClient({
    identityPath,
    serviceName,
    clientInfo: {
      name: 'ziti-mcp-example',
      version: '1.0.0'
    }
  });

  // Event handlers
  client.on('error', (error) => {
    console.error('Client error:', error.message);
  });

  try {
    console.log('Connecting to MCP Server via Ziti...');
    await client.connect();

    console.log('Connected!');
    console.log('Server info:', client.serverInfo);
    console.log('');

    // List tools
    console.log('Fetching available tools...');
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];

    console.log(`\nFound ${tools.length} tool(s):\n`);

    for (const tool of tools) {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    Description: ${tool.description}`);
      }
      if (tool.inputSchema) {
        console.log(`    Input Schema: ${JSON.stringify(tool.inputSchema, null, 2).split('\n').join('\n    ')}`);
      }
      console.log('');
    }

    // Also list resources and prompts if available
    try {
      const resourcesResult = await client.listResources();
      const resources = resourcesResult.resources || [];
      if (resources.length > 0) {
        console.log(`\nFound ${resources.length} resource(s):`);
        for (const resource of resources) {
          console.log(`  - ${resource.uri}: ${resource.name}`);
        }
      }
    } catch (e) {
      // Resources not supported
    }

    try {
      const promptsResult = await client.listPrompts();
      const prompts = promptsResult.prompts || [];
      if (prompts.length > 0) {
        console.log(`\nFound ${prompts.length} prompt(s):`);
        for (const prompt of prompts) {
          console.log(`  - ${prompt.name}: ${prompt.description || ''}`);
        }
      }
    } catch (e) {
      // Prompts not supported
    }

  } catch (error) {
    console.error('Failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    console.log('\nDisconnecting...');
    await client.disconnect();
    console.log('Done.');
  }
}

main();
