/**
 * Debug script to test raw Ziti SDK connection
 */

async function main() {
  const identityPath = process.env.ZITI_IDENTITY_FILE;
  const serviceName = process.env.ZITI_SERVICE_NAME;

  if (!identityPath || !serviceName) {
    console.error('Set ZITI_IDENTITY_FILE and ZITI_SERVICE_NAME');
    process.exit(1);
  }

  console.log('=== Ziti Debug ===');
  console.log(`Identity: ${identityPath}`);
  console.log(`Service: ${serviceName}`);
  console.log('');

  try {
    // Direct import of Ziti SDK
    console.log('Loading Ziti SDK...');
    const ziti = (await import('@openziti/ziti-sdk-nodejs')).default;

    console.log('Ziti SDK loaded. Functions available:');
    console.log(Object.keys(ziti).join(', '));
    console.log('');

    // Set verbose logging
    if (ziti.setLogLevel) {
      ziti.setLogLevel(4); // DEBUG level
    }

    // Initialize
    console.log('Initializing with identity...');
    const initStatus = await ziti.init(identityPath);
    console.log(`Init status: ${initStatus}`);

    if (initStatus !== 0) {
      console.error('Init failed!');
      process.exit(1);
    }

    // Check service availability
    console.log(`\nChecking service availability for: "${serviceName}"`);

    const status = await new Promise<number>((resolve) => {
      ziti.serviceAvailable(serviceName, (st: number) => {
        console.log(`serviceAvailable callback received: ${st}`);
        resolve(st);
      });
    });

    console.log(`\nService status raw value: ${status}`);
    console.log(`  - Is available (status >= 0): ${status >= 0}`);
    console.log(`  - Has Dial permission (status & 1): ${(status & 1) !== 0}`);
    console.log(`  - Has Bind permission (status & 2): ${(status & 2) !== 0}`);

    if (status < 0) {
      console.log('\nService not available. Common causes:');
      console.log('  - Service name mismatch');
      console.log('  - No Dial policy for this identity');
      console.log('  - Service has no terminators (nothing hosting it)');
      console.log('  - Edge router not connected');
    } else {
      console.log('\nService IS available! Trying to dial...');

      // Try to dial the service
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('Dial timeout after 10s');
          reject(new Error('Dial timeout'));
        }, 10000);

        ziti.dial(
          serviceName,
          false, // not websocket
          (conn: unknown) => {
            clearTimeout(timeout);
            console.log('Connected! Connection handle:', conn);
            resolve();
          },
          (data: Buffer) => {
            console.log('Received data:', data.toString().slice(0, 200));
          }
        );
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\nDone.');
  process.exit(0);
}

main();
