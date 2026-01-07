/**
 * Command line argument parser
 */
export function parseArgs(args) {
    const result = {
        autoConnect: false,
        verbose: false,
        help: false,
        version: false
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-i':
            case '--identity':
                result.identity = args[++i];
                break;
            case '-s':
            case '--service':
                result.service = args[++i];
                break;
            case '-c':
            case '--connect':
                result.autoConnect = true;
                break;
            case '-v':
            case '--verbose':
                result.verbose = true;
                break;
            case '-h':
            case '--help':
                result.help = true;
                break;
            case '--version':
                result.version = true;
                break;
            default:
                if (arg.startsWith('-')) {
                    console.warn(`Unknown option: ${arg}`);
                }
        }
    }
    // Check environment variables as fallback
    if (!result.identity && process.env.ZITI_IDENTITY_FILE) {
        result.identity = process.env.ZITI_IDENTITY_FILE;
    }
    if (!result.service && process.env.ZITI_SERVICE_NAME) {
        result.service = process.env.ZITI_SERVICE_NAME;
    }
    return result;
}
//# sourceMappingURL=args.js.map