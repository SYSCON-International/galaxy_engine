import { afterEach, describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-textarea", GalaxyTextarea], ["galaxy-form", GalaxyForm]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Creates and connects a <galaxy-textarea>, setting attributes before connecting, and waits for its create lifecycle.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
const create_textarea = async (attributes = {}) => {
    let element = document.createElement("galaxy-textarea");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

const get_field = (textarea) => {
    return textarea.shadowRoot.querySelector("textarea");
};

/**
 * Simulates the user typing into the textarea.
 * @param {HTMLElement} textarea - The Galaxy textarea.
 * @param {string} text - The full text after typing.
 */
const type_into = (textarea, text) => {
    let field = get_field(textarea);

    field.value = text;
    field.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
};

/**
 * Makes the field report a scroll height, since jsdom does no layout.
 * @param {HTMLTextAreaElement} field - The inner textarea.
 * @param {function(): number} get_scroll_height - Returns the height its content needs.
 */
const stub_scroll_height = (field, get_scroll_height) => {
    Object.defineProperty(field, "scrollHeight", {configurable: true, get: get_scroll_height});
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("rendering and attributes", () => {
    test("renders a textarea with 3 rows by default, and applies rows", async () => {
        let default_textarea = await create_textarea();
        let tall_textarea = await create_textarea({rows: "6"});

        expect(get_field(default_textarea).tagName).toBe("TEXTAREA");
        expect(get_field(default_textarea).rows).toBe(3);
        expect(get_field(tall_textarea).rows).toBe(6);

        tall_textarea.rows = 2;
        await flush();

        expect(get_field(tall_textarea).rows).toBe(2);
    });

    test("an invalid rows value falls back to 3", async () => {
        let textarea = await create_textarea({rows: "zero"});

        expect(textarea.rows).toBe(3);
        expect(get_field(textarea).rows).toBe(3);
    });

    test("maxlength is applied to the field, and removing it lifts the limit", async () => {
        let textarea = await create_textarea({maxlength: "500"});

        expect(get_field(textarea).maxLength).toBe(500);

        textarea.maxlength = null;
        await flush();

        expect(get_field(textarea).hasAttribute("maxlength")).toBe(false);
        expect(textarea.maxlength).toBe(null);
    });

    test("label, placeholder, readonly, and disabled reach the field", async () => {
        let textarea = await create_textarea({label: "Comments", placeholder: "Add a comment", readonly: "", disabled: ""});

        expect(textarea.shadowRoot.querySelector("label").textContent).toBe("Comments");
        expect(get_field(textarea).placeholder).toBe("Add a comment");
        expect(get_field(textarea).hasAttribute("readonly")).toBe(true);
        expect(get_field(textarea).disabled).toBe(true);
    });
});

describe("value", () => {
    test("typing sets the value and form value, keeping line breaks", async () => {
        let textarea = await create_textarea({name: "comments"});

        type_into(textarea, "Mold change at 10:00\nCheck the gate");

        expect(textarea._internals._form_value).toBe("Mold change at 10:00\nCheck the gate");
    });

    test("a value attribute fills the field", async () => {
        let textarea = await create_textarea({value: "SAMPLE-001\nSAMPLE-002"});

        expect(get_field(textarea).value).toBe("SAMPLE-001\nSAMPLE-002");
        expect(textarea.value).toBe("SAMPLE-001\nSAMPLE-002");
    });

    test("property-name binds it two-way", async () => {
        let textarea = await create_textarea({"property-name": "comments"});

        type_into(textarea, "From the user");

        expect(window.galaxy_state_manager.data.comments).toBe("From the user");

        window.galaxy_state_manager.data.comments = "From code";
        await flush();

        expect(get_field(textarea).value).toBe("From code");
    });
});

describe("validation", () => {
    test("required is invalid while empty", async () => {
        let textarea = await create_textarea({required: ""});

        expect(textarea.validate()).toBe(false);

        textarea.value = "Something";
        await flush();

        expect(textarea.validate()).toBe(true);
    });

    test("a value longer than maxlength, set from code, is invalid with a message, even when not required", async () => {
        let textarea = await create_textarea({maxlength: "5"});

        textarea.value = "Too long";
        await flush();

        expect(textarea.validate()).toBe(false);
        expect(textarea._internals.validationMessage).toBe("Please enter no more than 5 characters.");

        textarea.value = "Short";
        await flush();

        expect(textarea.validate()).toBe(true);
    });

    test("inside a galaxy-form with instant validation, typing revalidates", async () => {
        document.body.innerHTML = "<galaxy-form instant-validation><galaxy-textarea name='comments' required></galaxy-textarea></galaxy-form>";
        await flush();
        await flush();

        let textarea = document.querySelector("galaxy-form").shadowRoot.querySelector("galaxy-textarea");

        expect(textarea._internals.checkValidity()).toBe(false);

        type_into(textarea, "Filled in");

        expect(textarea._internals.checkValidity()).toBe(true);
    });
});

describe("auto-grow", () => {
    test("fits the height to the content on create, on typing, and on a value set from code", async () => {
        let content_height = 76;
        let textarea = await create_textarea({"auto-grow": ""});

        stub_scroll_height(get_field(textarea), () => content_height);
        textarea.update_auto_grow_height();

        expect(get_field(textarea).style.height).toBe("76px");

        content_height = 152;
        type_into(textarea, "line 1\nline 2\nline 3\nline 4\nline 5\nline 6");

        expect(get_field(textarea).style.height).toBe("152px");

        content_height = 100;
        textarea.value = "shorter";
        await flush();

        expect(get_field(textarea).style.height).toBe("100px");
    });

    test("without auto-grow the height is left to rows, and turning it off clears a fitted height", async () => {
        let textarea = await create_textarea();

        stub_scroll_height(get_field(textarea), () => 200);
        type_into(textarea, "a\nb\nc\nd\ne\nf\ng");

        expect(get_field(textarea).style.height).toBe("");

        textarea.auto_grow = true;
        await flush();

        expect(get_field(textarea).style.height).toBe("200px");

        textarea.auto_grow = false;
        await flush();

        expect(get_field(textarea).style.height).toBe("");
    });

    test("refits when the width changes, but not when only its own height changes", async () => {
        let observer_callback = null;
        let observer_instance = null;

        vi.stubGlobal("ResizeObserver", class {
            constructor(callback) {
                observer_callback = callback;
                observer_instance = this;
                this.observe = vi.fn();
                this.disconnect = vi.fn();
            }
        });

        let textarea = await create_textarea({"auto-grow": ""});
        let refit_spy = vi.spyOn(textarea, "update_auto_grow_height");

        observer_callback([{contentRect: {width: 300}}]);
        observer_callback([{contentRect: {width: 300}}]);
        observer_callback([{contentRect: {width: 200}}]);

        expect(refit_spy).toHaveBeenCalledTimes(2);

        textarea.remove();
        await flush();

        expect(observer_instance.disconnect).toHaveBeenCalled();
    });
});
