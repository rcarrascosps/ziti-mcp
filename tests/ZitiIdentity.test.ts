/**
 * Tests for ZitiIdentity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZitiIdentity } from '../src/ziti/ZitiIdentity.js';
import * as fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn(),
  constants: { R_OK: 4 }
}));

const mockFs = fs as unknown as {
  readFile: ReturnType<typeof vi.fn>;
  access: ReturnType<typeof vi.fn>;
};

describe('ZitiIdentity', () => {
  const validIdentityContent = JSON.stringify({
    ztAPI: 'https://controller.ziti.example.com:1280',
    id: {
      key: '-----BEGIN PRIVATE KEY-----\n...',
      cert: '-----BEGIN CERTIFICATE-----\n...',
      ca: '-----BEGIN CERTIFICATE-----\n...'
    },
    configTypes: ['intercept.v1', 'host.v1']
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should resolve relative path to absolute', () => {
      const identity = new ZitiIdentity('./my-identity.json');
      const path = identity.getPath();

      expect(path).toContain('my-identity.json');
      expect(path.startsWith('/') || path.match(/^[A-Z]:\\/)).toBeTruthy();
    });

    it('should keep absolute path as is', () => {
      const absolutePath = '/home/user/identity.json';
      const identity = new ZitiIdentity(absolutePath);

      expect(identity.getPath()).toBe(absolutePath);
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const identity = new ZitiIdentity('/path/to/identity.json');
      const exists = await identity.exists();

      expect(exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const identity = new ZitiIdentity('/path/to/identity.json');
      const exists = await identity.exists();

      expect(exists).toBe(false);
    });
  });

  describe('load', () => {
    it('should load and parse valid identity file', async () => {
      mockFs.readFile.mockResolvedValue(validIdentityContent);

      const identity = new ZitiIdentity('/path/to/identity.json');
      const config = await identity.load();

      expect(config.ztAPI).toBe('https://controller.ziti.example.com:1280');
      expect(config.id.key).toBeDefined();
      expect(config.id.cert).toBeDefined();
      expect(config.id.ca).toBeDefined();
    });

    it('should cache loaded config', async () => {
      mockFs.readFile.mockResolvedValue(validIdentityContent);

      const identity = new ZitiIdentity('/path/to/identity.json');
      await identity.load();
      await identity.load();

      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid JSON', async () => {
      mockFs.readFile.mockResolvedValue('not valid json');

      const identity = new ZitiIdentity('/path/to/identity.json');

      await expect(identity.load()).rejects.toThrow('Failed to load Ziti identity');
    });

    it('should throw when file cannot be read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const identity = new ZitiIdentity('/path/to/identity.json');

      await expect(identity.load()).rejects.toThrow('Failed to load Ziti identity');
    });
  });

  describe('validate', () => {
    it('should validate complete identity file', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(validIdentityContent);

      const identity = new ZitiIdentity('/path/to/identity.json');
      const info = await identity.validate();

      expect(info.isValid).toBe(true);
      expect(info.apiEndpoint).toBe('https://controller.ziti.example.com:1280');
      expect(info.error).toBeUndefined();
    });

    it('should fail validation when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const identity = new ZitiIdentity('/path/to/missing.json');
      const info = await identity.validate();

      expect(info.isValid).toBe(false);
      expect(info.error).toContain('not found');
    });

    it('should fail validation when ztAPI is missing', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: { key: 'k', cert: 'c', ca: 'ca' }
      }));

      const identity = new ZitiIdentity('/path/to/identity.json');
      const info = await identity.validate();

      expect(info.isValid).toBe(false);
      expect(info.error).toContain('ztAPI');
    });

    it('should fail validation when id fields are missing', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        ztAPI: 'https://example.com',
        id: { key: 'k' }
      }));

      const identity = new ZitiIdentity('/path/to/identity.json');
      const info = await identity.validate();

      expect(info.isValid).toBe(false);
      expect(info.error).toContain('id.cert');
    });
  });

  describe('getApiEndpoint', () => {
    it('should return API endpoint from loaded config', async () => {
      mockFs.readFile.mockResolvedValue(validIdentityContent);

      const identity = new ZitiIdentity('/path/to/identity.json');
      const endpoint = await identity.getApiEndpoint();

      expect(endpoint).toBe('https://controller.ziti.example.com:1280');
    });
  });

  describe('fromEnv', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create identity from environment variable', () => {
      process.env = { ...originalEnv, ZITI_IDENTITY_FILE: '/env/path/identity.json' };

      const identity = ZitiIdentity.fromEnv();

      expect(identity.getPath()).toBe('/env/path/identity.json');
    });

    it('should use custom env variable name', () => {
      process.env = { ...originalEnv, MY_IDENTITY: '/custom/identity.json' };

      const identity = ZitiIdentity.fromEnv('MY_IDENTITY');

      expect(identity.getPath()).toBe('/custom/identity.json');
    });

    it('should throw when env variable is not set', () => {
      process.env = { ...originalEnv };
      delete process.env.ZITI_IDENTITY_FILE;

      expect(() => ZitiIdentity.fromEnv()).toThrow('not set');
    });
  });

  describe('fromPath', () => {
    it('should create identity from path', () => {
      const identity = ZitiIdentity.fromPath('/some/path/identity.json');

      expect(identity.getPath()).toBe('/some/path/identity.json');
    });
  });
});
