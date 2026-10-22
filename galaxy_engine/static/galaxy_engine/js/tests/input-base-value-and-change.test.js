import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyFloatInput } from "../components/GalaxyFloatInput.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxyPasswordInput } from "../components/GalaxyPasswordInput.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { create_picker } from "./datetime-test-helpers.js";
import { create_select, flush, SIMPLE_OPTIONS } from "./test-helpers.js";

const COMPONENTS = [
    ["galaxy-text-input", GalaxyTextInput],
    ["galaxy-integer-input", GalaxyIntegerInput],
    ["galaxy-float-input", GalaxyFloatInput],
    ["galaxy-textarea", GalaxyTextarea],
    ["galaxy-password-input", GalaxyPasswordInput],
    ["galaxy-checkbox", GalaxyCheckbox],
    ["galaxy-duration-input", GalaxyDurationInput],
];

for (let [tag_name, component_class] of COMPONENTS) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const create_connected = async (tag_name, attributes = {}) => {
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);
    await flush();

    return element;
};

/**
 * Types into the element's inner field the way a browser reports it: an input event per edit, then a change event when the field is committed.
 * @param {HTMLElement} element
 * @param {string} text
 */
const type_and_commit = (element, text) => {
    element.input_element.value = text;
    element.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));
    element.input_element.dispatchEvent(new Event("change", {bubbles: true}));
};

describe("removing the value attribute empties the field", () => {
    let unhandled_rejections = [];
    let record_rejection = (reason) => {
        unhandled_rejections.push(reason);
    };

    beforeEach(() => {
        unhandled_rejections = [];
        process.on("unhandledRejection", record_rejection);
    });

    afterEach(() => {
        process.off("unhandledRejection", record_rejection);
    });

    for (let [tag_name, initial_value] of [
        ["galaxy-text-input", "initial"],
        ["galaxy-integer-input", "5"],
        ["galaxy-float-input", "2.5"],
        ["galaxy-textarea", "initial"],
    ]) {
        test(`${tag_name}: no rejection, an empty value, and an empty form value`, async () => {
            let element = await create_connected(tag_name, {"name": "field", "value": initial_value});

            element.removeAttribute("value");
            await flush();

            expect(unhandled_rejections).toEqual([]);
            expect(element.value).toBe("");
            expect(element.input_element.value).toBe("");
            expect(element._internals._form_value).toBe("");
        });

        test(`${tag_name}: a required field is invalid once its value is removed`, async () => {
            let element = await create_connected(tag_name, {"value": initial_value, "required": ""});

            element.removeAttribute("value");
            await flush();

            expect(element.validate()).toBe(false);
        });
    }

    test("galaxy-password-input: removing a value attribute empties it without a rejection", async () => {
        let password_input = await create_connected("galaxy-password-input");

        password_input.setAttribute("value", "hunter2");
        await flush();
        password_input.removeAttribute("value");
        await flush();

        expect(unhandled_rejections).toEqual([]);
        expect(password_input.value).toBe("");
    });

    test("galaxy-select: removing the value attribute clears the selection rather than selecting null", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), "value": "banana"});

        select.removeAttribute("value");
        await flush();

        expect(unhandled_rejections).toEqual([]);
        expect(select.value).toEqual([]);
    });
});

