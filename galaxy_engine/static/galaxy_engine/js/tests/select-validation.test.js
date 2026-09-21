import { describe, expect, test } from "vitest";
import { create_select, SIMPLE_OPTIONS } from "./test-helpers.js";

describe("required validation on select/multi-select (fix #2)", () => {
    test("an empty required select fails validation with a select-specific message", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            required: "",
        });

        expect(select.value).toEqual([]);
        expect(select.validate()).toBe(false);
        expect(select._internals.validationMessage).toContain("Please select an option.");
    });

    test("a required select with a value passes validation", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            required: "",
        });

        select.option_on_click(null, null, SIMPLE_OPTIONS[0]);

        expect(select.validate()).toBe(true);
    });

    test("an empty required multi-select also fails validation (not a no-op like before the fix)", async () => {
        let select = await create_select("multi-select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            required: "",
        });

        expect(select.validate()).toBe(false);
    });

    test("a required multi-select with at least one selection passes validation", async () => {
        let select = await create_select("multi-select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            required: "",
        });

        let apple_row = select.flat_data.find((o) => o.value === "apple");
        select.option_on_click(null, null, apple_row);

        expect(select.validate()).toBe(true);
    });
});
