import { describe, expect, test } from "vitest";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyNotification } from "../components/GalaxyNotification.js";
import { GalaxyTextarea } from "../components/GalaxyTextarea.js";
import { create_modal } from "./modal-test-helpers.js";
import { create_range_picker } from "./datetime-test-helpers.js";
import { create_select, flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-textarea", GalaxyTextarea], ["galaxy-duration-input", GalaxyDurationInput], ["galaxy-notification", GalaxyNotification]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const create_connected = async (tag_name) => {
    let element = document.createElement(tag_name);

    document.body.appendChild(element);
    await flush();
    await flush();

    return element;
};

const get_style_text = (element) => Array.from(element.shadowRoot.querySelectorAll("style")).map((style) => style.textContent).join("\n");

/**
 * The declarations of the first CSS block that follows a selector, as text.
 * @param {string} css
 * @param {string} selector_text - Text that ends just before the block's opening brace.
 * @return {string}
 */
const get_block_after = (css, selector_text) => {
    let selector_index = css.indexOf(selector_text);

    expect(selector_index, selector_text).toBeGreaterThan(-1);

    let block_start = css.indexOf("{", selector_index);
    let depth = 0;

    for (let index = block_start; index < css.length; index++) {
        if (css[index] === "{") {
            depth++;
        }
        else if (css[index] === "}") {
            depth--;

            if (depth === 0) {
                return css.slice(block_start, index + 1);
            }
        }
    }

    return "";
};

describe("every inner control uses the page font and shows a focus ring", () => {
    test("the range picker's select", async () => {
        let block = get_block_after(get_style_text(await create_range_picker()), "> select");

        expect(block).toMatch(/font-family:\s*inherit;/);
        expect(block).toMatch(/&:focus\s*\{[^}]*border-color:\s*var\(--blue\)/);
    });

    test("the notification's close and action buttons", async () => {
        let style_text = get_style_text(await create_connected("galaxy-notification"));

        for (let selector_text of [".close-btn", ".action-btn"]) {
            let block = get_block_after(style_text, selector_text);

            expect(block, selector_text).toMatch(/font-family:\s*inherit;/);
            expect(block, selector_text).toMatch(/&:focus-visible\s*\{\s*outline:\s*2px solid var\(--blue\)/);
        }
    });

    test("the select's search-clear button", async () => {
        let block = get_block_after(get_style_text(await create_select("select")), "/* Clear button */");

        expect(block).toMatch(/font-family:\s*inherit;/);
        expect(block).toMatch(/&:focus-visible\s*\{\s*outline:\s*2px solid var\(--blue\)/);
    });

    test("the modal's close button", async () => {
        let modal = await create_modal();
        let block = get_block_after(get_style_text(modal), "h3 {\n                                margin-bottom: 0;");
        let close_button_block = get_block_after(get_style_text(modal).slice(get_style_text(modal).indexOf(block) + block.length), "button");

        expect(close_button_block).toMatch(/font-family:\s*inherit;/);
        expect(close_button_block).toMatch(/&:focus-visible\s*\{\s*outline:\s*2px solid var\(--blue\)/);
    });
});

describe("every field background comes from the palette", () => {
    test("the textarea, normal and readonly", async () => {
        let style_text = (await create_connected("galaxy-textarea")).component_css;

        expect(style_text).toContain("background-color: var(--input-background, #ffffff);");
        expect(style_text).toContain("background-color: var(--input-readonly-background, #e9ecef);");
        expect(style_text).not.toMatch(/background-color:\s*#(fff|ffffff|e9ecef);/);
    });

    test("the duration input's fields", async () => {
        let style_text = (await create_connected("galaxy-duration-input")).component_css;

        expect(style_text).toContain("background-color: var(--input-background, #ffffff);");
        expect(style_text).not.toMatch(/background-color:\s*#(fff|ffffff);/);
    });

    test("the range picker's select", async () => {
        let style_text = (await create_range_picker()).component_css;

        expect(style_text).toContain("background-color: var(--input-background, #ffffff);");
        expect(style_text).not.toMatch(/background-color:\s*#(fff|ffffff);/);
    });
});
