/**
 * @file GalaxyEditableTable.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyTable} from "./GalaxyTable.js";

const ROW_STATES = {
    OPEN: "open",
    LOCKED: "locked",
};

const ROW_STATE_KEY = "_state";

// The Galaxy component each cell type is edited with. Each must be registered, as GalaxyComponentsLoader does for the engine.
const CELL_EDITOR_TAG_BY_TYPE = {
    "text": "galaxy-text-input",
    "integer": "galaxy-integer-input",
    "float": "galaxy-float-input",
    "select": "galaxy-select",
    "multi-select": "galaxy-multi-select",
    "checkbox": "galaxy-checkbox",
    "date": "galaxy-date-picker",
    "time": "galaxy-time-picker",
    "datetime": "galaxy-datetime-picker",
};

// Column options passed straight to the cell editor as attributes.
const CELL_EDITOR_ATTRIBUTE_NAMES = ["min", "max", "step", "placeholder"];

const INVALID_CELLS_MESSAGE = "Please fix the highlighted cells.";

const LOCK_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>`;
const UNLOCK_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 7.5-2"></path></svg>`;
const REMOVE_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>`;

/**
 * @class
 * @description
 *     A {@link GalaxyTable} whose cells are edited in place. Each column may set a `type` - text, integer, float, select, multi-select, checkbox, date, time, or datetime -
 *     and its cells are edited with the matching Galaxy input, drawn compact and plain (no border until hovered or focused); `editable: false` shows the column read-only. `options` (select types), `required`, `min`,
 *     `max`, `step`, `maxlength`, `placeholder`, and `default` (the value for a new row) configure the cells. Values are kept in their type: numbers (null when empty),
 *     booleans, a select's single value, a multi-select's array, ISO strings for dates.
 *
 *     Each row is open or locked, carried in its data as `_state: "open" | "locked"`. A locked row's cells are disabled and it cannot be removed. An actions column has a
 *     lock toggle and a remove button for each row, and an "Add Row" button sits below the table; `hide-add`, `hide-remove`, and `hide-lock` hide each, and `readonly`
 *     makes the whole table read-only. `max-body-height` (from {@link GalaxyTable}) makes the body scroll under a sticky header.
 *
 *     Cells are marked with an error from their own validation (required, min/max, the type's format, maxlength), or from code with {@link set_cell_error} - for errors
 *     from the server - which clears when that cell is edited.
 *
 *     User actions dispatch bubbling events: `row_add`, `row_change` (as each cell is edited, with `key`, `value`, and `old_value`), `row_remove`, and `row_lock` (with
 *     `locked`). The methods that do the same from code - {@link add_row}, {@link remove_row}, {@link lock_row}, {@link unlock_row}, and setting `rows` - do not.
 *
 *     It is form-associated: with a `name`, it submits its rows as one JSON value. Validating it validates every open row's cells, and a galaxy-form that finds it invalid
 *     focuses its first invalid cell.
 * @extends GalaxyTable
 */
export class GalaxyEditableTable extends GalaxyTable {
    static formAssociated = true;

    /**
     * @constructor
     */
    constructor() {
        super();

        this._internals = this.attachInternals();

        this.editable_row_entries = [];
        this.synced_rows_source = null;
        this.next_row_number = 0;
        this.manual_errors = new Map();
        this.initial_rows = [];
        this.add_row_button = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [...super.observed_attributes, "readonly", "hide-add", "hide-remove", "hide-lock", "name"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_attribute_changed_callback}
     * @note GalaxyTable's attribute_changed_callback has already handled its own attributes, `rows` among them.
     * @override
     */
    post_attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.body_element) {
            return;
        }

        const attribute_lookup_table = {
            "rows": this.update_form_value,
            "readonly": this.render_controls_and_body,
            "hide-add": this.render_controls_and_body,
            "hide-remove": this.render_controls_and_body,
            "hide-lock": this.render_controls_and_body,
            "name": this.update_form_value,
        }

        attribute_lookup_table[name]?.();
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the rows as plain data - each row's values keyed by column, plus `_state`.
     * @override
     * @return {Object[]} - Copies of the rows, in their order (not the sorted display order).
     */
    get rows() {
        return this.row_entries.map(this.get_row_data);
    }

    /**
     * Replaces every row. Each row gets a new id; `_state: "locked"` starts it locked. Dispatches no events.
     * @override
     * @param {Object[]|string|null} value - The rows, or a JSON string of them.
     */
    set rows(value) {
        this.apply_rows(value);
        this.update_form_value();
    }

