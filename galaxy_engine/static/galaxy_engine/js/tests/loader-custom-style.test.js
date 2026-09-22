import { describe, expect, test } from "vitest";
import { create_loader } from "./loader-test-helpers.js";

describe("custom_style replaces rather than accumulates (fix #1)", () => {
    test("setting custom_style twice keeps exactly one adopted stylesheet, with the latest content", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; }";
        expect(loader.shadowRoot.adoptedStyleSheets).toHaveLength(1);
        expect(loader.shadowRoot.adoptedStyleSheets[0].cssRules[0].cssText).toContain("color: red");

        loader.custom_style = ".message { color: blue; }";

        // The bug this guards against: a second assignment pushing a second stylesheet, leaving the old
        // (red) one still adopted underneath the new (blue) one.
        expect(loader.shadowRoot.adoptedStyleSheets).toHaveLength(1);
        expect(loader.shadowRoot.adoptedStyleSheets[0].cssRules[0].cssText).toContain("color: blue");
        expect(loader.shadowRoot.adoptedStyleSheets[0].cssRules[0].cssText).not.toContain("color: red");
    });

    test("a property only the first custom_style set doesn't bleed through after a second, unrelated one", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; font-weight: bold; }";
        loader.custom_style = ".message { color: blue; }"; // doesn't mention font-weight at all

        let css_text = loader.shadowRoot.adoptedStyleSheets[0].cssRules[0].cssText;
        expect(css_text).not.toContain("font-weight");
    });

    test("setting custom_style to a falsy value clears the previously-applied custom CSS", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; }";
        expect(loader.shadowRoot.adoptedStyleSheets).toHaveLength(1);

        loader.custom_style = null;

        expect(loader.shadowRoot.adoptedStyleSheets).toHaveLength(0);
        expect(loader.custom_style).toBeNull();
    });

    test("the custom_style getter reflects the most recently applied CSS", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; }";
        expect(loader.custom_style).toBe(".message { color: red; }");

        loader.custom_style = ".message { color: blue; }";
        expect(loader.custom_style).toBe(".message { color: blue; }");
    });
});
