import { describe, expect, test } from "vitest";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-text-input")) {
    customElements.define("galaxy-text-input", GalaxyTextInput);
}

// jsdom applies no styles and cannot match :host(), so the rule is checked as CSS text.
describe("A9.1: the input base's invalid styling matches the host", () => {
    test("the invalid rule is written as :host(:invalid), which a browser matches, not a nested &:invalid, which compiles to :host:invalid", async () => {
        let text_input = document.createElement("galaxy-text-input");

        document.body.appendChild(text_input);
        await flush();

        let style_text = [...text_input.shadowRoot.querySelectorAll("style")].map((style) => style.textContent).join("\n");

        expect(style_text).not.toMatch(/&:invalid/);
        expect(style_text).toMatch(/:host\(:invalid\)\s*\{\s*input:not\(\[type="checkbox"\]\),\s*select\s*\{\s*border-color:\s*var\(--red\)/);
    });

    test("the invalid rule comes after the focus rule, so an invalid field keeps its red border while focused", async () => {
        let text_input = document.createElement("galaxy-text-input");

        document.body.appendChild(text_input);
        await flush();

        let input_css = text_input.pre_component_css;

        expect(input_css.indexOf(":host(:invalid)")).toBeGreaterThan(input_css.indexOf(":focus"));
    });
});