    /**
     * Gets the row entries - `{row_id, row, state, index}` - kept in step with the rows {@link GalaxyTable} was given, and changed in place by edits.
     * @override
     * @return {Object[]} - The row entries.
     */
    get row_entries() {
        if (this._rows !== this.synced_rows_source) {
            this.sync_row_entries_from_rows();
        }

        return this.editable_row_entries;
    }

    /**
     * Never reads a light-DOM `<table>`: its cloned markup cannot be edited.
     * @override
     * @return {boolean} - Always false.
     */
    get is_using_light_dom() {
        return false;
    }

    /**
     * Gets whether the whole table is read-only.
     * @return {boolean} - True when read-only.
     */
    get readonly() {return this.hasAttribute("readonly");}

    /**
     * Sets whether the whole table is read-only: every cell disabled, and no add, remove, or lock controls.
     * @param {boolean} value - True for read-only.
     */
    set readonly(value) {
        this.toggleAttribute("readonly", Boolean(value));
    }

    /**
     * Gets whether the "Add Row" button is hidden.
     * @return {boolean} - True when hidden.
     */
    get hide_add() {return this.hasAttribute("hide-add");}

    /**
     * Sets whether the "Add Row" button is hidden.
     * @param {boolean} value - True to hide it.
     */
    set hide_add(value) {
        this.toggleAttribute("hide-add", Boolean(value));
    }

    /**
     * Gets whether the remove buttons are hidden.
     * @return {boolean} - True when hidden.
     */
    get hide_remove() {return this.hasAttribute("hide-remove");}

    /**
     * Sets whether the remove buttons are hidden.
     * @param {boolean} value - True to hide them.
     */
    set hide_remove(value) {
        this.toggleAttribute("hide-remove", Boolean(value));
    }

    /**
     * Gets whether the lock toggles are hidden.
     * @return {boolean} - True when hidden.
     */
    get hide_lock() {return this.hasAttribute("hide-lock");}

    /**
     * Sets whether the lock toggles are hidden. Rows keep their state; it just cannot be changed from the table.
     * @param {boolean} value - True to hide them.
     */
    set hide_lock(value) {
        this.toggleAttribute("hide-lock", Boolean(value));
    }

    /**
     * Gets the field name the rows are submitted under.
     * @return {string|null} - The name.
     */
    get name() {return this.getAttribute("name");}

    /**
     * Sets the field name the rows are submitted under.
     * @param {string|null} value - The name.
     */
    set name(value) {
        if (value) {
            this.setAttribute("name", value);
        }
        else {
            this.removeAttribute("name");
        }
    }

    /**
     * Gets whether the actions column is shown - when the table is editable and either the lock or remove controls are.
     * @return {boolean} - True when the actions column is shown.
     */
    get has_row_actions() {
        return !this.readonly && !(this.hide_lock && this.hide_remove);
    }

    /**
     * Always true: the row actions and the cell error marks have tooltips.
     * @override
     * @return {boolean} - True.
     */
    get has_tooltips() {
        return true;
    }

    /**
     * {@link GalaxyTable#extra_column_count}
     * @override
     */
    get extra_column_count() {
        return this.has_row_actions ? 1 : 0;
    }

    /***************  Rows  ***************/

    /**
     * Rebuilds the row entries from the rows GalaxyTable was given, copying each row so edits never change the caller's objects. These rows become the ones a form reset
     * restores, and manual cell errors are cleared, since the rows they were set on are gone.
     */
    sync_row_entries_from_rows = () => {
        this.editable_row_entries = (this._rows || []).map(this.create_row_entry);
        this.initial_rows = this.editable_row_entries.map(this.get_row_data);
        this.manual_errors.clear();
        this.commit_row_entries();
    }

    /**
     * Creates a row entry for a row's data, with a new id.
     * @param {Object} row_data - The row's data, optionally with `_state`.
     * @return {Object} - The row entry.
     */
    create_row_entry = (row_data) => {
        let {[ROW_STATE_KEY]: state, ...row} = row_data && typeof row_data === "object" ? row_data : {};

        this.next_row_number += 1;

        return {
            row_id: `editable_row_${this.next_row_number}`,
            row: {...row},
            state: state === ROW_STATES.LOCKED ? ROW_STATES.LOCKED : ROW_STATES.OPEN,
            index: 0,
            cell_nodes: null,
        };
    }

