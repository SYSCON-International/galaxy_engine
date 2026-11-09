/**
 * @file choice_control_form_contract.spec.mjs
 * @description
 *     Task 0.3B-2 - the native form contract of the choice controls: galaxy-checkbox (plain, switch, tri-state), galaxy-select and galaxy-multi-select, checked in a
 *     plain <form> with the browser's own FormData, form.reset() and constraint validation, in Chromium, Firefox and WebKit. A native control is compared only where its
 *     semantics genuinely match: a checkbox's checked state and reset (not its serialization - Galaxy documents "true"/"false" where a native box submits nothing), a
 *     <select>'s selected values, and a <select multiple>'s repeated entries.
 */

import { test, expect } from "@playwright/test";
import { annotate_finding, expect_clean_load, expect_native_element_internals, open_engine_page, record_observation } from "./helpers.mjs";

const OPTIONS = JSON.stringify([{value: "a", text: "Alpha"}, {value: "b", text: "Beta"}, {value: "c", text: "Gamma"}]);

/**
 * The three components: markup with an initial selection and the entries it submits; a value to set from code and its entries; and, for the required test, markup
 * with nothing chosen and a value that satisfies `required`.
 * @type {{tag: string, markup: function(string): string, initial_entries: function(string): string[][], code_value: (boolean|string),
 *     code_entries: function(string): string[][], required_markup: string, required_value: (boolean|string)}[]}
 */
const CHOICE_CONTROLS = [
    {
        tag: "galaxy-checkbox",
        markup: (name) => `<galaxy-checkbox id="subject" name="${name}" checked></galaxy-checkbox>`,
        initial_entries: (name) => [[name, "true"]],
        code_value: false,
        code_entries: (name) => [[name, "false"]],
        required_markup: `<galaxy-checkbox id="subject" name="field" required></galaxy-checkbox>`,
        required_value: true,
    },
    {
        tag: "galaxy-select",
        markup: (name) => `<galaxy-select id="subject" name="${name}" options-data='${OPTIONS}' value="b"></galaxy-select>`,
        initial_entries: (name) => [[name, "b"]],
        code_value: "c",
        code_entries: (name) => [[name, "c"]],
        required_markup: `<galaxy-select id="subject" name="field" options-data='${OPTIONS}' required></galaxy-select>`,
        required_value: "a",
    },
    {
        tag: "galaxy-multi-select",
        markup: (name) => `<galaxy-multi-select id="subject" name="${name}" options-data='${OPTIONS}' value='["a","c"]'></galaxy-multi-select>`,
        initial_entries: (name) => [[name, "a"], [name, "c"]],
        code_value: `["b"]`,
        code_entries: (name) => [[name, "b"]],
        required_markup: `<galaxy-multi-select id="subject" name="field" options-data='${OPTIONS}' required></galaxy-multi-select>`,
        required_value: `["a"]`,
    },
];

let reports;

test.beforeEach(async ({ page }) => {
    reports = await open_engine_page(page);
    await expect_native_element_internals(page);
});

/**
 * The one page error this file tolerates: opening a galaxy-select dropdown makes every engine dispatch this ResizeObserver loop error on window (T03B2-F2), and
 * WebKit's driver alone reports it as a page error. It is matched exactly, recorded each time it is tolerated, and asserted on its own by the T03B2-F2 test below,
 * so nothing else is hidden.
 * @type {RegExp}
 */
const RESIZE_OBSERVER_LOOP_ERROR = /^(?:Error)?: ResizeObserver loop completed with undelivered notifications\.$/;

/**
 * The shared clean-load check, with only the exact T03B2-F2 message set aside - and recorded in the report when it was.
 * @param {ReturnType<typeof open_engine_page>} page_reports
 */
const expect_clean_load_except_resize_observer_loop = (page_reports) => {
    let tolerated = page_reports.page_errors.filter((message) => RESIZE_OBSERVER_LOOP_ERROR.test(message));

    if (tolerated.length > 0) {
        test.info().annotations.push({type: "tolerated", description: `T03B2-F2: ${tolerated.length} × "${tolerated[0]}"`});
    }

    expect_clean_load({...page_reports, page_errors: page_reports.page_errors.filter((message) => !RESIZE_OBSERVER_LOOP_ERROR.test(message))});
};

test.afterEach(async () => {
    expect_clean_load_except_resize_observer_loop(reports);
});

