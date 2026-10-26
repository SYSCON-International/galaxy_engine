import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { GalaxyDurationUtils } from "../GalaxyDurationUtils.js";
import { create_duration, flush } from "./duration-test-helpers.js";

if (!customElements.get("galaxy-text-input")) {
    customElements.define("galaxy-text-input", GalaxyTextInput);
}

/**
 * Gets a duration input's unit fields, in order.
 * @param {HTMLElement} duration_input
 * @return {HTMLInputElement[]}
 */
const get_fields = (duration_input) => Object.values(duration_input.field_inputs);

describe("A5.1: a negative or non-finite duration does not throw", () => {
    let warn_spy;

    beforeEach(() => {
        warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warn_spy.mockRestore();
    });

    test("an input with value=\"-5\" builds its fields, holds 0, and warns", async () => {
        let duration_input = await create_duration("input", {value: "-5"});

        expect(get_fields(duration_input).length).toBe(4);
        expect(duration_input.value).toBe(0);
        expect(warn_spy).toHaveBeenCalled();
    });

    test("setting Infinity or NaN from code holds 0", async () => {
        let duration_input = await create_duration("input", {value: "60"});

        duration_input.value = Infinity;
        expect(duration_input.value).toBe(0);

        duration_input.value = "not a number";
        expect(duration_input.value).toBe(0);
    });

    test("a display shows a negative duration with a leading minus, and Infinity as zero", async () => {
        let duration_display = await create_duration("display", {value: "-90", "visible-units": JSON.stringify(["minutes", "seconds"]), format: "short"});

        expect(duration_display.value).toBe("-1m 30s");

        duration_display.setAttribute("value", "Infinity");
        expect(duration_display.value).toBe("0m 0s");
    });
});

describe("A5.2: disabled and readonly reach the duration input's own fields", () => {
    test("the disabled and readonly attributes, at creation and after", async () => {
        let duration_input = await create_duration("input", {disabled: ""});

        expect(get_fields(duration_input).every((field) => field.disabled)).toBe(true);

        duration_input.removeAttribute("disabled");
        duration_input.setAttribute("readonly", "");
        await flush();

        expect(get_fields(duration_input).some((field) => field.disabled)).toBe(false);
        expect(get_fields(duration_input).every((field) => field.readOnly)).toBe(true);

        duration_input.removeAttribute("readonly");
        await flush();

        expect(get_fields(duration_input).some((field) => field.readOnly)).toBe(false);
    });

    test("a disabling fieldset disables the fields, and a rebuild keeps the state", async () => {
        let duration_input = await create_duration("input");

        duration_input.formDisabledCallback(true);
        expect(get_fields(duration_input).every((field) => field.disabled)).toBe(true);

        duration_input.setAttribute("visible-units", JSON.stringify(["hours", "minutes"]));
        await flush();
        await flush();

        expect(get_fields(duration_input).length).toBe(2);
        expect(get_fields(duration_input).every((field) => field.disabled)).toBe(true);

        duration_input.formDisabledCallback(false);
        expect(get_fields(duration_input).some((field) => field.disabled)).toBe(false);
    });
});

describe("A5.3: a value keeps one unit through state", () => {
    test("with unit=minutes and output-unit=seconds, a state value is read in seconds, so bound inputs agree", async () => {
        let attributes = {unit: "minutes", "output-unit": "seconds", "property-name": "duration"};
        let first_input = await create_duration("input", attributes);
        let second_input = await create_duration("input", attributes);

        window.galaxy_state_manager.set("duration", 120);

        expect(first_input.value).toBe(120);
        expect(second_input.value).toBe(120);
        expect(first_input.field_values.minutes).toBe(2);
    });

    test("a restored form state is read in the output unit too", async () => {
        let duration_input = await create_duration("input", {unit: "minutes", "output-unit": "seconds"});

        duration_input.formStateRestoreCallback("180");

        expect(duration_input.value).toBe(180);
        expect(duration_input.field_values.minutes).toBe(3);
    });
});

describe("A5.4: duration display precision and options", () => {
    let warn_spy;

    beforeEach(() => {
        warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warn_spy.mockRestore();
    });

    test("\"fraction\" carries a rounded-up smallest unit, so 3599.9 seconds is 1h 0m, not 0h 60m", () => {
        let total_microseconds = GalaxyDurationUtils.to_microseconds(3599.9, "seconds");
        let result = GalaxyDurationUtils.apply_precision(total_microseconds, ["hours", "minutes"], "fraction", 0);

        expect(result.parts).toEqual({hours: 1, minutes: 0});
        expect(result.fractional_smallest_unit_value).toBe(0);
    });

    test("an out-of-range fraction-digits is clamped instead of throwing", async () => {
        let duration_display = await create_duration("display", {value: "90", "visible-units": JSON.stringify(["minutes"]), "precision-mode": "fraction", format: "short"});

        duration_display.setAttribute("fraction-digits", "-3");
        expect(duration_display.value).toBe("2m");

        duration_display.setAttribute("fraction-digits", "500");
        expect(duration_display.value).toBe(`1.${"5".padEnd(20, "0")}m`);
    });

    test("partial unit labels are merged over the defaults", async () => {
        let duration_display = await create_duration("display", {value: "3660", format: "long", "visible-units": JSON.stringify(["hours", "minutes"]), "long-unit-labels": JSON.stringify({hours: {singular: "hr"}})});

        expect(duration_display.value).toBe("1 hr, 1 minute");

        let duration_input = await create_duration("input", {"unit-labels": JSON.stringify({days: "D"})});
        let label_texts = [...duration_input.shadowRoot.querySelectorAll(".duration-input-label")].map((label) => label.textContent);

        expect(label_texts).toEqual(["D", "Hours", "Minutes", "Seconds"]);
    });
});

describe("A8.4: the state manager keeps going when one bound component throws", () => {
    test("a component bound after one that throws is still updated, and the error is reported", async () => {
        let error_spy = vi.spyOn(console, "error").mockImplementation(() => {});
        let throwing_component = {apply_state_value: () => {throw new Error("bad value");}};

        window.galaxy_state_manager.bind("machine_name", throwing_component);

        document.body.insertAdjacentHTML("beforeend", "<galaxy-text-input property-name=\"machine_name\"></galaxy-text-input>");
        await flush();

        let text_input = document.querySelector("galaxy-text-input");

        window.galaxy_state_manager.set("machine_name", "Press 2");

        expect(text_input.value).toBe("Press 2");
        expect(error_spy).toHaveBeenCalled();

        error_spy.mockRestore();
    });
});