describe("a committed change reaches the on_change hook", () => {
    test("galaxy-text-input: typing calls on_input, committing calls on_change once, and the value follows", async () => {
        let text_input = await create_connected("galaxy-text-input", {"name": "field"});
        let on_input_spy = vi.fn();
        let on_change_spy = vi.fn();

        text_input.on_input = on_input_spy;
        text_input.on_change = on_change_spy;

        type_and_commit(text_input, "typed");

        expect(on_input_spy).toHaveBeenCalledTimes(1);
        expect(on_change_spy).toHaveBeenCalledTimes(1);
        expect(on_change_spy.mock.calls[0][0].type).toBe("change");
        expect(text_input.value).toBe("typed");
        expect(text_input._internals._form_value).toBe("typed");
    });

    test("galaxy-checkbox: a toggle calls on_change once and dispatches one change on the host", async () => {
        let checkbox = await create_connected("galaxy-checkbox");
        let on_change_spy = vi.fn();
        let host_change_listener = vi.fn();

        checkbox.on_change = on_change_spy;
        checkbox.addEventListener("change", host_change_listener);

        checkbox.input_element.click();

        expect(checkbox.checked).toBe(true);
        expect(on_change_spy).toHaveBeenCalledTimes(1);
        expect(host_change_listener).toHaveBeenCalledTimes(1);
    });

    test("galaxy-password-input: a committed password is submitted with no restore state", async () => {
        let password_input = await create_connected("galaxy-password-input", {"name": "password"});
        let on_change_spy = vi.fn();

        password_input.on_change = on_change_spy;

        type_and_commit(password_input, "hunter2");

        expect(on_change_spy).toHaveBeenCalledTimes(1);
        expect(password_input.value).toBe("hunter2");
        expect(password_input._internals._form_value).toBe("hunter2");
        expect(password_input._internals._form_state).toBe("");
    });

    test("galaxy-date-picker: a committed change keeps the ISO value, not the display text", async () => {
        let date_picker = await create_picker("date", {"name": "day", "value": "2024-01-15"});
        let on_change_spy = vi.fn();

        date_picker.on_change = on_change_spy;

        let display_text = date_picker.format_for_display("2024-02-20");

        type_and_commit(date_picker, display_text);

        expect(on_change_spy).toHaveBeenCalledTimes(1);
        expect(date_picker.value).toBe("2024-02-20");
        expect(date_picker._internals._form_value).toBe("2024-02-20");
    });

    test("galaxy-select: committing search text calls on_change and leaves the selection alone", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), "value": "banana", "search-enabled": ""});
        let on_change_spy = vi.fn();

        select.on_change = on_change_spy;

        type_and_commit(select, "che");

        expect(on_change_spy).toHaveBeenCalledTimes(1);
        expect(select.value).toEqual(["banana"]);
    });
});

describe("a committed edit dispatches change on the element itself", () => {
    // The field's native change does not cross the shadow boundary, so without this a change listener on the element never fires.
    for (let [tag_name, typed_text] of [
        ["galaxy-text-input", "typed"],
        ["galaxy-integer-input", "7"],
        ["galaxy-float-input", "1.5"],
        ["galaxy-textarea", "typed"],
        ["galaxy-password-input", "hunter2"],
    ]) {
        test(`${tag_name}: one change on the element per committed edit, none for typing alone`, async () => {
            let element = await create_connected(tag_name);
            let host_change_listener = vi.fn();

            element.addEventListener("change", host_change_listener);

            element.input_element.value = typed_text;
            element.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));

            expect(host_change_listener).not.toHaveBeenCalled();

            element.input_element.dispatchEvent(new Event("change", {bubbles: true}));

            expect(host_change_listener).toHaveBeenCalledTimes(1);
            expect(host_change_listener.mock.calls[0][0].target).toBe(element);
            expect(element.value).toBe(typed_text);
        });
    }

    test("galaxy-date-picker: a committed change dispatches change on the element, with the ISO value already set", async () => {
        let date_picker = await create_picker("date", {"value": "2024-01-15"});
        let seen_values = [];

        date_picker.addEventListener("change", () => seen_values.push(date_picker.value));

        type_and_commit(date_picker, date_picker.format_for_display("2024-02-20"));

        expect(seen_values).toEqual(["2024-02-20"]);
    });

    test("a value set from code dispatches no change, as on a native input", async () => {
        let text_input = await create_connected("galaxy-text-input");
        let host_change_listener = vi.fn();

        text_input.addEventListener("change", host_change_listener);
        text_input.value = "from code";
        await flush();

        expect(host_change_listener).not.toHaveBeenCalled();
    });

    test("galaxy-select: committing search text dispatches no change (picking an option does; see select-change-event.test.js)", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), "search-enabled": ""});
        let host_change_listener = vi.fn();

        select.addEventListener("change", host_change_listener);

        type_and_commit(select, "che");

        expect(host_change_listener).not.toHaveBeenCalled();
    });

    test("galaxy-checkbox: still one change on the element per toggle", async () => {
        let checkbox = await create_connected("galaxy-checkbox");
        let host_change_listener = vi.fn();

        checkbox.addEventListener("change", host_change_listener);
        checkbox.input_element.click();

        expect(host_change_listener).toHaveBeenCalledTimes(1);
    });
});
