/**
 * Debug: Use dial + raw HTTP for MCP SSE transport
 */

async function main() {
  const identityPath = process.env.ZITI_IDENTITY_FILE!;
  const serviceName = process.env.ZITI_SERVICE_NAME!;

  console.log('=== Debug Dial + HTTP ===');
  console.log(`Service: ${serviceName}`);

  const ziti = (await import('@openziti/ziti-sdk-nodejs')).default;
  ziti.setLogLevel(3); // INFO

  console.log('Initializing...');
  await ziti.init(identityPath);
  await new Promise(r => setTimeout(r, 1500));

  let sessionId: string | null = null;
  let sseConn: number | null = null;
  let messageConn: number | null = null;

  // Step 1: Connect SSE stream
  console.log('\n1. Dialing for SSE stream...');

  await new Promise<void>((resolve) => {
    ziti.dial(
      serviceName,
      false,
      (conn: number) => {
        sseConn = conn;
        console.log(`   SSE connection handle: ${conn}`);

        // Send HTTP GET for /sse
        const request = [
          'GET /sse HTTP/1.1',
          `Host: ${serviceName}`,
          'Accept: text/event-stream',
          'Cache-Control: no-cache',
          'Connection: keep-alive',
          '',
          ''
        ].join('\r\n');

        console.log('   Sending GET /sse request...');
        ziti.write(conn, Buffer.from(request));
      },
      (data: Buffer) => {
        const text = data.toString();
        console.log('   SSE data received:', text.slice(0, 300));

        // Parse sessionId from endpoint event
        const match = text.match(/sessionId=([^\s&"]+)/);
        if (match && !sessionId) {
          sessionId = match[1];
          console.log(`   >>> Session ID: ${sessionId}`);
          resolve();
        }
      }
    );
  });

  if (!sessionId) {
    console.error('Failed to get session ID');
    return;
  }

  // Step 2: Send MCP initialize message via new dial connection
  console.log('\n2. Dialing for message POST...');

  const initMessage = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'debug-client', version: '1.0.0' }
    }
  });

  await new Promise<void>((resolve) => {
    ziti.dial(
      serviceName,
      false,
      (conn: number) => {
        messageConn = conn;
        console.log(`   Message connection handle: ${conn}`);

        // Send HTTP POST
        const request = [
          `POST /message?sessionId=${sessionId} HTTP/1.1`,
          `Host: ${serviceName}`,
          'Content-Type: application/json',
          `Content-Length: ${Buffer.byteLength(initMessage)}`,
          'Connection: close',
          '',
          initMessage
        ].join('\r\n');

        console.log('   Sending POST /message request...');
        ziti.write(conn, Buffer.from(request));
      },
      (data: Buffer) => {
        const text = data.toString();
        console.log('   POST response:', text.slice(0, 500));
        resolve();
      }
    );
  });

  // Step 3: Wait for SSE response
  console.log('\n3. Waiting for MCP response via SSE...');

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log('   Timeout waiting for SSE response');
      resolve();
    }, 10000);

    // The SSE data handler already set up will receive the response
    // We just need to wait
    const check = setInterval(() => {
      // Check if we got a response (will be printed by the SSE handler)
    }, 100);

    setTimeout(() => {
      clearInterval(check);
      clearTimeout(timeout);
      resolve();
    }, 5000);
  });

  // Cleanup
  if (sseConn) ziti.close(sseConn);
  if (messageConn) ziti.close(messageConn);

  console.log('\nDone.');
  process.exit(0);
}

main();