    /**
     * Renumbers the row entries and points GalaxyTable's rows at them, after rows are added or removed.
     */
    commit_row_entries = () => {
        for (let [index, row_entry] of this.editable_row_entries.entries()) {
            row_entry.index = index;
        }

        this._rows = this.editable_row_entries.map((row_entry) => row_entry.row);
        this.synced_rows_source = this._rows;
    }

    /**
     * Gets a row's data as plain data, with `_state`.
     * @param {Object} row_entry - The row entry.
     * @return {Object} - A copy of the row.
     */
    get_row_data = (row_entry) => {
        return {...structuredClone(row_entry.row), [ROW_STATE_KEY]: row_entry.state};
    }

    /**
     * Finds a row entry by id.
     * @param {string} row_id - The row's id.
     * @return {Object|undefined} - The row entry.
     */
    find_row_entry = (row_id) => {
        return this.row_entries.find((row_entry) => row_entry.row_id === row_id);
    }

    /**
     * Gets a row's data.
     * @param {string} row_id - The row's id.
     * @return {Object|null} - A copy of the row, or null when there is no such row.
     */
    get_row = (row_id) => {
        let row_entry = this.find_row_entry(row_id);

        return row_entry ? this.get_row_data(row_entry) : null;
    }

    /**
     * Gets the row ids in the rows' order.
     * @return {string[]} - The row ids.
     */
    get row_ids() {
        return this.row_entries.map((row_entry) => row_entry.row_id);
    }

    /**
     * Adds a row at the end, filling any column it leaves out with that column's `default`. Dispatches no event.
     * @param {Object} row_data - The row's values, optionally with `_state`.
     * @return {string} - The new row's id.
     */
    add_row = (row_data = {}) => {
        let defaults = {};

        for (let column of this.columns) {
            if (column.default !== undefined) {
                defaults[column.key] = structuredClone(column.default);
            }
        }

        let row_entry = this.create_row_entry({...defaults, ...row_data});

        this.row_entries.push(row_entry);
        this.commit_row_entries();
        this.render_body();
        this.update_form_value();

        return row_entry.row_id;
    }

    /**
     * Removes a row, locked or not. Dispatches no event.
     * @param {string} row_id - The row's id.
     * @return {Object|null} - The removed row's data, or null when there is no such row.
     */
    remove_row = (row_id) => {
        let row_entry = this.find_row_entry(row_id);

        if (!row_entry) {
            return null;
        }

        this.editable_row_entries = this.row_entries.filter((entry) => entry !== row_entry);
        this.clear_row_errors(row_id);
        this.commit_row_entries();
        this.render_body();
        this.update_form_value();

        return this.get_row_data(row_entry);
    }

    /**
     * Locks a row: its cells are disabled and it cannot be removed from the table. Dispatches no event.
     * @param {string} row_id - The row's id.
     */
    lock_row = (row_id) => {
        this.set_row_state(row_id, ROW_STATES.LOCKED);
    }

    /**
     * Unlocks a row. Dispatches no event.
     * @param {string} row_id - The row's id.
     */
    unlock_row = (row_id) => {
        this.set_row_state(row_id, ROW_STATES.OPEN);
    }

    /**
     * Gets whether a row is locked.
     * @param {string} row_id - The row's id.
     * @return {boolean} - True when locked.
     */
    is_row_locked = (row_id) => {
        return this.find_row_entry(row_id)?.state === ROW_STATES.LOCKED;
    }

    /**
     * Sets a row's state and re-renders that row alone.
     * @param {string} row_id - The row's id.
     * @param {string} state - "open" or "locked".
     */
    set_row_state = (row_id, state) => {
        let row_entry = this.find_row_entry(row_id);

        if (!row_entry || row_entry.state === state) {
            return;
        }

        row_entry.state = state;

        this.render_row(row_id);
        this.update_form_value();
    }

    /**
     * Replaces one rendered row, leaving every other row - and any cell being typed in - untouched.
     * @param {string} row_id - The row's id.
     */
    render_row = (row_id) => {
        let row_entry = this.find_row_entry(row_id);
        let table_row = this.find_table_row(row_id);

        if (row_entry && table_row) {
            table_row.replaceWith(this.create_row_element(row_entry, this.columns));
        }
    }

    /**
     * Finds a row's rendered `<tr>`.
     * @param {string} row_id - The row's id.
     * @return {HTMLTableRowElement|null} - The row, or null when it is not rendered.
     */
    find_table_row = (row_id) => {
        return this.body_element?.querySelector(`tr[data-row-id="${row_id}"]`) ?? null;
    }