/**
 * Marks the rest of a test as a documented expected failure, once every action and precondition has run on a clean page, so the one assertion left can fail only for
 * the documented reason.
 * @param {string} reason - The finding id and description.
 */
const expect_failure_from_here = (reason) => {
    expect_clean_load_except_resize_observer_loop(reports);
    test.fail(true, reason);
};

/**
 * Puts markup in #test_root, guards every form's submit, and waits for every Galaxy element to finish creating.
 * @param {import("@playwright/test").Page} page
 * @param {string} inner_html
 */
const mount = async (page, inner_html) => {
    await page.evaluate(async (html) => {
        let root = document.querySelector("#test_root");
        root.innerHTML = html;
        window.submit_count = 0;

        for (let form of root.querySelectorAll("form")) {
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                window.submit_count += 1;
            });
        }

        await Promise.all([...root.querySelectorAll("*")].filter((element) => element.localName.startsWith("galaxy-")).map((element) => element.initialization_promise));
    }, inner_html);
};

/**
 * Reads a form's entries as the browser would submit them.
 * @param {import("@playwright/test").Page} page
 * @param {string} [form_selector]
 * @return {Promise<string[][]>}
 */
const read_form_data = (page, form_selector = "#test_form") => {
    return page.evaluate((selector) => [...new FormData(document.querySelector(selector)).entries()].map(([name, value]) => [name, String(value)]), form_selector);
};

/**
 * Runs code in the page, then waits for every Galaxy element matching a selector to finish (re)creating - for moves and re-appends.
 * @param {import("@playwright/test").Page} page
 * @param {string} selector
 */
const await_initialized = (page, selector) => {
    return page.evaluate((element_selector) => Promise.all([...document.querySelectorAll(element_selector)].map((element) => element.initialization_promise)), selector);
};

/**
 * Picks an option in a galaxy-select as a user does: a click on the field opens the dropdown, a click on the option's text picks it.
 * @param {import("@playwright/test").Page} page
 * @param {string} select_selector
 * @param {string} option_text
 */
const pick_option = async (page, select_selector, option_text) => {
    await page.locator(`${select_selector} input`).first().click();
    await page.locator(select_selector).getByText(option_text, {exact: true}).click();
};

for (let control of CHOICE_CONTROLS) {
    test.describe(control.tag, () => {
        test("A/C: form value follows the markup, code, name, disabled state, fieldset, reset, moves and reconnects", async ({ page }) => {
            await mount(page, `
                <form id="test_form">
                    <fieldset id="group"><div id="first_place">${control.markup("field")}</div></fieldset>
                    <div id="second_place"></div>
                </form>
                <form id="other_form"></form>
            `);

            await test.step("the initial selection is submitted", async () => {
                expect(await read_form_data(page)).toEqual(control.initial_entries("field"));
            });

            await test.step("a value set from code is submitted (synchronously for the selects; the checkbox's delay is R-07, tested on its own below)", async () => {
                let entries = await page.evaluate(async (code_value) => {
                    let read = () => [...new FormData(document.querySelector("#test_form")).entries()];

                    document.querySelector("#subject").value = code_value;
                    let synchronous = read();
                    await Promise.resolve();

                    return {synchronous, settled: read()};
                }, control.code_value);

                expect(entries.settled).toEqual(control.code_entries("field"));

                if (control.tag !== "galaxy-checkbox") {
                    expect(entries.synchronous).toEqual(control.code_entries("field"));
                }
            });

            await test.step("renaming renames every entry", async () => {
                await page.evaluate(() => {
                    document.querySelector("#subject").name = "renamed";
                });
                expect(await read_form_data(page)).toEqual(control.code_entries("renamed"));
            });

            await test.step("disabled, then a disabled fieldset, exclude it; re-enabling restores it", async () => {
                let states = await page.evaluate(() => {
                    let read = () => [...new FormData(document.querySelector("#test_form")).entries()];
                    let subject = document.querySelector("#subject");
                    let group = document.querySelector("#group");
                    let result = {};

                    subject.disabled = true;
                    result.disabled = read();
                    subject.disabled = false;
                    group.disabled = true;
                    result.in_disabled_fieldset = read();
                    result.matches_disabled = subject.matches(":disabled");
                    group.disabled = false;
                    result.enabled = read();

                    return result;
                });
                expect(states).toEqual({disabled: [], in_disabled_fieldset: [], matches_disabled: true, enabled: control.code_entries("renamed")});
            });

            await test.step("reset restores the initial selection", async () => {
                await page.evaluate(() => document.querySelector("#test_form").reset());
                expect(await read_form_data(page)).toEqual(control.initial_entries("renamed"));
            });

            await test.step("a move to another form makes that form submit it, and a re-append keeps the selection", async () => {
                await page.evaluate((code_value) => {
                    document.querySelector("#subject").value = code_value;
                    document.querySelector("#other_form").append(document.querySelector("#subject"));
                }, control.code_value);
                await await_initialized(page, "#subject");
                expect(await read_form_data(page)).toEqual([]);
                expect(await read_form_data(page, "#other_form")).toEqual(control.code_entries("renamed"));

                await page.evaluate(() => {
                    let subject = document.querySelector("#subject");
                    subject.remove();
                    document.querySelector("#other_form").append(subject);
                });
                await await_initialized(page, "#subject");
                expect(await read_form_data(page, "#other_form")).toEqual(control.code_entries("renamed"));
            });
        });

        test("B: required is enforced by validate(), and native validity follows it", async ({ page }) => {
            await mount(page, `<form id="test_form">${control.required_markup}</form>`);

            let validity = await page.evaluate((required_value) => {
                let subject = document.querySelector("#subject");
                let form = document.querySelector("#test_form");
                let empty = {result: subject.validate(), form_valid: form.checkValidity()};

                subject.value = required_value;
                let filled = {result: subject.validate(), form_valid: form.checkValidity()};

                return {empty, filled};
            }, control.required_value);

            expect(validity).toEqual({empty: {result: false, form_valid: false}, filled: {result: true, form_valid: true}});
        });
    });
}

