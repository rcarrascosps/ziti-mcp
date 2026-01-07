/**
 * Command line argument parser
 */
export interface CliArgs {
    identity?: string;
    service?: string;
    autoConnect: boolean;
    verbose: boolean;
    help: boolean;
    version: boolean;
}
export declare function parseArgs(args: string[]): CliArgs;
//# sourceMappingURL=args.d.ts.map