import { describe, expect, test, vi } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyComboBox } from "../components/GalaxyComboBox.js";
import { GalaxyDurationDisplay } from "../components/GalaxyDurationDisplay.js";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyFloatInput } from "../components/GalaxyFloatInput.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxyLoader } from "../components/GalaxyLoader.js";
import { GalaxyNotification } from "../components/GalaxyNotification.js";
import { GalaxyPasswordInput } from "../components/GalaxyPasswordInput.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { click_button, create_button, flush_all } from "./button-test-helpers.js";
import { create_picker } from "./datetime-test-helpers.js";
import { create_select, flush, SIMPLE_OPTIONS } from "./test-helpers.js";

for (let [tag_name, component_class] of [
    ["galaxy-text-input", GalaxyTextInput],
    ["galaxy-integer-input", GalaxyIntegerInput],
    ["galaxy-float-input", GalaxyFloatInput],
    ["galaxy-textarea", GalaxyTextarea],
    ["galaxy-password-input", GalaxyPasswordInput],
    ["galaxy-combo-box", GalaxyComboBox],
    ["galaxy-checkbox", GalaxyCheckbox],
    ["galaxy-duration-input", GalaxyDurationInput],
    ["galaxy-duration-display", GalaxyDurationDisplay],
    ["galaxy-loader", GalaxyLoader],
    ["galaxy-notification", GalaxyNotification],
]) {
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
    await flush();

    return element;
};

/**
 * Moves an element into a new wrapper, as a sortable list, a portal or a re-render does, and waits for it to be created again.
 * @param {HTMLElement} element
 */
const move = async (element) => {
    let wrapper = document.createElement("div");

    document.body.appendChild(wrapper);
    wrapper.appendChild(element);
    await flush();
    await flush();
};

const type_into = (element, text) => {
    element.input_element.value = text;
    element.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));
};

describe("a moved component renders its markup once", () => {
    test("galaxy-button", async () => {
        let galaxy_button = await create_button();

        await move(galaxy_button);
        await flush_all();

        expect(galaxy_button.shadowRoot.querySelectorAll("button")).toHaveLength(1);
    });

    test("galaxy-loader", async () => {
        let loader = await create_connected("galaxy-loader");

        await move(loader);

        expect(loader.shadowRoot.querySelectorAll(".galaxy-loader-backdrop")).toHaveLength(1);
    });

    test("galaxy-notification", async () => {
        let notification = await create_connected("galaxy-notification");

        await move(notification);

        expect(notification.shadowRoot.querySelectorAll(".galaxy-notification")).toHaveLength(1);
    });

    test("galaxy-duration-display", async () => {
        let display = await create_connected("galaxy-duration-display", {value: "90"});

        await move(display);

        expect(display.shadowRoot.querySelectorAll(".duration-display")).toHaveLength(1);
    });
});

describe("a moved button keeps its confirmation callbacks", () => {
    test("the confirm callback still runs after the button is moved", async () => {
        let galaxy_button = await create_button({"has-confirm": ""});
        let confirm_callback = vi.fn();

        galaxy_button.confirm_callback = confirm_callback;

        await move(galaxy_button);
        await flush_all();

        click_button(galaxy_button);
        await flush_all();
        click_button(galaxy_button.confirm_modal.ok_button);

        expect(confirm_callback).toHaveBeenCalledTimes(1);
    });
});

describe("a moved input keeps what the user typed", () => {
    for (let [tag_name, initial_value, typed_value] of [
        ["galaxy-text-input", "orig", "typed"],
        ["galaxy-integer-input", "5", "7"],
        ["galaxy-float-input", "1.5", "2.5"],
        ["galaxy-textarea", "orig", "typed"],
        ["galaxy-combo-box", "orig", "typed"],
    ]) {
        test(`${tag_name}`, async () => {
            let element = await create_connected(tag_name, {name: "field", value: initial_value});

            type_into(element, typed_value);
            await move(element);

            expect(element.value).toBe(typed_value);
            expect(element.input_element.value).toBe(typed_value);
            expect(element._internals._form_value).toBe(typed_value);
        });
    }

    test("galaxy-password-input", async () => {
        let password_input = await create_connected("galaxy-password-input", {name: "password"});

        type_into(password_input, "hunter2");
        await move(password_input);

        expect(password_input.value).toBe("hunter2");
        expect(password_input.input_element.value).toBe("hunter2");
    });

    test("a form reset after a move still restores the value from the markup", async () => {
        let text_input = await create_connected("galaxy-text-input", {value: "orig"});

        type_into(text_input, "typed");
        await move(text_input);
        text_input.formResetCallback();
        await flush();

        expect(text_input.value).toBe("orig");
    });

    test("galaxy-checkbox", async () => {
        let checkbox = await create_connected("galaxy-checkbox");

        checkbox.input_element.click();
        await move(checkbox);

        expect(checkbox.checked).toBe(true);
        expect(checkbox.input_element.checked).toBe(true);
    });

    test("galaxy-select", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), value: "apple"});

        select.value = "banana";
        await flush();
        await move(select);

        expect(select.value).toEqual(["banana"]);
        expect(select.input_element.value).toBe("Banana");
    });

    test("galaxy-date-picker", async () => {
        let date_picker = await create_picker("date", {value: "2024-01-15"});

        date_picker.input_element.value = date_picker.format_for_display("2024-02-20");
        date_picker.input_element.dispatchEvent(new Event("change", {bubbles: true}));
        await move(date_picker);

        expect(date_picker.value).toBe("2024-02-20");
        expect(date_picker.input_element.value).toBe(date_picker.format_for_display("2024-02-20"));
    });

    test("galaxy-duration-input", async () => {
        let duration_input = await create_connected("galaxy-duration-input", {value: "60"});
        let minutes_field = duration_input.field_inputs.minutes;

        minutes_field.value = "5";
        minutes_field.dispatchEvent(new Event("input", {bubbles: true}));
        await move(duration_input);

        expect(duration_input.value).toBe(300);
        expect(duration_input.field_inputs.minutes.value).toBe("05");
    });
});
