import { describe, expect, test } from "vitest";
import { create_duration } from "./duration-test-helpers.js";

describe("submitted form value's unit no longer depends on how it was set (fix #1)", () => {
    test("setting .value submits the value in output-unit, not unit", async () => {
        let input = await create_duration("input", {unit: "seconds", "output-unit": "minutes"});

        input.value = 120; // 120 seconds = 2 minutes

        expect(input.value).toBe(2);
        expect(input._internals._form_value).toBe("2");
    });

    test("editing a field afterward submits the same unit (output-unit) as setting .value did", async () => {
        let input = await create_duration("input", {
            unit: "seconds",
            "output-unit": "minutes",
            "visible-units": JSON.stringify(["minutes", "seconds"]),
        });

        input.value = 120; // 2 minutes via the property setter
        let form_value_after_set = input._internals._form_value;

        // Now edit the minutes field directly (as a user would) and confirm the submitted unit doesn't change.
        input.field_inputs.minutes.value = "3";
        input.field_inputs.minutes.dispatchEvent(new window.Event("input"));

        expect(input._internals._form_value).not.toBe(form_value_after_set); // the value did change...
        expect(input.value).toBe(3); // ...to 3 minutes...
        expect(input._internals._form_value).toBe("3"); // ...and is submitted in the same unit (minutes) as before.
    });

    test("with no output-unit configured, both paths submit in unit (the fallback)", async () => {
        let input = await create_duration("input", {unit: "seconds"});

        input.value = 90;

        expect(input.value).toBe(90);
        expect(input._internals._form_value).toBe("90");
    });
});
