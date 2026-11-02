/**
 * @file text_family_form_contract.spec.mjs
 * @description
 *     Task 0.3B-1 - the native form contract of the six text-family components, which share GalaxyInputBase: galaxy-text-input, -password-input, -textarea,
 *     -integer-input, -float-input and -combo-box. Everything is checked with the browser's own FormData, form.reset() and constraint validation, inside a plain
 *     <form>, and where it helps each component is compared with the native control it stands in for.
 */

import { test, expect } from "@playwright/test";
import { annotate_finding, expect_clean_load, expect_native_element_internals, open_engine_page, record_observation } from "./helpers.mjs";

/**
 * The six components, each with a typical value, a value to set from code, a value to type, and the native control it is compared with. Every value is one the
 * component accepts, so these tests check the shared contract; invalid input has its own tests below.
 * @type {{tag: string, field: string, sample: string, code_value: string, typed: string, native: string}[]}
 */
const TEXT_FAMILY = [
    {tag: "galaxy-text-input", field: "input", sample: "hello", code_value: "set from code", typed: "typed text", native: `input type="text"`},
    {tag: "galaxy-password-input", field: "input", sample: "s3cret", code_value: "set from code", typed: "pa55 word", native: `input type="password"`},
    {tag: "galaxy-textarea", field: "textarea", sample: "a note", code_value: "set from code", typed: "typed note", native: "textarea"},
    {tag: "galaxy-integer-input", field: "input", sample: "42", code_value: "7", typed: "-17", native: `input type="number"`},
    {tag: "galaxy-float-input", field: "input", sample: "3.25", code_value: "7.5", typed: "-0.5", native: `input type="number" step="any"`},
    {tag: "galaxy-combo-box", field: "input", sample: "YYYY-MM-DD", code_value: "set from code", typed: "MM/DD", native: `input type="text"`},
];

/**
 * Markup for a component's native counterpart with a name and an initial value.
 * @param {{native: string}} component
 * @param {string} name
 * @param {string} value
 * @return {string}
 */
const native_markup = (component, name, value) => {
    if (component.native === "textarea") {
        return `<textarea id="native" name="${name}">${value}</textarea>`;
    }

    return `<${component.native} id="native" name="${name}" value="${value}" />`;
};

let reports;

test.beforeEach(async ({ page }) => {
    reports = await open_engine_page(page);
    await expect_native_element_internals(page);
});

test.afterEach(async () => {
    expect_clean_load(reports);
});

/**
 * Marks the rest of a test as a documented expected failure. Called only after every action and precondition has run and the page is known to be clean, so the one
 * assertion left can fail only for the documented reason - a broken setup or a console error fails the test outright instead of passing as "expected".
 * @param {string} reason - The finding id and description.
 */
const expect_failure_from_here = (reason) => {
    expect_clean_load(reports);
    test.fail(true, reason);
};

/**
 * Puts one or more plain forms on the engine page and waits for every Galaxy element in them to finish creating. Each form cancels its own submit and counts it,
 * so a stray Enter can never navigate the page.
 * @param {import("@playwright/test").Page} page
 * @param {string} inner_html - Markup for #test_root; forms in it are given the submit guard.
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

        let galaxy_elements = [...root.querySelectorAll("*")].filter((element) => element.localName.startsWith("galaxy-"));
        await Promise.all(galaxy_elements.map((element) => element.initialization_promise));
    }, inner_html);
};

/**
 * Reads a form's entries exactly as the browser would submit them.
 * @param {import("@playwright/test").Page} page
 * @param {string} [form_selector]
 * @return {Promise<string[][]>}
 */
const read_form_data = (page, form_selector = "#test_form") => {
    return page.evaluate((selector) => [...new FormData(document.querySelector(selector)).entries()].map(([name, value]) => [name, String(value)]), form_selector);
};

/**
 * Waits for the Galaxy elements matching a selector to finish (re)creating, after a move or re-append.
 * @param {import("@playwright/test").Page} page
 * @param {string} selector
 */
const await_initialized = (page, selector) => {
    return page.evaluate((element_selector) => Promise.all([...document.querySelectorAll(element_selector)].map((element) => element.initialization_promise)), selector);
};

