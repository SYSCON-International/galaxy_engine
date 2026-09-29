import { describe, expect, test } from "vitest";
import { create_notification } from "./notification-test-helpers.js";

describe("safe construction with no/incomplete config (fix #1, #2)", () => {
    test("document.createElement-style construction (no config at all) does not throw", async () => {
        let element = document.createElement("galaxy-notification");

        expect(() => document.body.appendChild(element)).not.toThrow();
    });

    test("new GalaxyNotification() with no arguments does not throw and renders a sensible default", async () => {
        let notification = await create_notification(undefined);

        expect(notification.header_text.textContent).toBe("Info");
        expect(notification.body.textContent).toBe("");
    });

    test("a config with a message but no type/title does not throw and falls back to 'Info'", async () => {
        let notification = await create_notification({message: "Just a message."});

        expect(notification.header_text.textContent).toBe("Info");
        expect(notification.body.textContent).toBe("Just a message.");
    });

    test("an explicit title is still used even without a type", async () => {
        let notification = await create_notification({title: "Heads up", message: "hi"});

        expect(notification.header_text.textContent).toBe("Heads up");
    });

    test("set_icon still falls back gracefully for a missing type (pre-existing, unaffected behavior)", async () => {
        let notification = await create_notification({message: "hi"});

        expect(notification.notification.classList.contains("info")).toBe(true);
    });
});