    /***************  Cells  ***************/

    /**
     * Gets a column's type, defaulting to text.
     * @param {Object} column - The column definition.
     * @return {string} - The type.
     */
    get_column_type = (column) => {
        return CELL_EDITOR_TAG_BY_TYPE[column.type] ? column.type : "text";
    }

    /**
     * Gets whether a column's cells are edited.
     * @param {Object} column - The column definition.
     * @return {boolean} - True unless the column sets `editable: false`.
     */
    is_column_editable = (column) => {
        return column.editable !== false;
    }

    /**
     * Converts a row value to what a cell editor of the column's type takes.
     * @param {Object} column - The column definition.
     * @param {*} value - The row value.
     * @return {*} - The editor value.
     */
    to_editor_value = (column, value) => {
        let type = this.get_column_type(column);
        let is_empty = value === null || value === undefined;

        if (type === "select") {
            return is_empty ? null : [value];
        }

        if (type === "multi-select") {
            return Array.isArray(value) ? value : [];
        }

        if (type === "checkbox") {
            return Boolean(value);
        }

        return is_empty ? "" : String(value);
    }

    /**
     * Reads a cell editor's value back into the column's type.
     * @param {Object} column - The column definition.
     * @param {HTMLElement} editor - The cell editor.
     * @return {*} - The row value: a number or null for numbers (the typed text if it is not a number, so the cell can report it), a boolean for a checkbox, a select's
     *     single value or null, a multi-select's array, a string or null for dates, and a string for text.
     */
    from_editor_value = (column, editor) => {
        let type = this.get_column_type(column);
        let value = editor.value;

        if (type === "integer" || type === "float") {
            let value_string = String(value ?? "").trim();
            let number_value = Number(value_string);

            if (value_string === "") {
                return null;
            }

            return Number.isNaN(number_value) ? value_string : number_value;
        }

        if (type === "select") {
            return Array.isArray(value) && value.length > 0 ? value[0] : null;
        }

        if (type === "multi-select") {
            return Array.isArray(value) ? [...value] : [];
        }

        if (type === "checkbox") {
            return Boolean(value);
        }

        if (type === "date" || type === "time" || type === "datetime") {
            return value ? String(value) : null;
        }

        return value === null || value === undefined ? "" : String(value);
    }

    /**
     * Creates a cell's editor: the Galaxy input for the column's type, drawn compact, configured from the column, and disabled when the row is locked or the table
     * read-only.
     * @param {Object} column - The column definition.
     * @param {Object} row_entry - The row entry.
     * @return {HTMLElement} - The editor.
     */
    create_cell_editor = (column, row_entry) => {
        let editor = document.createElement(CELL_EDITOR_TAG_BY_TYPE[this.get_column_type(column)]);

        // Compact to fit a row, and plain so a value reads as ordinary table text until the cell is hovered or focused.
        editor.setAttribute("compact", "");
        editor.setAttribute("plain", "");
        editor.dataset.rowId = row_entry.row_id;
        editor.dataset.columnKey = column.key;

        // A multi-select's inline list would make its row as tall as the list; its dropdown keeps the row one line high.
        if (this.get_column_type(column) === "multi-select") {
            editor.setAttribute("dropdown", "");
        }

        if (column.options !== undefined) {
            editor.setAttribute("options-data", JSON.stringify(column.options));
        }

        if (column.required) {
            editor.setAttribute("required", "");
        }

        for (let attribute_name of CELL_EDITOR_ATTRIBUTE_NAMES) {
            if (column[attribute_name] !== undefined && column[attribute_name] !== null) {
                editor.setAttribute(attribute_name, String(column[attribute_name]));
            }
        }

        if (this.readonly || row_entry.state === ROW_STATES.LOCKED) {
            editor.setAttribute("disabled", "");
        }

        let editor_value = this.to_editor_value(column, row_entry.row[column.key]);

        // apply_state_value is how every Galaxy input takes a value in its own type; an editor whose tag is not registered yet is still a plain element.
        if (typeof editor.apply_state_value === "function") {
            editor.apply_state_value(editor_value);
        }
        else {
            editor.value = editor_value;
        }

        // Listened for on each editor: a date picker reports a value chosen from its popup with input_validated, which does not bubble.
        for (let event_name of ["input", "change", "input_validated"]) {
            editor.addEventListener(event_name, this.on_cell_event);
        }

        return editor;
    }