test.describe("checkbox", () => {
    test("an unchecked box submits \"false\" (documented), where a native box submits nothing", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-checkbox id="untouched" name="untouched"></galaxy-checkbox>
                <galaxy-checkbox id="clicked" name="clicked" checked></galaxy-checkbox>
                <input id="native" type="checkbox" name="native" value="true" />
            </form>
        `);

        await page.locator("#clicked input").click();

        expect(await read_form_data(page)).toEqual([["untouched", "false"], ["clicked", "false"]]);
    });

    test("checked or value set from code is submitted synchronously", async ({ page }) => {
        annotate_finding(test.info(), "R-07", "the checked attribute is handled in the attribute_changed_callback tier, so the form value follows a microtask late; "
            + "new FormData(form) or requestSubmit() in the same task sees the old state");

        await mount(page, `<form id="test_form"><galaxy-checkbox id="by_checked" name="by_checked"></galaxy-checkbox><galaxy-checkbox id="by_value" name="by_value"></galaxy-checkbox></form>`);

        let observed = await page.evaluate(async () => {
            let read = () => [...new FormData(document.querySelector("#test_form")).entries()];

            document.querySelector("#by_checked").checked = true;
            document.querySelector("#by_value").value = true;
            let synchronous = read();
            await Promise.resolve();

            return {synchronous, settled: read()};
        });

        await record_observation(test.info(), "entries synchronously and after a microtask", observed);
        // Precondition: the change does arrive, a microtask later.
        expect(observed.settled).toEqual([["by_checked", "true"], ["by_value", "true"]]);

        expect_failure_from_here("R-07: defect in 0.0.15 (checkbox form value applied a microtask late)");
        expect(observed.synchronous).toEqual(observed.settled);
    });

    test("user clicks, and reset, match a native checkbox's checked state", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-checkbox id="subject" name="subject" checked></galaxy-checkbox>
                <input id="native" type="checkbox" name="native" value="true" checked />
            </form>
        `);

        let read_checked = () => page.evaluate(() => [document.querySelector("#subject").checked, document.querySelector("#native").checked]);

        await page.locator("#subject input").click();
        await page.locator("#native").click();
        expect(await read_checked()).toEqual([false, false]);
        expect(await read_form_data(page)).toEqual([["subject", "false"]]);

        await page.locator("#subject input").press("Space");
        await page.locator("#native").press("Space");
        expect(await read_checked()).toEqual([true, true]);

        await page.locator("#subject input").click();
        await page.locator("#native").click();
        await page.evaluate(() => document.querySelector("#test_form").reset());
        expect(await read_checked()).toEqual([true, true]);
        expect(await read_form_data(page)).toEqual([["subject", "true"], ["native", "true"]]);
    });

    test("readonly blocks click, keyboard and label toggling, and keeps submitting (documented)", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-checkbox id="subject" name="subject" label="Agree" checked readonly></galaxy-checkbox></form>`);

        await page.locator("#subject input").click();
        await page.locator("#subject input").press("Space");
        await page.locator("#subject label").click();

        expect(await page.evaluate(() => document.querySelector("#subject").checked)).toBe(true);
        expect(await read_form_data(page)).toEqual([["subject", "true"]]);
    });

    test("switch: the same form value, announced as a switch", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-checkbox id="subject" name="subject" switch></galaxy-checkbox></form>`);

        expect(await read_form_data(page)).toEqual([["subject", "false"]]);
        await page.locator("#subject input").click();
        expect(await read_form_data(page)).toEqual([["subject", "true"]]);
        expect(await page.locator("#subject input").getAttribute("role")).toBe("switch");
    });

    test("without tri-state, indeterminate is visual only and the next toggle clears it (documented)", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-checkbox id="subject" name="subject" checked indeterminate></galaxy-checkbox></form>`);

        expect(await read_form_data(page)).toEqual([["subject", "true"]]);
        await page.locator("#subject input").click();

        let state = await page.evaluate(() => ({indeterminate: document.querySelector("#subject").indeterminate, value: document.querySelector("#subject").value}));
        expect(state).toEqual({indeterminate: false, value: false});
        expect(await read_form_data(page)).toEqual([["subject", "false"]]);
    });

    test("tri-state: clicks cycle indeterminate (\"\") -> true -> false -> indeterminate; required rejects indeterminate; reset restores it (documented)", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-checkbox id="subject" name="subject" tri-state required value="null"></galaxy-checkbox></form>`);

        let submitted = [(await read_form_data(page))[0][1]];

        for (let click = 0; click < 3; click += 1) {
            await page.locator("#subject input").click();
            submitted.push((await read_form_data(page))[0][1]);
        }

        expect(submitted).toEqual(["", "true", "false", ""]);
        expect(await page.evaluate(() => document.querySelector("#subject").validate())).toBe(false);

        await page.locator("#subject input").click();
        await page.evaluate(() => document.querySelector("#test_form").reset());
        expect(await read_form_data(page)).toEqual([["subject", ""]]);
    });

    test("a reset after a move restores the state the box was created with", async ({ page }) => {
        annotate_finding(test.info(), "R-11", "on_create re-captures the reset default on every create, so a box moved in the DOM resets to its moved-time state");

        await mount(page, `
            <form id="test_form">
                <div id="first_place"><galaxy-checkbox id="subject" name="subject" checked></galaxy-checkbox></div>
                <div id="second_place"></div>
            </form>
        `);

        await page.locator("#subject input").click();
        await page.evaluate(() => document.querySelector("#second_place").append(document.querySelector("#subject")));
        await await_initialized(page, "#subject");
        // Precondition: the move kept the unchecked state.
        expect(await read_form_data(page)).toEqual([["subject", "false"]]);

        await page.evaluate(() => document.querySelector("#test_form").reset());
        let after_reset = await read_form_data(page);
        await record_observation(test.info(), "entries after reset following a move", after_reset);

        expect_failure_from_here("R-11: defect in 0.0.15 (checkbox moved then reset)");
        expect(after_reset).toEqual([["subject", "true"]]);
    });
});

