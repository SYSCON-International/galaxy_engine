import { describe, expect, test } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyDatePicker } from "../components/GalaxyDatePicker.js";
import { GalaxyDatetimePicker } from "../components/GalaxyDatetimePicker.js";
import { GalaxyDatetimeRangePickerBase } from "../components/GalaxyDatetimeRangePickerBase.js";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyEditableTable } from "../components/GalaxyEditableTable.js";
import { GalaxyFloatInput } from "../components/GalaxyFloatInput.js";
import { GalaxyInputBase } from "../components/GalaxyInputBase.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxyMultiSelect } from "../components/GalaxyMultiSelect.js";
import { GalaxyPasswordInput } from "../components/GalaxyPasswordInput.js";
import { GalaxySelect } from "../components/GalaxySelect.js";
import { GalaxySortableList } from "../components/GalaxySortableList.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { GalaxyTimePicker } from "../components/GalaxyTimePicker.js";
import { flush } from "./test-helpers.js";

// The browser reads form-associated callbacks from the class prototype when the element is defined, and never from the instance.
// A callback written as an arrow-function class field lives only on the instance, so the browser never calls it.
const FORM_ASSOCIATED_COMPONENTS = [
    ["galaxy-text-input", GalaxyTextInput],
    ["galaxy-integer-input", GalaxyIntegerInput],
    ["galaxy-float-input", GalaxyFloatInput],
    ["galaxy-textarea", GalaxyTextarea],
    ["galaxy-password-input", GalaxyPasswordInput],
    ["galaxy-checkbox", GalaxyCheckbox],
    ["galaxy-select", GalaxySelect],
    ["galaxy-multi-select", GalaxyMultiSelect],
    ["galaxy-duration-input", GalaxyDurationInput],
    ["galaxy-datetime-picker", GalaxyDatetimePicker],
    ["galaxy-date-picker", GalaxyDatePicker],
    ["galaxy-time-picker", GalaxyTimePicker],
    ["galaxy-datetime-range", GalaxyDatetimeRangePickerBase],
    ["galaxy-editable-table", GalaxyEditableTable],
    ["galaxy-sortable-list", GalaxySortableList],
];

const FORM_CALLBACK_NAMES = ["formResetCallback", "formDisabledCallback", "formStateRestoreCallback"];

for (let [tag_name, component_class] of FORM_ASSOCIATED_COMPONENTS) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Calls a form-associated callback the way the browser does: the function the element's class prototype holds, never one on the instance.
 * @param {HTMLElement} element
 * @param {string} callback_name
 * @param {...*} callback_arguments
 */
const call_as_browser = (element, callback_name, ...callback_arguments) => {
    let defined_class = customElements.get(element.localName);

    return defined_class.prototype[callback_name].call(element, ...callback_arguments);
};

const create_connected = async (tag_name, attributes = {}) => {
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);
    await flush();

    return element;
};

describe("form-associated callbacks are where the browser looks for them", () => {
    for (let [tag_name, component_class] of FORM_ASSOCIATED_COMPONENTS) {
        test(`${tag_name}: formResetCallback and formStateRestoreCallback are on the prototype`, () => {
            expect(component_class.formAssociated).toBe(true);
            expect(typeof component_class.prototype.formResetCallback).toBe("function");
            expect(typeof component_class.prototype.formStateRestoreCallback).toBe("function");
        });

        test(`${tag_name}: no instance field shadows a prototype callback`, () => {
            let element = document.createElement(tag_name);

            for (let callback_name of FORM_CALLBACK_NAMES) {
                expect(Object.hasOwn(element, callback_name)).toBe(false);
            }
        });
    }

    test("every input base subclass gets formDisabledCallback from the prototype", () => {
        expect(typeof GalaxyInputBase.prototype.formDisabledCallback).toBe("function");
    });

    test("subclass overrides replace the base callbacks on the prototype", () => {
        expect(GalaxyCheckbox.prototype.formResetCallback).not.toBe(GalaxyInputBase.prototype.formResetCallback);
        expect(GalaxyPasswordInput.prototype.formResetCallback).not.toBe(GalaxyInputBase.prototype.formResetCallback);
        expect(GalaxyPasswordInput.prototype.formStateRestoreCallback).not.toBe(GalaxyInputBase.prototype.formStateRestoreCallback);
    });
});

describe("the callbacks the browser finds do their job", () => {
    test("a form reset restores a text input's initial value", async () => {
        let text_input = await create_connected("galaxy-text-input", {"value": "initial"});

        text_input.value = "edited";
        call_as_browser(text_input, "formResetCallback");

        expect(text_input.value).toBe("initial");
    });

    test("a disabled fieldset disables a text input, and re-enabling it enables it", async () => {
        let text_input = await create_connected("galaxy-text-input");

        call_as_browser(text_input, "formDisabledCallback", true);
        expect(text_input.disabled).toBe(true);

        call_as_browser(text_input, "formDisabledCallback", false);
        expect(text_input.disabled).toBe(false);
    });

    test("restoring state sets a text input's value", async () => {
        let text_input = await create_connected("galaxy-text-input");

        call_as_browser(text_input, "formStateRestoreCallback", "restored");

        expect(text_input.value).toBe("restored");
    });

    test("a form reset restores a checkbox's initial checked state", async () => {
        let checkbox = await create_connected("galaxy-checkbox");

        checkbox.checked = true;
        call_as_browser(checkbox, "formResetCallback");

        expect(checkbox.checked).toBe(false);
    });

    test("a password is never restored from session history", async () => {
        let password_input = await create_connected("galaxy-password-input");

        call_as_browser(password_input, "formStateRestoreCallback", "hunter2");

        expect(password_input.value).toBe("");
    });
});
