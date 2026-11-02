/**
 * @file styling.spec.mjs
 * @description
 *     B5 - Styling in a real browser, which the jsdom suite cannot check at all (jsdom does not parse the components' nested CSS). Uses
 *     galaxy-text-input: its field styles are written with native CSS nesting and read the engine palette through custom properties.
 */

import { test, expect } from "@playwright/test";
import { expect_clean_load, open_engine_page } from "./helpers.mjs";

let reports;

test.beforeEach(async ({ page }) => {
    reports = await open_engine_page(page);
});

test.afterEach(async () => {
    expect_clean_load(reports);
});

/**
 * Mounts text inputs and waits for them to finish creating.
 * @param {import("@playwright/test").Page} page
 * @param {string} inner_html
 */
const mount = async (page, inner_html) => {
    await page.evaluate(async (html) => {
        let root = document.querySelector("#test_root");
        root.innerHTML = html;
        await Promise.all([...root.querySelectorAll("galaxy-text-input")].map((element) => element.initialization_promise));
    }, inner_html);
};

test("the component's nested shadow CSS is applied by the browser", async ({ page }) => {
    await mount(page, `<galaxy-text-input id="styled"></galaxy-text-input>`);

    let field_style = await page.evaluate(() => {
        let style = getComputedStyle(document.querySelector("#styled").shadowRoot.querySelector("input"));

        return {
            display: style.display,
            border_top_left_radius: style.borderTopLeftRadius,
            padding_left: style.paddingLeft,
            border_top_color: style.borderTopColor,
            background_color: style.backgroundColor,
        };
    });

    // 0.25rem and 0.75rem at the default 16px root size; the border reads --lightgrey (#ced4da) and the background --input-background's #ffffff fallback.
    expect(field_style).toEqual({
        display: "block",
        border_top_left_radius: "4px",
        padding_left: "12px",
        border_top_color: "rgb(206, 212, 218)",
        background_color: "rgb(255, 255, 255)",
    });
});

test("page styles do not reach into the shadow root, and component styles do not leak out of it", async ({ page }) => {
    let plain_input_before = await page.evaluate(() => {
        let plain_input = document.createElement("input");
        plain_input.id = "plain_input";
        plain_input.className = "form-control";
        document.body.append(plain_input);

        return getComputedStyle(plain_input).paddingLeft;
    });

    await mount(page, `<galaxy-text-input id="isolated"></galaxy-text-input>`);

    let isolation = await page.evaluate(() => {
        let page_style = document.createElement("style");
        page_style.textContent = `input, .form-control { background-color: rgb(255, 0, 0); border-top-left-radius: 0px; }`;
        document.head.append(page_style);

        let shadow_field_style = getComputedStyle(document.querySelector("#isolated").shadowRoot.querySelector("input"));

        return {
            shadow_field_background: shadow_field_style.backgroundColor,
            shadow_field_radius: shadow_field_style.borderTopLeftRadius,
            plain_input_padding_left: getComputedStyle(document.querySelector("#plain_input")).paddingLeft,
            plain_input_background: getComputedStyle(document.querySelector("#plain_input")).backgroundColor,
        };
    });

    expect(isolation).toEqual({
        // In: the page's input rule does not reach the shadow-root field, which shares the class name.
        shadow_field_background: "rgb(255, 255, 255)",
        shadow_field_radius: "4px",
        // Out: the component's input rule does not reach a page input with the same class, which keeps the browser default.
        plain_input_padding_left: plain_input_before,
        // Control: the page rule does apply in the page.
        plain_input_background: "rgb(255, 0, 0)",
    });
});

test("the documented --input-background custom property restyles one instance from the page", async ({ page }) => {
    await mount(page, `
        <style>#themed { --input-background: rgb(1, 2, 3); }</style>
        <galaxy-text-input id="themed"></galaxy-text-input>
        <galaxy-text-input id="default"></galaxy-text-input>
    `);

    let backgrounds = await page.evaluate(() => {
        let read_background = (id) => getComputedStyle(document.querySelector(`#${id}`).shadowRoot.querySelector("input")).backgroundColor;

        return {themed: read_background("themed"), default: read_background("default")};
    });

    expect(backgrounds).toEqual({themed: "rgb(1, 2, 3)", default: "rgb(255, 255, 255)"});
});

test("a palette variable redeclared by the page overrides the engine default", async ({ page }) => {
    // The engine's palette sits first in <head> so a page's later :root declaration wins - the mechanism a consuming app's theme override uses.
    await mount(page, `
        <style>:root { --lightgrey: rgb(10, 20, 30); }</style>
        <galaxy-text-input id="palette"></galaxy-text-input>
    `);

    let border_color = await page.evaluate(() => getComputedStyle(document.querySelector("#palette").shadowRoot.querySelector("input")).borderTopColor);

    expect(border_color).toBe("rgb(10, 20, 30)");
});
