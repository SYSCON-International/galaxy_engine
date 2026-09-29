/**
 * @file GalaxySocket.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * Connection states reported by {@link GalaxySocket#state}.
 * @type {{DISCONNECTED: string, CONNECTING: string, CONNECTED: string, RECONNECTING: string}}
 */
export const SOCKET_STATES = Object.freeze({
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
});

/**
 * Event types that can be subscribed to with {@link GalaxySocket#on}.
 * @type {string[]}
 */
export const SOCKET_EVENT_TYPES = Object.freeze(["open", "message", "close", "error", "reconnecting", "reconnect_failed"]);

/**
 * Native WebSocket OPEN readyState. Referenced by value rather than through the WebSocket global so a custom `socket_factory` implementation (or an
 * environment without a WebSocket global) works the same way.
 */
const NATIVE_OPEN = 1;

/**
 * Default GalaxySocket options. Every option can be overridden per instance through the constructor.
 * @type {Object}
 */
export const DEFAULT_SOCKET_CONFIG = {
    url: null,
    protocols: undefined,
    reconnect: true,
    // Exponential backoff (1s, 2s, 4s, ...) capped at 30 seconds, so a server that is down never causes a tight reconnect loop.
    reconnect_delay: (attempt) => Math.min(1000 * 2 ** (attempt - 1), 30000),
    max_reconnect_attempts: Infinity,
    queue_while_connecting: true,
    max_queue_size: 100,
    serialize: (data) => {
        if (typeof data === "string" || data instanceof ArrayBuffer || ArrayBuffer.isView(data) || (typeof Blob !== "undefined" && data instanceof Blob)) {
            return data;
        }

        return JSON.stringify(data);
    },
    deserialize: (data) => typeof data === "string" ? JSON.parse(data) : data,
    socket_factory: (url, protocols) => new WebSocket(url, protocols),
};

/**
 * @class GalaxySocket
 * @description
 *      Owns the lifecycle of a single WebSocket connection: connecting, connection state, automatic reconnection after an *unexpected* close, outgoing
 *      sends (queued in FIFO order while a connection is being established), incoming message dispatch, and listener management.
 *
 *      This class is protocol-agnostic. It serializes outgoing values to JSON and parses incoming text frames as JSON by default, but it knows nothing about
 *      message types, envelopes, or routing -- the consuming application registers handlers and interprets the data itself.
 *
 *      Every instance is independent, so a page can hold as many sockets as it needs. An application that wants one shared connection simply keeps a
 *      single instance around.
 *
 *      Guarantees:
 *      - At most one native socket is active per instance. Calling {@link connect} while already connecting returns the same pending Promise.
 *      - {@link disconnect} is intentional and synchronous: it never triggers a reconnect, and events from the socket it closed are ignored.
 *      - Events from a replaced (stale) native socket are always ignored, so they can never corrupt the state of the current connection.
 *      - Handlers are called synchronously, in registration order, in the order frames arrive. Async handlers are not awaited.
 * @example
 *      let socket = new GalaxySocket({url: "/ws/dashboard/"});
 *
 *      socket.on("open", () => socket.send({message_function: "set_up"}));
 *
 *      let unsubscribe = socket.on("message", (data) => console.log(data));
 *
 *      await socket.connect();
 *
 *      socket.send({message_function: "update_machine", machine_id: 4});
 *
 *      unsubscribe();
 *      socket.disconnect();
 */
export class GalaxySocket {
    static STATES = SOCKET_STATES;

    /**
     * @constructor
     * @param {Object} options
     * @param {string|function(): string} options.url - The endpoint. A function is re-evaluated on every connect and reconnect attempt. Relative and
     * http(s) URLs are resolved against the current page location and mapped to ws(s).
     * @param {string|string[]} [options.protocols] - Sub-protocols passed through to the socket.
     * @param {boolean} [options.reconnect=true] - Reconnect automatically after an unexpected close (never after {@link disconnect}).
     * @param {number|function(number): number} [options.reconnect_delay] - Milliseconds before a reconnect attempt, or a function of the attempt number
     * (starting at 1). Defaults to exponential backoff capped at 30 seconds.
     * @param {number} [options.max_reconnect_attempts=Infinity] - Consecutive failed reconnect attempts allowed before giving up with `reconnect_failed`.
     * @param {boolean} [options.queue_while_connecting=true] - Queue sends made while connecting/reconnecting and flush them once connected.
     * @param {number} [options.max_queue_size=100] - Maximum number of queued outgoing messages.
     * @param {function(*): *} [options.serialize] - Converts a value passed to {@link send} into a frame.
     * @param {function(*): *} [options.deserialize] - Converts an incoming frame into the value passed to `message` handlers.
     * @param {function(string, (string|string[])): WebSocket} [options.socket_factory] - Creates the native socket.
     */
    constructor(options = {}) {
        let config = {...DEFAULT_SOCKET_CONFIG, ...options};

        if (!config.url) {
            throw new TypeError("GalaxySocket: a url (string or function) is required.");
        }

        this.url = config.url;
        this.protocols = config.protocols;
        this.reconnect = config.reconnect;
        this.reconnect_delay = config.reconnect_delay;
        this.max_reconnect_attempts = config.max_reconnect_attempts;
        this.queue_while_connecting = config.queue_while_connecting;
        this.max_queue_size = config.max_queue_size;
        this.serialize = config.serialize;
        this.deserialize = config.deserialize;
        this.socket_factory = config.socket_factory;

        this._state = SOCKET_STATES.DISCONNECTED;
        this._socket = null;
        this._queue = [];
        this._reconnect_timer = null;
        this._reconnect_attempt = 0;
        this._connection_lost = false;
        this._pending_connect = null;
        this._destroyed = false;
        this._listeners = {};

        for (let type of SOCKET_EVENT_TYPES) {
            this._listeners[type] = new Set();
        }
    }

