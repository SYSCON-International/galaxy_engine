import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GalaxySocket, SOCKET_STATES } from "../GalaxySocket.js";

/**
 * Minimal stand-in for a native WebSocket. Tests drive its lifecycle explicitly through open(), message(), fail() and server_close(), the same way
 * the browser would dispatch onopen/onmessage/onerror/onclose.
 */
class FakeWebSocket {
    constructor(url, protocols) {
        this.url = url;
        this.protocols = protocols;
        this.readyState = 0;
        this.sent = [];
        this.close_calls = [];
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
    }

    send(data) {
        this.sent.push(data);
    }

    close(code, reason) {
        this.close_calls.push({code, reason});
        this.readyState = 2;
    }

    open() {
        this.readyState = 1;
        this.onopen?.({});
    }

    message(data) {
        this.onmessage?.({data});
    }

    fail() {
        this.onerror?.({type: "error"});
        this.server_close(1006, "", false);
    }

    server_close(code = 1006, reason = "", was_clean = false) {
        this.readyState = 3;
        this.onclose?.({code, reason, wasClean: was_clean});
    }
}

describe("GalaxySocket", () => {
    let sockets;
    let socket_factory;

    /**
     * @param {Object} options
     * @return {GalaxySocket}
     */
    const create = (options = {}) => new GalaxySocket({url: "ws://example.test/ws/feed", socket_factory, ...options});

    const latest = () => sockets[sockets.length - 1];

    beforeEach(() => {
        sockets = [];
        socket_factory = (url, protocols) => {
            let socket = new FakeWebSocket(url, protocols);

            sockets.push(socket);

            return socket;
        };

        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("configuration", () => {
        test("requires a url", () => {
            expect(() => new GalaxySocket({socket_factory})).toThrow(TypeError);
        });

        test("creates the socket with the given url and protocols", () => {
            create({protocols: ["v1"]}).connect();

            expect(sockets).toHaveLength(1);
            expect(latest().url).toBe("ws://example.test/ws/feed");
            expect(latest().protocols).toEqual(["v1"]);
        });

        test("maps relative and http(s) urls onto the page origin with a ws(s) scheme", () => {
            create({url: "/ws/feed"}).connect();
            create({url: "https://secure.test:8889/wss/feed"}).connect();

            expect(sockets[0].url).toBe(`ws://${window.location.host}/ws/feed`);
            expect(sockets[1].url).toBe("wss://secure.test:8889/wss/feed");
        });

        test("re-evaluates a url function on every connection attempt", async () => {
            vi.useFakeTimers();

            let count = 0;
            let socket = create({url: () => `ws://example.test/ws/feed?n=${++count}`, reconnect_delay: 10});

            socket.connect().catch(() => {});
            latest().fail();
            await vi.advanceTimersByTimeAsync(10);

            expect(sockets.map((s) => s.url)).toEqual(["ws://example.test/ws/feed?n=1", "ws://example.test/ws/feed?n=2"]);
        });

        test("uses the native WebSocket by default", () => {
            let original = window.WebSocket;

            window.WebSocket = FakeWebSocket;

            try {
                let socket = new GalaxySocket({url: "ws://example.test/ws/feed"});

                socket.connect();

                expect(socket._socket).toBeInstanceOf(FakeWebSocket);
            } finally {
                window.WebSocket = original;
            }
        });
    });

    describe("connection", () => {
        test("state moves from disconnected to connecting to connected", async () => {
            let socket = create();

            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);

            let promise = socket.connect();

            expect(socket.state).toBe(SOCKET_STATES.CONNECTING);
            expect(socket.is_connected).toBe(false);

            latest().open();

            await expect(promise).resolves.toBeUndefined();
            expect(socket.state).toBe(SOCKET_STATES.CONNECTED);
            expect(socket.is_connected).toBe(true);
        });

        test("connect() twice while connecting opens one socket and returns the same promise", () => {
            let socket = create();

            let first = socket.connect();
            let second = socket.connect();

            expect(first).toBe(second);
            expect(sockets).toHaveLength(1);
        });

        test("connect() while connected resolves without opening another socket", async () => {
            let socket = create();

            socket.connect();
            latest().open();

            await expect(socket.connect()).resolves.toBeUndefined();
            expect(sockets).toHaveLength(1);
        });

        test("open handlers receive is_reconnect false on the first connection", () => {
            let socket = create();
            let opens = [];

            socket.on("open", (details) => opens.push(details));
            socket.connect();
            latest().open();

            expect(opens).toEqual([{is_reconnect: false}]);
        });
    });

    describe("incoming messages", () => {
        let socket;

        beforeEach(() => {
            socket = create();
            socket.connect();
            latest().open();
        });

        test("handlers receive parsed JSON and the native event", () => {
            let received = [];

            socket.on("message", (data, event) => received.push([data, event.data]));
            latest().message('{"message_type": "update", "data": {"a": 1}}');

            expect(received).toEqual([[{message_type: "update", data: {a: 1}}, '{"message_type": "update", "data": {"a": 1}}']]);
        });

        test("multiple handlers are called in registration order", () => {
            let calls = [];

            socket.on("message", () => calls.push("first"));
            socket.on("message", () => calls.push("second"));
            latest().message("1");

            expect(calls).toEqual(["first", "second"]);
        });

        test("registering the same handler twice calls it once", () => {
            let handler = vi.fn();

            socket.on("message", handler);
            socket.on("message", handler);
            latest().message("1");

            expect(handler).toHaveBeenCalledTimes(1);
        });

        test("unsubscribe and off() stop delivery", () => {
            let a = vi.fn();
            let b = vi.fn();
            let unsubscribe = socket.on("message", a);

            socket.on("message", b);
            unsubscribe();
            socket.off("message", b);
            latest().message("1");

            expect(a).not.toHaveBeenCalled();
            expect(b).not.toHaveBeenCalled();
        });

        test("a handler removed by an earlier handler in the same dispatch is skipped", () => {
            let second = vi.fn();

            socket.on("message", () => socket.off("message", second));
            socket.on("message", second);
            latest().message("1");

            expect(second).not.toHaveBeenCalled();
        });

        test("message order is preserved", () => {
            let received = [];

            socket.on("message", (data) => received.push(data));

            for (let i = 0; i < 5; i++) {
                latest().message(String(i));
            }

            expect(received).toEqual([0, 1, 2, 3, 4]);
        });

        test("a throwing handler does not block the others", () => {
            let after = vi.fn();

            socket.on("message", () => {
                throw new Error("boom");
            });
            socket.on("message", after);
            latest().message("1");

            expect(after).toHaveBeenCalledWith(1, expect.anything());
            expect(console.error).toHaveBeenCalled();
        });

        test("a rejecting async handler is logged rather than left unhandled", async () => {
            socket.on("message", async () => {
                throw new Error("async boom");
            });
            latest().message("1");
            await Promise.resolve();
            await Promise.resolve();

            expect(console.error).toHaveBeenCalled();
        });

        test("a frame that fails to parse emits error and is not delivered as a message", () => {
            let messages = vi.fn();
            let errors = [];

            socket.on("message", messages);
            socket.on("error", (details) => errors.push(details));
            latest().message("not json");

            expect(messages).not.toHaveBeenCalled();
            expect(errors).toHaveLength(1);
            expect(errors[0].raw).toBe("not json");
            expect(errors[0].error).toBeInstanceOf(SyntaxError);
        });

        test("a custom deserialize receives raw frames", () => {
            let raw_socket = create({deserialize: (data) => data});
            let received = [];

            raw_socket.on("message", (data) => received.push(data));
            raw_socket.connect();
            latest().open();
            latest().message("plain text");

            expect(received).toEqual(["plain text"]);
        });

        test("binary frames pass through the default deserialize", () => {
            let buffer = new ArrayBuffer(4);
            let received = [];

            socket.on("message", (data) => received.push(data));
            latest().message(buffer);

            expect(received[0]).toBe(buffer);
        });

        test("unknown event types warn and return a no-op unsubscribe", () => {
            let unsubscribe = socket.on("bogus", () => {});

            expect(console.warn).toHaveBeenCalled();
            expect(() => unsubscribe()).not.toThrow();
        });
    });

    describe("sending", () => {
        test("objects are serialized to JSON while connected", () => {
            let socket = create();

            socket.connect();
            latest().open();

            expect(socket.send({message_function: "set_up", user_id: 1})).toBe(true);
            expect(latest().sent).toEqual(['{"message_function":"set_up","user_id":1}']);
        });

        test("strings and binary data are sent unchanged", () => {
            let socket = create();
            let bytes = new Uint8Array([1, 2]);

            socket.connect();
            latest().open();
            socket.send("raw");
            socket.send(bytes);

            expect(latest().sent).toEqual(["raw", bytes]);
        });

        test("a custom serialize is used", () => {
            let socket = create({serialize: (data) => `<${data.value}>`});

            socket.connect();
            latest().open();
            socket.send({value: 7});

            expect(latest().sent).toEqual(["<7>"]);
        });

        test("messages are serialized when send() is called, not when the queue flushes", () => {
            let socket = create();
            let message = {value: 1};

            socket.connect();
            socket.send(message);
            message.value = 2;
            latest().open();

            expect(latest().sent).toEqual(['{"value":1}']);
        });

        test("sends while connecting are queued and flushed in FIFO order on open", () => {
            let socket = create();

            socket.connect();

            expect(socket.send({n: 1})).toBe(true);
            expect(socket.send({n: 2})).toBe(true);
            expect(socket.queued_count).toBe(2);
            expect(latest().sent).toEqual([]);

            latest().open();

            expect(latest().sent).toEqual(['{"n":1}', '{"n":2}']);
            expect(socket.queued_count).toBe(0);
        });

        test("messages sent from an open handler go out before previously queued messages", () => {
            let socket = create();

            socket.on("open", () => socket.send({message_function: "set_up"}));
            socket.connect();
            socket.send({message_function: "update"});
            latest().open();

            expect(latest().sent).toEqual(['{"message_function":"set_up"}', '{"message_function":"update"}']);
        });

        test("the connect() promise resolves after the queue has been flushed", async () => {
            let socket = create();
            let sent_at_resolve;

            let promise = socket.connect().then(() => {
                sent_at_resolve = [...latest().sent];
            });

            socket.send("queued");
            latest().open();
            await promise;

            expect(sent_at_resolve).toEqual(["queued"]);
        });

        test("sends while disconnected are rejected", () => {
            let socket = create();

            expect(socket.send({n: 1})).toBe(false);
            expect(console.warn).toHaveBeenCalled();
            expect(sockets).toHaveLength(0);
        });

        test("sends while connecting are rejected when queueing is disabled", () => {
            let socket = create({queue_while_connecting: false});

            socket.connect();

            expect(socket.send({n: 1})).toBe(false);
            latest().open();
            expect(latest().sent).toEqual([]);
        });

        test("sends beyond max_queue_size are rejected", () => {
            let socket = create({max_queue_size: 2});

            socket.connect();

            expect(socket.send(1)).toBe(true);
            expect(socket.send(2)).toBe(true);
            expect(socket.send(3)).toBe(false);
            expect(socket.queued_count).toBe(2);
        });

        test("a send while the native socket is already closing is queued rather than lost", () => {
            vi.useFakeTimers();

            let socket = create({reconnect_delay: 10});

            socket.connect();
            latest().open();
            latest().readyState = 2;

            expect(socket.send("late")).toBe(true);
            expect(latest().sent).toEqual([]);
            expect(socket.queued_count).toBe(1);
        });

        test("a serialize failure returns false without throwing", () => {
            let socket = create();
            let circular = {};

            circular.self = circular;
            socket.connect();
            latest().open();

            expect(socket.send(circular)).toBe(false);
            expect(latest().sent).toEqual([]);
        });

        test("a native send failure returns false without throwing", () => {
            let socket = create();

            socket.connect();
            latest().open();
            latest().send = () => {
                throw new Error("send failed");
            };

            expect(socket.send("x")).toBe(false);
        });
    });

    describe("close and reconnect", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        test("an unexpected close moves to reconnecting and reports will_reconnect", () => {
            let socket = create({reconnect_delay: 100});
            let closes = [];
            let reconnecting = [];

            socket.on("close", (details) => closes.push(details));
            socket.on("reconnecting", (details) => reconnecting.push(details));
            socket.connect();
            latest().open();
            latest().server_close(1011, "server error");

            expect(socket.state).toBe(SOCKET_STATES.RECONNECTING);
            expect(closes).toEqual([{code: 1011, reason: "server error", was_clean: false, intentional: false, will_reconnect: true}]);
            expect(reconnecting).toEqual([{attempt: 1, delay: 100}]);
            expect(vi.getTimerCount()).toBe(1);
        });

        test("the reconnect creates a new socket after the delay and reports is_reconnect", async () => {
            let socket = create({reconnect_delay: 100});
            let opens = [];

            socket.on("open", (details) => opens.push(details));
            socket.connect();
            latest().open();
            latest().server_close();

            await vi.advanceTimersByTimeAsync(99);
            expect(sockets).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(1);
            expect(sockets).toHaveLength(2);

            latest().open();

            expect(socket.state).toBe(SOCKET_STATES.CONNECTED);
            expect(opens).toEqual([{is_reconnect: false}, {is_reconnect: true}]);
        });

        test("the default delay backs off exponentially", async () => {
            let socket = create();
            let delays = [];

            socket.on("reconnecting", ({delay}) => delays.push(delay));
            socket.connect().catch(() => {});

            for (let i = 0; i < 7; i++) {
                latest().fail();
                await vi.runOnlyPendingTimersAsync();
            }

            expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
        });

        test("a reconnect_delay function receives the attempt number", async () => {
            let attempts = [];
            let socket = create({reconnect_delay: (attempt) => {
                attempts.push(attempt);
                return 5;
            }});

            socket.connect().catch(() => {});
            latest().fail();
            await vi.advanceTimersByTimeAsync(5);
            latest().fail();

            expect(attempts).toEqual([1, 2]);
        });

        test("only one reconnect timer and socket exist per close", async () => {
            let socket = create({reconnect_delay: 100});

            socket.connect();
            latest().open();
            latest().server_close();
            socket.connect();
            socket.connect();

            expect(vi.getTimerCount()).toBe(1);

            await vi.advanceTimersByTimeAsync(100);

            expect(sockets).toHaveLength(2);
        });

        test("connect() while reconnecting resolves when the reconnect succeeds", async () => {
            let socket = create({reconnect_delay: 100});

            socket.connect();
            latest().open();
            latest().server_close();

            let promise = socket.connect();

            await vi.advanceTimersByTimeAsync(100);
            latest().open();

            await expect(promise).resolves.toBeUndefined();
        });

        test("reconnects after the initial connection attempt fails", async () => {
            let socket = create({reconnect_delay: 100});
            let promise = socket.connect();

            latest().fail();

            expect(socket.state).toBe(SOCKET_STATES.RECONNECTING);

            await vi.advanceTimersByTimeAsync(100);
            latest().open();

            await expect(promise).resolves.toBeUndefined();
        });

        test("gives up after max_reconnect_attempts", async () => {
            let socket = create({reconnect_delay: 10, max_reconnect_attempts: 2});
            let failed = [];
            let closes = [];

            socket.on("reconnect_failed", (details) => failed.push(details));
            socket.on("close", (details) => closes.push(details.will_reconnect));

            let promise = socket.connect();

            latest().fail();
            await vi.advanceTimersByTimeAsync(10);
            latest().fail();
            await vi.advanceTimersByTimeAsync(10);
            latest().fail();

            expect(sockets).toHaveLength(3);
            expect(closes).toEqual([true, true, false]);
            expect(failed).toEqual([{attempts: 2}]);
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
            expect(vi.getTimerCount()).toBe(0);
            await expect(promise).rejects.toThrow("exhausted");
        });

        test("a successful reconnect resets the attempt counter", async () => {
            let socket = create({reconnect_delay: 10, max_reconnect_attempts: 1});
            let failed = vi.fn();

            socket.on("reconnect_failed", failed);
            socket.connect();
            latest().open();

            for (let i = 0; i < 3; i++) {
                latest().server_close();
                await vi.advanceTimersByTimeAsync(10);
                latest().open();
            }

            expect(failed).not.toHaveBeenCalled();
            expect(sockets).toHaveLength(4);
            expect(socket.state).toBe(SOCKET_STATES.CONNECTED);
        });

        test("listeners keep working on the reconnected socket", async () => {
            let socket = create({reconnect_delay: 10});
            let received = [];

            socket.on("message", (data) => received.push(data));
            socket.connect();
            latest().open();
            latest().message("1");
            latest().server_close();
            await vi.advanceTimersByTimeAsync(10);
            latest().open();
            latest().message("2");

            expect(received).toEqual([1, 2]);
        });

        test("sends while reconnecting are queued and delivered on the new socket", async () => {
            let socket = create({reconnect_delay: 10});

            socket.connect();
            latest().open();
            latest().server_close();

            expect(socket.send({n: 1})).toBe(true);

            await vi.advanceTimersByTimeAsync(10);
            latest().open();

            expect(sockets[0].sent).toEqual([]);
            expect(sockets[1].sent).toEqual(['{"n":1}']);
        });

        test("reconnect: false moves to disconnected on an unexpected close", async () => {
            let socket = create({reconnect: false});
            let closes = [];
            let failed = vi.fn();

            socket.on("close", (details) => closes.push(details.will_reconnect));
            socket.on("reconnect_failed", failed);
            socket.connect();
            latest().open();
            latest().server_close();

            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
            expect(closes).toEqual([false]);
            expect(failed).not.toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        });

        test("reconnect: false rejects the connect() promise when the attempt fails", async () => {
            let socket = create({reconnect: false});
            let promise = socket.connect();

            latest().fail();

            await expect(promise).rejects.toThrow("closed");
        });

        test("a close handler can veto the reconnect by calling disconnect()", async () => {
            let socket = create({reconnect_delay: 10});
            let reconnecting = vi.fn();
            let closes = [];

            socket.on("close", (details) => {
                closes.push(details.intentional);

                if (!details.intentional) {
                    socket.disconnect();
                }
            });
            socket.on("reconnecting", reconnecting);
            socket.connect();
            latest().open();
            latest().server_close();
            await vi.advanceTimersByTimeAsync(100);

            expect(sockets).toHaveLength(1);
            expect(reconnecting).not.toHaveBeenCalled();
            expect(closes).toEqual([false, true]);
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
        });
    });

    describe("intentional disconnect", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        test("closes the socket with the given code and never reconnects", async () => {
            let socket = create({reconnect_delay: 10});
            let closes = [];

            socket.on("close", (details) => closes.push(details));
            socket.connect();
            latest().open();
            socket.disconnect(4200, "tab change");

            // The browser still delivers onclose for the closed socket; it must be ignored.
            sockets[0].server_close(4200, "tab change", true);
            await vi.advanceTimersByTimeAsync(1000);

            expect(sockets[0].close_calls).toEqual([{code: 4200, reason: "tab change"}]);
            expect(sockets).toHaveLength(1);
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
            expect(closes).toEqual([{code: 4200, reason: "tab change", was_clean: null, intentional: true, will_reconnect: false}]);
        });

        test("disconnect() while disconnected does nothing", () => {
            let socket = create();
            let closes = vi.fn();

            socket.on("close", closes);
            socket.disconnect();

            expect(closes).not.toHaveBeenCalled();
        });

        test("disconnect() discards queued messages", () => {
            let socket = create();

            socket.connect().catch(() => {});
            socket.send("queued");
            socket.disconnect();

            expect(socket.queued_count).toBe(0);
        });

        test("an invalid close code still closes the socket", () => {
            let socket = create();

            socket.connect();
            latest().open();
            latest().close = function (code, reason) {
                if (code !== undefined && code !== 1000 && (code < 3000 || code > 4999)) {
                    throw new Error("InvalidAccessError");
                }

                FakeWebSocket.prototype.close.call(this, code, reason);
            };
            socket.disconnect(1234);

            expect(latest().close_calls).toEqual([{code: undefined, reason: undefined}]);
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
        });
    });

    describe("races", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        test("connect() then disconnect() while pending rejects and ignores the stale socket", async () => {
            let socket = create({reconnect_delay: 10});
            let opens = vi.fn();

            socket.on("open", opens);

            let promise = socket.connect();

            socket.disconnect();

            expect(sockets[0].close_calls).toHaveLength(1);
            await expect(promise).rejects.toThrow("disconnected");

            sockets[0].open();
            sockets[0].message("1");
            sockets[0].server_close();
            await vi.advanceTimersByTimeAsync(1000);

            expect(opens).not.toHaveBeenCalled();
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
            expect(sockets).toHaveLength(1);
        });

        test("connect(), connection fails, connect() uses a single retry socket", async () => {
            let socket = create({reconnect_delay: 10});
            let first = socket.connect();

            latest().fail();

            let second = socket.connect();

            expect(second).toBe(first);

            await vi.advanceTimersByTimeAsync(10);

            expect(sockets).toHaveLength(2);
        });

        test("connect(), connection fails without reconnect, connect() opens a fresh socket", async () => {
            let socket = create({reconnect: false});
            let first = socket.connect();

            latest().fail();
            await expect(first).rejects.toThrow();

            let second = socket.connect();

            expect(sockets).toHaveLength(2);
            latest().open();
            await expect(second).resolves.toBeUndefined();
        });

        test("unexpected close, reconnect begins, disconnect() cancels everything", async () => {
            let socket = create({reconnect_delay: 10});

            socket.connect();
            latest().open();
            latest().server_close();
            await vi.advanceTimersByTimeAsync(10);

            // The reconnect socket is connecting when the application disconnects.
            expect(sockets).toHaveLength(2);

            socket.disconnect();
            sockets[1].open();
            sockets[1].server_close();
            await vi.advanceTimersByTimeAsync(1000);

            expect(sockets).toHaveLength(2);
            expect(sockets[1].close_calls).toHaveLength(1);
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);
        });

        test("disconnect() during the reconnect delay cancels the timer", async () => {
            let socket = create({reconnect_delay: 10});

            socket.connect();
            latest().open();
            latest().server_close();
            socket.disconnect();

            expect(vi.getTimerCount()).toBe(0);

            await vi.advanceTimersByTimeAsync(1000);

            expect(sockets).toHaveLength(1);
        });

        test("events from a replaced socket do not affect the active connection", async () => {
            let socket = create({reconnect_delay: 10});
            let received = [];
            let closes = vi.fn();

            socket.connect();
            latest().open();

            let socket_a = sockets[0];
            let socket_a_onclose = socket_a.onclose;
            let socket_a_onmessage = socket_a.onmessage;

            socket_a.server_close();
            await vi.advanceTimersByTimeAsync(10);
            sockets[1].open();

            socket.on("message", (data) => received.push(data));
            socket.on("close", closes);

            // Even a handler reference captured before detachment ignores events for a stale socket.
            socket_a_onmessage({data: "99"});
            socket_a_onclose({code: 1006, reason: "", wasClean: false});
            await vi.advanceTimersByTimeAsync(1000);

            expect(received).toEqual([]);
            expect(closes).not.toHaveBeenCalled();
            expect(socket.state).toBe(SOCKET_STATES.CONNECTED);
            expect(sockets).toHaveLength(2);
        });

        test("a message arriving immediately before close is delivered", () => {
            let socket = create({reconnect_delay: 10});
            let events = [];

            socket.on("message", (data) => events.push(["message", data]));
            socket.on("close", () => events.push(["close"]));
            socket.connect();
            latest().open();
            latest().message("1");
            latest().server_close();

            expect(events).toEqual([["message", 1], ["close"]]);
        });

        test("disconnect() then connect() opens a fresh socket", async () => {
            let socket = create();

            socket.connect();
            latest().open();
            socket.disconnect();

            let promise = socket.connect();

            expect(sockets).toHaveLength(2);
            latest().open();
            await expect(promise).resolves.toBeUndefined();
            expect(socket.state).toBe(SOCKET_STATES.CONNECTED);
        });

        test("disconnect() from an open handler rejects connect() and skips the flush", async () => {
            let socket = create();

            socket.on("open", () => socket.disconnect());

            let promise = socket.connect();

            socket.send("queued");
            latest().open();

            await expect(promise).rejects.toThrow("disconnected");
            expect(latest().sent).toEqual([]);
        });
    });

    describe("errors", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        test("native errors are emitted with the original event", () => {
            let socket = create();
            let errors = [];

            socket.on("error", (details) => errors.push(details));
            socket.connect().catch(() => {});
            latest().fail();

            expect(errors).toEqual([{event: {type: "error"}}]);
        });

        test("an error followed by close does not leave the socket stuck", async () => {
            let socket = create({reconnect_delay: 10});
            let promise = socket.connect();

            latest().fail();
            await vi.advanceTimersByTimeAsync(10);
            latest().open();

            await expect(promise).resolves.toBeUndefined();
            expect(socket.is_connected).toBe(true);
        });

        test("a socket_factory that throws emits error and follows the reconnect policy", async () => {
            let attempts = 0;
            let socket = new GalaxySocket({
                url: "ws://example.test/ws/feed",
                reconnect_delay: 10,
                socket_factory: (url, protocols) => {
                    if (++attempts === 1) {
                        throw new SyntaxError("bad url");
                    }

                    return socket_factory(url, protocols);
                },
            });
            let errors = [];

            socket.on("error", (details) => errors.push(details));

            let promise = socket.connect();

            expect(errors[0].error).toBeInstanceOf(SyntaxError);
            expect(socket.state).toBe(SOCKET_STATES.RECONNECTING);

            await vi.advanceTimersByTimeAsync(10);
            latest().open();

            await expect(promise).resolves.toBeUndefined();
        });
    });

    describe("destroy", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        test("closes the socket, cancels timers, and clears the queue and listeners", async () => {
            let socket = create({reconnect_delay: 10});
            let messages = vi.fn();

            socket.on("message", messages);
            socket.connect();
            latest().open();
            latest().server_close();
            socket.send("queued");
            socket.destroy();

            expect(vi.getTimerCount()).toBe(0);
            expect(socket.queued_count).toBe(0);
            expect(socket.state).toBe(SOCKET_STATES.DISCONNECTED);

            await vi.advanceTimersByTimeAsync(1000);

            expect(sockets).toHaveLength(1);
            expect(socket._listeners.message.size).toBe(0);
        });

        test("closes an active socket", () => {
            let socket = create();

            socket.connect();
            latest().open();
            socket.destroy();

            expect(latest().close_calls).toHaveLength(1);
        });

        test("a destroyed socket refuses further use", async () => {
            let socket = create();

            socket.destroy();

            await expect(socket.connect()).rejects.toThrow("destroyed");
            expect(socket.send("x")).toBe(false);
            socket.on("message", () => {});
            expect(socket._listeners.message.size).toBe(0);
            expect(sockets).toHaveLength(0);
            expect(() => socket.destroy()).not.toThrow();
        });
    });
});
