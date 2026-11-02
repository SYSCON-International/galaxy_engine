/**
 * @file form_association.spec.mjs
 * @description
 *     B2 - Native form association: a galaxy-text-input inside a plain <form>, checked with the browser's own FormData and constraint validation.
 *     Nothing here is polyfilled; the jsdom suite can only check what a component passed to setFormValue, never what the browser submits.
 */

import { test, expect } from "@playwright/test";
import { annotate_finding, expect_clean_load, expect_native_element_internals, open_engine_page } from "./helpers.mjs";

/**
 * Puts a native form with the given markup on the engine page and waits for every Galaxy element in it to finish creating.
 * @param {import("@playwright/test").Page} page
 * @param {string} form_inner_html
 */
const mount_form = async (page, form_inner_html) => {
    await page.evaluate(async (inner_html) => {
        let form = document.createElement("form");
        form.id = "test_form";
        form.innerHTML = inner_html;
        document.querySelector("#test_root").append(form);

        let galaxy_elements = [...form.querySelectorAll("*")].filter((element) => element.localName.startsWith("galaxy-"));
        await Promise.all(galaxy_elements.map((element) => element.initialization_promise));
    }, form_inner_html);
};

/**
 * Reads the form's entries exactly as the browser would submit them.
 * @param {import("@playwright/test").Page} page
 * @return {Promise<string[][]>}
 */
const read_form_data = (page) => {
    return page.evaluate(() => [...new FormData(document.querySelector("#test_form")).entries()].map(([name, value]) => [name, String(value)]));
};

let reports;

test.beforeEach(async ({ page }) => {
    reports = await open_engine_page(page);
    await expect_native_element_internals(page);
});

test.afterEach(async () => {
    expect_clean_load(reports);
});

test("a named text input's value attribute is submitted", async ({ page }) => {
    await mount_form(page, `<galaxy-text-input name="title" value="hello"></galaxy-text-input>`);

    expect(await read_form_data(page)).toEqual([["title", "hello"]]);
});

test("a value set from code, and a renamed field, are what FormData sees", async ({ page }) => {
    await mount_form(page, `<galaxy-text-input name="title" value="hello"></galaxy-text-input>`);

    await page.evaluate(() => {
        let input = document.querySelector("galaxy-text-input");
        input.value = "set from code";
        input.name = "heading";
    });

    expect(await read_form_data(page)).toEqual([["heading", "set from code"]]);
});

test("typing in the field is what FormData sees", async ({ page }) => {
    await mount_form(page, `<galaxy-text-input name="title"></galaxy-text-input>`);

    // A real key-by-key user entry into the shadow-root field, located through the open shadow root.
    await page.locator("galaxy-text-input input").pressSequentially("typed");

    expect(await read_form_data(page)).toEqual([["title", "typed"]]);
});

test("a field without a name is not submitted", async ({ page }) => {
    await mount_form(page, `<galaxy-text-input value="orphan"></galaxy-text-input>`);

    expect(await read_form_data(page)).toEqual([]);
});

test("a disabled field is excluded from FormData", async ({ page }) => {
    await mount_form(page, `
        <galaxy-text-input name="kept" value="a"></galaxy-text-input>
        <galaxy-text-input name="excluded" value="b" disabled></galaxy-text-input>
    `);

    expect(await read_form_data(page)).toEqual([["kept", "a"]]);

    let is_matched_by_disabled = await page.evaluate(() => document.querySelector("galaxy-text-input[disabled]").matches(":disabled"));
    expect(is_matched_by_disabled).toBe(true);
});

test("a field in a disabled fieldset is excluded, and returns when the fieldset is re-enabled", async ({ page }) => {
    await mount_form(page, `
        <fieldset disabled>
            <galaxy-text-input name="in_fieldset" value="c"></galaxy-text-input>
        </fieldset>
    `);

    expect(await read_form_data(page)).toEqual([]);

    let inner_field_state = await page.evaluate(() => {
        let input = document.querySelector("galaxy-text-input");
        let disabled_by_fieldset = input.shadowRoot.querySelector("input").disabled;

        document.querySelector("fieldset").disabled = false;

        return {disabled_by_fieldset, enabled_again: !input.shadowRoot.querySelector("input").disabled};
    });

    expect(inner_field_state).toEqual({disabled_by_fieldset: true, enabled_again: true});
    expect(await read_form_data(page)).toEqual([["in_fieldset", "c"]]);
});

test("form.reset() restores the field's initial value", async ({ page }) => {
    await mount_form(page, `<galaxy-text-input name="title" value="initial"></galaxy-text-input>`);

    await page.evaluate(() => {
        document.querySelector("galaxy-text-input").value = "changed";
        document.querySelector("#test_form").reset();
    });

    expect(await read_form_data(page)).toEqual([["title", "initial"]]);
});

test("a required field is invalid once the component validates it", async ({ page }) => {
    await mount_form(page, `<galaxy-text-input name="needed" required></galaxy-text-input>`);

    let validity = await page.evaluate(() => {
        let input = document.querySelector("galaxy-text-input");
        let form = document.querySelector("#test_form");
        let component_result = input.validate();

        return {
            component_result,
            form_check_validity: form.checkValidity(),
            matches_invalid: input.matches(":invalid"),
        };
    });

    expect(validity).toEqual({component_result: false, form_check_validity: false, matches_invalid: true});
});

test("a required, empty field makes a plain form invalid before anything validates it", async ({ page }) => {
    annotate_finding(test.info(), "T03A-F2", "ElementInternals validity is set only when validate() runs (submit through galaxy-form, or instant-validation); "
        + "in a plain <form> an empty required field reports valid, unlike a native required <input>");
    // Documented expected failure: the assertion below is native <input required> behavior, which the owner has accepted as the contract (validity
    // accurate immediately; only the visual error presentation may stay deferred). It fails on 0.0.15 in every engine. When the defect is fixed this
    // test passes, Playwright reports the unexpected pass as a failure, and the fail() marker is removed in the same change.
    test.fail(true, "T03A-F2: correctness defect in 0.0.15 (owner decision recorded in Task 0.3A.1)");

    await mount_form(page, `<galaxy-text-input name="needed" required></galaxy-text-input>`);

    let form_check_validity = await page.evaluate(() => document.querySelector("#test_form").checkValidity());

    expect(form_check_validity).toBe(false);
});
