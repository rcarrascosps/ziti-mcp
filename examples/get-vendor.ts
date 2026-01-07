/**
 * Get vendor data from MCP Server
 */
import { ZitiMCPClient } from '../src/index.js';

async function main() {
  const client = new ZitiMCPClient({
    identityPath: process.env.ZITI_IDENTITY_FILE!,
    serviceName: process.env.ZITI_SERVICE_NAME!,
    clientInfo: { name: 'vendor-query', version: '1.0.0' }
  });

  try {
    console.log('Connecting to MCP Server...');
    await client.connect();
    console.log(`Connected to ${client.serverInfo?.name}\n`);

    console.log('Calling get-vendors tool...\n');
    const result = await client.callTool('get-vendors', {});

    console.log('=== Vendors Response ===\n');

    // Parse and display results
    if (result.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          // Try to parse as JSON for better display
          try {
            const data = JSON.parse(item.text);
            console.log(JSON.stringify(data, null, 2));

            // Search for SPS vendor
            if (Array.isArray(data)) {
              const sps = data.find((v: any) =>
                v.name?.toLowerCase().includes('sps') ||
                v.vendorCode?.toLowerCase().includes('sps') ||
                JSON.stringify(v).toLowerCase().includes('sps')
              );
              if (sps) {
                console.log('\n=== Proveedor SPS encontrado ===');
                console.log(JSON.stringify(sps, null, 2));
              }
            }
          } catch {
            console.log(item.text);
          }
        }
      }
    } else {
      console.log('Result:', JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  } finally {
    await client.disconnect();
  }
}

main();