    /**
     * Opens the connection.
     *
     * - While disconnected, starts a new connection.
     * - While connecting or reconnecting, does NOT open another socket; it returns the Promise for the attempt already in progress.
     * - While connected, returns an already-resolved Promise.
     *
     * The Promise rejects if {@link disconnect} or {@link destroy} is called before the connection opens, if reconnect attempts are exhausted, or -- when
     * reconnecting is disabled -- if the attempt fails.
     * @return {Promise<void>}
     */
    connect = () => {
        if (this._destroyed) {
            console.warn("GalaxySocket: connect() called on a destroyed socket.");
            return Promise.reject(new Error("GalaxySocket: socket has been destroyed."));
        }

        if (this._state === SOCKET_STATES.CONNECTED) {
            return Promise.resolve();
        }

        let pending = this._get_pending_connect();

        if (this._state === SOCKET_STATES.DISCONNECTED) {
            this._state = SOCKET_STATES.CONNECTING;
            this._open_socket();
        }

        return pending.promise;
    }

    /**
     * Intentionally closes the connection. Synchronously cancels any scheduled reconnect, closes the current native socket (even if it is still
     * connecting), discards queued outgoing messages, rejects a pending {@link connect} Promise, and emits `close` with `intentional: true`. Events from
     * the closed native socket are ignored afterwards, so this can never trigger a reconnect. Does nothing if already disconnected.
     * @param {number} [code=1000] - Close code sent to the server (1000 or 3000-4999).
     * @param {string} [reason=""] - Close reason sent to the server.
     */
    disconnect = (code = 1000, reason = "") => {
        if (this._state === SOCKET_STATES.DISCONNECTED) {
            return;
        }

        this._clear_reconnect_timer();

        let socket = this._socket;

        this._socket = null;

        if (socket) {
            this._detach(socket);

            try {
                socket.close(code, reason);
            } catch (error) {
                // An invalid close code throws; still close the socket rather than leaving it open.
                console.warn(`GalaxySocket: close(${code}) failed (${error}); closing with the default code instead.`);
                socket.close();
            }
        }

        this._reset_to_disconnected();
        this._reject_pending_connect(new Error("GalaxySocket: disconnected before the connection opened."));
        this._emit("close", {code, reason, was_clean: null, intentional: true, will_reconnect: false});
    }

    /**
     * Sends a message. The value is serialized immediately (so later mutations by the caller have no effect).
     *
     * - Connected: sent right away.
     * - Connecting or reconnecting (or the native socket is already closing): queued in FIFO order and flushed once connected, if
     *   `queue_while_connecting` is enabled and the queue is not full.
     * - Disconnected or destroyed: rejected.
     *
     * Never throws.
     * @param {*} data - The message to send.
     * @return {boolean} - True if the message was sent or queued, false if it was rejected.
     */
    send = (data) => {
        if (this._destroyed) {
            console.warn("GalaxySocket: send() called on a destroyed socket; message dropped.");
            return false;
        }

        if (this._state === SOCKET_STATES.DISCONNECTED) {
            console.warn("GalaxySocket: send() called while disconnected; message dropped.");
            return false;
        }

        let payload;

        try {
            payload = this.serialize(data);
        } catch (error) {
            console.error("GalaxySocket: failed to serialize outgoing message.", error);
            return false;
        }

        if (this._state === SOCKET_STATES.CONNECTED && this._socket && this._socket.readyState === NATIVE_OPEN) {
            return this._transmit(this._socket, payload);
        }

        if (!this.queue_while_connecting) {
            console.warn(`GalaxySocket: send() called while ${this._state} and queueing is disabled; message dropped.`);
            return false;
        }

        if (this._queue.length >= this.max_queue_size) {
            console.warn(`GalaxySocket: outgoing queue is full (${this.max_queue_size}); message dropped.`);
            return false;
        }

        this._queue.push(payload);

        return true;
    }