for (let component of TEXT_FAMILY) {
    test.describe(component.tag, () => {
        test("A: native FormData follows the attribute, code, typing, name and disabled state", async ({ page }) => {
            let field_selector = `#subject ${component.field}`;

            await mount(page, `
                <form id="test_form">
                    <fieldset id="group">
                        <${component.tag} id="subject" name="field" value="${component.sample}"></${component.tag}>
                    </fieldset>
                    <${component.tag} id="unnamed" value="not submitted"></${component.tag}>
                </form>
            `);

            await test.step("the initial value attribute is the only entry; an unnamed field adds none", async () => {
                expect(await read_form_data(page)).toEqual([["field", component.sample]]);
            });

            await test.step("a value set from code is in FormData synchronously", async () => {
                let synchronous_entries = await page.evaluate((code_value) => {
                    document.querySelector("#subject").value = code_value;

                    return [...new FormData(document.querySelector("#test_form")).entries()];
                }, component.code_value);

                expect(synchronous_entries).toEqual([["field", component.code_value]]);
                expect(await page.locator(field_selector).inputValue()).toBe(component.code_value);
            });

            await test.step("typed text replaces the value", async () => {
                await page.locator(field_selector).fill("");
                await page.locator(field_selector).pressSequentially(component.typed);
                expect(await read_form_data(page)).toEqual([["field", component.typed]]);
            });

            await test.step("renaming the field renames its entry", async () => {
                await page.evaluate(() => {
                    document.querySelector("#subject").name = "renamed";
                });
                expect(await read_form_data(page)).toEqual([["renamed", component.typed]]);
            });

            await test.step("disabled excludes it; removing disabled includes it again", async () => {
                await page.evaluate(() => {
                    document.querySelector("#subject").disabled = true;
                });
                expect(await read_form_data(page)).toEqual([]);

                await page.evaluate(() => {
                    document.querySelector("#subject").disabled = false;
                });
                expect(await read_form_data(page)).toEqual([["renamed", component.typed]]);
            });

            await test.step("a disabled fieldset excludes it and disables the field; re-enabling restores both", async () => {
                let disabled_state = await page.evaluate((field) => {
                    document.querySelector("#group").disabled = true;

                    return {
                        entries: [...new FormData(document.querySelector("#test_form")).entries()],
                        field_disabled: document.querySelector("#subject").shadowRoot.querySelector(field).disabled,
                    };
                }, component.field);
                expect(disabled_state).toEqual({entries: [], field_disabled: true});

                let enabled_state = await page.evaluate((field) => {
                    document.querySelector("#group").disabled = false;

                    return {
                        entries: [...new FormData(document.querySelector("#test_form")).entries()],
                        field_disabled: document.querySelector("#subject").shadowRoot.querySelector(field).disabled,
                    };
                }, component.field);
                expect(enabled_state).toEqual({entries: [["renamed", component.typed]], field_disabled: false});
            });
        });

        test("C: reset restores the initial value after code, typing, moves and reconnects", async ({ page }) => {
            let field_selector = `#subject ${component.field}`;

            await mount(page, `
                <form id="test_form">
                    <div id="first_place"><${component.tag} id="subject" name="field" value="${component.sample}"></${component.tag}></div>
                    <div id="second_place"></div>
                    ${native_markup(component, "native", component.sample)}
                </form>
                <form id="other_form"></form>
            `);

            await test.step("reset after a value set from code", async () => {
                await page.evaluate((code_value) => {
                    document.querySelector("#subject").value = code_value;
                    document.querySelector("#test_form").reset();
                }, component.code_value);
                expect(await read_form_data(page)).toEqual([["field", component.sample], ["native", component.sample]]);
                expect(await page.locator(field_selector).inputValue()).toBe(component.sample);
            });

            await test.step("reset after typing, compared with the native control", async () => {
                await page.locator(field_selector).fill(component.typed);
                await page.locator("#native").fill(component.typed);
                expect(await read_form_data(page)).toEqual([["field", component.typed], ["native", component.typed]]);

                await page.evaluate(() => document.querySelector("#test_form").reset());
                expect(await read_form_data(page)).toEqual([["field", component.sample], ["native", component.sample]]);
            });

            await test.step("reset after a move within the form", async () => {
                await page.evaluate(() => document.querySelector("#second_place").append(document.querySelector("#subject")));
                await await_initialized(page, "#subject");
                await page.locator(field_selector).fill(component.typed);
                expect(await read_form_data(page)).toEqual([["field", component.typed], ["native", component.sample]]);

                await page.evaluate(() => document.querySelector("#test_form").reset());
                expect(await read_form_data(page)).toEqual([["field", component.sample], ["native", component.sample]]);
                expect(await page.locator(field_selector).inputValue()).toBe(component.sample);
            });

            await test.step("a move to another form changes which form submits it, keeping name and value", async () => {
                await page.evaluate((code_value) => {
                    document.querySelector("#subject").value = code_value;
                    document.querySelector("#other_form").append(document.querySelector("#subject"));
                }, component.code_value);
                await await_initialized(page, "#subject");
                expect(await read_form_data(page)).toEqual([["native", component.sample]]);
                expect(await read_form_data(page, "#other_form")).toEqual([["field", component.code_value]]);
                expect(await page.locator(field_selector).inputValue()).toBe(component.code_value);
            });

            await test.step("removing and re-appending keeps name and value", async () => {
                await page.evaluate(() => {
                    let subject = document.querySelector("#subject");
                    subject.remove();
                    document.querySelector("#other_form").append(subject);
                });
                await await_initialized(page, "#subject");
                expect(await read_form_data(page, "#other_form")).toEqual([["field", component.code_value]]);

                await page.evaluate(() => document.querySelector("#other_form").reset());
                expect(await read_form_data(page, "#other_form")).toEqual([["field", component.sample]]);
            });
        });

        test("B: required is enforced by validate(), and native validity follows it", async ({ page }) => {
            await mount(page, `<form id="test_form"><${component.tag} id="subject" name="field" required></${component.tag}></form>`);

            let validity = await page.evaluate(() => {
                let subject = document.querySelector("#subject");
                let form = document.querySelector("#test_form");
                let empty_result = subject.validate();
                let empty_state = {form_valid: form.checkValidity(), matches_invalid: subject.matches(":invalid")};

                subject.value = "1";
                let filled_result = subject.validate();
                let filled_state = {form_valid: form.checkValidity(), matches_invalid: subject.matches(":invalid")};

                return {empty_result, empty_state, filled_result, filled_state};
            });

            expect(validity).toEqual({
                empty_result: false,
                empty_state: {form_valid: false, matches_invalid: true},
                filled_result: true,
                filled_state: {form_valid: true, matches_invalid: false},
            });
        });
    });
}

