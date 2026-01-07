/**
 * CLI Output Formatter
 *
 * Provides colored and formatted output for the CLI
 */
import { Tool, Resource, Prompt, ServerInfo, ServerCapabilities } from '../protocol/types.js';
export declare const c: {
    reset: (s: string) => string;
    bold: (s: string) => string;
    dim: (s: string) => string;
    italic: (s: string) => string;
    red: (s: string) => string;
    green: (s: string) => string;
    yellow: (s: string) => string;
    blue: (s: string) => string;
    magenta: (s: string) => string;
    cyan: (s: string) => string;
    white: (s: string) => string;
    success: (s: string) => string;
    error: (s: string) => string;
    warning: (s: string) => string;
    info: (s: string) => string;
    header: (s: string) => string;
    command: (s: string) => string;
    value: (s: string) => string;
};
export declare function printBanner(): void;
export declare function printHeader(title: string): void;
export declare function printSubHeader(title: string): void;
export declare function printSuccess(message: string): void;
export declare function printError(message: string): void;
export declare function printWarning(message: string): void;
export declare function printInfo(message: string): void;
export declare function printDebug(message: string): void;
export declare function printConnectionStatus(connected: boolean, serverInfo?: ServerInfo | null, serviceName?: string): void;
export declare function printServerCapabilities(capabilities: ServerCapabilities): void;
export declare function printToolList(tools: Tool[]): void;
export declare function printToolDetails(tool: Tool): void;
export declare function printToolResult(result: {
    content: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
        resource?: {
            uri: string;
            text?: string;
        };
    }>;
    isError?: boolean;
}): void;
export declare function printResourceList(resources: Resource[]): void;
export declare function printResourceContents(contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
}>): void;
export declare function printPromptList(prompts: Prompt[]): void;
export declare function printPromptResult(result: {
    description?: string;
    messages: Array<{
        role: string;
        content: {
            type: string;
            text?: string;
        };
    }>;
}): void;
export declare function printHelp(): void;
export declare function printJson(data: unknown): void;
export declare function printTable(headers: string[], rows: string[][]): void;
//# sourceMappingURL=formatter.d.ts.map