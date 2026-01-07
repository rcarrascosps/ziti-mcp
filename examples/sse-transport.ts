/**
 * ZitiSSETransport Example
 *
 * Demonstrates how to use ZitiSSETransport to communicate
 * with an MCP server over OpenZiti.
 */

import {
  ZitiConnection,
  ZitiIdentity,
  ZitiSSETransport,
  TransportState,
  ZitiLogLevel,
  LogLevel,
  Logger
} from '../src/index.js';

// Create a custom logger
const logger = new Logger({
  level: LogLevel.DEBUG,
  prefix: 'MCPExample'
});

async function main() {
  const identityPath = process.env.ZITI_IDENTITY_FILE || './my-identity.json';
  const serviceName = process.env.ZITI_SERVICE_NAME || 'my-mcp-service';

  // Validate identity
  const identity = new ZitiIdentity(identityPath);
  const info = await identity.validate();

  if (!info.isValid) {
    logger.error(`Invalid identity: ${info.error}`);
    process.exit(1);
  }

  logger.info(`Using identity: ${identity.getPath()}`);
  logger.info(`Controller: ${info.apiEndpoint}`);

  // Create Ziti connection
  const connection = new ZitiConnection({
    identityPath: identity.getPath(),
    logLevel: ZitiLogLevel.INFO
  });

  // Create SSE transport
  const transport = new ZitiSSETransport(connection, {
    serviceName,
    ssePath: '/sse',
    messagePath: '/message',
    autoReconnect: true,
    maxReconnectAttempts: 3,
    reconnectDelay: 1000,
    connectTimeout: 30000,
    requestTimeout: 60000,
    logger
  });

  // Set up event handlers
  transport.on('connected', () => {
    logger.info(`Connected! Session ID: ${transport.sessionId}`);
  });

  transport.on('disconnected', (reason) => {
    logger.info(`Disconnected: ${reason}`);
  });

  transport.on('reconnecting', (attempt) => {
    logger.info(`Reconnecting... attempt ${attempt}`);
  });

  transport.on('stateChange', (state) => {
    logger.debug(`State changed to: ${state}`);
  });

  transport.on('message', (message) => {
    logger.info('Received notification:', JSON.stringify(message, null, 2));
  });

  transport.on('error', (error) => {
    logger.error(`Transport error: ${error.message}`);
  });

  try {
    // Initialize Ziti
    logger.info('Initializing Ziti SDK...');
    await connection.init();

    // Check service availability
    const status = await connection.isServiceAvailable(serviceName);
    if (!status.available) {
      throw new Error(`Service ${serviceName} is not available`);
    }
    logger.info(`Service ${serviceName} is available (dial: ${status.permissions.dial})`);

    // Connect transport
    logger.info('Connecting to MCP server...');
    await transport.connect();

    // Send initialize request
    logger.info('Sending initialize request...');
    const initResult = await transport.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'ziti-mcp-sdk-example',
          version: '0.1.0'
        }
      }
    });

    logger.info('Initialize response:', JSON.stringify(initResult, null, 2));

    // Send initialized notification
    await transport.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });

    // List tools
    logger.info('Listing tools...');
    const toolsResult = await transport.request({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    logger.info('Available tools:', JSON.stringify(toolsResult, null, 2));

    // List resources
    logger.info('Listing resources...');
    const resourcesResult = await transport.request({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list'
    });

    logger.info('Available resources:', JSON.stringify(resourcesResult, null, 2));

    // Example: Call a tool (if available)
    // const toolResult = await transport.request({
    //   jsonrpc: '2.0',
    //   id: 4,
    //   method: 'tools/call',
    //   params: {
    //     name: 'example-tool',
    //     arguments: { key: 'value' }
    //   }
    // });
    // logger.info('Tool result:', JSON.stringify(toolResult, null, 2));

    // Keep running for a while to receive notifications
    logger.info('Listening for notifications (press Ctrl+C to exit)...');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await transport.disconnect();
      await connection.close();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : error}`);
    await transport.disconnect();
    await connection.close();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
