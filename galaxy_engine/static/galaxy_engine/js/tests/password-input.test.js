import { describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyPasswordInput } from "../components/GalaxyPasswordInput.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-password-input", GalaxyPasswordInput], ["galaxy-form", GalaxyForm]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Creates and connects a <galaxy-password-input>, setting attributes before connecting, and waits for its create lifecycle.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
const create_password_input = async (attributes = {}) => {
    let element = document.createElement("galaxy-password-input");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

const get_field = (password_input) => password_input.shadowRoot.querySelector("input");
const get_toggle = (password_input) => password_input.shadowRoot.querySelector(".visibility-toggle");
const get_caps_lock_warning = (password_input) => password_input.shadowRoot.querySelector(".caps-lock-warning");

/**
 * Simulates the user typing into the field.
 * @param {HTMLElement} password_input - The password input.
 * @param {string} text - The full text after typing.
 */
const type_into = (password_input, text) => {
    let field = get_field(password_input);

    field.value = text;
    field.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
};

/**
 * Dispatches a key event on the field reporting the given Caps Lock state.
 * @param {HTMLElement} password_input - The password input.
 * @param {string} type - "keydown" or "keyup".
 * @param {boolean} is_caps_lock_on - The Caps Lock state the event reports.
 */
const press_key_with_caps_lock = (password_input, type, is_caps_lock_on) => {
    let key_event = new window.KeyboardEvent(type, {key: "a", bubbles: true});

    Object.defineProperty(key_event, "getModifierState", {value: (modifier) => modifier === "CapsLock" && is_caps_lock_on});
    get_field(password_input).dispatchEvent(key_event);
};

describe("field", () => {
    test("is a masked field with current-password autocomplete and no spellcheck", async () => {
        let password_input = await create_password_input();

        expect(get_field(password_input).type).toBe("password");
        expect(get_field(password_input).getAttribute("autocomplete")).toBe("current-password");
        expect(get_field(password_input).getAttribute("spellcheck")).toBe("false");
    });

    test("autocomplete is forwarded, and changing it updates the field", async () => {
        let password_input = await create_password_input({autocomplete: "new-password"});

        expect(get_field(password_input).getAttribute("autocomplete")).toBe("new-password");

        password_input.autocomplete = null;
        await flush();

        expect(get_field(password_input).getAttribute("autocomplete")).toBe("current-password");
    });

    test("label, required, and validation are inherited from the text input", async () => {
        let password_input = await create_password_input({label: "Password", required: ""});

        expect(password_input.shadowRoot.querySelector("label").textContent).toBe("Password");
        expect(password_input.validate()).toBe(false);

        type_into(password_input, "hunter2");

        expect(password_input.validate()).toBe(true);
    });
});

describe("show/hide toggle", () => {
    test("toggles between masked and plain text, with label and pressed state", async () => {
        let password_input = await create_password_input();
        let toggle = get_toggle(password_input);

        toggle.click();

        expect(get_field(password_input).type).toBe("text");
        expect(password_input.is_password_visible).toBe(true);
        expect(toggle.getAttribute("aria-pressed")).toBe("true");
        expect(toggle.getAttribute("aria-label")).toBe("Hide password");

        toggle.click();

        expect(get_field(password_input).type).toBe("password");
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(toggle.getAttribute("aria-label")).toBe("Show password");
    });

    test("pressing it with the mouse does not take focus from the field, and keeps the caret", async () => {
        let password_input = await create_password_input();
        let field = get_field(password_input);

        type_into(password_input, "hunter2");
        field.focus();
        field.setSelectionRange(3, 3);

        let mousedown_event = new window.MouseEvent("mousedown", {bubbles: true, cancelable: true});

        get_toggle(password_input).dispatchEvent(mousedown_event);
        get_toggle(password_input).click();

        expect(mousedown_event.defaultPrevented).toBe(true);
        expect(field.selectionStart).toBe(3);
    });

    test("hide-visibility-toggle removes the toggle and masks a shown password", async () => {
        let password_input = await create_password_input();

        password_input.show_password();
        password_input.hide_visibility_toggle = true;
        await flush();

        expect(get_toggle(password_input).hidden).toBe(true);
        expect(get_field(password_input).type).toBe("password");
    });

    test("the toggle is disabled with the field", async () => {
        let password_input = await create_password_input({disabled: ""});

        expect(get_toggle(password_input).disabled).toBe(true);

        password_input.disabled = false;
        await flush();

        expect(get_toggle(password_input).disabled).toBe(false);
    });

    test("a form reset masks the password again and restores the initial value", async () => {
        let password_input = await create_password_input();

        type_into(password_input, "hunter2");
        password_input.show_password();
        password_input.formResetCallback();

        expect(get_field(password_input).type).toBe("password");
        expect(password_input.value).toBe("");
    });
});

describe("Caps Lock warning", () => {
    test("shows while Caps Lock is on, hides when it goes off and on blur", async () => {
        let password_input = await create_password_input();

        expect(get_caps_lock_warning(password_input).hidden).toBe(true);

        press_key_with_caps_lock(password_input, "keydown", true);

        expect(get_caps_lock_warning(password_input).hidden).toBe(false);
        expect(get_caps_lock_warning(password_input).textContent).toBe("Caps Lock is on");

        press_key_with_caps_lock(password_input, "keyup", false);

        expect(get_caps_lock_warning(password_input).hidden).toBe(true);

        press_key_with_caps_lock(password_input, "keydown", true);
        get_field(password_input).dispatchEvent(new window.Event("blur"));

        expect(get_caps_lock_warning(password_input).hidden).toBe(true);
    });

    test("caps-lock-message replaces the text", async () => {
        let password_input = await create_password_input({"caps-lock-message": "Bloq Mayús activado"});

        expect(get_caps_lock_warning(password_input).textContent).toBe("Bloq Mayús activado");
    });
});

describe("keeping the password in the field", () => {
    test("a typed password is submitted, with no restore state", async () => {
        let password_input = await create_password_input({name: "password"});

        type_into(password_input, "hunter2");

        expect(password_input.value).toBe("hunter2");
        expect(password_input._internals._form_value).toBe("hunter2");
        expect(password_input._internals._form_state).toBe("");
    });

    test("a password set from code is submitted but never reflected to the value attribute", async () => {
        let password_input = await create_password_input({name: "password"});

        password_input.value = "hunter2";

        expect(get_field(password_input).value).toBe("hunter2");
        expect(password_input._internals._form_value).toBe("hunter2");
        expect(password_input.hasAttribute("value")).toBe(false);
        expect(password_input.outerHTML).not.toContain("hunter2");
    });

    test("a password set from code before the element is connected still reaches the field", async () => {
        let password_input = document.createElement("galaxy-password-input");

        password_input.value = "hunter2";
        document.body.appendChild(password_input);
        await flush();

        expect(get_field(password_input).value).toBe("hunter2");
    });

    test("property-name is ignored with a warning, so the state manager never sees the password", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
        let password_input = await create_password_input({"property-name": "password"});

        type_into(password_input, "hunter2");
        await flush();

        expect(warn_spy.mock.calls.some((call) => String(call[0]).includes("property-name is not supported"))).toBe(true);
        expect(window.galaxy_state_manager.has_property("password")).toBe(false);

        warn_spy.mockRestore();
    });

    test("restore state is ignored", async () => {
        let password_input = await create_password_input();

        password_input.formStateRestoreCallback("hunter2");

        expect(password_input.value).toBe("");
    });
});

describe("in a galaxy-form", () => {
    test("initializes and validates as a required field", async () => {
        document.body.innerHTML = "<galaxy-form><galaxy-password-input name='password' required></galaxy-password-input></galaxy-form>";
        await flush();
        await flush();

        let form = document.querySelector("galaxy-form");
        let password_input = form.shadowRoot.querySelector("galaxy-password-input");

        expect(password_input.is_initialized).toBe(true);
        expect(form.validate(false)).toBe(false);

        type_into(password_input, "hunter2");

        expect(form.validate(false)).toBe(true);
    });
});
