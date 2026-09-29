import { describe, expect, test } from "vitest";
import { create_notification } from "./notification-test-helpers.js";

describe("notification accessibility (fix #4)", () => {
    test("the notification announces itself as a polite status region", async () => {
        let notification = await create_notification({type: "info", message: "hi"});

        expect(notification.notification.getAttribute("role")).toBe("status");
        expect(notification.notification.getAttribute("aria-live")).toBe("polite");
    });

    test("the close button has a descriptive label beyond the bare 'X'", async () => {
        let notification = await create_notification({type: "info", message: "hi"});

        expect(notification.close_btn.getAttribute("aria-label")).toBe("Close");
    });
});
