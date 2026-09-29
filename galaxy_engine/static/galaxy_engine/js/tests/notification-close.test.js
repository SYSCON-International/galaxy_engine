import { afterEach, describe, expect, test, vi } from "vitest";
import { create_notification } from "./notification-test-helpers.js";

// Fake timers are enabled per-test, after create_notification() has already resolved via real timers - the
// helper's own flush() relies on a real setTimeout(0) to let connectedCallback's async chain settle, which
// would otherwise hang forever waiting on a fake timer nothing advances.
afterEach(() => {
    vi.useRealTimers();
});

describe("hide() actually removes the notification on its own (fix #3)", () => {
    test("clicking the close button (no manager involved) fades out and then leaves the DOM", async () => {
        let notification = await create_notification({type: "info", message: "hi"});
        vi.useFakeTimers();

        expect(document.body.contains(notification)).toBe(true);

        notification.close_btn.click();

        expect(notification.notification.classList.contains("hide")).toBe(true);
        expect(document.body.contains(notification)).toBe(true); // not yet - the fade-out delay hasn't elapsed

        await vi.advanceTimersByTimeAsync(300);

        expect(document.body.contains(notification)).toBe(false);
    });

    test("calling hide() directly (no manager, no click) also eventually removes it", async () => {
        let notification = await create_notification({type: "info", message: "hi"});
        vi.useFakeTimers();

        notification.hide();
        await vi.advanceTimersByTimeAsync(300);

        expect(document.body.contains(notification)).toBe(false);
    });

    test("show() after hide() doesn't throw, and doesn't undo the pending removal", async () => {
        let notification = await create_notification({type: "info", message: "hi"});
        vi.useFakeTimers();

        notification.hide();

        expect(() => notification.show()).not.toThrow();

        await vi.advanceTimersByTimeAsync(300);

        expect(document.body.contains(notification)).toBe(false);
    });
});
