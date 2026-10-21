import { describe, expect, test, vi } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyDatePicker } from "../components/GalaxyDatePicker.js";
import { GalaxyDatetimePicker } from "../components/GalaxyDatetimePicker.js";
import { GalaxyEditableTable } from "../components/GalaxyEditableTable.js";
import { GalaxyFloatInput } from "../components/GalaxyFloatInput.js";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyIntegerInput } from "../components/GalaxyIntegerInput.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { GalaxyTimePicker } from "../components/GalaxyTimePicker.js";
import { flush, SIMPLE_OPTIONS } from "./test-helpers.js";

const COMPONENTS = {
    "galaxy-editable-table": GalaxyEditableTable,
    "galaxy-text-input": GalaxyTextInput,
    "galaxy-integer-input": GalaxyIntegerInput,
    "galaxy-float-input": GalaxyFloatInput,
    "galaxy-checkbox": GalaxyCheckbox,
    "galaxy-date-picker": GalaxyDatePicker,
    "galaxy-time-picker": GalaxyTimePicker,
    "galaxy-datetime-picker": GalaxyDatetimePicker,
    "galaxy-form": GalaxyForm,
};

for (let [tag_name, component_class] of Object.entries(COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const COLUMNS = [
    {key: "name", label: "Machine", type: "text", required: true, sortable: true},
    {key: "cycle_time", label: "Cycle Time", type: "integer", min: 0, default: 30},
    {key: "is_enabled", label: "Enabled", type: "checkbox", default: true},
    {key: "notes", label: "Notes", editable: false},
];

const ROWS = [
    {name: "Press 1", cycle_time: 45, is_enabled: true, notes: "Note A"},
    {name: "Press 2", cycle_time: 30, is_enabled: false, notes: "Note B", _state: "locked"},
    {name: "Lathe 1", cycle_time: null, is_enabled: true, notes: ""},
];

/**
 * Creates and connects a <galaxy-editable-table> and waits for it and its cell editors to finish creating.
 * @param {Object} options - columns, rows, and attributes.
 * @return {Promise<HTMLElement>}
 */
const create_table = async ({columns = COLUMNS, rows = ROWS, attributes = {}} = {}) => {
    let table = document.createElement("galaxy-editable-table");

    for (let [name, value] of Object.entries(attributes)) {
        table.setAttribute(name, value);
    }

    table.columns = columns;
    table.rows = rows;
    document.body.appendChild(table);

    await flush();
    await flush();

    return table;
};

const get_table_rows = (table) => Array.from(table.shadowRoot.querySelectorAll("tbody tr.data-row"));
const get_editor = (table, row_index, key) => get_table_rows(table)[row_index].querySelector(`td[data-column-key="${key}"] > [data-column-key]`);
const get_cell = (table, row_index, key) => get_table_rows(table)[row_index].querySelector(`td[data-column-key="${key}"]`);
const get_action = (table, row_index, action) => get_table_rows(table)[row_index].querySelector(`button[data-action="${action}"]`);

/**
 * Records every event of a kind the table dispatches.
 * @param {HTMLElement} table - The table.
 * @param {string} event_name - The event name.
 * @return {Object[]} - Each event's detail, in order.
 */
const record = (table, event_name) => {
    let details = [];

    table.addEventListener(event_name, (event) => details.push(event.detail));

    return details;
};

/**
 * Simulates the user typing into a text-like cell editor.
 * @param {HTMLElement} editor - The cell editor.
 * @param {string} text - The full text after typing.
 */
const type_into = (editor, text) => {
    let field = editor.shadowRoot.querySelector("input");

    field.value = text;
    field.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
};

describe("typed cells", () => {
    test("a float column with a step creates its editors without an error, and the step reaches the field", async () => {
        let rejections = [];
        let on_rejection = (event) => rejections.push(event.reason);

        window.addEventListener("unhandledrejection", on_rejection);

        let table = await create_table({columns: [{key: "rate", type: "float", step: "0.1"}], rows: [{rate: 1.5}]});

        expect(get_editor(table, 0, "rate").shadowRoot.querySelector("input").step).toBe("0.1");
        expect(rejections).toEqual([]);

        window.removeEventListener("unhandledrejection", on_rejection);
    });

    test("each column type gets its Galaxy editor, compact, with the row's value", async () => {
        let table = await create_table({
            columns: [
                {key: "text", type: "text"},
                {key: "integer", type: "integer"},
                {key: "float", type: "float"},
                {key: "select", type: "select", options: SIMPLE_OPTIONS},
                {key: "multi", type: "multi-select", options: SIMPLE_OPTIONS},
                {key: "checkbox", type: "checkbox"},
                {key: "date", type: "date"},
                {key: "time", type: "time"},
                {key: "datetime", type: "datetime"},
                {key: "untyped"},
            ],
            rows: [{text: "Press 1", integer: 5, float: 2.5, select: "banana", multi: ["apple", "cherry"], checkbox: true, date: "2026-10-21", untyped: "Plain"}],
        });

        let expected_tags = {
            text: "GALAXY-TEXT-INPUT", integer: "GALAXY-INTEGER-INPUT", float: "GALAXY-FLOAT-INPUT", select: "GALAXY-SELECT", multi: "GALAXY-MULTI-SELECT",
            checkbox: "GALAXY-CHECKBOX", date: "GALAXY-DATE-PICKER", time: "GALAXY-TIME-PICKER", datetime: "GALAXY-DATETIME-PICKER", untyped: "GALAXY-TEXT-INPUT",
        };

        for (let [key, tag_name] of Object.entries(expected_tags)) {
            expect(get_editor(table, 0, key).tagName).toBe(tag_name);
            expect(get_editor(table, 0, key).hasAttribute("compact")).toBe(true);
            expect(get_editor(table, 0, key).hasAttribute("plain")).toBe(true);
        }

        expect(get_editor(table, 0, "text").value).toBe("Press 1");
        expect(get_editor(table, 0, "integer").value).toBe("5");
        expect(get_editor(table, 0, "select").value).toEqual(["banana"]);
        expect(get_editor(table, 0, "multi").value).toEqual(["apple", "cherry"]);
        expect(get_editor(table, 0, "checkbox").value).toBe(true);
    });

    test("a multi-select cell opens its options in a dropdown, showing the selection as text when closed", async () => {
        let table = await create_table({
            columns: [{key: "tags", type: "multi-select", options: SIMPLE_OPTIONS}],
            rows: [{tags: ["apple", "cherry"]}],
        });
        await flush();

        let editor = get_editor(table, 0, "tags");

        expect(editor.hasAttribute("dropdown")).toBe(true);
        expect(editor.options_element.getAttribute("popover")).toBe("manual");
        expect(editor.input_element.value).toBe("Apple, Cherry");
    });

    test("a column with editable: false is shown read-only, as GalaxyTable shows it", async () => {
        let table = await create_table();

        expect(get_cell(table, 0, "notes").textContent).toBe("Note A");
        expect(get_cell(table, 0, "notes").querySelector("[data-column-key]")).toBeNull();
    });

    test("edited values are stored in their type", async () => {
        let table = await create_table();
        let row_id = table.row_ids[0];

        type_into(get_editor(table, 0, "cycle_time"), "120");
        expect(table.get_row(row_id).cycle_time).toBe(120);

        type_into(get_editor(table, 0, "cycle_time"), "");
        expect(table.get_row(row_id).cycle_time).toBe(null);

        get_editor(table, 0, "is_enabled").shadowRoot.querySelector("input").click();
        await flush();
        expect(table.get_row(row_id).is_enabled).toBe(false);
    });
});

describe("editing", () => {
    test("typing updates rows and fires row_change with the old and new values, without re-rendering the cell", async () => {
        let table = await create_table();
        let changes = record(table, "row_change");
        let editor = get_editor(table, 0, "name");

        type_into(editor, "Press 1A");

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({row_id: table.row_ids[0], key: "name", value: "Press 1A", old_value: "Press 1"});
        expect(changes[0].row.name).toBe("Press 1A");
        expect(table.rows[0].name).toBe("Press 1A");
        expect(get_editor(table, 0, "name")).toBe(editor);
    });

    test("an event that leaves the value unchanged fires nothing", async () => {
        let table = await create_table();
        let changes = record(table, "row_change");

        type_into(get_editor(table, 0, "name"), "Press 1");

        expect(changes).toEqual([]);
    });

    test("edits do not change the caller's row objects", async () => {
        let caller_rows = [{name: "Press 1", cycle_time: 45, is_enabled: true}];
        let table = await create_table({rows: caller_rows});

        type_into(get_editor(table, 0, "name"), "Changed");

        expect(caller_rows[0].name).toBe("Press 1");
    });
});

describe("row state and controls", () => {
    test("_state locked starts a row locked: cells disabled, remove disabled, lock pressed; rows report _state", async () => {
        let table = await create_table();

        expect(get_table_rows(table)[1].classList.contains("locked")).toBe(true);
        expect(get_editor(table, 1, "name").hasAttribute("disabled")).toBe(true);
        expect(get_action(table, 1, "remove").disabled).toBe(true);
        expect(get_action(table, 1, "lock").getAttribute("aria-pressed")).toBe("true");
        expect(table.rows.map((row) => row._state)).toEqual(["open", "locked", "open"]);
    });

    test("the lock toggle locks and unlocks, firing row_lock, and re-renders only that row", async () => {
        let table = await create_table();
        let locks = record(table, "row_lock");
        let other_row_editor = get_editor(table, 2, "name");

        get_action(table, 0, "lock").click();

        expect(locks[0]).toMatchObject({row_id: table.row_ids[0], locked: true});
        expect(get_editor(table, 0, "name").hasAttribute("disabled")).toBe(true);
        expect(get_editor(table, 2, "name")).toBe(other_row_editor);

        get_action(table, 0, "lock").click();

        expect(locks[1].locked).toBe(false);
        expect(get_editor(table, 0, "name").hasAttribute("disabled")).toBe(false);
    });

    test("remove fires row_remove with the removed row; a locked row cannot be removed", async () => {
        let table = await create_table();
        let removals = record(table, "row_remove");
        let first_row_id = table.row_ids[0];

        get_action(table, 1, "remove").click();

        expect(removals).toEqual([]);
        expect(table.rows).toHaveLength(3);

        get_action(table, 0, "remove").click();

        expect(removals).toHaveLength(1);
        expect(removals[0]).toMatchObject({row_id: first_row_id, row: {name: "Press 1"}});
        expect(table.rows.map((row) => row.name)).toEqual(["Press 2", "Lathe 1"]);
    });

    test("Add Row adds a row from the columns' defaults, fires row_add, and focuses its first cell", async () => {
        let table = await create_table();
        let additions = record(table, "row_add");

        table.shadowRoot.querySelector(".add-row-button").click();

        expect(additions).toHaveLength(1);
        expect(additions[0].row).toEqual({cycle_time: 30, is_enabled: true, _state: "open"});
        expect(table.rows).toHaveLength(4);

        let focus_spy = vi.spyOn(get_editor(table, 3, "name"), "focus");

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(focus_spy).toHaveBeenCalled();
    });

    test("the methods from code do the same without firing events", async () => {
        let table = await create_table();
        let events = [...record(table, "row_add"), ...record(table, "row_remove"), ...record(table, "row_lock")];
        let event_listener = vi.fn();

        for (let event_name of ["row_add", "row_remove", "row_lock", "row_change"]) {
            table.addEventListener(event_name, event_listener);
        }

        let row_id = table.add_row({name: "From Code"});

        table.lock_row(row_id);
        expect(table.is_row_locked(row_id)).toBe(true);

        table.unlock_row(row_id);
        expect(table.is_row_locked(row_id)).toBe(false);

        expect(table.remove_row(row_id)).toMatchObject({name: "From Code"});
        table.rows = [{name: "Replaced"}];

        expect(event_listener).not.toHaveBeenCalled();
        expect(events).toEqual([]);
        expect(table.rows.map((row) => row.name)).toEqual(["Replaced"]);
    });

    test("hide-add, hide-remove, and hide-lock hide each control; readonly disables every cell and hides them all", async () => {
        let table = await create_table({attributes: {"hide-add": "", "hide-remove": ""}});

        expect(table.shadowRoot.querySelector(".add-row-button").hidden).toBe(true);
        expect(get_action(table, 0, "remove")).toBeNull();
        expect(get_action(table, 0, "lock")).not.toBeNull();

        table.hide_lock = true;
        await flush();

        expect(table.shadowRoot.querySelector(".actions-header")).toBeNull();
        expect(get_table_rows(table)[0].querySelector(".actions-cell")).toBeNull();

        table.hide_lock = false;
        table.hide_remove = false;
        table.readonly = true;
        await flush();

        expect(table.shadowRoot.querySelector(".actions-header")).toBeNull();
        expect(get_editor(table, 0, "name").hasAttribute("disabled")).toBe(true);
    });
});

describe("cell errors and validation", () => {
    test("set_cell_error marks the cell and makes the table invalid; editing the cell clears it", async () => {
        let table = await create_table();
        let row_id = table.row_ids[0];

        table.set_cell_error(row_id, "name", "Already used by another machine");

        expect(get_cell(table, 0, "name").classList.contains("has-error")).toBe(true);
        expect(get_cell(table, 0, "name").title).toBe("Already used by another machine");
        expect(get_cell(table, 0, "name").hasAttribute("aria-invalid")).toBe(true);
        expect(table.validate()).toBe(false);

        type_into(get_editor(table, 0, "name"), "Press 1B");

        expect(get_cell(table, 0, "name").classList.contains("has-error")).toBe(false);
        expect(table.validate()).toBe(true);
    });

    test("clear_cell_error and clear_cell_errors remove marks set from code", async () => {
        let table = await create_table();
        let [first_row_id, , third_row_id] = table.row_ids;

        table.set_cell_error(first_row_id, "name", "A");
        table.set_cell_error(third_row_id, "cycle_time", "B");
        table.clear_cell_error(first_row_id, "name");

        expect(get_cell(table, 0, "name").classList.contains("has-error")).toBe(false);
        expect(get_cell(table, 2, "cycle_time").classList.contains("has-error")).toBe(true);

        table.clear_cell_errors();

        expect(get_cell(table, 2, "cycle_time").classList.contains("has-error")).toBe(false);
    });

    test("validate() marks an empty required cell and a value below min, skips locked rows, and focus_first_invalid focuses the first", async () => {
        let table = await create_table({rows: [{name: "", cycle_time: 10}, {name: "", _state: "locked"}, {name: "Lathe 1", cycle_time: 5}]});

        // A number field cannot hold text that is not a number - the browser empties it - so out-of-range is the type error a user can actually make.
        type_into(get_editor(table, 2, "cycle_time"), "-5");

        expect(table.validate()).toBe(false);
        expect(get_cell(table, 0, "name").classList.contains("has-error")).toBe(true);
        expect(get_cell(table, 1, "name").classList.contains("has-error")).toBe(false);
        expect(get_cell(table, 2, "cycle_time").classList.contains("has-error")).toBe(true);
        expect(table._internals.validationMessage).toBe("Please fix the highlighted cells.");

        let focus_spy = vi.spyOn(get_editor(table, 0, "name"), "focus");

        table.focus_first_invalid();

        expect(focus_spy).toHaveBeenCalled();
    });

    test("maxlength is checked by the table", async () => {
        let table = await create_table({columns: [{key: "code", type: "text", maxlength: 3}], rows: [{code: "ABCD"}]});

        expect(table.validate()).toBe(false);
        expect(get_cell(table, 0, "code").title).toBe("Please enter no more than 3 characters.");
    });
});

describe("form association", () => {
    test("with a name, the table submits its rows as JSON", async () => {
        let table = await create_table({attributes: {name: "machines"}});

        type_into(get_editor(table, 0, "name"), "Press 1A");

        let submitted_rows = JSON.parse(table._internals._form_value);

        expect(submitted_rows.map((row) => row.name)).toEqual(["Press 1A", "Press 2", "Lathe 1"]);
        expect(submitted_rows[1]._state).toBe("locked");
    });

    test("inside a galaxy-form: an empty required cell fails validation and the form focuses that cell", async () => {
        document.body.innerHTML = "<galaxy-form><galaxy-editable-table name='machines'></galaxy-editable-table></galaxy-form>";
        await flush();

        let form = document.querySelector("galaxy-form");
        let table = form.shadowRoot.querySelector("galaxy-editable-table");

        table.columns = COLUMNS;
        table.rows = [{name: ""}];
        await flush();
        await flush();

        let focus_first_invalid_spy = vi.spyOn(table, "focus_first_invalid");

        expect(form.validate()).toBe(false);
        expect(focus_first_invalid_spy).toHaveBeenCalled();
    });

    test("form reset restores the initial rows", async () => {
        let table = await create_table({attributes: {name: "machines"}});

        table.add_row({name: "Extra"});

        // Adding a row re-renders the body, and the new editors finish creating a turn later.
        await flush();
        type_into(get_editor(table, 0, "name"), "Changed");
        table.formResetCallback();
        await flush();

        expect(table.rows.map((row) => row.name)).toEqual(["Press 1", "Press 2", "Lathe 1"]);
    });
});

describe("layout and sorting", () => {
    test("max-body-height caps the scrolling container", async () => {
        let table = await create_table({attributes: {"max-body-height": "300px"}});

        expect(table.shadowRoot.querySelector(".galaxy-table-container").style.maxHeight).toBe("300px");

        table.max_body_height = null;
        await flush();

        expect(table.shadowRoot.querySelector(".galaxy-table-container").style.maxHeight).toBe("");
    });

    test("with client-sort, sorting reorders the rows but edits still reach the right row", async () => {
        let table = await create_table({attributes: {"client-sort": ""}});
        let lathe_row_id = table.row_ids[2];

        table.shadowRoot.querySelector('.sort-button[data-key="name"]').click();
        await flush();

        expect(get_table_rows(table).map((table_row) => table_row.dataset.rowId)[0]).toBe(lathe_row_id);

        type_into(get_editor(table, 0, "name"), "Lathe 1A");

        expect(table.get_row(lathe_row_id).name).toBe("Lathe 1A");
    });

    test("reconnecting renders one table and one Add Row button", async () => {
        let table = await create_table();

        table.remove();
        await flush();
        document.body.appendChild(table);
        await flush();
        await flush();

        expect(table.shadowRoot.querySelectorAll("table")).toHaveLength(1);
        expect(table.shadowRoot.querySelectorAll(".add-row-button")).toHaveLength(1);
        expect(get_table_rows(table)).toHaveLength(3);
    });
});
