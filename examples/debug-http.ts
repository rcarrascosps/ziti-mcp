/**
 * Debug HTTP request over Ziti
 */

async function main() {
  const identityPath = process.env.ZITI_IDENTITY_FILE!;
  const serviceName = process.env.ZITI_SERVICE_NAME!;

  console.log('=== Debug HTTP Request ===');
  console.log(`Identity: ${identityPath}`);
  console.log(`Service: ${serviceName}`);

  const ziti = (await import('@openziti/ziti-sdk-nodejs')).default;

  // Set debug level
  ziti.setLogLevel(4);

  console.log('\nInitializing...');
  const status = await ziti.init(identityPath);
  console.log(`Init status: ${status}`);

  // Wait a bit for services to load
  await new Promise(r => setTimeout(r, 2000));

  console.log('\nTrying httpRequest to /sse...');

  try {
    await new Promise<void>((resolve, reject) => {
      let responseReceived = false;

      const timeout = setTimeout(() => {
        if (!responseReceived) {
          console.log('Timeout waiting for response');
          resolve();
        }
      }, 15000);

      ziti.httpRequest(
        serviceName,
        undefined,
        'GET',
        '/sse',
        ['Accept: text/event-stream', 'Cache-Control: no-cache'],
        undefined,
        // onRequest
        () => {
          console.log('Request sent');
        },
        // onResponse
        (obj: { status: number; headers: Record<string, string> }) => {
          responseReceived = true;
          console.log('Response received:');
          console.log(`  Status: ${obj.status}`);
          console.log(`  Headers:`, obj.headers);
        },
        // onResponseData
        (obj: { body: Buffer }) => {
          console.log('Response data:');
          console.log(obj.body.toString().slice(0, 500));
          clearTimeout(timeout);
          resolve();
        }
      );
    });
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\nDone.');
}

main();