test.describe("an untouched empty field (T03B1-F1)", () => {
    test("a named field that was never given a value submits an empty entry, as a native control does", async ({ page }) => {
        annotate_finding(test.info(), "T03B1-F1", "setFormValue is first called when a value is applied, so a field created without a value attribute submits no entry at all, "
            + "while the same field cleared by the user submits an empty one");

        await mount(page, `
            <form id="test_form">
                ${TEXT_FAMILY.map((component) => `<${component.tag} name="${component.tag}"></${component.tag}>`).join("")}
            </form>
            <form id="native_form">
                ${TEXT_FAMILY.map((component) => native_markup(component, component.tag, "").replace(` id="native"`, "")).join("")}
            </form>
        `);

        let galaxy_entries = await read_form_data(page);
        let native_entries = await read_form_data(page, "#native_form");

        await record_observation(test.info(), "entries for untouched empty fields", {galaxy: galaxy_entries, native: native_entries});
        // Precondition: the native reference really is one empty entry per field.
        expect(native_entries).toEqual(TEXT_FAMILY.map((component) => [component.tag, ""]));

        expect_failure_from_here("T03B1-F1: defect in 0.0.15; one expected failure covers all six components");
        expect(galaxy_entries).toEqual(native_entries);
    });
});

test.describe("constraint validity is current without validate() (T03A-F2)", () => {
    test("a violated constraint makes the plain form invalid before anything validates it", async ({ page }) => {
        annotate_finding(test.info(), "T03A-F2", "ElementInternals validity changes only inside validate(); every constraint below is violated, yet the form reports valid");

        await mount(page, `
            <form id="test_form">
                ${TEXT_FAMILY.map((component) => `<${component.tag} name="${component.tag}" required></${component.tag}>`).join("")}
                <galaxy-integer-input id="fraction" name="fraction" value="1.5"></galaxy-integer-input>
                <galaxy-float-input id="above_max" name="above_max" max="10" value="10.5"></galaxy-float-input>
                <galaxy-textarea id="too_long" name="too_long" maxlength="3" value="four"></galaxy-textarea>
            </form>
        `);

        let observed = await page.evaluate(() => {
            let validity_by_name = {};

            for (let element of document.querySelector("#test_form").querySelectorAll("[name]")) {
                validity_by_name[element.getAttribute("name")] = element.matches(":invalid") ? "invalid" : "valid";
            }

            return {form_valid: document.querySelector("#test_form").checkValidity(), validity_by_name};
        });

        await record_observation(test.info(), "validity before validate()", observed);
        // Precondition: all nine constrained fields exist and were inspected.
        expect(Object.keys(observed.validity_by_name)).toHaveLength(9);

        expect_failure_from_here("T03A-F2: correctness defect in 0.0.15 (DEC-2); one expected failure covers all six components and every constraint type");
        expect(observed.form_valid).toBe(false);
    });

    test("correcting an invalid value makes the field valid without another validate()", async ({ page }) => {
        annotate_finding(test.info(), "T03A-F2", "the reverse symptom: after validate() marks a field invalid, a corrected value leaves it invalid until validate() runs again");

        await mount(page, `
            <form id="test_form">
                <galaxy-text-input id="by_code" name="by_code" required></galaxy-text-input>
                <galaxy-text-input id="by_typing" name="by_typing" required></galaxy-text-input>
            </form>
        `);

        let marked_invalid = await page.evaluate(() => {
            let results = [document.querySelector("#by_code").validate(), document.querySelector("#by_typing").validate()];

            return {results, form_valid: document.querySelector("#test_form").checkValidity()};
        });
        // Precondition: validate() did mark both empty fields invalid, so "still invalid" below can only mean the correction was not taken into account.
        expect(marked_invalid).toEqual({results: [false, false], form_valid: false});

        await page.evaluate(() => {
            document.querySelector("#by_code").value = "corrected from code";
        });
        await page.locator("#by_typing input").pressSequentially("corrected by typing");

        let observed = await page.evaluate(() => ({
            by_code: document.querySelector("#by_code").matches(":invalid") ? "invalid" : "valid",
            by_typing: document.querySelector("#by_typing").matches(":invalid") ? "invalid" : "valid",
            form_valid: document.querySelector("#test_form").checkValidity(),
        }));

        await record_observation(test.info(), "validity after correction", observed);
        // Precondition: both corrections reached the fields' values.
        expect(await read_form_data(page)).toEqual([["by_code", "corrected from code"], ["by_typing", "corrected by typing"]]);

        expect_failure_from_here("T03A-F2: correctness defect in 0.0.15 (DEC-2), stale-invalid symptom");
        expect(observed).toEqual({by_code: "valid", by_typing: "valid", form_valid: true});
    });
});

