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
export declare class SSEParser extends EventEmitter {
    private buffer;
    private eventType;
    private eventData;
    private eventId;
    private lastEventId;
    private retryInterval;
    private httpHeadersParsed;
    constructor();
    /**
     * Feed data into the parser
     *
     * Call this method with each chunk of data received from the stream.
     * The parser will buffer incomplete events and emit complete ones.
     */
    feed(chunk: Buffer | string): void;
    /**
     * Process the buffer and emit complete events
     */
    private processBuffer;
    /**
     * Process a single line according to SSE spec
     */
    private processLine;
    /**
     * Process a field:value pair
     */
    private processField;
    /**
     * Dispatch the accumulated event
     */
    private dispatchEvent;
    /**
     * Reset event state for next event
     */
    private resetEvent;
    /**
     * Get the last event ID received
     */
    getLastEventId(): string | undefined;
    /**
     * Get the current retry interval
     */
    getRetryInterval(): number | undefined;
    /**
     * Reset the parser state
     */
    reset(): void;
    /**
     * Check if there's pending data in the buffer
     */
    hasPendingData(): boolean;
}
export default SSEParser;
//# sourceMappingURL=SSEParser.d.ts.map