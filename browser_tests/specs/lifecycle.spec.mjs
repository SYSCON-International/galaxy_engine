/**
 * @file lifecycle.spec.mjs
 * @description
 *     B3 - Component lifecycle in a real browser: create and connect, disconnect and clean up, reconnect without duplicated shadow content. Uses
 *     galaxy-text-input, whose create lifecycle builds its shadow content and whose destroy lifecycle removes its field listeners.
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
 * Counts what one rendering of a text input puts in its shadow root.
 * @return {{fields: number, containers: number, labels: number}}
 */
const count_shadow_content = () => {
    let input = document.querySelector("galaxy-text-input");

    return {
        fields: input.shadowRoot.querySelectorAll("input").length,
        containers: input.shadowRoot.querySelectorAll(".galaxy-input-container").length,
        labels: input.shadowRoot.querySelectorAll("label").length,
    };
};

test("create, connect, disconnect, clean up and reconnect without duplicated content", async ({ page }) => {
    let created = await page.evaluate(async () => {
        let input = document.createElement("galaxy-text-input");
        input.id = "lifecycle_input";
        input.setAttribute("label", "Lifecycle");
        input.setAttribute("value", "first");
        document.querySelector("#test_root").append(input);

        await input.initialization_promise;

        let { GalaxyHTMLComponentBase } = await import("/static/galaxy_engine/js/components/GalaxyHTMLComponentBase.js");

        return {
            is_initialized: input.is_initialized,
            is_registered: GalaxyHTMLComponentBase.find_component("galaxy-text-input", "lifecycle_input") === input,
            field_value: input.shadowRoot.querySelector("input").value,
        };
    });

    expect(created).toEqual({is_initialized: true, is_registered: true, field_value: "first"});
    expect(await page.evaluate(count_shadow_content)).toEqual({fields: 1, containers: 1, labels: 1});

    let destroyed = await page.evaluate(async () => {
        let input = document.querySelector("galaxy-text-input");
        let field_before_removal = input.shadowRoot.querySelector("input");

        input.remove();
        await input.destruction_promise;

        let { GalaxyHTMLComponentBase } = await import("/static/galaxy_engine/js/components/GalaxyHTMLComponentBase.js");

        // Cleanup check: the destroy lifecycle removes the field's input listener, so input on the detached field no longer reaches the element.
        field_before_removal.value = "after removal";
        field_before_removal.dispatchEvent(new Event("input", {bubbles: true}));

        let result = {
            is_initialized: input.is_initialized,
            is_registered: GalaxyHTMLComponentBase.find_component("galaxy-text-input", "lifecycle_input") !== null,
            value_after_detached_input: input.value,
        };

        window.removed_input = input;

        return result;
    });

    expect(destroyed).toEqual({is_initialized: false, is_registered: false, value_after_detached_input: "first"});

    let reconnected = await page.evaluate(async () => {
        let input = window.removed_input;

        document.querySelector("#test_root").append(input);
        await input.initialization_promise;

        return {is_initialized: input.is_initialized, value: input.value, field_value: input.shadowRoot.querySelector("input").value};
    });

    expect(reconnected).toEqual({is_initialized: true, value: "first", field_value: "first"});
    expect(await page.evaluate(count_shadow_content)).toEqual({fields: 1, containers: 1, labels: 1});
});

test("a move within the document (disconnect and reconnect in one task) leaves one rendering", async ({ page }) => {
    let moved = await page.evaluate(async () => {
        let first_parent = document.createElement("div");
        let second_parent = document.createElement("div");
        document.querySelector("#test_root").append(first_parent, second_parent);

        let input = document.createElement("galaxy-text-input");
        input.setAttribute("value", "moved");
        first_parent.append(input);
        await input.initialization_promise;

        second_parent.append(input);
        await input.initialization_promise;

        // A user typing after the move must still reach the element: the rebuilt field has its listener.
        let field = input.shadowRoot.querySelector("input");
        field.value = "typed after move";
        field.dispatchEvent(new Event("input", {bubbles: true}));

        return {parent_is_second: input.parentElement === second_parent, is_initialized: input.is_initialized, value: input.value};
    });

    expect(moved).toEqual({parent_is_second: true, is_initialized: true, value: "typed after move"});
    expect(await page.evaluate(count_shadow_content)).toEqual({fields: 1, containers: 1, labels: 1});
});
