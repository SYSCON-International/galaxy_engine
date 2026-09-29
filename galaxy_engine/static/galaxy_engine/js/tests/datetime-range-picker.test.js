import { describe, expect, test, vi } from "vitest";
import { create_range_picker, flush } from "./datetime-test-helpers.js";

describe("GalaxyDatetimeRangePickerBase reference bugs", () => {
    test("setting .value with range: 'Custom' does not throw and sets custom-range", async () => {
        let picker = await create_range_picker();

        expect(() => { picker.value = {range: "Custom"}; }).not.toThrow();

        expect(picker.hasAttribute("custom-range")).toBe(true);
        expect(picker.range_select_element.value).toBe("Custom");
    });

    test("setting .value with a preset range does not throw and clears custom-range", async () => {
        let picker = await create_range_picker();

        picker.value = {range: "Custom"};
        expect(() => { picker.value = {range: "Today"}; }).not.toThrow();

        expect(picker.hasAttribute("custom-range")).toBe(false);
        expect(picker.range_select_element.value).toBe("Today");
    });

    test("an unrecognized range value falls back to 'All' instead of throwing", async () => {
        let picker = await create_range_picker();

        expect(() => { picker.value = {range: "Not A Real Range"}; }).not.toThrow();

        expect(picker.range_select_element.value).toBe("All");
    });

    test("setting .value with start/end dictionaries populates the nested pickers", async () => {
        let picker = await create_range_picker();

        picker.value = {
            range: "Custom",
            start: {year: 2024, month: 1, day: 1, hour: 0, minute: 0},
            end: {year: 2024, month: 1, day: 31, hour: 23, minute: 59},
        };

        expect(picker.start_datetime_picker.value_dictionary.day).toBe(1);
        expect(picker.end_datetime_picker.value_dictionary.day).toBe(31);
    });

    test("get value reads back the range and (for Custom) the nested pickers' dictionaries", async () => {
        let picker = await create_range_picker();

        picker.value = {range: "Custom", start: {year: 2024, month: 1, day: 1, hour: 0, minute: 0}};

        let value = picker.value;

        expect(value.range).toBe("Custom");
        expect(value.start.day).toBe(1);
    });
});

describe("range_change / range_valid custom events (dead code now wired up)", () => {
    test("changing the range select fires range_change and range_valid", async () => {
        let picker = await create_range_picker();

        let change_spy = vi.fn();
        let valid_spy = vi.fn();
        picker.addEventListener("range_change", change_spy);
        picker.addEventListener("range_valid", valid_spy);

        picker.range_select_element.value = "Today";
        picker.range_select_element.dispatchEvent(new window.Event("change"));

        await flush();

        expect(change_spy).toHaveBeenCalledOnce();
        expect(change_spy.mock.calls[0][0].detail.range).toBe("Today");
        expect(valid_spy).toHaveBeenCalledOnce(); // "Today" is always valid
    });

    test("range_valid does not fire for an incomplete Custom range", async () => {
        let picker = await create_range_picker();

        let valid_spy = vi.fn();
        picker.addEventListener("range_valid", valid_spy);

        picker.range_select_element.value = "Custom";
        picker.range_select_element.dispatchEvent(new window.Event("change"));

        await flush();

        expect(picker.is_range_valid()).toBe(false);
        expect(valid_spy).not.toHaveBeenCalled();
    });

    test("range_valid fires once both start and end are filled in for a Custom range", async () => {
        let picker = await create_range_picker();

        picker.range_select_element.value = "Custom";
        picker.range_select_element.dispatchEvent(new window.Event("change"));
        await flush();

        let valid_spy = vi.fn();
        picker.addEventListener("range_valid", valid_spy);

        // .value alone doesn't run validate_format() (that only happens via the required-field path, or via
        // real user interaction) - call it directly, which both sets is_valid and dispatches the real
        // input_validated event, exactly like a real interaction would.
        picker.start_datetime_picker.value = "2024-01-01T00:00";
        picker.start_datetime_picker.validate_format();
        picker.end_datetime_picker.value = "2024-01-31T23:59";
        picker.end_datetime_picker.validate_format();

        await flush();

        expect(picker.is_range_valid()).toBe(true);
        expect(valid_spy).toHaveBeenCalled();
    });
});
