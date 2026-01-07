#!/usr/bin/env node
/**
 * Ziti MCP CLI - Interactive client for dark MCP servers
 *
 * A REPL-based CLI for connecting to MCP servers over OpenZiti zero-trust network.
 *
 * Usage:
 *   ziti-mcp-cli --identity ./my-identity.json --service my-mcp-server
 *   ziti-mcp-cli -i ./identity.json -s my-server
 */
import { ZitiMCPRepl } from './repl.js';
import { parseArgs } from './args.js';
import { printBanner, printError } from './formatter.js';
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        process.exit(0);
    }
    if (args.version) {
        console.log('ziti-mcp-cli v0.1.0');
        process.exit(0);
    }
    printBanner();
    const repl = new ZitiMCPRepl({
        identityPath: args.identity,
        serviceName: args.service,
        autoConnect: args.autoConnect,
        verbose: args.verbose
    });
    // Handle shutdown
    const shutdown = async () => {
        console.log('\n');
        await repl.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    try {
        await repl.start();
    }
    catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
function printHelp() {
    console.log(`
Ziti MCP CLI - Interactive client for dark MCP servers

USAGE:
  ziti-mcp-cli [OPTIONS]

OPTIONS:
  -i, --identity <path>    Path to Ziti identity file
  -s, --service <name>     Name of the MCP service to connect to
  -c, --connect            Auto-connect on startup
  -v, --verbose            Enable verbose logging
  -h, --help               Show this help message
  --version                Show version

EXAMPLES:
  # Start interactive mode
  ziti-mcp-cli

  # Start with identity and auto-connect
  ziti-mcp-cli -i ./identity.json -s my-mcp-server -c

  # Verbose mode for debugging
  ziti-mcp-cli -i ./identity.json -s my-server -v

COMMANDS (in REPL):
  /connect <service>       Connect to an MCP server
  /disconnect              Disconnect from current server
  /status                  Show connection status

  /tools                   List available tools
  /tool <name>             Show tool details
  /call <name> [args]      Call a tool with JSON args

  /resources               List available resources
  /resource <uri>          Read a resource

  /prompts                 List available prompts
  /prompt <name> [args]    Get a prompt

  /ping                    Ping the server
  /clear                   Clear the screen
  /help                    Show help
  /exit                    Exit the CLI
`);
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map