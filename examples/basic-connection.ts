/**
 * Basic ZitiConnection Example
 *
 * Demonstrates how to:
 * 1. Initialize a Ziti connection with an identity
 * 2. Check if a service is available
 * 3. Make HTTP requests to a dark service
 * 4. Create a streaming connection for SSE
 */

import { ZitiConnection, ZitiIdentity, ZitiLogLevel } from '../src/index.js';

async function main() {
  // Load identity from environment or path
  const identityPath = process.env.ZITI_IDENTITY_FILE || './my-identity.json';

  // Validate identity first
  const identity = new ZitiIdentity(identityPath);
  const info = await identity.validate();

  if (!info.isValid) {
    console.error('Invalid identity:', info.error);
    process.exit(1);
  }

  console.log('Identity validated successfully');
  console.log('API Endpoint:', info.apiEndpoint);

  // Create and initialize connection
  const connection = new ZitiConnection({
    identityPath: identity.getPath(),
    logLevel: ZitiLogLevel.INFO,
    connectTimeout: 30000,
    requestTimeout: 60000
  });

  connection.on('initialized', () => {
    console.log('Ziti SDK initialized');
  });

  connection.on('closed', () => {
    console.log('Ziti connection closed');
  });

  try {
    // Initialize the SDK
    await connection.init();

    // Check service availability
    const serviceName = process.env.ZITI_SERVICE_NAME || 'my-mcp-service';
    const status = await connection.isServiceAvailable(serviceName);

    console.log(`Service "${serviceName}" status:`, status);

    if (!status.available) {
      console.error('Service not available');
      process.exit(1);
    }

    if (!status.permissions.dial) {
      console.error('No dial permission for service');
      process.exit(1);
    }

    // Example: Make an HTTP request
    console.log('\n--- Making HTTP request ---');
    const response = await connection.httpRequest(serviceName, {
      method: 'GET',
      path: '/health',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response body:', response.body.toString('utf-8'));

    // Example: Create SSE stream
    console.log('\n--- Creating SSE stream ---');
    const stream = await connection.createHttpStream(serviceName, {
      method: 'GET',
      path: '/sse',
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    // Handle stream data
    stream.on('data', (chunk: Buffer) => {
      console.log('SSE chunk:', chunk.toString('utf-8'));
    });

    stream.on('error', (error: Error) => {
      console.error('Stream error:', error);
    });

    stream.on('close', () => {
      console.log('Stream closed');
    });

    // Keep connection open for 10 seconds to receive SSE events
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Cleanup
    stream.close();
    await connection.close();

    console.log('\nConnection closed successfully');
  } catch (error) {
    console.error('Error:', error);
    await connection.close();
    process.exit(1);
  }
}

main().catch(console.error);
