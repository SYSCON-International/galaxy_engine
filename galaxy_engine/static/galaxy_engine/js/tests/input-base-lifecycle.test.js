import { describe, expect, test, vi } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyDatePicker } from "../components/GalaxyDatePicker.js";
import { GalaxyDatetimePicker } from "../components/GalaxyDatetimePicker.js";
import { GalaxyDatetimeRangePickerBase } from "../components/GalaxyDatetimeRangePickerBase.js";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyFloatInput } from "../components/GalaxyFloatInput.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxyMultiSelect } from "../components/GalaxyMultiSelect.js";
import { GalaxySelect } from "../components/GalaxySelect.js";
import { GalaxyPasswordInput } from "../components/GalaxyPasswordInput.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { GalaxyTimePicker } from "../components/GalaxyTimePicker.js";
import { flush } from "./test-helpers.js";

const INPUT_COMPONENTS = {
    "galaxy-text-input": GalaxyTextInput,
    "galaxy-integer-input": GalaxyIntegerInput,
    "galaxy-float-input": GalaxyFloatInput,
    "galaxy-select": GalaxySelect,
    "galaxy-multi-select": GalaxyMultiSelect,
    "galaxy-date-picker": GalaxyDatePicker,
    "galaxy-time-picker": GalaxyTimePicker,
    "galaxy-datetime-picker": GalaxyDatetimePicker,
    "galaxy-datetime-range": GalaxyDatetimeRangePickerBase,
    "galaxy-duration-input": GalaxyDurationInput,
    "galaxy-checkbox": GalaxyCheckbox,
    "galaxy-textarea": GalaxyTextarea,
    "galaxy-password-input": GalaxyPasswordInput,
};

for (let [tag_name, component_class] of Object.entries(INPUT_COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Creates and connects an input, and waits for its create lifecycle - twice over, since the range picker's inner datetime pickers initialize a tick after it does.
 * @param {string} tag_name - The input's tag.
 * @return {Promise<HTMLElement>}
 */
const create_input = async (tag_name) => {
    let element = document.createElement(tag_name);

    element.setAttribute("label", "Label");
    document.body.appendChild(element);

    await flush();
    await flush();

    return element;
};

/**
 * Counts the shadow root's rendered markup - everything but its own <style>.
 * @param {HTMLElement} element - The input.
 * @return {number}
 */
const count_rendered_markup = (element) => {
    return Array.from(element.shadowRoot.children).filter((child) => child.tagName !== "STYLE").length;
};

describe.each(Object.keys(INPUT_COMPONENTS))("%s", (tag_name) => {
    test("reconnecting renders its markup once, not twice", async () => {
        let element = await create_input(tag_name);
        let rendered_count = count_rendered_markup(element);
        let label_count = element.shadowRoot.querySelectorAll("label").length;

        expect(rendered_count).toBe(1);

        element.remove();
        await flush();
        document.body.appendChild(element);
        await flush();
        await flush();

        expect(count_rendered_markup(element)).toBe(rendered_count);
        expect(element.shadowRoot.querySelectorAll("label")).toHaveLength(label_count);
        expect(element.is_initialized).toBe(true);
    });

    test("the host is not a tab stop, and its shadow root is created with delegatesFocus", async () => {
        // jsdom accepts delegatesFocus but neither reports nor implements it, so the request itself is what can be checked here.
        let attach_shadow_spy = vi.spyOn(window.Element.prototype, "attachShadow");
        let element = await create_input(tag_name);
        let own_call = attach_shadow_spy.mock.calls.find((call, index) => attach_shadow_spy.mock.instances[index] === element);

        expect(element.hasAttribute("tabindex")).toBe(false);
        expect(own_call[0]).toEqual({mode: "open", delegatesFocus: true});

        attach_shadow_spy.mockRestore();
    });
});

describe("datetime picker reconnect", () => {
    test("does not stack another copy of its secondary stylesheet", async () => {
        let element = await create_input("galaxy-date-picker");
        let stylesheet_count = element.shadowRoot.adoptedStyleSheets.length;

        element.remove();
        await flush();
        document.body.appendChild(element);
        await flush();

        expect(element.shadowRoot.adoptedStyleSheets).toHaveLength(stylesheet_count);
    });
});