    /**
     * Handles a cell edit: stores the editor's value in the row, clears the cell's manual error, revalidates the cell, and dispatches `row_change`. The body is never
     * re-rendered, so the cell being typed in keeps its focus and caret.
     * @param {Event} event - The editor's input, change, or input_validated event.
     */
    on_cell_event = (event) => {
        let editor = event.currentTarget;
        let row_entry = this.find_row_entry(editor.dataset.rowId);
        let column = this.columns.find((candidate_column) => candidate_column.key === editor.dataset.columnKey);

        if (!row_entry || !column) {
            return;
        }

        let key = column.key;
        let old_value = row_entry.row[key];
        let value = this.from_editor_value(column, editor);

        if (JSON.stringify(old_value) === JSON.stringify(value)) {
            return;
        }

        row_entry.row[key] = value;
        this.manual_errors.delete(this.get_error_key(row_entry.row_id, key));
        this.refresh_cell_error(row_entry, column, editor, true);
        this.update_form_value();

        this.dispatchEvent(new CustomEvent("row_change", {
            bubbles: true,
            detail: {row_id: row_entry.row_id, row: this.get_row_data(row_entry), key: key, value: structuredClone(value), old_value: structuredClone(old_value)},
        }));
    }

    /**
     * {@link GalaxyTable#create_row_element}
     * @override
     */
    create_row_element = (row_entry, columns) => {
        let table_row = document.createElement("tr");
        table_row.className = "data-row";
        table_row.dataset.index = String(row_entry.index);
        table_row.dataset.rowId = row_entry.row_id;
        table_row.classList.toggle("locked", row_entry.state === ROW_STATES.LOCKED);

        for (let column of columns) {
            let cell = document.createElement("td");
            cell.dataset.columnKey = column.key;

            this.apply_column_layout(cell, column);

            // Before the error mark, which replaces this description while the cell has an error.
            this.apply_cell_tooltip_description(cell, column, row_entry.row);

            if (this.is_column_editable(column)) {
                let editor = this.create_cell_editor(column, row_entry);

                cell.appendChild(editor);
                this.apply_cell_error_mark(cell, this.manual_errors.get(this.get_error_key(row_entry.row_id, column.key)) ?? "");
            }
            else {
                this.fill_cell(cell, column, row_entry.row);
            }

            table_row.appendChild(cell);
        }

        this.apply_row_tooltip_description(table_row, row_entry.row);

        if (this.has_row_actions) {
            table_row.appendChild(this.create_actions_cell(row_entry));
        }

        return table_row;
    }

    /**
     * Builds a row's actions cell: the lock toggle and the remove button, each unless hidden. A locked row's remove button is disabled.
     * @param {Object} row_entry - The row entry.
     * @return {HTMLTableCellElement} - The cell.
     */
    create_actions_cell = (row_entry) => {
        let actions_cell = document.createElement("td");
        actions_cell.className = "actions-cell";

        let is_locked = row_entry.state === ROW_STATES.LOCKED;

        if (!this.hide_lock) {
            let lock_button = document.createElement("button");
            lock_button.className = "row-action lock-action";
            lock_button.type = "button";
            lock_button.dataset.action = "lock";
            lock_button.dataset.rowId = row_entry.row_id;
            lock_button.setAttribute("aria-pressed", String(is_locked));
            lock_button.setAttribute("aria-label", is_locked ? "Unlock row" : "Lock row");
            lock_button.innerHTML = is_locked ? LOCK_ICON_HTML : UNLOCK_ICON_HTML;

            actions_cell.appendChild(this.create_control_tooltip(lock_button, is_locked ? "Unlock row" : "Lock row"));
        }

        if (!this.hide_remove) {
            let remove_button = document.createElement("button");
            remove_button.className = "row-action remove-action";
            remove_button.type = "button";
            remove_button.dataset.action = "remove";
            remove_button.dataset.rowId = row_entry.row_id;
            remove_button.setAttribute("aria-label", "Remove row");
            remove_button.disabled = is_locked;
            remove_button.innerHTML = REMOVE_ICON_HTML;

            actions_cell.appendChild(this.create_control_tooltip(remove_button, is_locked ? "Unlock the row to remove it" : "Remove row"));
        }

        return actions_cell;
    }

