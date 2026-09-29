import { describe, expect, test, vi } from "vitest";
import { create_picker } from "./datetime-test-helpers.js";

describe("clearing the field keeps is_valid and input_validated in sync (fix #4)", () => {
    test("clearing a previously-invalid field resets is_valid to true and fires input_validated", async () => {
        let picker = await create_picker("date");

        picker.input_element.value = "not a date";
        picker.validate_format();
        expect(picker.is_valid).toBe(false);

        let validated_spy = vi.fn();
        picker.addEventListener("input_validated", validated_spy);

        picker.input_element.value = "";
        picker.validate_format();

        expect(picker.is_valid).toBe(true);
        expect(validated_spy).toHaveBeenCalledOnce();
        expect(picker.input_element.classList.contains("error")).toBe(false);
    });

    test("clearing a previously-valid field still fires input_validated", async () => {
        let picker = await create_picker("date", {value: "2024-01-15"});

        let validated_spy = vi.fn();
        picker.addEventListener("input_validated", validated_spy);

        picker.input_element.value = "";
        picker.validate_format();

        expect(picker.is_valid).toBe(true);
        expect(validated_spy).toHaveBeenCalledOnce();
    });
});
