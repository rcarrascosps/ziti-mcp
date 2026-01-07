/**
 * Agent Integration Example
 *
 * Demonstrates how to integrate the Ziti MCP SDK with an AI agent
 * to securely call tools on a dark MCP server.
 *
 * Usage:
 *   ZITI_IDENTITY_FILE=./identity.json \
 *   ZITI_SERVICE_NAME=my-dark-mcp \
 *   npx tsx examples/agent-integration.ts
 */

import { ZitiMCPClient, Tool, ToolCallResult } from '../src/index.js';

// =============================================================================
// Agent Tool Interface
// =============================================================================

interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// =============================================================================
// Dark MCP Tool Wrapper
// =============================================================================

class DarkMCPToolProvider {
  private client: ZitiMCPClient;
  private tools: Map<string, Tool> = new Map();

  constructor(identityPath: string, serviceName: string) {
    this.client = new ZitiMCPClient({
      identityPath,
      serviceName,
      clientInfo: {
        name: 'agent-integration-example',
        version: '1.0.0'
      }
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log(`Connected to ${this.client.serverInfo?.name}`);

    // Cache tools
    const allTools = await this.client.getAllTools();
    for (const tool of allTools) {
      this.tools.set(tool.name, tool);
    }

    console.log(`Loaded ${this.tools.size} tools from dark MCP server`);

    // Listen for tool updates
    this.client.on('toolsChanged', async () => {
      console.log('Tools changed, refreshing...');
      const updated = await this.client.getAllTools();
      this.tools.clear();
      for (const tool of updated) {
        this.tools.set(tool.name, tool);
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  /**
   * Get tools in a format suitable for AI agents (e.g., OpenAI function calling)
   */
  getAgentTools(): AgentTool[] {
    const agentTools: AgentTool[] = [];

    for (const [name, tool] of this.tools) {
      agentTools.push({
        name,
        description: tool.description || `Execute ${name} tool`,
        parameters: tool.inputSchema as Record<string, unknown>,
        execute: async (args) => this.executeTool(name, args)
      });
    }

    return agentTools;
  }

  /**
   * Execute a tool and return the result as a string
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    console.log(`Executing tool: ${name}`, args);

    const result = await this.client.callTool(name, args);

    // Convert result to string
    return this.formatResult(result);
  }

  private formatResult(result: ToolCallResult): string {
    const parts: string[] = [];

    for (const content of result.content) {
      switch (content.type) {
        case 'text':
          parts.push(content.text);
          break;
        case 'image':
          parts.push(`[Image: ${content.mimeType}]`);
          break;
        case 'resource':
          parts.push(`[Resource: ${content.resource.uri}]`);
          if (content.resource.text) {
            parts.push(content.resource.text);
          }
          break;
      }
    }

    if (result.isError) {
      return `Error: ${parts.join('\n')}`;
    }

    return parts.join('\n');
  }
}

// =============================================================================
// Simple Agent Simulation
// =============================================================================

class SimpleAgent {
  private toolProvider: DarkMCPToolProvider;
  private tools: AgentTool[] = [];

  constructor(toolProvider: DarkMCPToolProvider) {
    this.toolProvider = toolProvider;
  }

  async initialize(): Promise<void> {
    await this.toolProvider.connect();
    this.tools = this.toolProvider.getAgentTools();

    console.log('\nAvailable tools for agent:');
    for (const tool of this.tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
  }

  async shutdown(): Promise<void> {
    await this.toolProvider.disconnect();
  }

  /**
   * Process a user request (simplified agent logic)
   */
  async processRequest(userRequest: string): Promise<string> {
    console.log(`\nProcessing request: "${userRequest}"`);

    // Simple keyword matching to select tool (in real agent, use LLM)
    const selectedTool = this.selectTool(userRequest);

    if (!selectedTool) {
      return "I don't have a tool that can help with that request.";
    }

    console.log(`Selected tool: ${selectedTool.name}`);

    // Extract arguments (simplified - in real agent, use LLM)
    const args = this.extractArgs(userRequest, selectedTool);
    console.log('Extracted args:', args);

    try {
      const result = await selectedTool.execute(args);
      return `Tool ${selectedTool.name} returned:\n${result}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error executing tool: ${message}`;
    }
  }

  private selectTool(request: string): AgentTool | null {
    const lower = request.toLowerCase();

    // Simple keyword matching
    for (const tool of this.tools) {
      if (lower.includes(tool.name.toLowerCase())) {
        return tool;
      }
      // Check description keywords
      const descWords = (tool.description || '').toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 4 && lower.includes(word)) {
          return tool;
        }
      }
    }

    // Return first tool as fallback (for demo)
    return this.tools[0] || null;
  }

  private extractArgs(request: string, tool: AgentTool): Record<string, unknown> {
    // Very simplified argument extraction
    // In a real agent, this would use an LLM to extract structured args
    const args: Record<string, unknown> = {};

    const schema = tool.parameters as { properties?: Record<string, unknown> };
    if (schema.properties) {
      for (const [paramName] of Object.entries(schema.properties)) {
        // Try to find the param value in the request
        const regex = new RegExp(`${paramName}[:\\s]+([\\w\\d]+)`, 'i');
        const match = request.match(regex);
        if (match) {
          args[paramName] = match[1];
        }
      }
    }

    return args;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const identityPath = process.env.ZITI_IDENTITY_FILE;
  const serviceName = process.env.ZITI_SERVICE_NAME;

  if (!identityPath || !serviceName) {
    console.error('Please set ZITI_IDENTITY_FILE and ZITI_SERVICE_NAME');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(' Dark MCP Agent Integration Example');
  console.log('='.repeat(60));

  const toolProvider = new DarkMCPToolProvider(identityPath, serviceName);
  const agent = new SimpleAgent(toolProvider);

  try {
    await agent.initialize();

    // Simulate agent requests
    const requests = [
      'What tools are available?',
      'Execute the first available tool'
    ];

    for (const request of requests) {
      console.log('\n' + '-'.repeat(60));
      const response = await agent.processRequest(request);
      console.log('\nAgent response:');
      console.log(response);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await agent.shutdown();
    console.log('\nAgent shutdown complete');
  }
}

main().catch(console.error);
