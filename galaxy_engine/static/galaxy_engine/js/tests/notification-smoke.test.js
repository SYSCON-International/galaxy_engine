import { describe, expect, test } from "vitest";
import { create_notification } from "./notification-test-helpers.js";

describe("notification smoke test", () => {
    test("a notification with a normal config connects and renders", async () => {
        let notification = await create_notification({type: "success", title: "Saved", message: "It worked."});

        expect(notification.header_text.textContent).toBe("Saved");
        expect(notification.body.textContent).toBe("It worked.");
    });
});