test.describe("numeric inputs", () => {
    test("accepted values are submitted as written and validate", async ({ page }) => {
        let cases = [
            {tag: "galaxy-integer-input", values: ["0", "-7", "42"]},
            {tag: "galaxy-float-input", values: ["0", "-0.5", "3.14", "1e3"]},
        ];

        await mount(page, `<form id="test_form"></form>`);

        for (let { tag, values } of cases) {
            for (let value of values) {
                let result = await page.evaluate(async ({ tag_name, number_value }) => {
                    let form = document.querySelector("#test_form");
                    form.innerHTML = `<${tag_name} name="number"></${tag_name}><input type="number" step="any" name="native" />`;
                    await form.firstElementChild.initialization_promise;

                    form.firstElementChild.value = number_value;
                    form.lastElementChild.value = number_value;

                    return {entries: [...new FormData(form).entries()], valid: form.firstElementChild.validate()};
                }, {tag_name: tag, number_value: value});

                expect(result, `${tag} = ${value}`).toEqual({entries: [["number", value], ["native", value]], valid: true});
            }
        }
    });

    test("a cleared numeric field submits an empty entry and is valid unless required", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-integer-input id="integer" name="integer" value="5"></galaxy-integer-input>
                <galaxy-float-input id="float" name="float" value="5.5"></galaxy-float-input>
                <input id="native" type="number" name="native" value="5" />
            </form>
        `);

        for (let selector of ["#integer input", "#float input", "#native"]) {
            await page.locator(selector).fill("");
        }

        let result = await page.evaluate(() => ({
            entries: [...new FormData(document.querySelector("#test_form")).entries()],
            integer_valid: document.querySelector("#integer").validate(),
            float_valid: document.querySelector("#float").validate(),
        }));

        expect(result).toEqual({entries: [["integer", ""], ["float", ""], ["native", ""]], integer_valid: true, float_valid: true});
    });

    test("a fractional integer, and min/max on both types, are reported by validate()", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-integer-input id="integer" name="integer" min="0" max="10"></galaxy-integer-input>
                <galaxy-float-input id="float" name="float" min="0.5" max="1.5"></galaxy-float-input>
            </form>
        `);

        let results = await page.evaluate(() => {
            let check = (id, value) => {
                let element = document.querySelector(`#${id}`);
                element.value = value;

                return {value, valid: element.validate(), form_value: new FormData(document.querySelector("#test_form")).get(id)};
            };

            return [
                check("integer", "1.5"), check("integer", "-1"), check("integer", "0"), check("integer", "10"), check("integer", "11"),
                check("float", "0.4"), check("float", "0.5"), check("float", "1.5"), check("float", "1.6"),
            ];
        });

        expect(results).toEqual([
            {value: "1.5", valid: false, form_value: "1.5"},
            {value: "-1", valid: false, form_value: "-1"},
            {value: "0", valid: true, form_value: "0"},
            {value: "10", valid: true, form_value: "10"},
            {value: "11", valid: false, form_value: "11"},
            {value: "0.4", valid: false, form_value: "0.4"},
            {value: "0.5", valid: true, form_value: "0.5"},
            {value: "1.5", valid: true, form_value: "1.5"},
            {value: "1.6", valid: false, form_value: "1.6"},
        ]);
    });

    test("changing a limit re-checks a field that already shows an error (documented)", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-integer-input id="integer" name="integer" max="10" value="11"></galaxy-integer-input></form>`);

        let result = await page.evaluate(async () => {
            let integer = document.querySelector("#integer");
            let before = integer.validate();

            integer.max = "20";
            // The limit is handled in the attribute_changed_callback tier, a microtask after the change.
            await Promise.resolve();

            return {before, after_raising_max: integer.matches(":invalid") ? "invalid" : "valid"};
        });

        expect(result).toEqual({before: false, after_raising_max: "valid"});
    });

    test("a non-numeric value set from code: observed", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-integer-input id="integer" name="integer"></galaxy-integer-input></form>`);

        let observed = await page.evaluate(() => {
            let integer = document.querySelector("#integer");
            integer.value = "abc";

            return {
                element_value: integer.value,
                displayed_value: integer.shadowRoot.querySelector("input").value,
                form_value: new FormData(document.querySelector("#test_form")).get("integer"),
                valid: integer.validate(),
            };
        });

        await record_observation(test.info(), "non-numeric value from code", observed);
        // validate() reports it; that part is a guarantee.
        expect(observed.valid).toBe(false);
    });

    /**
     * Types text into a galaxy-integer-input and a native number input side by side, and reads back what each reports and submits.
     * @param {import("@playwright/test").Page} page
     * @param {string} typed_text
     */
    const type_into_numeric_fields = async (page, typed_text) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-integer-input id="integer" name="integer"></galaxy-integer-input>
                <input id="native" type="number" name="native" />
            </form>
        `);

        await page.locator("#integer input").pressSequentially(typed_text);
        await page.locator("#native").pressSequentially(typed_text);

        return page.evaluate(() => {
            let integer = document.querySelector("#integer");
            let field = integer.shadowRoot.querySelector("input");
            let native = document.querySelector("#native");

            return {
                field_bad_input: field.validity.badInput,
                element_value: integer.value,
                form_value: new FormData(document.querySelector("#test_form")).get("integer"),
                validate_result: integer.validate(),
                native_bad_input: native.validity.badInput,
                native_form_value: new FormData(document.querySelector("#test_form")).get("native"),
                native_valid: native.checkValidity(),
            };
        });
    };

    test(`typed text the field cannot parse ("1e") makes validate() report the field invalid`, async ({ page, browserName }) => {
        annotate_finding(test.info(), "R-09", "badInput is never consulted: typed unparseable text reads as \"\", validate() passes, and \"\" is submitted, "
            + "where a native number input is invalid and blocks submission");

        let observed = await type_into_numeric_fields(page, "1e");

        await record_observation(test.info(), `${browserName}: typed "1e"`, observed);
        // Preconditions: the browser really reports badInput for this text, and the native reference is invalid.
        expect(observed.field_bad_input).toBe(true);
        expect(observed.native_valid).toBe(false);

        expect_failure_from_here("R-09 (badInput): defect in 0.0.15, the same in every engine");
        expect(observed.validate_result).toBe(false);
    });

    test(`typing letters ("12abc") into a numeric field: observed, browser-specific`, async ({ page, browserName }) => {
        let observed = await type_into_numeric_fields(page, "12abc");

        await record_observation(test.info(), `${browserName}: typed "12abc"`, observed);
        // The guarantees common to every engine: the element reports what it submits, and it matches what a native number input submits. Whether the field is valid
        // is not asserted here: where the engine accepts the letters (badInput), that is R-09, covered by the expected failure above.
        expect(observed.element_value).toBe(observed.form_value);
        expect(observed.form_value).toBe(observed.native_form_value);
    });
});

test.describe("component-specific contracts", () => {
    test("password: a value set from code is submitted but never written to the value attribute", async ({ page }) => {
        await mount(page, `<form id="test_form"><galaxy-password-input id="password" name="password" value="initial"></galaxy-password-input></form>`);

        let result = await page.evaluate(() => {
            let password = document.querySelector("#password");
            password.value = "set from code";

            return {
                entries: [...new FormData(document.querySelector("#test_form")).entries()],
                value_attribute: password.getAttribute("value"),
                field_type: password.shadowRoot.querySelector("input").type,
            };
        });

        // The markup's own value attribute stays as written; the code-set password is not added to it.
        expect(result).toEqual({entries: [["password", "set from code"]], value_attribute: "initial", field_type: "password"});
    });

    test("textarea: maxlength limits typing natively and makes a longer value from code invalid", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-textarea id="textarea" name="textarea" maxlength="5"></galaxy-textarea>
                <textarea id="native" name="native" maxlength="5"></textarea>
            </form>
        `);

        await page.locator("#textarea textarea").pressSequentially("1234567");
        await page.locator("#native").pressSequentially("1234567");
        expect(await read_form_data(page)).toEqual([["textarea", "12345"], ["native", "12345"]]);

        let code_set = await page.evaluate(() => {
            let textarea = document.querySelector("#textarea");
            let native = document.querySelector("#native");
            textarea.value = "too long";
            native.value = "too long";

            return {galaxy_valid: textarea.validate(), native_valid: native.checkValidity(), form_value: new FormData(document.querySelector("#test_form")).get("textarea")};
        });

        // A native textarea does not flag a too-long value set from code (tooLong applies to user edits only); Galaxy does, once validated.
        expect(code_set).toEqual({galaxy_valid: false, native_valid: true, form_value: "too long"});
    });

    test("textarea: typed line breaks are submitted as the native textarea submits them", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-textarea id="textarea" name="textarea"></galaxy-textarea>
                <textarea id="native" name="native"></textarea>
            </form>
        `);

        for (let selector of ["#textarea textarea", "#native"]) {
            let field = page.locator(selector);
            await field.pressSequentially("first");
            await field.press("Enter");
            await field.pressSequentially("second");
        }

        let entries = await read_form_data(page);
        await record_observation(test.info(), "line-break entries", entries.map(([name, value]) => [name, JSON.stringify(value)]));
        expect(entries[0][1]).toBe(entries[1][1]);
    });

    test("combo box: picking a suggestion submits its value, not its text; free text is submitted as typed", async ({ page }) => {
        await mount(page, `
            <form id="test_form">
                <galaxy-combo-box id="combo" name="format" suggestions='[{"value": "YYYY-MM-DD", "text": "ISO date"}, "DD/MM/YYYY"]'></galaxy-combo-box>
            </form>
        `);

        let field = page.locator("#combo input");
        await field.focus();
        await field.press("ArrowDown");
        await field.press("Enter");
        expect(await read_form_data(page)).toEqual([["format", "YYYY-MM-DD"]]);

        await field.fill("");
        await field.pressSequentially("Q1 2026");
        expect(await read_form_data(page)).toEqual([["format", "Q1 2026"]]);

        // Enter on a highlighted suggestion picks it; it must not also submit the form.
        expect(await page.evaluate(() => window.submit_count)).toBe(0);
    });
});
