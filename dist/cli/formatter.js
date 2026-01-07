/**
 * CLI Output Formatter
 *
 * Provides colored and formatted output for the CLI
 */
// =============================================================================
// ANSI Colors
// =============================================================================
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};
// =============================================================================
// Color Helpers
// =============================================================================
export const c = {
    reset: (s) => `${colors.reset}${s}${colors.reset}`,
    bold: (s) => `${colors.bold}${s}${colors.reset}`,
    dim: (s) => `${colors.dim}${s}${colors.reset}`,
    italic: (s) => `${colors.italic}${s}${colors.reset}`,
    red: (s) => `${colors.red}${s}${colors.reset}`,
    green: (s) => `${colors.green}${s}${colors.reset}`,
    yellow: (s) => `${colors.yellow}${s}${colors.reset}`,
    blue: (s) => `${colors.blue}${s}${colors.reset}`,
    magenta: (s) => `${colors.magenta}${s}${colors.reset}`,
    cyan: (s) => `${colors.cyan}${s}${colors.reset}`,
    white: (s) => `${colors.white}${s}${colors.reset}`,
    success: (s) => `${colors.green}${s}${colors.reset}`,
    error: (s) => `${colors.red}${s}${colors.reset}`,
    warning: (s) => `${colors.yellow}${s}${colors.reset}`,
    info: (s) => `${colors.cyan}${s}${colors.reset}`,
    header: (s) => `${colors.bold}${colors.cyan}${s}${colors.reset}`,
    command: (s) => `${colors.bold}${colors.yellow}${s}${colors.reset}`,
    value: (s) => `${colors.green}${s}${colors.reset}`
};
// =============================================================================
// Banner and Headers
// =============================================================================
export function printBanner() {
    console.log(c.cyan(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   ${c.bold('Ziti MCP CLI')} - Dark MCP Server Client                 ║
  ║   Zero-Trust Network Access for MCP                       ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
`));
    console.log(c.dim('  Type /help for available commands\n'));
}
export function printHeader(title) {
    const line = '─'.repeat(50);
    console.log(`\n${c.cyan(line)}`);
    console.log(c.header(`  ${title}`));
    console.log(`${c.cyan(line)}`);
}
export function printSubHeader(title) {
    console.log(`\n${c.bold(title)}`);
}
// =============================================================================
// Messages
// =============================================================================
export function printSuccess(message) {
    console.log(`${c.green('✓')} ${message}`);
}
export function printError(message) {
    console.log(`${c.red('✗')} ${c.red(message)}`);
}
export function printWarning(message) {
    console.log(`${c.yellow('⚠')} ${c.yellow(message)}`);
}
export function printInfo(message) {
    console.log(`${c.cyan('ℹ')} ${message}`);
}
export function printDebug(message) {
    console.log(`${c.dim('⋯')} ${c.dim(message)}`);
}
// =============================================================================
// Connection Status
// =============================================================================
export function printConnectionStatus(connected, serverInfo, serviceName) {
    printHeader('Connection Status');
    if (connected && serverInfo) {
        console.log(`  Status:  ${c.green('● Connected')}`);
        console.log(`  Service: ${c.value(serviceName || 'unknown')}`);
        console.log(`  Server:  ${c.value(serverInfo.name)} v${serverInfo.version}`);
    }
    else {
        console.log(`  Status:  ${c.red('○ Disconnected')}`);
        if (serviceName) {
            console.log(`  Service: ${c.dim(serviceName)}`);
        }
    }
}
export function printServerCapabilities(capabilities) {
    printSubHeader('Server Capabilities:');
    const cap = (name, value) => {
        const status = value ? c.green('✓') : c.dim('○');
        console.log(`  ${status} ${name}`);
    };
    cap('Tools', capabilities.tools);
    cap('Resources', capabilities.resources);
    cap('Prompts', capabilities.prompts);
    cap('Logging', capabilities.logging);
    if (capabilities.resources?.subscribe) {
        console.log(`    ${c.dim('└─ Subscriptions supported')}`);
    }
}
// =============================================================================
// Tools
// =============================================================================
export function printToolList(tools) {
    printHeader(`Tools (${tools.length})`);
    if (tools.length === 0) {
        console.log(c.dim('  No tools available'));
        return;
    }
    for (const tool of tools) {
        console.log(`\n  ${c.command(tool.name)}`);
        if (tool.description) {
            console.log(`  ${c.dim(tool.description)}`);
        }
    }
    console.log(c.dim(`\n  Use /tool <name> for details, /call <name> to execute`));
}
export function printToolDetails(tool) {
    printHeader(`Tool: ${tool.name}`);
    if (tool.description) {
        console.log(`\n  ${tool.description}`);
    }
    const props = tool.inputSchema.properties;
    const required = tool.inputSchema.required || [];
    if (props && Object.keys(props).length > 0) {
        printSubHeader('  Parameters:');
        for (const [name, schema] of Object.entries(props)) {
            const isRequired = required.includes(name);
            const reqMark = isRequired ? c.red('*') : ' ';
            const type = c.dim(`(${schema.type})`);
            console.log(`    ${reqMark} ${c.yellow(name)} ${type}`);
            if (schema.description) {
                console.log(`      ${c.dim(schema.description)}`);
            }
            if (schema.enum) {
                console.log(`      ${c.dim('Options:')} ${schema.enum.join(', ')}`);
            }
            if (schema.default !== undefined) {
                console.log(`      ${c.dim('Default:')} ${JSON.stringify(schema.default)}`);
            }
        }
        if (required.length > 0) {
            console.log(c.dim(`\n    ${c.red('*')} = required`));
        }
    }
    else {
        console.log(c.dim('\n  No parameters required'));
    }
    console.log(c.dim(`\n  Example: /call ${tool.name} {"param": "value"}`));
}
export function printToolResult(result) {
    printSubHeader(result.isError ? c.red('Tool Error:') : 'Result:');
    for (const content of result.content) {
        switch (content.type) {
            case 'text':
                console.log(`\n${content.text}`);
                break;
            case 'image':
                console.log(`\n  ${c.cyan('[Image]')} ${content.mimeType}`);
                console.log(`  ${c.dim(`${content.data?.length || 0} bytes (base64)`)}`);
                break;
            case 'resource':
                console.log(`\n  ${c.cyan('[Resource]')} ${content.resource?.uri}`);
                if (content.resource?.text) {
                    console.log(content.resource.text);
                }
                break;
        }
    }
}
// =============================================================================
// Resources
// =============================================================================
export function printResourceList(resources) {
    printHeader(`Resources (${resources.length})`);
    if (resources.length === 0) {
        console.log(c.dim('  No resources available'));
        return;
    }
    for (const resource of resources) {
        console.log(`\n  ${c.cyan(resource.name)}`);
        console.log(`  ${c.dim(resource.uri)}`);
        if (resource.description) {
            console.log(`  ${c.dim(resource.description)}`);
        }
        if (resource.mimeType) {
            console.log(`  ${c.dim(`Type: ${resource.mimeType}`)}`);
        }
    }
    console.log(c.dim(`\n  Use /resource <uri> to read`));
}
export function printResourceContents(contents) {
    for (const content of contents) {
        printSubHeader(`Resource: ${content.uri}`);
        if (content.mimeType) {
            console.log(c.dim(`  Type: ${content.mimeType}`));
        }
        if (content.text) {
            console.log(`\n${content.text}`);
        }
        else if (content.blob) {
            console.log(c.dim(`\n  [Binary data: ${content.blob.length} bytes (base64)]`));
        }
    }
}
// =============================================================================
// Prompts
// =============================================================================
export function printPromptList(prompts) {
    printHeader(`Prompts (${prompts.length})`);
    if (prompts.length === 0) {
        console.log(c.dim('  No prompts available'));
        return;
    }
    for (const prompt of prompts) {
        console.log(`\n  ${c.magenta(prompt.name)}`);
        if (prompt.description) {
            console.log(`  ${c.dim(prompt.description)}`);
        }
        if (prompt.arguments && prompt.arguments.length > 0) {
            const argNames = prompt.arguments.map(a => a.name).join(', ');
            console.log(`  ${c.dim(`Args: ${argNames}`)}`);
        }
    }
    console.log(c.dim(`\n  Use /prompt <name> to get`));
}
export function printPromptResult(result) {
    if (result.description) {
        console.log(c.dim(`\n  ${result.description}`));
    }
    printSubHeader('Messages:');
    for (const message of result.messages) {
        const roleColor = message.role === 'user' ? c.blue : c.green;
        console.log(`\n  ${roleColor(`[${message.role}]`)}`);
        if (message.content.type === 'text' && message.content.text) {
            // Indent multi-line content
            const lines = message.content.text.split('\n');
            for (const line of lines) {
                console.log(`  ${line}`);
            }
        }
    }
}
// =============================================================================
// Help
// =============================================================================
export function printHelp() {
    printHeader('Available Commands');
    const cmds = [
        { section: 'Connection' },
        { cmd: '/connect <service>', desc: 'Connect to an MCP server' },
        { cmd: '/disconnect', desc: 'Disconnect from current server' },
        { cmd: '/status', desc: 'Show connection status' },
        { cmd: '/identity <path>', desc: 'Set identity file path' },
        { section: 'Tools' },
        { cmd: '/tools', desc: 'List available tools' },
        { cmd: '/tool <name>', desc: 'Show tool details' },
        { cmd: '/call <name> [json]', desc: 'Call a tool with optional JSON args' },
        { section: 'Resources' },
        { cmd: '/resources', desc: 'List available resources' },
        { cmd: '/resource <uri>', desc: 'Read a resource by URI' },
        { section: 'Prompts' },
        { cmd: '/prompts', desc: 'List available prompts' },
        { cmd: '/prompt <name> [json]', desc: 'Get a prompt with optional args' },
        { section: 'Utility' },
        { cmd: '/ping', desc: 'Ping the server' },
        { cmd: '/clear', desc: 'Clear the screen' },
        { cmd: '/verbose', desc: 'Toggle verbose mode' },
        { cmd: '/help', desc: 'Show this help' },
        { cmd: '/exit', desc: 'Exit the CLI' }
    ];
    for (const item of cmds) {
        if ('section' in item) {
            console.log(`\n  ${c.bold(item.section)}`);
        }
        else {
            console.log(`    ${c.command(item.cmd.padEnd(22))} ${c.dim(item.desc)}`);
        }
    }
    console.log();
}
// =============================================================================
// JSON Output
// =============================================================================
export function printJson(data) {
    console.log(JSON.stringify(data, null, 2));
}
// =============================================================================
// Table Output
// =============================================================================
export function printTable(headers, rows) {
    // Calculate column widths
    const widths = headers.map((h, i) => {
        const maxRow = Math.max(...rows.map(r => (r[i] || '').length));
        return Math.max(h.length, maxRow);
    });
    // Print header
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
    console.log(`  ${c.bold(headerLine)}`);
    // Print separator
    const separator = widths.map(w => '─'.repeat(w)).join('──');
    console.log(`  ${c.dim(separator)}`);
    // Print rows
    for (const row of rows) {
        const line = row.map((cell, i) => (cell || '').padEnd(widths[i])).join('  ');
        console.log(`  ${line}`);
    }
}
//# sourceMappingURL=formatter.js.map