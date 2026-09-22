/**
 * @file GalaxySessionStorageManager.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * @class GalaxySessionStorageManager
 * @description
 *      Serializes calls that persist session-like state so that a write in progress is never aborted to make room for a newer call, and a newer call is
 *      never merged with, or discarded in favor of, another one. Every call to {@link set} is queued and processed strictly in the order it was received,
 *      one at a time.
 *
 *      This class only owns the queueing/ordering guarantee -- it does not implement any network transport or storage itself. The consumer supplies a
 *      `persist` function at construction time (e.g. an AJAX call to a Django endpoint), so the same queue can back any storage/endpoint implementation.
 *
 *      To avoid navigating away while a write is outstanding, a consumer can guard `beforeunload` with {@link has_pending}:
 * @example
 *      window.addEventListener("beforeunload", (event) => {
 *          if (session_storage_manager.has_pending) {
 *              event.preventDefault();
 *              event.returnValue = ""; // required for the browser's native confirmation dialog
 *          }
 *      });
 *
 *      This only blocks navigation -- it does not, by itself, let an in-flight write survive a navigation the user confirms anyway. Surviving an actual
 *      unload requires the consumer's `persist` transport to be built on something that keeps running after unload, such as `fetch(url, {keepalive:
 *      true})` or `navigator.sendBeacon`; that is a transport concern for the consumer's `persist` implementation, not something this class can provide.
 */
export class GalaxySessionStorageManager {
    /**
     * @constructor
     * @param {function(Object): (Promise|Thenable)} persist - Called with a shallow clone of the variables passed to `set()`. Must return a Promise (or
     * thenable, e.g. a jQuery jqXHR) that resolves when the write has completed, and rejects if it fails.
     */
    constructor(persist) {
        this.persist = persist;

        this._queue = [];
        this._active = false;
    }

    /**
     * Queues a write of the given variables. Every accepted call is executed in the order it was received -- a write already in progress is never aborted
     * to start this one, and this one is never dropped or coalesced with another queued call.
     *
     * The variables are shallow-cloned immediately (before this call returns), not when the write actually runs, so a caller that mutates the object it
     * passed in after calling `set()` cannot affect a write that is still waiting in the queue.
     * @param {Object} variables - The variables to persist.
     * @return {Promise} - Resolves or rejects with the outcome of this specific write once it actually runs, not merely once it is queued.
     */
    set = (variables) => {
        let snapshot = {...variables};

        return new Promise((resolve, reject) => {
            this._queue.push({variables: snapshot, resolve, reject});
            this._process_next();
        });
    }

    /**
     * Starts the next queued write, if one is queued and none is currently active. `persist` is invoked synchronously (matching how a direct AJAX call
     * dispatches immediately today) rather than deferred to a microtask, so a caller of `set()` on an idle queue sees the write start right away. Always
     * re-invoked once the active write settles, whether it succeeded or failed, so a failure can never leave the queue permanently stuck.
     */
    _process_next = () => {
        if (this._active || this._queue.length === 0) {
            return;
        }

        let entry = this._queue.shift();

        this._active = true;

        let outcome;

        try {
            // Promise.resolve() normalizes any thenable (e.g. a jQuery jqXHR) returned by persist() into a native Promise, and also lets a *synchronous*
            // throw from persist() (failure before any network request starts) be handled the same way as an asynchronous rejection.
            outcome = Promise.resolve(this.persist(entry.variables));
        } catch (error) {
            outcome = Promise.reject(error);
        }

        outcome
            .then(entry.resolve, entry.reject)
            .finally(() => {
                this._active = false;
                this._process_next();
            });
    }

    /**
     * @return {number} - The number of writes still waiting to start. Does not include the currently active write, if any.
     */
    get pending_count() {
        return this._queue.length;
    }

    /**
     * @return {boolean} - True if a write is currently in flight.
     */
    get is_active() {
        return this._active;
    }

    /**
     * @return {boolean} - True if a write is queued or currently in flight. Intended for callers that want to guard against leaving the page (e.g. a
     * `beforeunload` handler that shows the browser's native confirmation) while a session-variable write has not yet completed -- see the class-level
     * example above.
     */
    get has_pending() {
        return this._active || this._queue.length > 0;
    }
}
