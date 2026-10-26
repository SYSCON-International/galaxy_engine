import { describe, expect, test } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { create_range_picker, flush } from "./datetime-test-helpers.js";

if (!customElements.get("galaxy-form")) {
    customElements.define("galaxy-form", GalaxyForm);
}

/**
 * Parses markup into the document and waits for the range picker in it, and its nested pickers, to be created.
 * @param {string} markup
 * @return {Promise<HTMLElement>} - The range picker.
 */
const render_range_picker = async (markup) => {
    document.body.innerHTML = markup;

    for (let flush_count = 0; flush_count < 4; flush_count++) {
        await flush();
    }

    let form = document.querySelector("galaxy-form");

    return form ? form.shadowRoot.querySelector("galaxy-datetime-range") : document.querySelector("galaxy-datetime-range");
};

/**
 * Chooses a preset range in the select, as the user does.
 * @param {HTMLElement} range_picker
 * @param {string} range
 */
const choose_range = (range_picker, range) => {
    range_picker.range_select_element.value = range;
    range_picker.range_select_element.dispatchEvent(new window.Event("change", {bubbles: true}));
};

/**
 * Types a value into a nested picker and commits it, as the user does.
 * @param {HTMLElement} nested_picker
 * @param {string} display_text
 */
const type_into = (nested_picker, display_text) => {
    nested_picker.input_element.value = display_text;
    nested_picker.input_element.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
    nested_picker.input_element.dispatchEvent(new window.Event("change", {bubbles: true}));
};

const get_form_value = (range_picker) => JSON.parse(range_picker._internals._form_value);

describe("A6.1: the range picker is a full form field", () => {
    test("choosing a range sets the form value, writes state, and dispatches change", async () => {
        let range_picker = await render_range_picker("<galaxy-datetime-range name=\"period\" property-name=\"period\"></galaxy-datetime-range>");
        let change_count = 0;

        range_picker.addEventListener("change", () => change_count++);
        choose_range(range_picker, "Today");

        expect(get_form_value(range_picker)).toEqual({range: "Today", start: null, end: null});
        expect(window.galaxy_state_manager.data.period.range).toBe("Today");
        expect(change_count).toBe(1);
    });

    test("a custom range typed by the user is in the form value as canonical datetimes", async () => {
        let range_picker = await render_range_picker("<galaxy-datetime-range name=\"period\"></galaxy-datetime-range>");

        choose_range(range_picker, "Custom");
        type_into(range_picker.start_datetime_picker, range_picker.start_datetime_picker.format_for_display("2024-01-01T08:00"));
        type_into(range_picker.end_datetime_picker, range_picker.end_datetime_picker.format_for_display("2024-01-31T17:00"));

        expect(get_form_value(range_picker)).toEqual({range: "Custom", start: "2024-01-01T08:00", end: "2024-01-31T17:00"});
    });

    test("a value attribute, as JSON or a range name, sets the initial range, and a form reset restores it", async () => {
        let range_picker = await render_range_picker(
            "<galaxy-form><galaxy-datetime-range name=\"period\" value='{\"range\": \"Custom\", \"start\": \"2024-01-01T00:00\", \"end\": \"2024-01-02T00:00\"}'></galaxy-datetime-range></galaxy-form>"
        );

        expect(range_picker.value.range).toBe("Custom");
        expect(range_picker.value.start.day).toBe(1);
        expect(range_picker.hasAttribute("custom-range")).toBe(true);

        choose_range(range_picker, "Today");
        range_picker.formResetCallback();

        expect(range_picker.value.range).toBe("Custom");
        expect(get_form_value(range_picker).start).toBe("2024-01-01T00:00");

        let named_picker = await render_range_picker("<galaxy-datetime-range value=\"This Week\"></galaxy-datetime-range>");

        expect(named_picker.value.range).toBe("This Week");
    });

    test("required fails for a custom range with no dates, and a reversed or half-filled range is invalid", async () => {
        let range_picker = await render_range_picker("<galaxy-datetime-range required></galaxy-datetime-range>");

        expect(range_picker.validate()).toBe(true);

        range_picker.value = {range: "Custom"};
        expect(range_picker.validate()).toBe(false);

        range_picker.value = {range: "Custom", start: "2024-01-01T00:00"};
        expect(range_picker.validate()).toBe(false);

        range_picker.value = {range: "Custom", start: "2024-02-01T00:00", end: "2024-01-01T00:00"};
        expect(range_picker.validate()).toBe(false);

        range_picker.value = {range: "Custom", start: "2024-01-01T00:00", end: "2024-02-01T00:00"};
        expect(range_picker.validate()).toBe(true);
    });

    test("disabled and readonly reach the select and nested pickers, including from a fieldset", async () => {
        let range_picker = await render_range_picker("<galaxy-datetime-range disabled></galaxy-datetime-range>");

        expect(range_picker.range_select_element.disabled).toBe(true);
        expect(range_picker.start_datetime_picker.hasAttribute("disabled")).toBe(true);

        range_picker.removeAttribute("disabled");
        range_picker.setAttribute("readonly", "");
        await flush();

        expect(range_picker.range_select_element.disabled).toBe(true);
        expect(range_picker.end_datetime_picker.hasAttribute("readonly")).toBe(true);
        expect(range_picker.end_datetime_picker.hasAttribute("disabled")).toBe(false);

        range_picker.removeAttribute("readonly");
        range_picker.formDisabledCallback(true);

        expect(range_picker.range_select_element.disabled).toBe(true);
        expect(range_picker.start_datetime_picker.hasAttribute("disabled")).toBe(true);

        range_picker.formDisabledCallback(false);
        expect(range_picker.range_select_element.disabled).toBe(false);
    });

    test("reading and setting .value before creation does not throw, and the value is applied once created", async () => {
        let range_picker = document.createElement("galaxy-datetime-range");

        expect(range_picker.value).toEqual({range: "All", start: null, end: null});

        range_picker.value = {range: "This Month"};
        document.body.appendChild(range_picker);

        for (let flush_count = 0; flush_count < 4; flush_count++) {
            await flush();
        }

        expect(range_picker.range_select_element.value).toBe("This Month");
    });

    test("a move keeps the chosen range", async () => {
        let range_picker = await create_range_picker();

        range_picker.value = {range: "Custom", start: "2024-01-01T00:00", end: "2024-01-02T00:00"};

        let wrapper = document.createElement("div");

        document.body.appendChild(wrapper);
        wrapper.appendChild(range_picker);

        for (let flush_count = 0; flush_count < 4; flush_count++) {
            await flush();
        }

        expect(range_picker.range_select_element.value).toBe("Custom");
        expect(range_picker.value.end.day).toBe(2);
        expect(range_picker.shadowRoot.querySelectorAll(".range-picker")).toHaveLength(1);
    });

    test("a state value written back from the getter keeps an empty custom date empty", async () => {
        let range_picker = await render_range_picker("<galaxy-datetime-range property-name=\"period\"></galaxy-datetime-range>");

        range_picker.value = {range: "Custom", start: "2024-01-01T00:00"};
        window.galaxy_state_manager.set("period", range_picker.value);
        range_picker.apply_state_value(range_picker.value);

        expect(get_form_value(range_picker).end).toBe(null);
    });
});
