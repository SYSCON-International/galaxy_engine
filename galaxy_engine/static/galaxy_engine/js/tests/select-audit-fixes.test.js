import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { create_select, flush, press_key, SIMPLE_OPTIONS } from "./test-helpers.js";

if (!customElements.get("galaxy-form")) {
    customElements.define("galaxy-form", GalaxyForm);
}

const NUMERIC_OPTIONS = [
    {text: "One", value: 1, node_type: "Option"},
    {text: "Two", value: 2, node_type: "Option"},
];

/**
 * A group of berries, collapsed in its data, between two plain options.
 * @param {boolean} is_collapsed - The group's is_collapsed.
 * @return {Object[]}
 */
const make_grouped_options = (is_collapsed) => [
    {text: "Apple", value: "apple", node_type: "Option"},
    {
        text: "Berries", value: "berries", node_type: "Option Group", is_collapsed: is_collapsed,
        children: [
            {text: "Blueberry", value: "blueberry", node_type: "Option"},
            {text: "Blackberry", value: "blackberry", node_type: "Option"},
        ],
    },
    {text: "Cherry", value: "cherry", node_type: "Option"},
];

const search = (select, query) => {
    select.input_element.value = query;
    select.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));
};

const listed_values = (select) => select.flat_data.map((option_data) => option_data.value);

describe("A4.2: numeric option values", () => {
    test("a value attribute selects a numeric option", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(NUMERIC_OPTIONS), value: "2"});

        expect(select.value).toEqual([2]);
        expect(select.input_element.value).toBe("Two");
    });

    test("a numeric value set from code selects it, and matches a mouse pick", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(NUMERIC_OPTIONS)});

        select.value = 2;
        await flush();

        expect(select.value).toEqual([2]);
        expect(select.input_element.value).toBe("Two");
        expect(select.selected_options).toEqual([{text: "Two", value: 2}]);
    });

    test("a numeric value finds an option whose value is the same number as a string", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify([{text: "Two", value: "2", node_type: "Option"}])});

        select.value = 2;
        await flush();

        expect(select.input_element.value).toBe("Two");
    });
});

describe("A4.3: options whose text is not a string", () => {
    let unhandled_errors = [];
    let record_error = (error) => {
        unhandled_errors.push(error);
    };

    beforeEach(() => {
        unhandled_errors = [];
        process.on("uncaughtException", record_error);
        process.on("unhandledRejection", record_error);
    });

    afterEach(() => {
        process.off("uncaughtException", record_error);
        process.off("unhandledRejection", record_error);
    });

    test("searching a list with numeric or missing text filters without an error", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify([{text: 2024, value: "a", node_type: "Option"}, {value: "b", node_type: "Option"}, ...SIMPLE_OPTIONS]),
            "search-enabled": "",
        });

        select.open = true;
        await flush();
        search(select, "202");

        expect(unhandled_errors).toEqual([]);
        expect(listed_values(select)).toEqual(["a"]);
    });
});

describe("A4.4: with collapsible-groups, the keyboard reaches group headers", () => {
    test("arrowing lands on a collapsed group's header, and Enter expands it", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(make_grouped_options(true)), "collapsible-groups": ""});

        select.open = true;
        await flush();

        press_key(select, "ArrowDown");
        press_key(select, "ArrowDown");

        expect(select.flat_data[select.highlighted_flat_index].value).toBe("berries");

        press_key(select, "Enter");
        await flush();

        expect(listed_values(select)).toContain("blueberry");
    });

    test("without collapsible-groups, group headers are still skipped", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(make_grouped_options(false))});

        select.open = true;
        await flush();

        press_key(select, "ArrowDown");
        press_key(select, "ArrowDown");

        expect(select.flat_data[select.highlighted_flat_index].value).toBe("blueberry");
    });
});

describe("A4.5: one open select at a time, inside a galaxy-form too", () => {
    test("opening a second select in a form closes the first", async () => {
        document.body.innerHTML = `<galaxy-form><galaxy-select class="first"></galaxy-select><galaxy-select class="second"></galaxy-select></galaxy-form>`;
        await flush();
        await flush();

        let form = document.querySelector("galaxy-form");
        let first_select = form.shadowRoot.querySelector("galaxy-select.first");
        let second_select = form.shadowRoot.querySelector("galaxy-select.second");

        first_select.options = SIMPLE_OPTIONS;
        second_select.options = SIMPLE_OPTIONS;
        first_select.open = true;
        await flush();

        press_key(second_select, "ArrowDown");
        await flush();

        expect(second_select.open).toBe(true);
        expect(first_select.open).toBe(false);
    });
});

describe("A4.6: search and group collapse work together", () => {
    test("without collapsible-groups, a group marked is_collapsed is still filtered", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(make_grouped_options(true)), "search-enabled": ""});

        select.open = true;
        await flush();
        search(select, "blue");

        expect(listed_values(select)).toEqual(["berries", "blueberry"]);
    });

    test("with collapsible-groups, a collapsed group with no match is not listed", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(make_grouped_options(true)), "search-enabled": "", "collapsible-groups": ""});

        select.open = true;
        await flush();
        search(select, "cher");

        expect(listed_values(select)).toEqual(["cherry"]);
    });

    test("toggling a group keeps the current search", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(make_grouped_options(false)), "search-enabled": "", "collapsible-groups": ""});

        select.open = true;
        await flush();
        search(select, "blue");

        select.toggle_group(select.flat_data.find((option_data) => option_data.value === "berries"));
        select.toggle_group(select.flat_data.find((option_data) => option_data.value === "berries"));

        expect(listed_values(select)).toEqual(["berries", "blueberry"]);
    });
});

describe("A4.1: a value the options no longer contain is dropped", () => {
    test("replacing the options without the selected value clears the value, the form value and the field, with no change event", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), value: "apple", name: "fruit", required: ""});
        let change_listener = vi.fn();

        select.addEventListener("change", change_listener);
        select.options = [{text: "Banana", value: "banana", node_type: "Option"}];
        await flush();

        expect(select.value).toEqual([]);
        expect(select._internals._form_value).toBe(null);
        expect(select.input_element.value).toBe("");
        expect(select.validate()).toBe(false);
        expect(change_listener).not.toHaveBeenCalled();
    });

    test("a multi-select keeps the values still offered and drops the rest", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), value: JSON.stringify(["apple", "banana"])});

        select.options = [{text: "Banana", value: "banana", node_type: "Option"}, {text: "Cherry", value: "cherry", node_type: "Option"}];
        await flush();

        expect(select.value).toEqual(["banana"]);
    });

    test("a value set before the options load is kept, and selected once they arrive", async () => {
        let select = await create_select("select", {value: "banana"});

        expect(select.value).toEqual(["banana"]);

        select.options = SIMPLE_OPTIONS;
        await flush();

        expect(select.value).toEqual(["banana"]);
        expect(select.input_element.value).toBe("Banana");
    });

    test("options replaced with a list that still has the value keep it", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), value: "cherry"});

        select.options = [...SIMPLE_OPTIONS].reverse();
        await flush();

        expect(select.value).toEqual(["cherry"]);
    });
});