test.describe("select and multi-select", () => {
    test("no selection submits nothing (documented), as a native <select multiple> does", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-select name="single" options-data='${OPTIONS}'></galaxy-select>
                <galaxy-multi-select name="multiple" options-data='${OPTIONS}'></galaxy-multi-select>
                <select name="native_multiple" multiple><option value="a">Alpha</option></select>
            </form>
            <form id="native_form"><select name="native_single"><option value="">Choose</option><option value="a">Alpha</option></select></form>
        `);

        expect(await read_form_data(page)).toEqual([]);
        // A native single select always has a selected option, so it differs here: recorded, not asserted against Galaxy.
        await record_observation(test.info(), "native single select with a placeholder option", await read_form_data(page, "#native_form"));
    });

    test("a user pick in a single select submits that option's value, as a native select does", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-select id="subject" name="choice" options-data='${OPTIONS}' value="b"></galaxy-select>
                <select id="native" name="native"><option value="a">Alpha</option><option value="b" selected>Beta</option><option value="c">Gamma</option></select>
            </form>
        `);

        await pick_option(page, "#subject", "Gamma");
        await page.locator("#native").selectOption("c");
        expect(await read_form_data(page)).toEqual([["choice", "c"], ["native", "c"]]);

        await page.evaluate(() => document.querySelector("#test_form").reset());
        expect(await read_form_data(page)).toEqual([["choice", "b"], ["native", "b"]]);
    });

    test("user toggles in a multi-select submit one entry per selected value, under the same name, and deselecting removes it", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-multi-select id="subject" name="tags" options-data='${OPTIONS}' value='["c"]'></galaxy-multi-select>
            </form>
        `);

        await page.locator("#subject").getByText("Alpha", {exact: true}).click();
        let after_adding = await read_form_data(page);

        await page.locator("#subject").getByText("Gamma", {exact: true}).click();
        let after_removing = await read_form_data(page);

        // The order of the two entries is characterized by the next test; here only the set of entries is checked.
        expect(after_adding.map(([, value]) => value).sort()).toEqual(["a", "c"]);
        expect(after_adding.every(([name]) => name === "tags")).toBe(true);
        expect(after_removing).toEqual([["tags", "a"]]);
    });

    test("multi-select entries come in the order the values were selected (existing 0.0.15 behavior), where a native <select multiple> uses option order", async ({ page }) => {
        // T03B2-F3 was reclassified in Task 0.4A as existing behavior, not a defect: this pins the 0.0.15 order so a later change to it is deliberate.
        await mount(page, `
            <form id="test_form">
                <galaxy-multi-select id="subject" name="tags" options-data='${OPTIONS}' value='["c"]'></galaxy-multi-select>
            </form>
            <form id="native_form">
                <select id="native" name="tags" multiple><option value="a">Alpha</option><option value="b">Beta</option><option value="c" selected>Gamma</option></select>
            </form>
        `);

        // Gamma (the last option) was selected first; Alpha (the first option) is selected now.
        await page.locator("#subject").getByText("Alpha", {exact: true}).click();
        await page.locator("#native").selectOption(["c", "a"]);
        let entries = {galaxy: await read_form_data(page), native: await read_form_data(page, "#native_form")};

        await record_observation(test.info(), "entry order after selecting Alpha with Gamma already selected", entries);
        expect(entries.native).toEqual([["tags", "a"], ["tags", "c"]]);
        expect(entries.galaxy).toEqual([["tags", "c"], ["tags", "a"]]);
    });

    test("options that no longer contain a selected value drop it from the submission (documented)", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-select id="single" name="single" options-data='${OPTIONS}' value="b"></galaxy-select>
                <galaxy-multi-select id="multiple" name="multiple" options-data='${OPTIONS}' value='["a","b"]'></galaxy-multi-select>
            </form>
        `);

        await page.evaluate(() => {
            let without_beta = JSON.stringify([{value: "a", text: "Alpha"}, {value: "c", text: "Gamma"}]);
            document.querySelector("#single").setAttribute("options-data", without_beta);
            document.querySelector("#multiple").setAttribute("options-data", without_beta);
        });
        // options-data is handled in the attribute_changed_callback tier, a microtask after the change.
        await page.evaluate(() => Promise.resolve());

        expect(await read_form_data(page)).toEqual([["multiple", "a"]]);
    });

    test("value formats from code: a JSON string, a number-like string, a value no option has, and an array: observed", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-select id="numeric" name="numeric" options-data='[{"value": 2, "text": "Two"}]'></galaxy-select>
                <galaxy-select id="unknown" name="unknown" options-data='${OPTIONS}'></galaxy-select>
                <galaxy-multi-select id="json" name="json" options-data='${OPTIONS}'></galaxy-multi-select>
                <galaxy-multi-select id="array" name="array" options-data='${OPTIONS}'></galaxy-multi-select>
            </form>
        `);

        let observed = await page.evaluate(() => {
            document.querySelector("#numeric").value = "2";
            document.querySelector("#unknown").value = "zzz";
            document.querySelector("#json").value = JSON.stringify(["a", "c"]);
            document.querySelector("#array").value = ["a", "c"];

            return {
                entries: [...new FormData(document.querySelector("#test_form")).entries()],
                values: ["numeric", "unknown", "json", "array"].map((id) => document.querySelector(`#${id}`).value),
            };
        });

        await record_observation(test.info(), "value formats from code", observed);
        // The documented forms: a JSON string of values, and a number-like string matching a numeric option.
        expect(observed.entries.filter(([name]) => name === "numeric" || name === "json")).toEqual([["numeric", "2"], ["json", "a"], ["json", "c"]]);
    });

    /**
     * The readonly attempts, one per control and input route. Each starts from a readonly control holding "a", performs a user's attempt to change it, and must leave
     * the submission at "a" - the documented contract ("the user cannot change it, but it is still submitted"). `breaks_contract` marks the routes 0.0.15 does not
     * block (T03B2-F1), which are expected failures; the others are supported behavior.
     * @type {{title: string, markup: string, breaks_contract: boolean, attempt: function(import("@playwright/test").Page): Promise<void>}[]}
     */
    const READONLY_ATTEMPTS = [
        {
            title: "galaxy-select, keyboard (ArrowDown, ArrowDown, Enter)",
            breaks_contract: true,
            markup: `<galaxy-select id="subject" name="field" options-data='${OPTIONS}' value="a" readonly></galaxy-select>`,
            attempt: async (page) => {
                let field = page.locator("#subject input").first();
                await field.focus();
                await field.press("ArrowDown");
                await field.press("ArrowDown");
                await field.press("Enter");
            },
        },
        {
            title: "galaxy-select, mouse (click the field, then an option)",
            breaks_contract: false,
            markup: `<galaxy-select id="subject" name="field" options-data='${OPTIONS}' value="a" readonly></galaxy-select>`,
            attempt: async (page) => {
                // A readonly field has pointer-events: none, so the user's click lands on what is under it; clicking the element itself is that click.
                await page.locator("#subject").click();
                let gamma_option = page.locator("#subject").getByText("Gamma", {exact: true});

                // Only a reachable option can be clicked; if readonly kept the list closed, the attempt ends here and the value stays, as it should.
                if (await gamma_option.isVisible()) {
                    await gamma_option.click();
                }
            },
        },
        {
            title: "galaxy-multi-select, mouse (click two options)",
            breaks_contract: true,
            markup: `<galaxy-multi-select id="subject" name="field" options-data='${OPTIONS}' value="a" readonly></galaxy-multi-select>`,
            attempt: async (page) => {
                await page.locator("#subject").getByText("Gamma", {exact: true}).click();
                await page.locator("#subject").getByText("Alpha", {exact: true}).click();
            },
        },
        {
            // An inline multi-select without search has no focusable field (R-10); with search-enabled its search field takes the keyboard.
            title: "galaxy-multi-select with search-enabled, keyboard (ArrowDown, Enter in the search field)",
            breaks_contract: true,
            markup: `<galaxy-multi-select id="subject" name="field" options-data='${OPTIONS}' value="a" search-enabled readonly></galaxy-multi-select>`,
            attempt: async (page) => {
                let field = page.locator("#subject input").first();
                await field.focus();
                await field.press("ArrowDown");
                await field.press("ArrowDown");
                await field.press("Enter");
            },
        },
    ];

    for (let { title, markup, breaks_contract, attempt } of READONLY_ATTEMPTS) {
        test(`readonly: ${title} leaves the submitted selection unchanged (documented)`, async ({ page }) => {
            if (breaks_contract) {
                annotate_finding(test.info(), "T03B2-F1", "readonly does not stop a user from changing a galaxy-select or galaxy-multi-select, and the changed value is submitted");
            }

            await mount(page, `<form id="test_form">${markup}</form>`);
            // Precondition: the control starts as a readonly field submitting "a".
            expect(await page.evaluate(() => document.querySelector("#subject").readonly)).toBe(true);
            expect(await read_form_data(page)).toEqual([["field", "a"]]);

            await attempt(page);
            let after_attempt = await read_form_data(page);
            await record_observation(test.info(), "entries after the user's attempt", after_attempt);

            if (breaks_contract) {
                expect_failure_from_here("T03B2-F1: High-severity defect in 0.0.15 (readonly select can be changed by the user)");
            }

            expect(after_attempt).toEqual([["field", "a"]]);
        });
    }

    test("opening a galaxy-select dispatches no error on window", async ({ page }) => {
        annotate_finding(test.info(), "T03B2-F2", "the list's ResizeObserver re-renders rows in the same frame it observes, so every engine dispatches "
            + "\"ResizeObserver loop completed with undelivered notifications\" on window; WebKit's driver also reports it as a page error");

        await mount(page, `<form id="test_form"><galaxy-select id="subject" name="field" options-data='${OPTIONS}' value="b"></galaxy-select></form>`);
        await page.evaluate(() => {
            window.window_error_messages = [];
            window.addEventListener("error", (event) => window.window_error_messages.push(event.message));
        });

        await page.locator("#subject input").first().click();
        // Two animation frames: ResizeObserver notifications are delivered during rendering, after the click.
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

        let observed = await page.evaluate(() => ({open: document.querySelector("#subject").open, window_errors: window.window_error_messages}));
        await record_observation(test.info(), "window error events after opening the dropdown", observed);
        // Precondition: the dropdown really opened.
        expect(observed.open).toBe(true);

        expect_failure_from_here("T03B2-F2: defect in 0.0.15 (ResizeObserver loop error on opening a select)");
        expect(observed.window_errors).toEqual([]);
    });
});

