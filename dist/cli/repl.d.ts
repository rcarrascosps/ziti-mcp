/**
 * ZitiMCPRepl - Interactive REPL for MCP over Ziti
 */
export interface ReplOptions {
    identityPath?: string;
    serviceName?: string;
    autoConnect?: boolean;
    verbose?: boolean;
}
export declare class ZitiMCPRepl {
    private rl;
    private client;
    private identityPath;
    private serviceName;
    private verbose;
    private running;
    private toolsCache;
    constructor(options?: ReplOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    private getPrompt;
    private processLine;
    private parseCommand;
    private processCommand;
    private handleConnect;
    private handleDisconnect;
    private handleStatus;
    private handleIdentity;
    private handleTools;
    private handleToolInfo;
    private handleCall;
    private handleResources;
    private handleResourceRead;
    private handlePrompts;
    private handlePromptGet;
    private handlePing;
    private handleClear;
    private handleVerbose;
    private ensureConnected;
    private setupClientEvents;
    private completer;
}
//# sourceMappingURL=repl.d.ts.map