import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GalaxyNotificationManager } from "../GalaxyNotificationManager.js";
import { flush } from "./notification-test-helpers.js"; // also registers <galaxy-notification> as a side effect

describe("GalaxyNotificationManager", () => {
    let manager;

    beforeEach(() => {
        manager = new GalaxyNotificationManager();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("add() creates and shows a notification in the container", async () => {
        manager.add("success", "Saved!");
        await flush();

        expect(manager.notifications).toHaveLength(1);
        expect(manager.notifications_container.children).toHaveLength(1);
        expect(manager.notifications[0].body.textContent).toBe("Saved!");
    });

    test("a notification auto-expires and is removed after its duration elapses", async () => {
        vi.useFakeTimers();

        manager.add("info", "Bye soon", 1); // 1 second
        await vi.advanceTimersByTimeAsync(0); // let connectedCallback's async chain settle first

        expect(manager.notifications).toHaveLength(1);

        // duration (1000ms) + hide()'s own removal delay (300ms) + margin
        await vi.advanceTimersByTimeAsync(1000 + 300 + 10);

        expect(manager.notifications).toHaveLength(0);
        expect(manager.notifications_container.children).toHaveLength(0);
    });

    test("duration: 0 means the notification is never auto-removed", async () => {
        vi.useFakeTimers();

        manager.add("info", "Sticks around", 0);
        await vi.advanceTimersByTimeAsync(0);

        await vi.advanceTimersByTimeAsync(60_000);

        expect(manager.notifications).toHaveLength(1);
    });

    test("remove() clears the pending auto-expire timeout", async () => {
        vi.useFakeTimers();

        manager.add("info", "hi", 10);
        await vi.advanceTimersByTimeAsync(0);

        let notification = manager.notifications[0];
        let clear_spy = vi.spyOn(globalThis, "clearTimeout");

        manager.remove(notification);

        expect(clear_spy).toHaveBeenCalledWith(notification.remove_timeout);

        clear_spy.mockRestore();
    });

    test("clicking a managed notification's close button removes it via the manager", async () => {
        vi.useFakeTimers();

        manager.add("info", "hi", 10);
        await vi.advanceTimersByTimeAsync(0);

        let notification = manager.notifications[0];
        notification.close_btn.click();

        await vi.advanceTimersByTimeAsync(300);

        expect(manager.notifications).toHaveLength(0);
        expect(manager.notifications_container.contains(notification)).toBe(false);

        // The (cleared) auto-expire timer must not still fire and do anything odd well past its original duration.
        await vi.advanceTimersByTimeAsync(20_000);
        expect(manager.notifications).toHaveLength(0);
    });
});
