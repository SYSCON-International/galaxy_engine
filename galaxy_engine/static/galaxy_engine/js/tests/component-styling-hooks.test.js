import { describe, expect, test } from "vitest";
import { GalaxyButton } from "../components/GalaxyButton.js";
import { GalaxyHTMLComponentBase } from "../components/GalaxyHTMLComponentBase.js";
import { GalaxyInputBase } from "../components/GalaxyInputBase.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { create_select, flush, SIMPLE_OPTIONS } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-text-input", GalaxyTextInput], ["galaxy-textarea", GalaxyTextarea], ["galaxy-button", GalaxyButton]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const create_connected = async (tag_name) => {
    let element = document.createElement(tag_name);

    document.body.appendChild(element);
    await flush();

    return element;
};

/**
 * Every rule an element's shadow root has adopted, as text.
 * @param {HTMLElement} element
 * @return {string}
 */
const get_adopted_css = (element) => {
    return element.shadowRoot.adoptedStyleSheets.flatMap((stylesheet) => Array.from(stylesheet.cssRules).map((rule) => rule.cssText)).join("\n");
};

describe("inner elements carry part names, for ::part() from a page stylesheet", () => {
    test("an input's field and label", async () => {
        let text_input = await create_connected("galaxy-text-input");

        expect(text_input.shadowRoot.querySelector("[part~=\"input\"]")).toBe(text_input.input_element);
        expect(text_input.shadowRoot.querySelector("label[part~=\"label\"]")).not.toBeNull();
    });

    test("a textarea's field", async () => {
        let textarea = await create_connected("galaxy-textarea");

        expect(textarea.shadowRoot.querySelector("[part~=\"input\"]")).toBe(textarea.input_element);
    });

    test("a button's inner button", async () => {
        let galaxy_button = await create_connected("galaxy-button");

        expect(galaxy_button.shadowRoot.querySelector("button[part~=\"button\"]")).not.toBeNull();
    });

    test("a select's list and its option rows", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        select.open = true;
        await flush();

        expect(select.scroll_container.getAttribute("part")).toBe("list");
        expect(select.options_layer.children.length).toBeGreaterThan(0);

        for (let option_element of select.options_layer.children) {
            expect(option_element.getAttribute("part")).toBe("option");
        }
    });
});

describe("add_css reaches every instance of a component class", () => {
    test("CSS added before an instance exists reaches it", async () => {
        GalaxyTextInput.add_css(".marker-added-before { color: red; }");

        let text_input = await create_connected("galaxy-text-input");

        expect(get_adopted_css(text_input)).toContain(".marker-added-before");
    });

    test("CSS added after instances exist reaches them too", async () => {
        let first_text_input = await create_connected("galaxy-text-input");
        let second_text_input = await create_connected("galaxy-text-input");

        GalaxyTextInput.add_css(".marker-added-after { color: blue; }");

        expect(get_adopted_css(first_text_input)).toContain(".marker-added-after");
        expect(get_adopted_css(second_text_input)).toContain(".marker-added-after");
    });

    test("CSS added to a base class reaches its subclasses, and not its siblings", async () => {
        GalaxyInputBase.add_css(".marker-input-base { color: green; }");

        let text_input = await create_connected("galaxy-text-input");
        let textarea = await create_connected("galaxy-textarea");
        let galaxy_button = await create_connected("galaxy-button");

        expect(get_adopted_css(text_input)).toContain(".marker-input-base");
        expect(get_adopted_css(textarea)).toContain(".marker-input-base");
        expect(get_adopted_css(galaxy_button)).not.toContain(".marker-input-base");
    });

    test("one class's CSS does not reach another class", async () => {
        GalaxyButton.add_css(".marker-button-only { color: purple; }");

        let text_input = await create_connected("galaxy-text-input");
        let galaxy_button = await create_connected("galaxy-button");

        expect(get_adopted_css(galaxy_button)).toContain(".marker-button-only");
        expect(get_adopted_css(text_input)).not.toContain(".marker-button-only");
    });

    test("CSS added to GalaxyHTMLComponentBase reaches every component, base sheets before subclass sheets", async () => {
        GalaxyHTMLComponentBase.add_css(".marker-every-component { color: orange; }");
        GalaxyTextInput.add_css(".marker-text-input-last { color: black; }");

        let text_input = await create_connected("galaxy-text-input");
        let galaxy_button = await create_connected("galaxy-button");

        expect(get_adopted_css(galaxy_button)).toContain(".marker-every-component");

        let adopted_css = get_adopted_css(text_input);

        expect(adopted_css.indexOf(".marker-every-component")).toBeLessThan(adopted_css.indexOf(".marker-text-input-last"));
    });
});
