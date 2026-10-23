import { describe, expect, test, vi } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyHTMLComponentBase } from "../components/GalaxyHTMLComponentBase.js";
import { GalaxyPasswordInput } from "../components/GalaxyPasswordInput.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { create_picker } from "./datetime-test-helpers.js";
import { create_select, flush } from "./test-helpers.js";

/**
 * A component that only passes its template to its constructor, overriding no getter.
 */
class GalaxyTestConstructorTemplate extends GalaxyHTMLComponentBase {
    constructor() {
        super("<p class=\"from-constructor\">From the constructor</p>");
    }

    on_create = async () => {
        this.shadow.appendChild(await this.get_template());
    }
}

for (let [tag_name, component_class] of [
    ["galaxy-form", GalaxyForm],
    ["galaxy-text-input", GalaxyTextInput],
    ["galaxy-textarea", GalaxyTextarea],
    ["galaxy-password-input", GalaxyPasswordInput],
    ["galaxy-checkbox", GalaxyCheckbox],
    ["galaxy-test-constructor-template", GalaxyTestConstructorTemplate],
]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const create_form = async (markup) => {
    document.body.innerHTML = markup;

    await flush();
    await flush();

    return document.querySelector("galaxy-form");
};

describe("a field finds its form however it got there", () => {
    test("a field appended into a wrapper already inside the form takes the form as its parent_form", async () => {
        let form = await create_form("<galaxy-form><div class=\"row\"></div></galaxy-form>");
        let text_input = document.createElement("galaxy-text-input");

        form.shadowRoot.querySelector("form .row").appendChild(text_input);
        await flush();

        expect(text_input.parent_form).toBe(form);
        expect(text_input.is_initialized).toBe(true);
    });

    test("a required field added that way is validated by a form with instant-validation", async () => {
        let form = await create_form("<galaxy-form instant-validation><div class=\"row\"></div></galaxy-form>");
        let text_input = document.createElement("galaxy-text-input");

        text_input.setAttribute("required", "");
        form.shadowRoot.querySelector("form .row").appendChild(text_input);
        await flush();

        expect(text_input._internals.validity.valid).toBe(false);
    });

    test("a field moved out of its form no longer has a parent_form", async () => {
        let form = await create_form("<galaxy-form><galaxy-text-input></galaxy-text-input></galaxy-form>");
        let text_input = form.shadowRoot.querySelector("form galaxy-text-input");

        expect(text_input.parent_form).toBe(form);

        document.body.appendChild(text_input);
        await flush();

        expect(text_input.parent_form).toBe(null);
    });

    test("a field in a form nested in another belongs to the nested form", async () => {
        let outer_form = await create_form("<galaxy-form><galaxy-form class=\"inner\"><galaxy-text-input></galaxy-text-input></galaxy-form></galaxy-form>");
        let inner_form = outer_form.shadowRoot.querySelector("form galaxy-form.inner");

        await flush();

        let text_input = inner_form.shadowRoot.querySelector("form galaxy-text-input");

        expect(inner_form.parent_form).toBe(outer_form);
        expect(text_input.parent_form).toBe(inner_form);
    });
});

describe("a template passed to the constructor is used", () => {
    test("a component that only passes its template to super() renders it", async () => {
        let component = document.createElement("galaxy-test-constructor-template");

        document.body.appendChild(component);
        await flush();

        expect(component.shadowRoot.querySelector(".from-constructor")).not.toBeNull();
    });

    test("a component_html getter still wins over the constructor's template", async () => {
        let text_input = document.createElement("galaxy-text-input");

        document.body.appendChild(text_input);
        await flush();

        expect(text_input.shadowRoot.querySelector(".galaxy-input-container")).not.toBeNull();
    });
});

describe("inputs are block-level elements", () => {
    const host_is_block = (element) => {
        let style_text = Array.from(element.shadowRoot.querySelectorAll("style")).map((style) => style.textContent).join("\n");

        return /:host\s*\{\s*display:\s*block;\s*\}/.test(style_text);
    };

    test("text input, textarea, password input and checkbox", async () => {
        for (let tag_name of ["galaxy-text-input", "galaxy-textarea", "galaxy-password-input", "galaxy-checkbox"]) {
            let element = document.createElement(tag_name);

            document.body.appendChild(element);
            await flush();

            expect(host_is_block(element), tag_name).toBe(true);
        }
    });

    test("select and date picker", async () => {
        let select = await create_select("select");
        let date_picker = await create_picker("date");

        expect(host_is_block(select)).toBe(true);
        expect(host_is_block(date_picker)).toBe(true);
    });
});

describe("a field appended straight into an initialized galaxy-form", () => {
    test("is moved into the form, created once, and validated with it", async () => {
        let form = await create_form("<galaxy-form><div class=\"row\"></div></galaxy-form>");
        let text_input = document.createElement("galaxy-text-input");
        let pre_on_create_spy = vi.spyOn(text_input, "pre_on_create");

        text_input.setAttribute("required", "");
        form.appendChild(text_input);
        await flush();
        await flush();

        expect(text_input.parentElement).toBe(form.form_element);
        expect(text_input.parent_form).toBe(form);
        expect(text_input.is_initialized).toBe(true);
        expect(pre_on_create_spy).toHaveBeenCalledTimes(1);
        expect(form.validate(false)).toBe(false);
    });

    test("a wrapper appended that way is moved in with its fields", async () => {
        let form = await create_form("<galaxy-form></galaxy-form>");
        let wrapper = document.createElement("div");

        wrapper.innerHTML = "<galaxy-text-input required></galaxy-text-input>";
        form.appendChild(wrapper);
        await flush();
        await flush();

        expect(wrapper.parentElement).toBe(form.form_element);
        expect(form.validate(false)).toBe(false);
    });
});