    /**
     * {@link GalaxyTable#create_extra_header_cells}
     * @override
     */
    create_extra_header_cells = () => {
        if (!this.has_row_actions) {
            return [];
        }

        let actions_header = document.createElement("th");
        actions_header.className = "actions-header";
        actions_header.scope = "col";

        let actions_label = document.createElement("span");
        actions_label.className = "visually-hidden";
        actions_label.textContent = "Actions";

        actions_header.appendChild(actions_label);

        return [actions_header];
    }

    /***************  Controls  ***************/

    /**
     * Handles the lock and remove buttons in the actions column.
     * @param {MouseEvent} event - The click event.
     */
    on_row_action_click = (event) => {
        let action_button = event.target.closest?.("button[data-action]");

        if (!action_button || action_button.disabled) {
            return;
        }

        let row_id = action_button.dataset.rowId;
        let row_entry = this.find_row_entry(row_id);

        if (!row_entry) {
            return;
        }

        if (action_button.dataset.action === "lock") {
            let is_now_locked = row_entry.state !== ROW_STATES.LOCKED;

            this.set_row_state(row_id, is_now_locked ? ROW_STATES.LOCKED : ROW_STATES.OPEN);
            this.find_table_row(row_id)?.querySelector(".lock-action")?.focus();
            this.dispatchEvent(new CustomEvent("row_lock", {bubbles: true, detail: {row_id: row_id, row: this.get_row_data(row_entry), locked: is_now_locked}}));
        }
        else if (action_button.dataset.action === "remove") {
            let removed_row = this.remove_row(row_id);

            this.dispatchEvent(new CustomEvent("row_remove", {bubbles: true, detail: {row_id: row_id, row: removed_row}}));
        }
    }

    /**
     * Handles the "Add Row" button: adds a row from the columns' defaults, dispatches `row_add`, and focuses the new row's first editable cell.
     */
    on_add_row_click = () => {
        let row_id = this.add_row();
        let row_entry = this.find_row_entry(row_id);

        this.dispatchEvent(new CustomEvent("row_add", {bubbles: true, detail: {row_id: row_id, row: this.get_row_data(row_entry)}}));

        // The new row's editors finish creating asynchronously, so the focus waits a turn for them.
        setTimeout(() => {
            this.find_table_row(row_id)?.querySelector("[data-column-key] [data-column-key]")?.focus();
        }, 0);
    }

    /**
     * Shows or hides the "Add Row" button.
     */
    render_add_row_button = () => {
        if (this.add_row_button) {
            this.add_row_button.hidden = this.readonly || this.hide_add;
        }
    }

    /**
     * Re-renders the header and body (the actions column comes and goes with the controls) and the "Add Row" button.
     */
    render_controls_and_body = () => {
        this.render();
        this.render_add_row_button();
    }

    /***************  Errors and Validation  ***************/

    /**
     * Gets the key a manual cell error is stored under.
     * @param {string} row_id - The row's id.
     * @param {string} key - The column key.
     * @return {string} - The error key.
     */
    get_error_key = (row_id, key) => {
        return `${row_id}::${key}`;
    }

    /**
     * Marks a cell with an error from code - typically one the server reported. It stays until that cell is edited, or it is cleared, and makes the table invalid.
     * @param {string} row_id - The row's id.
     * @param {string} key - The column key.
     * @param {string} message - The error message, shown as the cell's tooltip.
     */
    set_cell_error = (row_id, key, message) => {
        this.manual_errors.set(this.get_error_key(row_id, key), String(message));
        this.refresh_cell_error_by_key(row_id, key);
    }

    /**
     * Clears a cell's error set from code.
     * @param {string} row_id - The row's id.
     * @param {string} key - The column key.
     */
    clear_cell_error = (row_id, key) => {
        this.manual_errors.delete(this.get_error_key(row_id, key));
        this.refresh_cell_error_by_key(row_id, key);
    }

    /**
     * Clears every cell error set from code.
     */
    clear_cell_errors = () => {
        let error_keys = [...this.manual_errors.keys()];

        this.manual_errors.clear();

        for (let error_key of error_keys) {
            let [row_id, key] = error_key.split("::");

            this.refresh_cell_error_by_key(row_id, key);
        }
    }

    /**
     * Clears every cell error set from code on one row.
     * @param {string} row_id - The row's id.
     */
    clear_row_errors = (row_id) => {
        for (let error_key of [...this.manual_errors.keys()]) {
            if (error_key.startsWith(`${row_id}::`)) {
                this.manual_errors.delete(error_key);
            }
        }
    }

