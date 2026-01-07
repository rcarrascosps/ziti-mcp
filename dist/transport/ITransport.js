/**
 * ITransport - Abstract transport interface for MCP communication
 *
 * Transports handle the low-level communication with MCP servers,
 * abstracting away the specific protocol (SSE, WebSocket, stdio, etc.)
 */
import { EventEmitter } from 'events';
/**
 * Transport connection state
 */
export var TransportState;
(function (TransportState) {
    TransportState["DISCONNECTED"] = "disconnected";
    TransportState["CONNECTING"] = "connecting";
    TransportState["CONNECTED"] = "connected";
    TransportState["RECONNECTING"] = "reconnecting";
    TransportState["CLOSED"] = "closed";
})(TransportState || (TransportState = {}));
/**
 * Base transport class with common functionality
 */
export class BaseTransport extends EventEmitter {
    _state = TransportState.DISCONNECTED;
    _sessionId = null;
    options;
    constructor(options = {}) {
        super();
        this.options = {
            autoReconnect: true,
            maxReconnectAttempts: 3,
            reconnectDelay: 1000,
            connectTimeout: 30000,
            requestTimeout: 60000,
            ...options
        };
    }
    get state() {
        return this._state;
    }
    get sessionId() {
        return this._sessionId;
    }
    setState(state) {
        if (this._state !== state) {
            this._state = state;
            this.emit('stateChange', state);
        }
    }
    isReady() {
        return this._state === TransportState.CONNECTED && this._sessionId !== null;
    }
}
//# sourceMappingURL=ITransport.js.map