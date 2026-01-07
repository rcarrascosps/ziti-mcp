/**
 * Types for OpenZiti SDK integration
 */

export interface ZitiHttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}

export interface ZitiHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export interface ZitiDialOptions {
  serviceName: string;
  isWebSocket?: boolean;
}

export interface ZitiStreamCallbacks {
  onConnect?: (conn: ZitiConnectionHandle) => void;
  onData?: (data: Buffer) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export type ZitiConnectionHandle = number;

export type ZitiServiceStatus = {
  available: boolean;
  permissions: {
    dial: boolean;
    bind: boolean;
  };
};

export type ZitiInitStatus =
  | { success: true }
  | { success: false; error: string };

export interface ZitiSDK {
  init(identityPath: string): Promise<number>;
  httpRequest(
    serviceName: string,
    schemeHostPort: string | undefined,
    method: string,
    path: string,
    headers: string[],
    body: Buffer | undefined,
    onRequest: (() => void) | undefined,
    onResponse: ((obj: { status: number; headers: Record<string, string> }) => void) | undefined,
    onResponseData: ((obj: { body: Buffer }) => void) | undefined
  ): void;
  dial(
    serviceName: string,
    isWebSocket: boolean,
    onConnect: (conn: number) => void,
    onData: (data: Buffer) => void
  ): void;
  write(conn: number, data: Buffer, onWrite?: () => void): void;
  close(conn: number): void;
  serviceAvailable(
    serviceName: string,
    onServiceAvailable: (status: number) => void
  ): void;
  setLogLevel(level: number): void;
}

export enum ZitiLogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
  VERBOSE = 6
}
