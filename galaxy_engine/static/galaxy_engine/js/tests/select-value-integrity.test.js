import { describe, expect, test } from "vitest";
import { create_select, SIMPLE_OPTIONS } from "./test-helpers.js";

describe("anchored dropdown selection keeps its value (fix #3)", () => {
    test("selecting an option with anchor-dropdown + search-enabled does not wipe the value back out", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "anchor-dropdown": "",
            "search-enabled": "",
        });

        select.option_on_click(null, null, SIMPLE_OPTIONS[1]); // Banana

        expect(select.value).toEqual(["banana"]);
        expect(select._internals._form_value).toBe("banana");
    });
});

describe("typing a search query never touches the real value (extra fix)", () => {
    test("typing while search-enabled filters the list but leaves .value alone", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "search-enabled": "",
            value: JSON.stringify(["banana"]),
        });

        select.open = true;
        select.input_element.value = "app";
        select.on_input_event(new window.Event("input"));

        expect(select.value).toEqual(["banana"]);
        expect(select._internals._form_value).toBe("banana");
        expect(select.flat_data.map((o) => o.value)).toEqual(["apple"]);
    });

    test("searching then clicking away without selecting leaves the value and display text as they were", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "search-enabled": "",
            value: JSON.stringify(["banana"]),
        });

        select.open = true;
        select.input_element.value = "app";
        select.on_input_event(new window.Event("input"));

        select.close_options(); // e.g. an outside click

        expect(select.value).toEqual(["banana"]);
        expect(select.input_element.value).toBe("Banana");
    });

    test("clicking the search clear button clears the query, not the selection", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "search-enabled": "",
            value: JSON.stringify(["banana"]),
        });

        select.open = true;
        select.input_element.value = "app";
        select.on_input_event(new window.Event("input"));

        select.clear_search(new window.Event("click"));

        expect(select.value).toEqual(["banana"]);
        expect(select.flat_data.map((o) => o.value)).toEqual(["apple", "banana", "cherry"]);
    });

    test("a multi-select's value is also untouched by typing a search query", async () => {
        let select = await create_select("multi-select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "search-enabled": "",
            value: JSON.stringify(["apple"]),
        });

        select.input_element.value = "ban";
        select.on_input_event(new window.Event("input"));

        expect(select.value).toEqual(["apple"]);
    });
});

describe("an initial value with no matching option doesn't crash (fix #4)", () => {
    test("connecting with a stale value attribute drops the unmatched entry instead of throwing", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            value: JSON.stringify(["does_not_exist"]),
        });

        expect(select.selected_options).toEqual([]);
        // Rendering after this must not throw (selected_options must contain no `undefined` entries).
        expect(() => select.render_options()).not.toThrow();
    });

    test("a mix of matching and non-matching initial values keeps only the matching ones", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            value: JSON.stringify(["apple", "does_not_exist"]),
        });

        expect(select.selected_options).toEqual([{text: "Apple", value: "apple"}]);
    });
});

describe("formResetCallback restores the original value and resyncs the UI (fix #6)", () => {
    test("resets a select's value, selected_options, and displayed text back to the initial value attribute", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            value: JSON.stringify(["apple"]),
        });

        select.option_on_click(null, null, SIMPLE_OPTIONS[2]); // change to Cherry
        expect(select.value).toEqual(["cherry"]);

        select.formResetCallback();

        expect(select.value).toEqual(["apple"]);
        expect(select.selected_options).toEqual([{text: "Apple", value: "apple"}]);
        expect(select.input_element.value).toBe("Apple");
    });

    test("resets a select with no initial value back to empty", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        select.option_on_click(null, null, SIMPLE_OPTIONS[0]);
        expect(select.value).toEqual(["apple"]);

        select.formResetCallback();

        expect(select.value).toEqual([]);
        expect(select.selected_options).toEqual([]);
    });

    test("formDisabledCallback keeps the disabled attribute in sync with fieldset-driven disabling", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        select.formDisabledCallback(true);
        expect(select.hasAttribute("disabled")).toBe(true);

        select.formDisabledCallback(false);
        expect(select.hasAttribute("disabled")).toBe(false);
    });
});