    /**
     * Refreshes one cell's error mark, found by row and column.
     * @param {string} row_id - The row's id.
     * @param {string} key - The column key.
     */
    refresh_cell_error_by_key = (row_id, key) => {
        let row_entry = this.find_row_entry(row_id);
        let column = this.columns.find((candidate_column) => candidate_column.key === key);
        let editor = this.find_cell_editor(row_id, key);

        if (row_entry && column && editor) {
            this.refresh_cell_error(row_entry, column, editor, false);
        }
    }

    /**
     * Finds a cell's editor.
     * @param {string} row_id - The row's id.
     * @param {string} key - The column key.
     * @return {HTMLElement|null} - The editor, or null when the cell is not rendered or not editable.
     */
    find_cell_editor = (row_id, key) => {
        let escaped_key = String(key).replace(/["\\]/g, "\\$&");

        return this.find_table_row(row_id)?.querySelector(`td[data-column-key="${escaped_key}"] > [data-column-key]`) ?? null;
    }

    /**
     * Works out a cell's error: an error set from code first, then the editor's own validation (when `should_validate`, or when it already has an error), then
     * `maxlength`. A locked row's cells are not checked, since they cannot be edited.
     * @param {Object} row_entry - The row entry.
     * @param {Object} column - The column definition.
     * @param {HTMLElement} editor - The cell's editor.
     * @param {boolean} should_validate - Whether to run the editor's validation.
     * @return {string} - The error message, or "" when the cell is valid.
     */
    get_cell_error = (row_entry, column, editor, should_validate) => {
        let manual_error = this.manual_errors.get(this.get_error_key(row_entry.row_id, column.key));

        if (manual_error) {
            return manual_error;
        }

        if (row_entry.state === ROW_STATES.LOCKED) {
            return "";
        }

        if (should_validate && typeof editor.validate === "function" && !editor.validate()) {
            return editor._internals?.validationMessage || "This value is not valid.";
        }

        let value = row_entry.row[column.key];
        let is_too_long = column.maxlength !== undefined && value !== null && value !== undefined && String(value).length > Number(column.maxlength);

        if (is_too_long) {
            return `Please enter no more than ${column.maxlength} characters.`;
        }

        return "";
    }

    /**
     * Works out and shows a cell's error.
     * @param {Object} row_entry - The row entry.
     * @param {Object} column - The column definition.
     * @param {HTMLElement} editor - The cell's editor.
     * @param {boolean} should_validate - Whether to run the editor's validation.
     * @return {string} - The error message, or "" when the cell is valid.
     */
    refresh_cell_error = (row_entry, column, editor, should_validate) => {
        let message = this.get_cell_error(row_entry, column, editor, should_validate);

        this.apply_cell_error_mark(editor.parentElement, message);

        return message;
    }

    /**
     * Shows or clears a cell's error mark: a red outline, `aria-invalid`, and the message as the cell's tooltip and `aria-description`.
     * @param {HTMLTableCellElement} cell - The cell.
     * @param {string} message - The error message, or "" to clear it.
     */
    apply_cell_error_mark = (cell, message) => {
        let has_error = Boolean(message);

        cell.classList.toggle("has-error", has_error);
        cell.toggleAttribute("aria-invalid", has_error);

        if (has_error) {
            cell.dataset.tooltip = message;
            cell.setAttribute("aria-description", message);
            return;
        }

        delete cell.dataset.tooltip;
        cell.removeAttribute("aria-description");

        // The column's own tooltip, if it has one, describes the cell again once the error is gone.
        let row_entry = this.find_row_entry(cell.closest("tr")?.dataset.rowId);
        let column = this.columns.find((candidate) => candidate.key === cell.dataset.columnKey);

        if (row_entry && column) {
            this.apply_cell_tooltip_description(cell, column, row_entry.row);
        }
    }

    /**
     * Validates every editable cell of every open row, marks the invalid ones, and sets the table's validity for its form, anchored to the first invalid cell.
     * @return {boolean} - True when every cell is valid.
     */
    validate = () => {
        let first_invalid_editor = null;

        for (let row_entry of this.display_row_entries) {
            for (let column of this.columns) {
                let editor = this.is_column_editable(column) ? this.find_cell_editor(row_entry.row_id, column.key) : null;

                if (!editor) {
                    continue;
                }

                let message = this.refresh_cell_error(row_entry, column, editor, true);

                if (message && !first_invalid_editor) {
                    first_invalid_editor = editor;
                }
            }
        }

        if (first_invalid_editor) {
            this._internals.setValidity({customError: true}, INVALID_CELLS_MESSAGE, first_invalid_editor);

            return false;
        }

        this._internals.setValidity({});

        return true;
    }

    /**
     * Focuses the first cell marked with an error, scrolling it into view within the table. GalaxyForm calls this after scrolling to the table when it is the first
     * invalid field.
     */
    focus_first_invalid = () => {
        let first_invalid_editor = this.body_element?.querySelector("td.has-error > [data-column-key]");

        if (first_invalid_editor) {
            first_invalid_editor.scrollIntoView({block: "nearest"});
            first_invalid_editor.focus();
        }
    }

    /***************  Form Association  ***************/

    /**
     * Submits the rows as one JSON value, which is also the restore state.
     */
    update_form_value = () => {
        let rows_json = JSON.stringify(this.rows);

        this._internals.setFormValue(rows_json, rows_json);
    }

    /**
     * Web Components API - restores the rows the table had when it was created.
     */
    formResetCallback = () => {
        this.rows = structuredClone(this.initial_rows);
    }

    /**
     * Web Components API - restores previously submitted rows.
     * @param {string|File|FormData|null} state - The rows JSON previously passed to setFormValue.
     */
    formStateRestoreCallback = (state) => {
        if (typeof state === "string") {
            this.rows = state;
        }
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#post_on_create}
     * @note Runs after GalaxyTable's on_create has built and rendered the table.
     * @override
     */
    post_on_create = async () => {
        this.body_element.addEventListener("click", this.on_row_action_click);

        this.add_row_button = document.createElement("button");
        this.add_row_button.className = "add-row-button";
        this.add_row_button.type = "button";
        this.add_row_button.textContent = "+ Add Row";
        this.add_row_button.addEventListener("click", this.on_add_row_click);

        this.shadow.appendChild(this.add_row_button);

        this.render_add_row_button();
        this.update_form_value();
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_on_destroy}
     * @note Runs before GalaxyTable's on_destroy removes the table.
     * @override
     */
    pre_on_destroy = async () => {
        this.body_element?.removeEventListener("click", this.on_row_action_click);
        this.add_row_button?.removeEventListener("click", this.on_add_row_click);
        this.add_row_button?.remove();
        this.add_row_button = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_component_css}
     * @override
     */
    get post_component_css() {
        return `
            td {
                padding: 0.25rem 0.375rem;
            }

            td.has-error {
                outline: 2px solid var(--red);
                outline-offset: -2px;
            }

            tr.data-row.locked {
                background-color: rgba(0, 0, 0, 0.04);
            }

            tbody tr.data-row:nth-child(even).locked {
                background-color: rgba(0, 0, 0, 0.06);
            }

            .actions-header, .actions-cell {
                width: 1%;
                white-space: nowrap;
                text-align: center;
            }

            .row-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.75rem;
                height: 1.75rem;
                margin: 0 0.1rem;
                padding: 0;
                border: none;
                color: var(--grey);
                background: none;
                border-radius: 0.25rem;
                cursor: pointer;
            }

            .row-action:hover:not(:disabled) {
                color: var(--text-dark);
                background-color: rgba(0, 0, 0, 0.06);
            }

            .row-action:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 1px;
            }

            /* Passes the pointer through to the control tooltip around it, which a disabled button would otherwise swallow */
            .row-action:disabled {
                cursor: default;
                opacity: 0.35;
                pointer-events: none;
            }

            .lock-action[aria-pressed="true"] {
                color: var(--blue);
            }

            .remove-action:hover:not(:disabled) {
                color: var(--red);
            }

            .row-action svg {
                width: 1.1rem;
                height: 1.1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .add-row-button {
                margin-top: 0.5rem;
                padding: 0.25rem 0.75rem;
                border: 1px dashed var(--lightgrey);
                font: inherit;
                color: var(--blue);
                background: none;
                border-radius: 0.25rem;
                cursor: pointer;
            }

            .add-row-button:hover {
                border-color: var(--blue);
            }

            .add-row-button:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 1px;
            }

            .add-row-button[hidden] {
                display: none;
            }

            .visually-hidden {
                position: absolute;
                width: 1px;
                height: 1px;
                overflow: hidden;
                clip: rect(0 0 0 0);
                white-space: nowrap;
            }
        `;
    }
}
