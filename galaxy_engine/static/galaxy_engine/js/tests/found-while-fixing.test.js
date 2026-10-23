import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { create_nav, flush } from "./nav-test-helpers.js";

if (!customElements.get("galaxy-text-input")) {
    customElements.define("galaxy-text-input", GalaxyTextInput);
}

// Read as text: importing GalaxyEngine.js would self-instantiate a full engine as a side effect (see setup.js).
const ENGINE_SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../GalaxyEngine.js"), "utf8");

// The light theme, the navbar's default.
const LIGHT_THEME = {
    "nav-bg": "#ffffff",
    "nav-text": "#000000",
    "nav-border": "#bfbfbf",
    "link-bg": "#f3f4f6",
    "link-text": "#000000",
    "link-hover-bg": "#3b82f6",
    "link-hover-text": "#e0e7ff",
};

describe("the navbar's CSS variables have real fallbacks", () => {
    for (let kind of ["navbar", "sidebar"]) {
        test(`${kind}: no fallback names a missing --default-* variable, and each falls back to the light theme`, async () => {
            let nav = await create_nav(kind);
            let component_css = nav.component_css;

            expect(component_css).not.toContain("--default-");

            for (let match of component_css.matchAll(/var\(--(nav-bg|nav-text|nav-border|link-bg|link-text|link-hover-bg|link-hover-text),\s*([^)]+)\)/g)) {
                expect(match[2].trim(), `--${match[1]}`).toBe(LIGHT_THEME[match[1]]);
            }
        });
    }
});

describe("the input field backgrounds come from the palette", () => {
    test("engine_css declares them", () => {
        expect(ENGINE_SOURCE).toMatch(/--input-background:\s*#ffffff;/);
        expect(ENGINE_SOURCE).toMatch(/--input-readonly-background:\s*#e9ecef;/);
    });

    test("the input base uses them, with no literal field background left", async () => {
        let text_input = document.createElement("galaxy-text-input");

        document.body.appendChild(text_input);
        await flush();

        let input_css = text_input.pre_component_css;

        expect(input_css).toContain("background-color: var(--input-background, #ffffff);");
        expect(input_css).toContain("background-color: var(--input-readonly-background, #e9ecef) !important;");
        expect(input_css).not.toMatch(/background-color:\s*#(fff|ffffff|e9ecef)\b/);
    });
});
