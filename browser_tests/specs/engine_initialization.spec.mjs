/**
 * @file engine_initialization.spec.mjs
 * @description
 *     B1 - Engine initialization: the real GalaxyEngine.js entry registers the 30 published tags and the engine globals, with nothing reported,
 *     and the browser does report an initialization failure when one happens.
 */

import { test, expect } from "@playwright/test";
import {
    EXPECTED_TAG_NAMES, annotate_finding, collect_browser_reports, expect_clean_load, expect_native_element_internals, open_engine_page, record_observation
} from "./helpers.mjs";

test("the entry module registers exactly the 30 published tags", async ({ page }) => {
    let reports = await open_engine_page(page);

    let registration = await page.evaluate((expected_tag_names) => {
        return {
            missing: expected_tag_names.filter((tag_name) => !customElements.get(tag_name)),
            form_associated: expected_tag_names.filter((tag_name) => customElements.get(tag_name)?.formAssociated === true),
        };
    }, EXPECTED_TAG_NAMES);

    expect(EXPECTED_TAG_NAMES).toHaveLength(30);
    expect(registration.missing).toEqual([]);
    // Task 0.2 counted 16 form-associated tags in jsdom; the browser must agree.
    expect(registration.form_associated).toHaveLength(16);
    expect_clean_load(reports);
    await record_observation(test.info(), "console warnings during load", reports.console_warnings);
});

test("the engine globals exist and the engine's stylesheets come before the page's own <head> content", async ({ page }) => {
    let reports = await open_engine_page(page);

    let globals = await page.evaluate(() => {
        return {
            engine: window.galaxy_engine?.constructor?.name,
            notifications: window.galaxy_engine?.notifications?.constructor?.name,
            loaders: window.galaxy_engine?.loaders?.constructor?.name,
            state_manager: window.galaxy_state_manager?.constructor?.name,
            utils: window.galaxy_utils?.constructor?.name,
        };
    });

    // The engine places its palette, and GalaxyUtils.add_default_css its other defaults, at the start of <head>, so a consuming page's stylesheets come later
    // and win the cascade. What is guaranteed is that order, not which engine style is first.
    let head_order = await page.evaluate(() => {
        let head_children = [...document.head.children];
        let palette_index = head_children.findIndex((element) => element.localName === "style" && element.textContent.includes("--col-12"));
        let first_page_element_index = head_children.findIndex((element) => element.localName === "meta");

        return {
            palette_index,
            first_page_element_index,
            leading_styles: head_children.slice(0, first_page_element_index).map((element) => element.id || "(palette, no id)"),
        };
    });

    expect(globals).toEqual({
        engine: "GalaxyEngine",
        notifications: "GalaxyNotificationManager",
        loaders: "GalaxyLoaderManager",
        state_manager: "GalaxyStateManager",
        utils: "GalaxyUtils",
    });
    expect(head_order.palette_index).toBeGreaterThanOrEqual(0);
    expect(head_order.palette_index).toBeLessThan(head_order.first_page_element_index);
    await record_observation(test.info(), "engine styles ahead of the page's head content", head_order.leading_styles);
    expect_clean_load(reports);
});

test("the page uses the browser's own ElementInternals, never the jsdom recorder polyfill", async ({ page }) => {
    await open_engine_page(page);
    await expect_native_element_internals(page);
});

test("a second copy of the engine at another URL is reported by the browser", async ({ page }) => {
    annotate_finding(test.info(), "R-05", "loading the entry twice re-runs customElements.define, which throws partway through initialization; there is no guard");
    annotate_finding(test.info(), "T03A-F1", "before it throws, the second copy replaces window.galaxy_state_manager and adds a second palette <style>");

    let reports = await open_engine_page(page);

    let outcome = await page.evaluate(async () => {
        let state_manager_before = window.galaxy_state_manager;
        let engine_before = window.galaxy_engine;

        // The way a page would load it twice: a second script tag whose URL differs only by a query string, as a cache-busting suffix does.
        let script = document.createElement("script");
        script.type = "module";
        script.src = "/static/galaxy_engine/js/GalaxyEngine.js?second_copy";

        await new Promise((resolve) => {
            script.addEventListener("load", resolve, {once: true});
            script.addEventListener("error", resolve, {once: true});
            document.head.append(script);
        });

        return {
            engine_global_replaced: window.galaxy_engine !== engine_before,
            state_manager_global_replaced: window.galaxy_state_manager !== state_manager_before,
            engine_style_elements: [...document.head.querySelectorAll("style")].filter((style) => style.textContent.includes("--col-12")).length,
        };
    });

    // The supported guarantee: the failure is not silent.
    expect(reports.page_errors.length, "the browser reports the failed second initialization").toBeGreaterThan(0);
    await record_observation(test.info(), "second engine load", {...outcome, page_errors: reports.page_errors});
});

test("a component whose creation fails is reported by the browser as an unhandled rejection", async ({ page }) => {
    annotate_finding(test.info(), "R-07(c)", "a lifecycle error surfaces only as an unhandled rejection; the engine itself reports nothing naming the component");

    let reports = await open_engine_page(page);

    let outcome = await page.evaluate(async () => {
        let { GalaxyHTMLComponentBase } = await import("/static/galaxy_engine/js/components/GalaxyHTMLComponentBase.js");

        class FailingTestComponent extends GalaxyHTMLComponentBase {
            on_create = async () => {
                throw new Error("deliberate on_create failure (Task 0.3A)");
            };
        }

        customElements.define("test-failing-component", FailingTestComponent);

        let rejection_reasons = [];
        let on_unhandled_rejection = (event) => {
            rejection_reasons.push(String(event.reason?.message ?? event.reason));
        };

        window.addEventListener("unhandledrejection", on_unhandled_rejection);

        let element = document.createElement("test-failing-component");
        element.id = "failing_component";
        document.body.append(element);

        // An unhandled rejection is reported after the microtask queue drains; two macrotasks is ample for every engine.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        window.removeEventListener("unhandledrejection", on_unhandled_rejection);

        return {rejection_reasons, is_initialized: element.is_initialized};
    });

    expect(outcome.rejection_reasons).toEqual(["deliberate on_create failure (Task 0.3A)"]);
    expect(outcome.is_initialized).toBe(false);
    await record_observation(test.info(), "creation failure reporting", {
        engine_console_errors: reports.console_errors,
        page_errors: reports.page_errors,
    });
});

test("a blank page without the engine registers no Galaxy tags", async ({ page }) => {
    let reports = collect_browser_reports(page);

    await page.goto("/blank.html");

    let registered_count = await page.evaluate((expected_tag_names) => {
        return expected_tag_names.filter((tag_name) => customElements.get(tag_name)).length;
    }, EXPECTED_TAG_NAMES);

    // Guards the other tests: the tags they see come from loading the entry, not from anything the harness injects.
    expect(registered_count).toBe(0);
    expect_clean_load(reports);
});
