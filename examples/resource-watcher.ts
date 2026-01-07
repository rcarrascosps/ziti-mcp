/**
 * Resource Watcher Example
 *
 * Demonstrates how to list, read, and watch resources
 * on a dark MCP server.
 *
 * Usage:
 *   ZITI_IDENTITY_FILE=./identity.json \
 *   ZITI_SERVICE_NAME=my-dark-mcp \
 *   npx tsx examples/resource-watcher.ts
 */

import { ZitiMCPClient, Resource, ResourceContents } from '../src/index.js';

// =============================================================================
// Resource Manager
// =============================================================================

class ResourceManager {
  private client: ZitiMCPClient;
  private watchedResources: Set<string> = new Set();

  constructor(identityPath: string, serviceName: string) {
    this.client = new ZitiMCPClient({
      identityPath,
      serviceName,
      clientInfo: {
        name: 'resource-watcher',
        version: '1.0.0'
      }
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log(`Connected to ${this.client.serverInfo?.name}\n`);

    // Set up event listeners
    this.client.on('resourcesChanged', () => {
      console.log('\n[Event] Resources list changed');
      this.listResources().catch(console.error);
    });

    this.client.on('resourceUpdated', async (uri) => {
      console.log(`\n[Event] Resource updated: ${uri}`);
      if (this.watchedResources.has(uri)) {
        await this.readResource(uri);
      }
    });
  }

  async disconnect(): Promise<void> {
    // Unsubscribe from all watched resources
    for (const uri of this.watchedResources) {
      try {
        await this.client.unsubscribeResource(uri);
      } catch {
        // Ignore unsubscribe errors during disconnect
      }
    }
    await this.client.disconnect();
  }

  async listResources(): Promise<Resource[]> {
    const resources = await this.client.getAllResources();

    console.log(`\nResources (${resources.length}):`);
    for (const resource of resources) {
      const watched = this.watchedResources.has(resource.uri) ? ' [watching]' : '';
      console.log(`  ${resource.name}${watched}`);
      console.log(`    URI: ${resource.uri}`);
      if (resource.mimeType) {
        console.log(`    Type: ${resource.mimeType}`);
      }
      if (resource.description) {
        console.log(`    ${resource.description}`);
      }
    }

    return resources;
  }

  async readResource(uri: string): Promise<ResourceContents[]> {
    console.log(`\nReading: ${uri}`);

    const contents = await this.client.readResource(uri);

    for (const content of contents) {
      console.log(`  URI: ${content.uri}`);
      if (content.mimeType) {
        console.log(`  Type: ${content.mimeType}`);
      }

      if (content.text) {
        // Limit output for display
        const preview = content.text.length > 500
          ? content.text.slice(0, 500) + '\n  ... (truncated)'
          : content.text;
        console.log(`  Content:\n${preview.split('\n').map(l => '    ' + l).join('\n')}`);
      } else if (content.blob) {
        console.log(`  Binary: ${content.blob.length} bytes (base64)`);
      }
    }

    return contents;
  }

  async watchResource(uri: string): Promise<void> {
    if (!this.client.serverCapabilities?.resources?.subscribe) {
      console.log('Server does not support resource subscriptions');
      return;
    }

    if (this.watchedResources.has(uri)) {
      console.log(`Already watching: ${uri}`);
      return;
    }

    await this.client.subscribeResource(uri);
    this.watchedResources.add(uri);
    console.log(`Now watching: ${uri}`);
  }

  async unwatchResource(uri: string): Promise<void> {
    if (!this.watchedResources.has(uri)) {
      console.log(`Not watching: ${uri}`);
      return;
    }

    await this.client.unsubscribeResource(uri);
    this.watchedResources.delete(uri);
    console.log(`Stopped watching: ${uri}`);
  }

  get supportsSubscriptions(): boolean {
    return this.client.serverCapabilities?.resources?.subscribe ?? false;
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
  console.log(' Dark MCP Resource Watcher');
  console.log('='.repeat(60));

  const manager = new ResourceManager(identityPath, serviceName);

  try {
    await manager.connect();

    // List all resources
    const resources = await manager.listResources();

    if (resources.length === 0) {
      console.log('\nNo resources available on this server.');
      await manager.disconnect();
      return;
    }

    // Read first resource
    console.log('\n' + '-'.repeat(60));
    await manager.readResource(resources[0].uri);

    // Watch first resource if subscriptions supported
    if (manager.supportsSubscriptions) {
      console.log('\n' + '-'.repeat(60));
      await manager.watchResource(resources[0].uri);
      console.log('\nWatching for changes. Press Ctrl+C to exit.');

      // Keep running to receive updates
      await new Promise<void>((resolve) => {
        process.on('SIGINT', () => {
          console.log('\n\nShutting down...');
          resolve();
        });
      });
    } else {
      console.log('\nServer does not support subscriptions.');
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    await manager.disconnect();
    console.log('Disconnected');
  }
}

main().catch(console.error);
