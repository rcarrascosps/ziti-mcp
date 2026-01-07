/**
 * ZitiMCPRepl - Interactive REPL for MCP over Ziti
 */
import * as readline from 'readline';
import { ZitiMCPClient } from '../client/ZitiMCPClient.js';
import { LogLevel } from '../utils/Logger.js';
import { printSuccess, printError, printWarning, printInfo, printDebug, printConnectionStatus, printServerCapabilities, printToolList, printToolDetails, printToolResult, printResourceList, printResourceContents, printPromptList, printPromptResult, printHelp, c } from './formatter.js';
// =============================================================================
// ZitiMCPRepl
// =============================================================================
export class ZitiMCPRepl {
    rl = null;
    client = null;
    identityPath;
    serviceName;
    verbose;
    running = false;
    toolsCache = [];
    constructor(options = {}) {
        this.identityPath = options.identityPath || null;
        this.serviceName = options.serviceName || null;
        this.verbose = options.verbose || false;
        if (options.autoConnect && this.identityPath && this.serviceName) {
            // Will auto-connect after start
        }
    }
    // ===========================================================================
    // Lifecycle
    // ===========================================================================
    async start() {
        this.running = true;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            completer: this.completer.bind(this)
        });
        // Show initial status
        if (this.identityPath) {
            printInfo(`Identity: ${this.identityPath}`);
        }
        if (this.serviceName) {
            printInfo(`Service: ${this.serviceName}`);
        }
        // Auto-connect if configured
        if (this.identityPath && this.serviceName) {
            printInfo('Auto-connecting...');
            await this.handleConnect([this.serviceName]);
        }
        // Start REPL loop
        this.rl.prompt();
        this.rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (trimmed) {
                await this.processLine(trimmed);
            }
            if (this.running && this.rl) {
                this.rl.setPrompt(this.getPrompt());
                this.rl.prompt();
            }
        });
        this.rl.on('close', () => {
            this.running = false;
        });
        // Keep the process running
        await new Promise((resolve) => {
            const check = () => {
                if (!this.running) {
                    resolve();
                }
                else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    async stop() {
        this.running = false;
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
        printInfo('Goodbye!');
    }
    // ===========================================================================
    // Prompt
    // ===========================================================================
    getPrompt() {
        const connected = this.client?.isReady;
        const status = connected ? c.green('●') : c.red('○');
        const service = this.serviceName ? c.dim(`[${this.serviceName}]`) : '';
        return `${status} ${service} ${c.bold('mcp>')} `;
    }
    // ===========================================================================
    // Command Processing
    // ===========================================================================
    async processLine(line) {
        if (line.startsWith('/')) {
            await this.processCommand(line);
        }
        else {
            // Treat as natural language or direct tool call
            printWarning('Commands must start with /. Type /help for available commands.');
        }
    }
    parseCommand(line) {
        const withoutSlash = line.slice(1);
        const parts = withoutSlash.split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        const rawArgs = withoutSlash.slice(command.length).trim();
        return { command, args, rawArgs };
    }
    async processCommand(line) {
        const { command, args, rawArgs } = this.parseCommand(line);
        try {
            switch (command) {
                // Connection
                case 'connect':
                    await this.handleConnect(args);
                    break;
                case 'disconnect':
                    await this.handleDisconnect();
                    break;
                case 'status':
                    this.handleStatus();
                    break;
                case 'identity':
                    this.handleIdentity(args);
                    break;
                // Tools
                case 'tools':
                    await this.handleTools();
                    break;
                case 'tool':
                    await this.handleToolInfo(args);
                    break;
                case 'call':
                    await this.handleCall(args, rawArgs);
                    break;
                // Resources
                case 'resources':
                    await this.handleResources();
                    break;
                case 'resource':
                    await this.handleResourceRead(rawArgs);
                    break;
                // Prompts
                case 'prompts':
                    await this.handlePrompts();
                    break;
                case 'prompt':
                    await this.handlePromptGet(args, rawArgs);
                    break;
                // Utility
                case 'ping':
                    await this.handlePing();
                    break;
                case 'clear':
                    this.handleClear();
                    break;
                case 'verbose':
                    this.handleVerbose();
                    break;
                case 'help':
                case 'h':
                case '?':
                    printHelp();
                    break;
                case 'exit':
                case 'quit':
                case 'q':
                    await this.stop();
                    break;
                default:
                    printError(`Unknown command: /${command}. Type /help for available commands.`);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            printError(message);
            if (this.verbose && error instanceof Error && error.stack) {
                console.log(c.dim(error.stack));
            }
        }
    }
    // ===========================================================================
    // Command Handlers - Connection
    // ===========================================================================
    async handleConnect(args) {
        if (this.client?.isReady) {
            printWarning('Already connected. Use /disconnect first.');
            return;
        }
        // Get service name
        const service = args[0] || this.serviceName;
        if (!service) {
            printError('Service name required. Usage: /connect <service>');
            return;
        }
        this.serviceName = service;
        // Get identity
        if (!this.identityPath) {
            printError('Identity not set. Use /identity <path> first.');
            return;
        }
        printInfo(`Connecting to ${service}...`);
        // Create client
        this.client = new ZitiMCPClient({
            identityPath: this.identityPath,
            serviceName: service,
            clientInfo: {
                name: 'ziti-mcp-cli',
                version: '0.1.0'
            },
            logLevel: this.verbose ? LogLevel.DEBUG : LogLevel.WARN
        });
        // Set up event handlers
        this.setupClientEvents();
        // Connect
        const result = await this.client.connect();
        printSuccess(`Connected to ${result.serverInfo.name} v${result.serverInfo.version}`);
        if (result.instructions) {
            printInfo(`Server instructions: ${result.instructions}`);
        }
        printServerCapabilities(result.capabilities);
        // Cache tools for autocomplete
        try {
            this.toolsCache = await this.client.getAllTools();
        }
        catch {
            this.toolsCache = [];
        }
    }
    async handleDisconnect() {
        if (!this.client) {
            printWarning('Not connected.');
            return;
        }
        await this.client.disconnect();
        this.client = null;
        this.toolsCache = [];
        printSuccess('Disconnected');
    }
    handleStatus() {
        printConnectionStatus(this.client?.isReady || false, this.client?.serverInfo, this.serviceName || undefined);
        if (this.identityPath) {
            console.log(`  Identity: ${c.dim(this.identityPath)}`);
        }
        if (this.client?.serverCapabilities) {
            printServerCapabilities(this.client.serverCapabilities);
        }
    }
    handleIdentity(args) {
        if (args.length === 0) {
            if (this.identityPath) {
                printInfo(`Current identity: ${this.identityPath}`);
            }
            else {
                printInfo('No identity set');
            }
            return;
        }
        this.identityPath = args[0];
        printSuccess(`Identity set to: ${this.identityPath}`);
    }
    // ===========================================================================
    // Command Handlers - Tools
    // ===========================================================================
    async handleTools() {
        this.ensureConnected();
        const tools = await this.client.getAllTools();
        this.toolsCache = tools;
        printToolList(tools);
    }
    async handleToolInfo(args) {
        this.ensureConnected();
        if (args.length === 0) {
            printError('Tool name required. Usage: /tool <name>');
            return;
        }
        const toolName = args[0];
        // Try cache first
        let tool = this.toolsCache.find(t => t.name === toolName);
        if (!tool) {
            const tools = await this.client.getAllTools();
            this.toolsCache = tools;
            tool = tools.find(t => t.name === toolName);
        }
        if (!tool) {
            printError(`Tool not found: ${toolName}`);
            return;
        }
        printToolDetails(tool);
    }
    async handleCall(args, rawArgs) {
        this.ensureConnected();
        if (args.length === 0) {
            printError('Tool name required. Usage: /call <name> [json_args]');
            return;
        }
        const toolName = args[0];
        // Parse arguments
        let toolArgs = {};
        const jsonPart = rawArgs.slice(toolName.length).trim();
        if (jsonPart) {
            try {
                toolArgs = JSON.parse(jsonPart);
            }
            catch (e) {
                printError(`Invalid JSON arguments: ${e instanceof Error ? e.message : e}`);
                return;
            }
        }
        printInfo(`Calling ${toolName}...`);
        if (this.verbose && Object.keys(toolArgs).length > 0) {
            printDebug(`Arguments: ${JSON.stringify(toolArgs)}`);
        }
        const result = await this.client.callTool(toolName, toolArgs);
        printToolResult(result);
    }
    // ===========================================================================
    // Command Handlers - Resources
    // ===========================================================================
    async handleResources() {
        this.ensureConnected();
        const resources = await this.client.getAllResources();
        printResourceList(resources);
    }
    async handleResourceRead(uri) {
        this.ensureConnected();
        if (!uri) {
            printError('Resource URI required. Usage: /resource <uri>');
            return;
        }
        printInfo(`Reading ${uri}...`);
        const contents = await this.client.readResource(uri);
        printResourceContents(contents);
    }
    // ===========================================================================
    // Command Handlers - Prompts
    // ===========================================================================
    async handlePrompts() {
        this.ensureConnected();
        const prompts = await this.client.getAllPrompts();
        printPromptList(prompts);
    }
    async handlePromptGet(args, rawArgs) {
        this.ensureConnected();
        if (args.length === 0) {
            printError('Prompt name required. Usage: /prompt <name> [json_args]');
            return;
        }
        const promptName = args[0];
        // Parse arguments
        let promptArgs;
        const jsonPart = rawArgs.slice(promptName.length).trim();
        if (jsonPart) {
            try {
                promptArgs = JSON.parse(jsonPart);
            }
            catch (e) {
                printError(`Invalid JSON arguments: ${e instanceof Error ? e.message : e}`);
                return;
            }
        }
        printInfo(`Getting prompt ${promptName}...`);
        const result = await this.client.getPrompt(promptName, promptArgs);
        printPromptResult(result);
    }
    // ===========================================================================
    // Command Handlers - Utility
    // ===========================================================================
    async handlePing() {
        this.ensureConnected();
        printInfo('Pinging server...');
        const start = Date.now();
        await this.client.ping();
        const elapsed = Date.now() - start;
        printSuccess(`Pong! (${elapsed}ms)`);
    }
    handleClear() {
        console.clear();
    }
    handleVerbose() {
        this.verbose = !this.verbose;
        printInfo(`Verbose mode: ${this.verbose ? 'ON' : 'OFF'}`);
    }
    // ===========================================================================
    // Helpers
    // ===========================================================================
    ensureConnected() {
        if (!this.client?.isReady) {
            throw new Error('Not connected. Use /connect <service> first.');
        }
    }
    setupClientEvents() {
        if (!this.client)
            return;
        this.client.on('disconnected', (reason) => {
            printWarning(`Disconnected: ${reason || 'unknown reason'}`);
            this.toolsCache = [];
        });
        this.client.on('error', (error) => {
            printError(`Client error: ${error.message}`);
        });
        this.client.on('toolsChanged', () => {
            printInfo('[Server] Tools list changed');
            // Refresh cache
            this.client?.getAllTools().then(tools => {
                this.toolsCache = tools;
            }).catch(() => { });
        });
        this.client.on('resourcesChanged', () => {
            printInfo('[Server] Resources list changed');
        });
        this.client.on('promptsChanged', () => {
            printInfo('[Server] Prompts list changed');
        });
        this.client.on('resourceUpdated', (uri) => {
            printInfo(`[Server] Resource updated: ${uri}`);
        });
        this.client.on('log', (level, message) => {
            if (this.verbose) {
                printDebug(`[Server/${level}] ${message}`);
            }
        });
    }
    // ===========================================================================
    // Autocomplete
    // ===========================================================================
    completer(line) {
        const commands = [
            '/connect', '/disconnect', '/status', '/identity',
            '/tools', '/tool', '/call',
            '/resources', '/resource',
            '/prompts', '/prompt',
            '/ping', '/clear', '/verbose', '/help', '/exit'
        ];
        if (line.startsWith('/')) {
            // Command completion
            const matches = commands.filter(c => c.startsWith(line));
            // Tool name completion for /call and /tool
            if (line.startsWith('/call ') || line.startsWith('/tool ')) {
                const prefix = line.split(' ')[1] || '';
                const toolMatches = this.toolsCache
                    .filter(t => t.name.startsWith(prefix))
                    .map(t => line.split(' ')[0] + ' ' + t.name);
                return [toolMatches.length > 0 ? toolMatches : matches, line];
            }
            return [matches, line];
        }
        return [[], line];
    }
}
//# sourceMappingURL=repl.js.map