test.describe("constraint validity is current without validate() (T03A-F2)", () => {
    test("a required, empty choice control makes the plain form invalid before anything validates it", async ({ page }) => {
        annotate_finding(test.info(), "T03A-F2", "ElementInternals validity changes only inside validate(); the same base-class path as the text family");

        await mount(page, `
            <form id="test_form">
                <galaxy-checkbox name="box" required></galaxy-checkbox>
                <galaxy-checkbox name="mixed" tri-state value="null" required></galaxy-checkbox>
                <galaxy-select name="single" options-data='${OPTIONS}' required></galaxy-select>
                <galaxy-multi-select name="multiple" options-data='${OPTIONS}' required></galaxy-multi-select>
                <input type="checkbox" name="native_box" required />
            </form>
        `);

        let observed = await page.evaluate(() => {
            let form = document.querySelector("#test_form");
            let validity_by_name = {};

            for (let element of form.querySelectorAll("[name]")) {
                validity_by_name[element.getAttribute("name")] = element.matches(":invalid") ? "invalid" : "valid";
            }

            document.querySelector("[name=native_box]").remove();

            return {validity_by_name, galaxy_form_valid: form.checkValidity()};
        });

        await record_observation(test.info(), "validity before validate()", observed);
        // Precondition: the native reference really is invalid, and all four Galaxy controls were inspected.
        expect(observed.validity_by_name.native_box).toBe("invalid");
        expect(Object.keys(observed.validity_by_name)).toHaveLength(5);

        expect_failure_from_here("T03A-F2: correctness defect in 0.0.15 (DEC-2)");
        expect(observed.galaxy_form_valid).toBe(false);
    });

    test("a user correcting an invalid choice makes the control valid without another validate()", async ({ page }) => {
        annotate_finding(test.info(), "T03A-F2", "stale-invalid symptom: after validate() marks a choice control invalid, a user correction leaves it invalid");

        await mount(page, `
            <form id="test_form">
                <galaxy-checkbox id="box" name="box" required></galaxy-checkbox>
                <galaxy-select id="single" name="single" options-data='${OPTIONS}' required></galaxy-select>
                <galaxy-multi-select id="multiple" name="multiple" options-data='${OPTIONS}' required></galaxy-multi-select>
            </form>
        `);

        let marked = await page.evaluate(() => ["#box", "#single", "#multiple"].map((id) => document.querySelector(id).validate()));
        // Precondition: validate() marked all three invalid.
        expect(marked).toEqual([false, false, false]);

        await page.locator("#box input").click();
        await pick_option(page, "#single", "Beta");
        await page.locator("#multiple").getByText("Gamma", {exact: true}).click();

        let observed = await page.evaluate(() => ({
            box: document.querySelector("#box").matches(":invalid") ? "invalid" : "valid",
            single: document.querySelector("#single").matches(":invalid") ? "invalid" : "valid",
            multiple: document.querySelector("#multiple").matches(":invalid") ? "invalid" : "valid",
        }));
        await record_observation(test.info(), "validity after user correction", observed);
        // Precondition: every correction reached the submitted value.
        expect(await read_form_data(page)).toEqual([["box", "true"], ["single", "b"], ["multiple", "c"]]);

        expect_failure_from_here("T03A-F2: correctness defect in 0.0.15 (DEC-2), stale-invalid symptom");
        expect(observed).toEqual({box: "valid", single: "valid", multiple: "valid"});
    });
});
