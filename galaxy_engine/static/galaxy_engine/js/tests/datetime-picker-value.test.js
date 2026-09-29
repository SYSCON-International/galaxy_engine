import { describe, expect, test } from "vitest";
import { create_picker, flush } from "./datetime-test-helpers.js";

describe("value plumbing (fix #1)", () => {
    test("the initial value attribute in markup is applied and displayed", async () => {
        let picker = await create_picker("date", {value: "2024-01-15"});

        expect(picker.value).toBe("2024-01-15");
        expect(picker.input_element.value).not.toBe("");
    });

    test(".value getter reflects a value set via the .value property", async () => {
        let picker = await create_picker("date");

        picker.value = "2024-06-01";

        expect(picker.value).toBe("2024-06-01");
    });

    test(".value getter reflects a value set via setAttribute directly (not just the property)", async () => {
        let picker = await create_picker("date");

        picker.setAttribute("value", "2024-07-04");
        await flush();

        expect(picker.value).toBe("2024-07-04");
        expect(picker.input_element.value).not.toBe("");
    });

    test("the form value is the canonical ISO value, not the locale-formatted display text", async () => {
        let picker = await create_picker("date");

        picker.value = "2024-01-15";

        expect(picker._internals._form_value).toBe("2024-01-15");
        // Sanity check that the display text is indeed different from the ISO value (locale-formatted),
        // so this test would actually catch a regression back to submitting event.target.value.
        expect(picker.input_element.value).not.toBe("2024-01-15");
    });

    test("picking a date via the calendar popup also produces a correct, ISO-formatted form value", async () => {
        let picker = await create_picker("date");

        picker.input_element.dispatchEvent(new window.Event("focus"));
        await flush();

        let day_cell = [...picker.datetime_popup.querySelectorAll(".calendar-grid > div")]
            .find((cell) => cell.textContent === "15" && !cell.classList.contains("day-name"));
        day_cell.click();

        expect(picker._internals._form_value).toMatch(/^\d{4}-\d{2}-15$/);
    });

    test("setting .value before the element is ever connected does not throw (fix #3)", () => {
        let picker = document.createElement("galaxy-date-picker");

        expect(() => { picker.value = "2024-01-01"; }).not.toThrow();
    });

    test("a time picker's form value is a clean HH:mm string", async () => {
        let picker = await create_picker("time", {"time-format": "24", value: "14:30"});

        expect(picker.value).toBe("14:30");
        expect(picker._internals._form_value).toBe("14:30");
    });

    test("a datetime picker's form value is a clean ISO datetime string", async () => {
        let picker = await create_picker("datetime", {value: "2024-01-15T14:30"});

        expect(picker.value).toBe("2024-01-15T14:30");
        expect(picker._internals._form_value).toBe("2024-01-15T14:30");
    });
});
