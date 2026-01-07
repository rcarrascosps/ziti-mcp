/**
 * SSEParser - Server-Sent Events parser
 *
 * Parses SSE streams according to the W3C specification:
 * https://html.spec.whatwg.org/multipage/server-sent-events.html
 *
 * SSE Format:
 *   event: <event-type>
 *   data: <data-line>
 *   data: <more-data>
 *   id: <event-id>
 *   retry: <milliseconds>
 *
 *   (blank line ends the event)
 */

import { EventEmitter } from 'events';

/**
 * Parsed SSE event
 */
export interface SSEEvent {
  /** Event type (default: "message") */
  type: string;
  /** Event data (multiple data lines joined with \n) */
  data: string;
  /** Event ID (optional) */
  id?: string;
  /** Retry interval in ms (optional) */
  retry?: number;
}

/**
 * SSE Parser events
 */
export interface SSEParserEvents {
  event: (event: SSEEvent) => void;
  error: (error: Error) => void;
}

/**
 * SSE stream parser
 *
 * Handles incremental parsing of SSE data, buffering incomplete
 * events and emitting complete events as they arrive.
 */
export class SSEParser extends EventEmitter {
  private buffer: string = '';
  private eventType: string = 'message';
  private eventData: string[] = [];
  private eventId: string | undefined;
  private lastEventId: string | undefined;
  private retryInterval: number | undefined;
  private httpHeadersParsed: boolean = false;

  constructor() {
    super();
  }

  /**
   * Feed data into the parser
   *
   * Call this method with each chunk of data received from the stream.
   * The parser will buffer incomplete events and emit complete ones.
   */
  feed(chunk: Buffer | string): void {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    this.buffer += data;

    // If we haven't parsed HTTP headers yet, try to skip them
    if (!this.httpHeadersParsed) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        // Skip HTTP headers (everything before \r\n\r\n)
        this.buffer = this.buffer.slice(headerEnd + 4);
        this.httpHeadersParsed = true;
      } else {
        // Headers not complete yet, wait for more data
        return;
      }
    }

    this.processBuffer();
  }

  /**
   * Process the buffer and emit complete events
   */
  private processBuffer(): void {
    // Split by lines, handling both \r\n and \n
    const lines = this.buffer.split(/\r?\n/);

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Process a single line according to SSE spec
   */
  private processLine(line: string): void {
    // Empty line = dispatch event
    if (line === '') {
      this.dispatchEvent();
      return;
    }

    // Comment line (starts with :)
    if (line.startsWith(':')) {
      // Comments are ignored but can be used as keep-alive
      return;
    }

    // Parse field:value
    const colonIndex = line.indexOf(':');

    let field: string;
    let value: string;

    if (colonIndex === -1) {
      // No colon, entire line is field name, value is empty
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIndex);
      // Skip the colon and optional single space
      value = line.slice(colonIndex + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    this.processField(field, value);
  }

  /**
   * Process a field:value pair
   */
  private processField(field: string, value: string): void {
    switch (field) {
      case 'event':
        this.eventType = value;
        break;

      case 'data':
        this.eventData.push(value);
        break;

      case 'id':
        // Ignore if contains null character
        if (!value.includes('\0')) {
          this.eventId = value;
        }
        break;

      case 'retry':
        const retry = parseInt(value, 10);
        if (!isNaN(retry) && retry >= 0) {
          this.retryInterval = retry;
          // Note: retry doesn't need an empty line to take effect
        }
        break;

      default:
        // Unknown fields are ignored per spec
        break;
    }
  }

  /**
   * Dispatch the accumulated event
   */
  private dispatchEvent(): void {
    // Only dispatch if we have data
    if (this.eventData.length === 0) {
      this.resetEvent();
      return;
    }

    const event: SSEEvent = {
      type: this.eventType,
      data: this.eventData.join('\n'),
      id: this.eventId,
      retry: this.retryInterval
    };

    // Update last event ID
    if (this.eventId !== undefined) {
      this.lastEventId = this.eventId;
    }

    this.emit('event', event);
    this.resetEvent();
  }

  /**
   * Reset event state for next event
   */
  private resetEvent(): void {
    this.eventType = 'message';
    this.eventData = [];
    this.eventId = undefined;
    // Note: retryInterval persists across events
  }

  /**
   * Get the last event ID received
   */
  getLastEventId(): string | undefined {
    return this.lastEventId;
  }

  /**
   * Get the current retry interval
   */
  getRetryInterval(): number | undefined {
    return this.retryInterval;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = '';
    this.httpHeadersParsed = false;
    this.resetEvent();
    this.lastEventId = undefined;
    this.retryInterval = undefined;
  }

  /**
   * Check if there's pending data in the buffer
   */
  hasPendingData(): boolean {
    return this.buffer.length > 0 || this.eventData.length > 0;
  }
}

export default SSEParser;
