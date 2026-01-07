/**
 * Tests for SSEParser
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSEParser, SSEEvent } from '../src/transport/SSEParser.js';

describe('SSEParser', () => {
  let parser: SSEParser;
  let eventHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    parser = new SSEParser();
    eventHandler = vi.fn();
    parser.on('event', eventHandler);
  });

  describe('basic parsing', () => {
    it('should parse simple message event', () => {
      parser.feed('data: hello world\n\n');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'hello world',
        id: undefined,
        retry: undefined
      });
    });

    it('should parse event with custom type', () => {
      parser.feed('event: endpoint\ndata: /message?sessionId=abc123\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'endpoint',
        data: '/message?sessionId=abc123',
        id: undefined,
        retry: undefined
      });
    });

    it('should parse multi-line data', () => {
      parser.feed('data: line1\ndata: line2\ndata: line3\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'line1\nline2\nline3',
        id: undefined,
        retry: undefined
      });
    });

    it('should parse event with id', () => {
      parser.feed('id: 42\ndata: test\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'test',
        id: '42',
        retry: undefined
      });
    });

    it('should parse retry field', () => {
      parser.feed('retry: 5000\ndata: test\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'test',
        id: undefined,
        retry: 5000
      });
      expect(parser.getRetryInterval()).toBe(5000);
    });
  });

  describe('HTTP header handling', () => {
    it('should skip HTTP headers and parse SSE body', () => {
      const httpResponse =
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: text/event-stream\r\n' +
        'Cache-Control: no-cache\r\n' +
        '\r\n' +
        'data: hello\n\n';

      parser.feed(httpResponse);

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'hello',
        id: undefined,
        retry: undefined
      });
    });

    it('should handle chunked HTTP headers', () => {
      parser.feed('HTTP/1.1 200 OK\r\n');
      parser.feed('Content-Type: text/event-stream\r\n\r\n');
      parser.feed('data: test\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'test',
        id: undefined,
        retry: undefined
      });
    });
  });

  describe('incremental parsing', () => {
    it('should handle data split across chunks', () => {
      parser.feed('data: hel');
      parser.feed('lo world\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'hello world',
        id: undefined,
        retry: undefined
      });
    });

    it('should handle event type split across chunks', () => {
      parser.feed('event: end');
      parser.feed('point\ndata: test\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'endpoint',
        data: 'test',
        id: undefined,
        retry: undefined
      });
    });

    it('should handle multiple events in one chunk', () => {
      parser.feed('data: first\n\ndata: second\n\n');

      expect(eventHandler).toHaveBeenCalledTimes(2);
      expect(eventHandler).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: 'first' }));
      expect(eventHandler).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: 'second' }));
    });
  });

  describe('edge cases', () => {
    it('should ignore comment lines', () => {
      parser.feed(': this is a comment\ndata: test\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'test',
        id: undefined,
        retry: undefined
      });
    });

    it('should handle empty data lines', () => {
      parser.feed('data:\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: '',
        id: undefined,
        retry: undefined
      });
    });

    it('should not emit event without data', () => {
      parser.feed('event: test\n\n');

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should ignore id with null character', () => {
      parser.feed('id: abc\0def\ndata: test\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'test',
        id: undefined,
        retry: undefined
      });
    });

    it('should handle CRLF line endings', () => {
      parser.feed('data: test\r\n\r\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: 'test',
        id: undefined,
        retry: undefined
      });
    });

    it('should handle field without value', () => {
      parser.feed('data\n\n');

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: '',
        id: undefined,
        retry: undefined
      });
    });

    it('should strip single leading space from value', () => {
      parser.feed('data: hello\n\n');
      parser.feed('data:  two spaces\n\n');

      expect(eventHandler).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: 'hello' }));
      expect(eventHandler).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: ' two spaces' }));
    });
  });

  describe('JSON message parsing', () => {
    it('should parse JSON data for MCP messages', () => {
      const mcpMessage = {
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] }
      };

      parser.feed(`data: ${JSON.stringify(mcpMessage)}\n\n`);

      expect(eventHandler).toHaveBeenCalledWith({
        type: 'message',
        data: JSON.stringify(mcpMessage),
        id: undefined,
        retry: undefined
      });

      // Verify JSON can be parsed
      const event = eventHandler.mock.calls[0][0] as SSEEvent;
      const parsed = JSON.parse(event.data);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.id).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset parser state', () => {
      parser.feed('data: partial');
      expect(parser.hasPendingData()).toBe(true);

      parser.reset();

      expect(parser.hasPendingData()).toBe(false);
      expect(parser.getLastEventId()).toBeUndefined();
      expect(parser.getRetryInterval()).toBeUndefined();
    });
  });

  describe('lastEventId', () => {
    it('should track last event id', () => {
      parser.feed('id: 1\ndata: first\n\n');
      expect(parser.getLastEventId()).toBe('1');

      parser.feed('id: 2\ndata: second\n\n');
      expect(parser.getLastEventId()).toBe('2');

      parser.feed('data: no id\n\n');
      expect(parser.getLastEventId()).toBe('2');
    });
  });
});
