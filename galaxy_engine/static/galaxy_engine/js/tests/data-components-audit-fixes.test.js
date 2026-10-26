import { describe, expect, test } from "vitest";
import { GalaxyDatePicker } from "../components/GalaxyDatePicker.js";
import { GalaxyEditableTable } from "../components/GalaxyEditableTable.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxySortableList } from "../components/GalaxySortableList.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { GalaxyUtils } from "../GalaxyUtils.js";
import { flush } from "./test-helpers.js";

const COMPONENTS = {
    "galaxy-editable-table": GalaxyEditableTable,
    "galaxy-sortable-list": GalaxySortableList,
    "galaxy-text-input": GalaxyTextInput,
    "galaxy-integer-input": GalaxyIntegerInput,
    "galaxy-date-picker": GalaxyDatePicker,
};

for (let [tag_name, component_class] of Object.entries(COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Creates and connects a component holding rows, and waits for it to finish creating.
 * @param {string} tag_name - galaxy-editable-table or galaxy-sortable-list.
 * @param {Object} options - columns, rows, and attributes.
 * @return {Promise<HTMLElement>}
 */
const create_rows_component = async (tag_name, {columns, rows, attributes = {}}) => {
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    element.columns = columns;
    element.rows = rows;
    document.body.appendChild(element);

    await flush();
    await flush();

    return element;
};

describe("A7.1: an editable-table cell is checked the same way on every page", () => {
    /**
     * Validates a one-row-per-page table showing page 1, then again showing the page holding the row under test.
     * @param {Object[]} columns
     * @param {Object[]} rows - The first row is valid; the second is the row under test.
     * @param {Object} attributes
     * @return {Promise<{off_page: boolean, on_page: boolean}>} - The table's validity with the row off the shown page, and on it.
     */
    const validate_on_and_off_page = async (columns, rows, attributes = {}) => {
        let table = await create_rows_component("galaxy-editable-table", {columns, rows, attributes: {"page-size": "1", ...attributes}});
        let off_page = table.validate();

        table.page = 2;
        await flush();
        await flush();

        return {off_page, on_page: table.validate()};
    };

    test("1.5 in an integer column is invalid whether its row is shown or not", async () => {
        let validity = await validate_on_and_off_page([{key: "count", type: "integer"}], [{count: 1}, {count: 1.5}]);

        expect(validity).toEqual({off_page: false, on_page: false});
    });

    test("text in an integer column is invalid off the shown page", async () => {
        let validity = await validate_on_and_off_page([{key: "count", type: "integer"}], [{count: 1}, {count: "abc"}]);

        expect(validity.off_page).toBe(false);
    });

    test("an impossible date is invalid off the shown page, and a real one is valid", async () => {
        let invalid = await validate_on_and_off_page([{key: "due", type: "date"}], [{due: "2024-01-15"}, {due: "2024-13-45"}]);
        let valid = await validate_on_and_off_page([{key: "due", type: "date"}], [{due: "2024-01-15"}, {due: "2024-02-29"}]);

        expect(invalid.off_page).toBe(false);
        expect(valid.off_page).toBe(true);
    });

    test("a read-only table's empty required cell is valid on every page", async () => {
        let validity = await validate_on_and_off_page([{key: "name", type: "text", required: true}], [{name: "Press 1"}, {name: ""}], {readonly: ""});

        expect(validity).toEqual({off_page: true, on_page: true});
    });
});

describe("A7.2: rows holding values that cannot be cloned", () => {
    test("an editable table takes a row with a function and a DOM node, and gives them back as they were", async () => {
        let on_select = () => {};
        let marker_element = document.createElement("span");
        let table = await create_rows_component("galaxy-editable-table", {
            columns: [{key: "name", type: "text"}],
            rows: [{name: "Press 1", on_select, marker_element, meta: {nested: [1, 2]}}],
        });

        let [row] = table.rows;

        expect(row.name).toBe("Press 1");
        expect(row.on_select).toBe(on_select);
        expect(row.marker_element).toBe(marker_element);
        expect(row.meta).toEqual({nested: [1, 2]});
    });

    test("a sortable list does the same, and plain values are still copies", async () => {
        let on_select = () => {};
        let meta = {nested: [1, 2]};
        let list = await create_rows_component("galaxy-sortable-list", {
            columns: [{key: "label"}],
            rows: [{id: "a", label: "A", on_select, meta}, {id: "b", label: "B"}],
        });

        let [row] = list.rows;

        expect(row.on_select).toBe(on_select);
        expect(row.meta).toEqual(meta);
        expect(row.meta).not.toBe(meta);
    });

    test("GalaxyUtils.clone_value copies what it can and shares what it cannot", () => {
        let callback = () => {};
        let source = {list: [1, {deep: true}], callback, when: new Date(0)};
        let copy = GalaxyUtils.clone_value(source);

        expect(copy).not.toBe(source);
        expect(copy.list).toEqual(source.list);
        expect(copy.list).not.toBe(source.list);
        expect(copy.callback).toBe(callback);
        expect(copy.when).toEqual(new Date(0));
    });
});
