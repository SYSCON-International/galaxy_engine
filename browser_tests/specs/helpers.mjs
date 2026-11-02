/**
 * @file helpers.mjs
 * @description
 *     Shared helpers for the browser smoke tests: opening a page with every error the browser reports collected, confirming the browser's own
 *     ElementInternals is in use, and labeling a test with the finding it records.
 */

import { expect } from "@playwright/test";

/**
 * Every tag the published 0.0.15 GalaxyComponentsLoader registers - the contract the engine test checks against. Written out rather than read
 * from the source, so a tag that disappears from the loader fails the test instead of silently shrinking the list.
 * @type {string[]}
 */
export const EXPECTED_TAG_NAMES = [
    "galaxy-form",
    "galaxy-text-input",
    "galaxy-integer-input",
    "galaxy-float-input",
    "galaxy-select",
    "galaxy-multi-select",
    "galaxy-modal",
    "galaxy-button",
    "galaxy-navbar",
    "galaxy-sidebar",
    "galaxy-datetime-picker",
    "galaxy-date-picker",
    "galaxy-time-picker",
    "galaxy-datetime-range",
    "galaxy-notification",
    "galaxy-loader",
    "galaxy-duration-input",
    "galaxy-duration-display",
    "galaxy-table",
    "galaxy-checkbox",
    "galaxy-textarea",
    "galaxy-password-input",
    "galaxy-collapse",
    "galaxy-editable-table",
    "galaxy-sortable-list",
    "galaxy-tooltip",
    "galaxy-pagination",
    "galaxy-combo-box",
    "galaxy-tab",
    "galaxy-tabs",
];

/**
 * Starts collecting everything the browser reports about a page - uncaught errors and rejections, console errors and warnings, failed requests,
 * and responses with an error status. Call before navigating.
 * @param {import("@playwright/test").Page} page
 * @return {{page_errors: string[], console_errors: string[], console_warnings: string[], failed_requests: string[], error_responses: string[], requested_urls: string[]}}
 */
export const collect_browser_reports = (page) => {
    let reports = {
        page_errors: [],
        console_errors: [],
        console_warnings: [],
        failed_requests: [],
        error_responses: [],
        requested_urls: [],
    };

    page.on("pageerror", (error) => {
        reports.page_errors.push(`${error.name}: ${error.message}`);
    });

    page.on("console", (message) => {
        if (message.type() === "error") {
            reports.console_errors.push(message.text());
        }
        else if (message.type() === "warning") {
            reports.console_warnings.push(message.text());
        }
    });

    page.on("request", (request) => {
        reports.requested_urls.push(request.url());
    });

    page.on("requestfailed", (request) => {
        reports.failed_requests.push(`${request.url()} (${request.failure()?.errorText})`);
    });

    page.on("response", (response) => {
        if (response.status() >= 400) {
            reports.error_responses.push(`${response.status()} ${response.url()}`);
        }
    });

    return reports;
};

/**
 * Opens the engine test page and waits for it to finish loading. A module script runs before the load event, so once `goto` resolves the engine
 * has either initialized or failed - no polling is needed.
 * @param {import("@playwright/test").Page} page
 * @return {Promise<ReturnType<typeof collect_browser_reports>>}
 */
export const open_engine_page = async (page) => {
    let reports = collect_browser_reports(page);

    await page.goto("/engine.html");

    return reports;
};

/**
 * Asserts the page loaded with nothing reported: no uncaught error, no console error, no failed or erroring request.
 * @param {ReturnType<typeof collect_browser_reports>} reports
 */
export const expect_clean_load = (reports) => {
    expect(reports.page_errors, "uncaught errors").toEqual([]);
    expect(reports.console_errors, "console errors").toEqual([]);
    expect(reports.failed_requests, "failed requests").toEqual([]);
    expect(reports.error_responses, "error responses").toEqual([]);
};

/**
 * Asserts the browser's own ElementInternals is in use - not the jsdom suite's recorder polyfill, which marks itself by storing `_form_value`.
 * @param {import("@playwright/test").Page} page
 */
export const expect_native_element_internals = async (page) => {
    let internals_report = await page.evaluate(() => {
        let probe = document.createElement("galaxy-text-input");
        probe.setAttribute("value", "probe");
        document.body.append(probe);

        let report = {
            set_form_value_is_native: ElementInternals.prototype.setFormValue.toString().includes("[native code]"),
            check_validity_is_native: ElementInternals.prototype.checkValidity.toString().includes("[native code]"),
            has_recorder_field: Boolean(probe._internals && "_form_value" in probe._internals),
        };

        probe.remove();

        return report;
    });

    expect(internals_report).toEqual({set_form_value_is_native: true, check_validity_is_native: true, has_recorder_field: false});
};

/**
 * Labels a test with the finding it records, so the report carries the id next to the result.
 * @param {import("@playwright/test").TestInfo} test_info
 * @param {string} finding_id - e.g. "R-09" or "T03A-1".
 * @param {string} description - What the finding is.
 */
export const annotate_finding = (test_info, finding_id, description) => {
    test_info.annotations.push({type: "finding", description: `${finding_id}: ${description}`});
};

/**
 * Records an observation in the test report without asserting it - for behavior being characterized rather than guaranteed.
 * @param {import("@playwright/test").TestInfo} test_info
 * @param {string} label
 * @param {*} observation - Anything JSON-serializable.
 */
export const record_observation = async (test_info, label, observation) => {
    test_info.annotations.push({type: "observation", description: `${label}: ${JSON.stringify(observation)}`});
    await test_info.attach(label, {body: JSON.stringify(observation, null, 4), contentType: "application/json"});
};
