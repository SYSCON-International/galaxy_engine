import { describe, expect, test } from "vitest";
import { create_loader } from "./loader-test-helpers.js";

/**
 * The stylesheets a loader has adopted besides the shared per-class ones every Galaxy component adopts (see GalaxyHTMLComponentBase.add_css) - that is, the ones
 * custom_style manages.
 * @param {HTMLElement} loader
 * @return {CSSStyleSheet[]}
 */
const get_custom_stylesheets = (loader) => {
    let class_stylesheets = loader.constructor.get_class_stylesheets();

    return loader.shadowRoot.adoptedStyleSheets.filter((stylesheet) => !class_stylesheets.includes(stylesheet));
};

describe("custom_style replaces rather than accumulates (fix #1)", () => {
    test("setting custom_style twice keeps exactly one adopted stylesheet, with the latest content", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; }";
        expect(get_custom_stylesheets(loader)).toHaveLength(1);
        expect(get_custom_stylesheets(loader)[0].cssRules[0].cssText).toContain("color: red");

        loader.custom_style = ".message { color: blue; }";

        // The bug this guards against: a second assignment pushing a second stylesheet, leaving the old
        // (red) one still adopted underneath the new (blue) one.
        expect(get_custom_stylesheets(loader)).toHaveLength(1);
        expect(get_custom_stylesheets(loader)[0].cssRules[0].cssText).toContain("color: blue");
        expect(get_custom_stylesheets(loader)[0].cssRules[0].cssText).not.toContain("color: red");
    });

    test("a property only the first custom_style set doesn't bleed through after a second, unrelated one", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; font-weight: bold; }";
        loader.custom_style = ".message { color: blue; }"; // doesn't mention font-weight at all

        let css_text = get_custom_stylesheets(loader)[0].cssRules[0].cssText;
        expect(css_text).not.toContain("font-weight");
    });

    test("setting custom_style to a falsy value clears the previously-applied custom CSS", async () => {
        let loader = await create_loader();

        loader.custom_style = ".message { color: red; }";
        expect(get_custom_stylesheets(loader)).toHaveLength(1);

        loader.custom_style = null;

        expect(get_custom_stylesheets(loader)).toHaveLength(0);
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
