import { describe, expect, test } from "vitest";
import { create_duration, flush } from "./duration-test-helpers.js";

describe("narrowing visible-units updates the truncation warning (fix #3)", () => {
    test("dropping a unit that newly loses precision shows the warning, even though the value was never edited", async () => {
        let input = await create_duration("input", {
            unit: "seconds",
            value: "90", // 1 minute 30 seconds - fully representable with minutes+seconds visible
            "visible-units": JSON.stringify(["minutes", "seconds"]),
        });

        expect(input.truncation_info.was_truncated).toBe(false);
        expect(input.warning_element.textContent).toBe("");

        // Narrow to minutes-only: the 30 seconds can no longer be represented.
        input.setAttribute("visible-units", JSON.stringify(["minutes"]));
        await flush();

        expect(input.truncation_info.was_truncated).toBe(true);
        expect(input.truncation_info.remainder_value).toBe(30);
        expect(input.warning_element.textContent).not.toBe("");
    });

    test("the warning still uses the originally-received value/unit, not a re-derived one", async () => {
        let input = await create_duration("input", {
            unit: "minutes",
            value: "90", // 1 hour 30 minutes
            "visible-units": JSON.stringify(["hours", "minutes"]),
        });

        input.setAttribute("visible-units", JSON.stringify(["hours"]));
        await flush();

        expect(input.truncation_info.original_value).toBe(90);
        expect(input.truncation_info.unit).toBe("minutes");
    });

    test("a field the user already edited keeps the warning suppressed after narrowing", async () => {
        let input = await create_duration("input", {
            unit: "seconds",
            value: "90",
            "visible-units": JSON.stringify(["minutes", "seconds"]),
        });

        input.field_inputs.seconds.value = "45";
        input.field_inputs.seconds.dispatchEvent(new window.Event("input"));

        input.setAttribute("visible-units", JSON.stringify(["minutes"]));
        await flush();

        expect(input.truncation_info.was_truncated).toBe(false);
        expect(input.warning_element.textContent).toBe("");
    });
});
