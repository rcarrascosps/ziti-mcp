/**
 * ZitiIdentity - Handles Ziti identity file validation and loading
 *
 * Ziti identities are JSON files containing certificates and keys
 * for authenticating with the Ziti network.
 */
export interface ZitiIdentityConfig {
    ztAPI: string;
    id: {
        key: string;
        cert: string;
        ca: string;
    };
    configTypes?: string[];
}
export interface IdentityInfo {
    path: string;
    apiEndpoint: string;
    isValid: boolean;
    error?: string;
}
export declare class ZitiIdentity {
    private identityPath;
    private config;
    constructor(identityPath: string);
    /**
     * Get the absolute path to the identity file
     */
    getPath(): string;
    /**
     * Check if the identity file exists and is readable
     */
    exists(): Promise<boolean>;
    /**
     * Load and parse the identity file
     */
    load(): Promise<ZitiIdentityConfig>;
    /**
     * Validate the identity file structure
     */
    validate(): Promise<IdentityInfo>;
    /**
     * Get the Ziti controller API endpoint
     */
    getApiEndpoint(): Promise<string>;
    /**
     * Create a ZitiIdentity from environment variable
     */
    static fromEnv(envVar?: string): ZitiIdentity;
    /**
     * Create a ZitiIdentity from a path
     */
    static fromPath(path: string): ZitiIdentity;
}
export default ZitiIdentity;
//# sourceMappingURL=ZitiIdentity.d.ts.map