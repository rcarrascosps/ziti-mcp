/**
 * ZitiIdentity - Handles Ziti identity file validation and loading
 *
 * Ziti identities are JSON files containing certificates and keys
 * for authenticating with the Ziti network.
 */

import { readFile, access, constants } from 'fs/promises';
import { resolve, isAbsolute } from 'path';

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

export class ZitiIdentity {
  private identityPath: string;
  private config: ZitiIdentityConfig | null = null;

  constructor(identityPath: string) {
    // Resolve to absolute path
    this.identityPath = isAbsolute(identityPath)
      ? identityPath
      : resolve(process.cwd(), identityPath);
  }

  /**
   * Get the absolute path to the identity file
   */
  getPath(): string {
    return this.identityPath;
  }

  /**
   * Check if the identity file exists and is readable
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.identityPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load and parse the identity file
   */
  async load(): Promise<ZitiIdentityConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const content = await readFile(this.identityPath, 'utf-8');
      this.config = JSON.parse(content) as ZitiIdentityConfig;
      return this.config;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load Ziti identity: ${message}`);
    }
  }

  /**
   * Validate the identity file structure
   */
  async validate(): Promise<IdentityInfo> {
    const info: IdentityInfo = {
      path: this.identityPath,
      apiEndpoint: '',
      isValid: false
    };

    try {
      // Check file exists
      if (!await this.exists()) {
        info.error = `Identity file not found: ${this.identityPath}`;
        return info;
      }

      // Load and parse
      const config = await this.load();

      // Check required fields
      if (!config.ztAPI) {
        info.error = 'Missing ztAPI field in identity file';
        return info;
      }

      if (!config.id?.key || !config.id?.cert || !config.id?.ca) {
        info.error = 'Missing id.key, id.cert, or id.ca in identity file';
        return info;
      }

      info.apiEndpoint = config.ztAPI;
      info.isValid = true;

      return info;
    } catch (error) {
      info.error = error instanceof Error ? error.message : String(error);
      return info;
    }
  }

  /**
   * Get the Ziti controller API endpoint
   */
  async getApiEndpoint(): Promise<string> {
    const config = await this.load();
    return config.ztAPI;
  }

  /**
   * Create a ZitiIdentity from environment variable
   */
  static fromEnv(envVar: string = 'ZITI_IDENTITY_FILE'): ZitiIdentity {
    const path = process.env[envVar];
    if (!path) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return new ZitiIdentity(path);
  }

  /**
   * Create a ZitiIdentity from a path
   */
  static fromPath(path: string): ZitiIdentity {
    return new ZitiIdentity(path);
  }
}

export default ZitiIdentity;