    /**
     * Registers a handler. Registering the same function for the same event more than once has no effect.
     *
     * Handler arguments by event:
     * - `open`: `{is_reconnect}`
     * - `message`: `(data, native_event)` where `data` is the deserialized frame
     * - `close`: `{code, reason, was_clean, intentional, will_reconnect}`
     * - `error`: `{event}` for a native socket error, `{error, raw}` for a frame that failed to deserialize, `{error}` if the socket could not be created
     * - `reconnecting`: `{attempt, delay}`
     * - `reconnect_failed`: `{attempts}`
     * @param {string} type - One of {@link SOCKET_EVENT_TYPES}.
     * @param {function} handler
     * @return {function(): void} - Removes the handler.
     */
    on = (type, handler) => {
        if (this._destroyed) {
            console.warn("GalaxySocket: on() called on a destroyed socket.");
            return () => {};
        }

        if (!(type in this._listeners)) {
            console.warn(`GalaxySocket: unknown event type "${type}".`);
            return () => {};
        }

        if (typeof handler !== "function") {
            console.warn(`GalaxySocket: handler for "${type}" must be a function.`);
            return () => {};
        }

        this._listeners[type].add(handler);

        return () => this.off(type, handler);
    }

    /**
     * Removes a handler registered with {@link on}.
     * @param {string} type
     * @param {function} handler
     */
    off = (type, handler) => {
        if (type in this._listeners) {
            this._listeners[type].delete(handler);
        }
    }

    /**
     * Permanently disposes of the socket: disconnects, cancels timers, discards the queue and removes every handler. The instance cannot be reused.
     */
    destroy = () => {
        if (this._destroyed) {
            return;
        }

        this.disconnect();

        for (let type of SOCKET_EVENT_TYPES) {
            this._listeners[type].clear();
        }

        this._destroyed = true;
    }

    /**
     * @return {string} - The current state, one of {@link SOCKET_STATES}.
     */
    get state() {
        return this._state;
    }

    /**
     * @return {boolean} - True if the connection is open.
     */
    get is_connected() {
        return this._state === SOCKET_STATES.CONNECTED;
    }

    /**
     * @return {number} - The number of outgoing messages waiting for the connection to open.
     */
    get queued_count() {
        return this._queue.length;
    }

    /**
     * Creates the native socket for the current attempt. This is the only place a native socket is created. Every native handler first checks that its
     * socket is still the current one, so events from a stale socket are ignored.
     */
    _open_socket = () => {
        let socket;

        try {
            socket = this.socket_factory(this._resolve_url(), this.protocols);
        } catch (error) {
            this._emit("error", {error});
            this._handle_connection_lost({code: 1006, reason: "", was_clean: false});
            return;
        }

        this._socket = socket;

        socket.onopen = () => {
            if (socket === this._socket) {
                this._handle_open(socket);
            }
        };

        socket.onmessage = (event) => {
            if (socket === this._socket) {
                this._handle_message(event);
            }
        };

        socket.onerror = (event) => {
            if (socket === this._socket) {
                this._emit("error", {event});
            }
        };

        socket.onclose = (event) => {
            if (socket === this._socket) {
                this._detach(socket);
                this._socket = null;
                this._handle_connection_lost({code: event.code, reason: event.reason, was_clean: event.wasClean});
            }
        };
    }

    /**
     * Marks the connection open, emits `open`, then flushes the queue. Messages sent from an `open` handler (e.g. a set-up message) therefore go out
     * before messages that were queued while connecting.
     * @param {WebSocket} socket
     */
    _handle_open = (socket) => {
        let is_reconnect = this._connection_lost;

        this._state = SOCKET_STATES.CONNECTED;
        this._reconnect_attempt = 0;
        this._connection_lost = false;

        this._emit("open", {is_reconnect});

        // An open handler may have disconnected or destroyed the socket.
        if (socket !== this._socket) {
            return;
        }

        this._flush_queue(socket);

        let pending = this._pending_connect;

        this._pending_connect = null;

        if (pending) {
            pending.resolve();
        }
    }

    /**
     * @param {MessageEvent} event
     */
    _handle_message = (event) => {
        let data;

        try {
            data = this.deserialize(event.data);
        } catch (error) {
            this._emit("error", {error, raw: event.data});
            return;
        }

        this._emit("message", data, event);
    }

