import { beforeEach, describe, expect, test } from "vitest";
import { GalaxySessionStorageManager } from "../GalaxySessionStorageManager.js";
import { flush } from "./test-helpers.js";

/**
 * Creates a Promise along with its resolve/reject functions exposed externally, so a test can control exactly
 * when a mocked `persist` call settles.
 * @return {{promise: Promise, resolve: function, reject: function}}
 */
const deferred = () => {
    let resolve, reject;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return {promise, resolve, reject};
};

describe("GalaxySessionStorageManager", () => {
    let calls;
    let deferreds;
    let manager;
    let persist;

    beforeEach(() => {
        calls = [];
        deferreds = [];

        persist = (variables) => {
            let entry = deferred();

            calls.push(variables);
            deferreds.push(entry);

            return entry.promise;
        };

        manager = new GalaxySessionStorageManager(persist);
    });

    test("a single request executes normally", async () => {
        let promise = manager.set({a: 1});

        expect(calls).toEqual([{a: 1}]);

        deferreds[0].resolve("ok");
        await flush();

        expect(manager.is_active).toBe(false);
        expect(manager.pending_count).toBe(0);
        await expect(promise).resolves.toBe("ok");
    });

    test("a second call does not begin until the first resolves", async () => {
        let promise_a = manager.set({a: 1});
        let promise_b = manager.set({b: 2});

        expect(calls).toEqual([{a: 1}]); // B has not started yet
        expect(manager.pending_count).toBe(1);
        expect(manager.is_active).toBe(true);

        deferreds[0].resolve("a-done");
        await flush();

        expect(calls).toEqual([{a: 1}, {b: 2}]); // B begins only after A resolves
        expect(manager.pending_count).toBe(0);
        expect(manager.is_active).toBe(true);
        await expect(promise_a).resolves.toBe("a-done");

        deferreds[1].resolve("b-done");
        await flush();

        await expect(promise_b).resolves.toBe("b-done");
    });

    test("multiple queued requests execute in FIFO order", async () => {
        let promises = [
            manager.set({id: "A"}),
            manager.set({id: "B"}),
            manager.set({id: "C"}),
            manager.set({id: "D"}),
        ];

        for (let index = 0; index < 4; index++) {
            let expected_id = ["A", "B", "C", "D"][index];

            expect(calls[index].id).toBe(expected_id);

            deferreds[index].resolve(expected_id);
            await flush();
        }

        expect(calls.map((c) => c.id)).toEqual(["A", "B", "C", "D"]);

        for (let index = 0; index < 4; index++) {
            await expect(promises[index]).resolves.toBe(["A", "B", "C", "D"][index]);
        }
    });

    test("never more than one active persist call at a time", async () => {
        let active_count = 0;
        let max_active = 0;
        let tracking_deferreds = [];

        let tracking_persist = () => {
            active_count++;
            max_active = Math.max(max_active, active_count);

            let entry = deferred();
            tracking_deferreds.push(entry);

            return entry.promise.finally(() => {
                active_count--;
            });
        };

        manager = new GalaxySessionStorageManager(tracking_persist);

        manager.set({n: 1});
        manager.set({n: 2});
        manager.set({n: 3});

        for (let index = 0; index < 3; index++) {
            tracking_deferreds[index].resolve(index);
            await flush();
        }

        expect(tracking_deferreds).toHaveLength(3);
        expect(max_active).toBe(1);
    });

    test("a failed active request does not block the next queued request", async () => {
        let promise_a = manager.set({a: 1});
        let promise_b = manager.set({b: 2});

        let failure = new Error("A failed");
        deferreds[0].reject(failure);
        await expect(promise_a).rejects.toBe(failure); // attach the rejection handler right away, before any other await

        await flush();

        // B should now run despite A's failure.
        expect(calls).toEqual([{a: 1}, {b: 2}]);

        deferreds[1].resolve("b-ok");
        await flush();

        await expect(promise_b).resolves.toBe("b-ok");
    });

    test("the queue drains: pending_count and is_active reset once the last request settles", async () => {
        let promise = manager.set({a: 1});

        expect(manager.is_active).toBe(true);

        deferreds[0].resolve("done");
        await flush();

        expect(manager.pending_count).toBe(0);
        expect(manager.is_active).toBe(false);
        await expect(promise).resolves.toBe("done");
    });

    test("has_pending reflects active and queued writes, and clears once the queue drains", async () => {
        expect(manager.has_pending).toBe(false);

        let promise_a = manager.set({a: 1});
        expect(manager.has_pending).toBe(true); // active

        let promise_b = manager.set({b: 2});
        expect(manager.has_pending).toBe(true); // active + queued

        deferreds[0].resolve("a-done");
        await flush();

        expect(manager.has_pending).toBe(true); // B now active, queue empty
        await expect(promise_a).resolves.toBe("a-done");

        deferreds[1].resolve("b-done");
        await flush();

        expect(manager.has_pending).toBe(false);
        await expect(promise_b).resolves.toBe("b-done");
    });

    test("a later independent call still works after a failed queue sequence", async () => {
        let promise_a = manager.set({a: 1});

        deferreds[0].reject(new Error("boom"));
        await expect(promise_a).rejects.toThrow("boom"); // attach the rejection handler right away, before any other await

        await flush();

        expect(manager.pending_count).toBe(0);
        expect(manager.is_active).toBe(false);

        let promise_next = manager.set({later: true});

        expect(calls[1]).toEqual({later: true});

        deferreds[1].resolve("ok");
        await flush();

        await expect(promise_next).resolves.toBe("ok");
    });

    test("each call's Promise settles with its own operation's outcome, in the right order", async () => {
        let promise_a = manager.set({id: "A"});
        let promise_b = manager.set({id: "B"});

        deferreds[0].resolve("result-a");
        await flush();

        deferreds[1].resolve("result-b");
        await flush();

        await expect(promise_a).resolves.toBe("result-a");
        await expect(promise_b).resolves.toBe("result-b");
    });

    test("mutating the object passed to set() after the call does not affect the queued write", async () => {
        let variables = {foo: 1};

        let promise_a = manager.set({first: true}); // occupies the active slot so variables's write stays queued
        let promise_b = manager.set(variables);

        variables.foo = 2; // mutate after enqueueing, before B's turn comes up

        deferreds[0].resolve("a-done");
        await flush();

        expect(calls[1]).toEqual({foo: 1}); // snapshot taken at set()-time, not run-time

        deferreds[1].resolve("b-done");
        await flush();

        await expect(promise_a).resolves.toBe("a-done");
        await expect(promise_b).resolves.toBe("b-done");
    });

    test("a synchronous throw from persist() is caught and does not wedge the queue", async () => {
        let throwing_deferreds = [];

        let throwing_persist = (variables) => {
            if (variables.explode) {
                throw new Error("sync failure");
            }

            let entry = deferred();
            throwing_deferreds.push(entry);

            return entry.promise;
        };

        manager = new GalaxySessionStorageManager(throwing_persist);

        let promise_a = manager.set({explode: true});
        let rejection_assertion = expect(promise_a).rejects.toThrow("sync failure"); // attach the handler right away
        let promise_b = manager.set({explode: false});

        await rejection_assertion;
        await flush();

        expect(throwing_deferreds).toHaveLength(1); // only B's persist() actually created a deferred

        throwing_deferreds[0].resolve("b-ok");
        await flush();

        await expect(promise_b).resolves.toBe("b-ok");
    });
});
