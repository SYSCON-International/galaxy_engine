/**
 * @file attribute_updates.spec.mjs
 * @description
 *     B4 - Attribute update timing, characterized rather than prescribed. The base class's attributeChangedCallback is async: a handler in the
 *     `pre_attribute_changed_callback` tier starts synchronously, and one in `attribute_changed_callback` runs a microtask later. Each test records
 *     what is visible synchronously, after one microtask, and after a macrotask, for one component on each path.
 *
 *     What is asserted is only what must hold under any future timing decision (D-1): the change has fully applied after a macrotask. The
 *     synchronous and microtask observations are recorded in the report, not asserted, so this file never turns today's timing into a contract.
 */

import { test, expect } from "@playwright/test";
import { annotate_finding, expect_clean_load, open_engine_page, record_observation } from "./helpers.mjs";

let reports;

test.beforeEach(async ({ page }) => {
    reports = await open_engine_page(page);
});

test.afterEach(async () => {
    expect_clean_load(reports);
});

test("galaxy-text-input value (handled in the pre_attribute_changed_callback tier)", async ({ page }) => {
    let timeline = await page.evaluate(async () => {
        let form = document.createElement("form");
        let input = document.createElement("galaxy-text-input");
        input.setAttribute("name", "timed");
        input.setAttribute("value", "before");
        form.append(input);
        document.querySelector("#test_root").append(form);
        await input.initialization_promise;

        let snapshot = () => ({
            element_value: input.value,
            field_value: input.shadowRoot.querySelector("input").value,
            form_data_value: new FormData(form).get("timed"),
        });

        input.setAttribute("value", "after");
        let synchronous = snapshot();

        await Promise.resolve();
        let after_microtask = snapshot();

        await new Promise((resolve) => setTimeout(resolve, 0));
        let after_macrotask = snapshot();

        return {synchronous, after_microtask, after_macrotask};
    });

    await record_observation(test.info(), "text input value timeline", timeline);
    expect(timeline.after_macrotask).toEqual({element_value: "after", field_value: "after", form_data_value: "after"});
});

test("galaxy-collapse open (handled in the attribute_changed_callback tier)", async ({ page }) => {
    annotate_finding(test.info(), "R-07(a)", "attribute reactions in the attribute_changed_callback tier are applied a microtask after the change");

    let timeline = await page.evaluate(async () => {
        let collapse = document.createElement("galaxy-collapse");
        collapse.innerHTML = `<span slot="heading">Heading</span><p>Body</p>`;
        document.querySelector("#test_root").append(collapse);
        await collapse.initialization_promise;

        let toggle_events = [];
        collapse.addEventListener("toggle", (event) => toggle_events.push(event.detail.open));

        let snapshot = () => ({
            open_property: collapse.open,
            heading_aria_expanded: collapse.shadowRoot.querySelector(".heading").getAttribute("aria-expanded"),
            body_is_inert: collapse.shadowRoot.querySelector(".body").inert,
            toggle_events: [...toggle_events],
        });

        collapse.setAttribute("open", "");
        let synchronous = snapshot();

        await Promise.resolve();
        let after_microtask = snapshot();

        await new Promise((resolve) => setTimeout(resolve, 0));
        let after_macrotask = snapshot();

        return {synchronous, after_microtask, after_macrotask};
    });

    await record_observation(test.info(), "collapse open timeline", timeline);
    expect(timeline.after_macrotask).toEqual({open_property: true, heading_aria_expanded: "true", body_is_inert: false, toggle_events: [true]});
});