    /**
     * Handles a close that was not requested through {@link disconnect}: schedules a reconnect if allowed, otherwise moves to disconnected. The state and
     * reconnect timer are set *before* `close` is emitted, so a `close` handler can veto the reconnect by calling {@link disconnect}.
     * @param {{code: number, reason: string, was_clean: boolean}} details
     */
    _handle_connection_lost = (details) => {
        if (!this.reconnect || this._reconnect_attempt >= this.max_reconnect_attempts) {
            let attempts = this._reconnect_attempt;
            let gave_up = this.reconnect;

            this._reset_to_disconnected();
            this._emit("close", {...details, intentional: false, will_reconnect: false});

            if (gave_up) {
                this._emit("reconnect_failed", {attempts});
            }

            this._reject_pending_connect(new Error(gave_up ? "GalaxySocket: reconnect attempts exhausted." : "GalaxySocket: connection closed."));
            return;
        }

        this._reconnect_attempt++;
        this._connection_lost = true;
        this._state = SOCKET_STATES.RECONNECTING;

        let attempt = this._reconnect_attempt;
        let delay = this._get_reconnect_delay(attempt);

        this._clear_reconnect_timer();
        this._reconnect_timer = setTimeout(() => {
            this._reconnect_timer = null;

            if (this._state === SOCKET_STATES.RECONNECTING && !this._socket) {
                this._open_socket();
            }
        }, delay);

        this._emit("close", {...details, intentional: false, will_reconnect: true});

        // A close handler may have called disconnect() to veto the reconnect.
        if (this._state === SOCKET_STATES.RECONNECTING && this._reconnect_attempt === attempt) {
            this._emit("reconnecting", {attempt, delay});
        }
    }

    /**
     * Sends queued messages, oldest first, onto the given (current, open) socket.
     * @param {WebSocket} socket
     */
    _flush_queue = (socket) => {
        while (this._queue.length > 0 && socket === this._socket && socket.readyState === NATIVE_OPEN) {
            this._transmit(socket, this._queue.shift());
        }
    }

    /**
     * @param {WebSocket} socket
     * @param {*} payload - An already-serialized frame.
     * @return {boolean}
     */
    _transmit = (socket, payload) => {
        try {
            socket.send(payload);
            return true;
        } catch (error) {
            console.error("GalaxySocket: failed to send message.", error);
            return false;
        }
    }

    /**
     * Calls every handler for an event. A throwing (or rejecting) handler is logged and does not stop the remaining handlers. A handler removed by an
     * earlier handler during the same dispatch is skipped.
     * @param {string} type
     * @param {...*} args
     */
    _emit = (type, ...args) => {
        let handlers = this._listeners[type];

        for (let handler of [...handlers]) {
            if (!handlers.has(handler)) {
                continue;
            }

            try {
                let result = handler(...args);

                if (result && typeof result.then === "function") {
                    result.then(null, (error) => console.error(`GalaxySocket: "${type}" handler failed.`, error));
                }
            } catch (error) {
                console.error(`GalaxySocket: "${type}" handler failed.`, error);
            }
        }
    }

    /**
     * @return {string} - The absolute ws(s) URL for the next connection attempt.
     */
    _resolve_url = () => {
        let url = new URL(typeof this.url === "function" ? this.url() : this.url, window.location.href);

        if (url.protocol === "http:") {
            url.protocol = "ws:";
        } else if (url.protocol === "https:") {
            url.protocol = "wss:";
        }

        return url.toString();
    }

    /**
     * @param {number} attempt
     * @return {number}
     */
    _get_reconnect_delay = (attempt) => {
        let delay = typeof this.reconnect_delay === "function" ? this.reconnect_delay(attempt) : this.reconnect_delay;

        delay = Number(delay);

        return Number.isFinite(delay) && delay > 0 ? delay : 0;
    }

    /**
     * @return {{promise: Promise, resolve: function, reject: function}}
     */
    _get_pending_connect = () => {
        if (!this._pending_connect) {
            let pending = {};

            pending.promise = new Promise((resolve, reject) => {
                pending.resolve = resolve;
                pending.reject = reject;
            });

            this._pending_connect = pending;
        }

        return this._pending_connect;
    }

    /**
     * @param {Error} error
     */
    _reject_pending_connect = (error) => {
        let pending = this._pending_connect;

        this._pending_connect = null;

        if (pending) {
            pending.reject(error);
        }
    }

    _reset_to_disconnected = () => {
        this._clear_reconnect_timer();
        this._state = SOCKET_STATES.DISCONNECTED;
        this._queue = [];
        this._reconnect_attempt = 0;
        this._connection_lost = false;
    }

    _clear_reconnect_timer = () => {
        if (this._reconnect_timer !== null) {
            clearTimeout(this._reconnect_timer);
            this._reconnect_timer = null;
        }
    }

    /**
     * @param {WebSocket} socket
     */
    _detach = (socket) => {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
    }
}
