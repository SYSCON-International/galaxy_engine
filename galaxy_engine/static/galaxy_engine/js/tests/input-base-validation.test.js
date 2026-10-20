import { describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-form", GalaxyForm], ["galaxy-text-input", GalaxyTextInput], ["galaxy-integer-input", GalaxyIntegerInput]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Creates and connects an input, setting attributes before connecting, and waits for its create lifecycle.
 * @param {string} tag_name - The input's tag.
 * @param {Object<string, string>} attributes - Attribute name/value pairs.
 * @return {Promise<HTMLElement>}
 */
const create_input = async (tag_name, attributes = {}) => {
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

/**
 * Simulates the user typing into an input.
 * @param {HTMLElement} input - The Galaxy input.
 * @param {string} text - The full text after typing.
 */
const type_into = (input, text) => {
    let field = input.shadowRoot.querySelector("input");

    field.value = text;
    field.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
};

describe("validate() on optional and disabled inputs", () => {
    test("an empty optional input is valid, and returns true rather than undefined", async () => {
        let text_input = await create_input("galaxy-text-input");

        expect(text_input.validate()).toBe(true);
    });

    test("a form with an optional field validates and dispatches submit", async () => {
        document.body.innerHTML = "<galaxy-form><galaxy-text-input name='optional_field'></galaxy-text-input><galaxy-text-input name='required_field' required value='filled'></galaxy-text-input></galaxy-form>";
        await flush();
        await flush();

        let form = document.querySelector("galaxy-form");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        form.form_element.dispatchEvent(new window.Event("submit", {cancelable: true}));

        expect(form.validate(false)).toBe(true);
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("a disabled required input is valid", async () => {
        let text_input = await create_input("galaxy-text-input", {required: "", disabled: ""});

        expect(text_input.validate()).toBe(true);
    });

    test("a required field is not shown invalid on load without instant validation, and is checked on validate()", async () => {
        let text_input = await create_input("galaxy-text-input", {required: ""});

        expect(text_input._internals.checkValidity()).toBe(true);
        expect(text_input.validate()).toBe(false);
        expect(text_input._internals.validationMessage).toBe("Please enter a value.");
    });

    test("removing required clears a stale required error", async () => {
        let text_input = await create_input("galaxy-text-input", {required: ""});

        text_input.validate();
        text_input.required = false;
        await flush();

        expect(text_input._internals.checkValidity()).toBe(true);
    });
});

describe("integer input values", () => {
    test("0 is a valid optional value", async () => {
        let integer_input = await create_input("galaxy-integer-input", {value: "0"});

        expect(integer_input.validate()).toBe(true);
    });

    test("text that is not a number reports one error, also when the field is optional", async () => {
        let integer_input = await create_input("galaxy-integer-input", {value: "abc"});

        expect(integer_input.validate()).toBe(false);
        expect(integer_input._internals.validationMessage).toBe("Please enter a valid integer value.");
    });

    test("a min of 0 is enforced, and a max of 0 too", async () => {
        let integer_input = await create_input("galaxy-integer-input", {min: "0", value: "-1"});

        expect(integer_input.validate()).toBe(false);
        expect(integer_input._internals.validationMessage).toBe("Please enter a value greater than or equal to 0.");

        integer_input.setAttribute("min", "");
        integer_input.setAttribute("max", "0");
        integer_input.value = "1";
        await flush();

        expect(integer_input.validate()).toBe(false);
        expect(integer_input._internals.validationMessage).toBe("Please enter a value less than or equal to 0.");
    });

    test("an empty required integer reports only the required error", async () => {
        let integer_input = await create_input("galaxy-integer-input", {required: ""});

        expect(integer_input.validate()).toBe(false);
        expect(integer_input._internals.validationMessage).toBe("Please enter a value.");
    });
});

describe("typing and readonly", () => {
    test("typing updates .value, so validation sees what was typed", async () => {
        let text_input = await create_input("galaxy-text-input", {required: ""});

        type_into(text_input, "Typed text");

        expect(text_input.value).toBe("Typed text");
        expect(text_input.validate()).toBe(true);
    });

    test("a bare readonly attribute makes the field readonly, and removing it clears it", async () => {
        let text_input = await create_input("galaxy-text-input", {readonly: ""});
        let field = text_input.shadowRoot.querySelector("input");

        expect(field.hasAttribute("readonly")).toBe(true);

        text_input.readonly = false;
        await flush();

        expect(field.hasAttribute("readonly")).toBe(false);
    });
});
