/**
 * @file GalaxySortableList.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyTable} from "./GalaxyTable.js";

const DEFAULT_ID_KEY = "id";

// How close to the scrolling body's top or bottom edge, in pixels, the pointer must be during a drag to scroll it, and the most it scrolls per frame.
const AUTO_SCROLL_EDGE_SIZE = 40;
const AUTO_SCROLL_MAXIMUM_STEP = 12;

const GRIP_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5"></circle><circle cx="15" cy="6" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="9" cy="18" r="1.5"></circle><circle cx="15" cy="18" r="1.5"></circle></svg>`;
const UP_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>`;
const DOWN_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>`;

/**
 * @class
 * @description
 *     A {@link GalaxyTable} whose rows people put in order themselves - the tables of a report, the columns of a table. Columns, rows, column `render` functions, the empty
 *     state, and `max-body-height` work as on the Table; column sorting (`sortable`, `client-sort`) does not, since a manual order and a sort would fight, and neither does
 *     the light-DOM `<table>` source.
 *
 *     Each row has a drag handle in a leading column, dragged with a mouse, pen, or touch, and up and down buttons in a trailing column - the fallback where dragging is
 *     awkward. With a handle focused, Alt+ArrowUp and Alt+ArrowDown move its row, and each move is announced to screen readers. `hide-handle` and `hide-buttons` hide each
 *     set of controls, and `readonly` hides both. A user's move dispatches a bubbling `reorder` event with the new order; {@link move_row}, and setting `rows` or `order`,
 *     do not.
 *
 *     Each item is identified by its `id-key` field (`id` by default), or by its original position when it has none. It is form-associated: with a `name`, it submits the
 *     ids in their order as one JSON array, and a form reset restores the order the rows were last set in.
 * @extends GalaxyTable
 */
export class GalaxySortableList extends GalaxyTable {
    static formAssociated = true;

    /**
     * @constructor
     */
    constructor() {
        super();

        this._internals = this.attachInternals();

        this.sortable_row_entries = [];
        this.synced_rows_source = null;
        this.next_row_number = 0;
        this.initial_rows = [];
        this.live_region = null;
        this.drag_state = null;

        // Every column is unsortable: wrapped here because normalize_column is an arrow-function field, which a subclass cannot extend through super.
        let normalize_table_column = this.normalize_column;

        this.normalize_column = (column) => {
            return {...normalize_table_column(column), sortable: false};
        };
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [...super.observed_attributes, "readonly", "hide-handle", "hide-buttons", "id-key", "name"];
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
            "readonly": this.render,
            "hide-handle": this.render,
            "hide-buttons": this.render,
            "id-key": this.update_form_value,
            "name": this.update_form_value,
        }

        attribute_lookup_table[name]?.();
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the rows in their current order.
     * @override
     * @return {Object[]} - Copies of the rows.
     */
    get rows() {
        return this.row_entries.map((row_entry) => structuredClone(row_entry.row));
    }

    /**
     * Replaces every row, in the order given. Each row gets a new id, and this order becomes the one a form reset restores. Dispatches no event.
     * @override
     * @param {Object[]|string|null} value - The rows, or a JSON string of them.
     */
    set rows(value) {
        this.apply_rows(value);
        this.update_form_value();
    }

    /**
     * Gets the items' ids in their current order - each row's {@link id_key} field, or its original position when it has none.
     * @return {Array} - The ids.
     */
    get order() {
        return this.row_entries.map(this.get_item_id);
    }

    /**
     * Puts the rows in the order of the ids given. Rows whose ids are not listed keep their relative order after the listed ones. Dispatches no event.
     * @param {Array|string} value - The ids, or a JSON string of them.
     */
    set order(value) {
        let ids = this.parse_array_value(value, "order") || [];
        let position_by_id = new Map(ids.map((id, position) => [JSON.stringify(id), position]));

        let get_position = (row_entry) => {
            return position_by_id.get(JSON.stringify(this.get_item_id(row_entry))) ?? ids.length;
        };

        // Array.prototype.sort is stable, so unlisted rows keep their relative order.
        this.sortable_row_entries = [...this.row_entries].sort((first_row_entry, second_row_entry) => {
            return get_position(first_row_entry) - get_position(second_row_entry);
        });

        this.commit_row_entries();
        this.render_body();
        this.update_form_value();
    }

    /**
     * Gets the row entries - `{row_id, row, index, original_index}` - kept in step with the rows {@link GalaxyTable} was given, and reordered in place by moves.
     * @override
     * @return {Object[]} - The row entries.
     */
    get row_entries() {
        if (this._rows !== this.synced_rows_source) {
            this.sync_row_entries_from_rows();
        }

        return this.sortable_row_entries;
    }

    /**
     * Never sorts: the rows' order is the one people give them.
     * @override
     * @return {boolean} - Always false.
     */
    get client_sort() {
        return false;
    }

    /**
     * Never reads a light-DOM `<table>`: its cloned markup has no row data to reorder.
     * @override
     * @return {boolean} - Always false.
     */
    get is_using_light_dom() {
        return false;
    }

    /**
     * Gets whether the list is read-only.
     * @return {boolean} - True when read-only.
     */
    get readonly() {return this.hasAttribute("readonly");}

    /**
     * Sets whether the list is read-only: no handles or buttons, and no moves from the keyboard.
     * @param {boolean} value - True for read-only.
     */
    set readonly(value) {
        this.toggleAttribute("readonly", Boolean(value));
    }

    /**
     * Gets whether the drag handles are hidden.
     * @return {boolean} - True when hidden.
     */
    get hide_handle() {return this.hasAttribute("hide-handle");}

    /**
     * Sets whether the drag handles are hidden.
     * @param {boolean} value - True to hide them.
     */
    set hide_handle(value) {
        this.toggleAttribute("hide-handle", Boolean(value));
    }

    /**
     * Gets whether the up and down buttons are hidden.
     * @return {boolean} - True when hidden.
     */
    get hide_buttons() {return this.hasAttribute("hide-buttons");}

    /**
     * Sets whether the up and down buttons are hidden.
     * @param {boolean} value - True to hide them.
     */
    set hide_buttons(value) {
        this.toggleAttribute("hide-buttons", Boolean(value));
    }

    /**
     * Gets the field each item is identified by.
     * @return {string} - The field name, `id` by default.
     */
    get id_key() {return this.getAttribute("id-key") || DEFAULT_ID_KEY;}

    /**
     * Sets the field each item is identified by.
     * @param {string|null} value - The field name, or null for `id`.
     */
    set id_key(value) {
        if (value) {
            this.setAttribute("id-key", value);
        }
        else {
            this.removeAttribute("id-key");
        }
    }

    /**
     * Gets the field name the order is submitted under.
     * @return {string|null} - The name.
     */
    get name() {return this.getAttribute("name");}

    /**
     * Sets the field name the order is submitted under.
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
     * Gets whether the drag handle column is shown.
     * @return {boolean} - True when shown.
     */
    get has_drag_handles() {
        return !this.readonly && !this.hide_handle;
    }

    /**
     * Gets whether the up and down button column is shown.
     * @return {boolean} - True when shown.
     */
    get has_move_buttons() {
        return !this.readonly && !this.hide_buttons;
    }

    /**
     * {@link GalaxyTable#leading_column_count}
     * @override
     */
    get leading_column_count() {
        return this.has_drag_handles ? 1 : 0;
    }

    /**
     * {@link GalaxyTable#extra_column_count}
     * @override
     */
    get extra_column_count() {
        return this.has_move_buttons ? 1 : 0;
    }

    /***************  Rows  ***************/

    /**
     * Rebuilds the row entries from the rows GalaxyTable was given, copying each row so moves never change the caller's objects. The order they are given in becomes the
     * one a form reset restores.
     */
    sync_row_entries_from_rows = () => {
        let rows = this._rows || [];

        this.sortable_row_entries = rows.map((row, original_index) => {
            this.next_row_number += 1;

            return {
                row_id: `sortable_row_${this.next_row_number}`,
                row: row && typeof row === "object" ? structuredClone(row) : {},
                index: original_index,
                original_index: original_index,
                cell_nodes: null,
            };
        });

        this.initial_rows = this.sortable_row_entries.map((row_entry) => structuredClone(row_entry.row));
        this.commit_row_entries();
    }

    /**
     * Renumbers the row entries and points GalaxyTable's rows at them, after a move.
     */
    commit_row_entries = () => {
        for (let [index, row_entry] of this.sortable_row_entries.entries()) {
            row_entry.index = index;
        }

        this._rows = this.sortable_row_entries.map((row_entry) => row_entry.row);
        this.synced_rows_source = this._rows;
    }

    /**
     * Gets an item's id: its {@link id_key} field, or its original position when it has none.
     * @param {Object} row_entry - The row entry.
     * @return {*} - The id.
     */
    get_item_id = (row_entry) => {
        let id_key = this.id_key;

        return Object.hasOwn(row_entry.row, id_key) ? row_entry.row[id_key] : row_entry.original_index;
    }

    /**
     * Gets the text an item is named by in its handle's label and in move announcements - its first column's value.
     * @param {Object} row_entry - The row entry.
     * @return {string} - The label.
     */
    get_item_label = (row_entry) => {
        let first_column = this.columns[0];
        let value = first_column ? row_entry.row[first_column.key] : undefined;
        let has_value = value !== null && value !== undefined && value !== "";

        return has_value ? String(value) : `item ${row_entry.index + 1}`;
    }

    /**
     * Finds a row's rendered `<tr>`.
     * @param {string} row_id - The row's id.
     * @return {HTMLTableRowElement|null} - The row, or null when it is not rendered.
     */
    find_table_row = (row_id) => {
        return this.body_element?.querySelector(`tr[data-row-id="${row_id}"]`) ?? null;
    }

    /**
     * Moves a row from one position to another, moving its rendered `<tr>` rather than re-rendering the list. Dispatches no event.
     * @param {number} from_index - The row's current position.
     * @param {number} to_index - Its new position, clamped to the list.
     * @return {boolean} - True when the row moved.
     */
    move_row = (from_index, to_index) => {
        let row_entries = this.row_entries;
        let last_index = row_entries.length - 1;
        let target_index = Math.min(Math.max(Number(to_index), 0), last_index);
        let is_valid_move = Number.isInteger(from_index) && from_index >= 0 && from_index <= last_index && Number.isInteger(target_index);

        if (!is_valid_move || target_index === from_index) {
            return false;
        }

        let [row_entry] = row_entries.splice(from_index, 1);
        row_entries.splice(target_index, 0, row_entry);

        this.commit_row_entries();
        this.place_table_row(row_entry);
        this.refresh_row_positions();
        this.update_form_value();

        return true;
    }

    /**
     * Moves a row's `<tr>` to the place its entry holds in the order.
     * @param {Object} row_entry - The row entry.
     */
    place_table_row = (row_entry) => {
        let table_row = this.find_table_row(row_entry.row_id);

        if (!table_row) {
            return;
        }

        let next_row_entry = this.row_entries[row_entry.index + 1];
        let next_table_row = next_row_entry ? this.find_table_row(next_row_entry.row_id) : null;

        this.body_element.insertBefore(table_row, next_table_row);
    }

    /**
     * Brings each rendered row's position and its up and down buttons' disabled states up to date after a move.
     */
    refresh_row_positions = () => {
        let last_index = this.row_entries.length - 1;

        for (let row_entry of this.row_entries) {
            let table_row = this.find_table_row(row_entry.row_id);

            if (!table_row) {
                continue;
            }

            table_row.dataset.index = String(row_entry.index);

            let up_button = table_row.querySelector(".move-up-action");
            let down_button = table_row.querySelector(".move-down-action");

            if (up_button) {
                up_button.disabled = row_entry.index === 0;
            }

            if (down_button) {
                down_button.disabled = row_entry.index === last_index;
            }
        }
    }

    /**
     * Moves a row for a user's action: announces it and dispatches `reorder` when it actually moved.
     * @param {string} row_id - The row's id.
     * @param {number} to_index - Its new position.
     * @return {boolean} - True when the row moved.
     */
    move_row_for_user = (row_id, to_index) => {
        let row_entry = this.row_entries.find((entry) => entry.row_id === row_id);

        if (!row_entry || this.readonly) {
            return false;
        }

        let from_index = row_entry.index;

        if (!this.move_row(from_index, to_index)) {
            return false;
        }

        this.dispatch_reorder(row_entry, from_index);

        return true;
    }

    /**
     * Announces a move to screen readers and dispatches `reorder`.
     * @param {Object} row_entry - The moved row's entry, at its new position.
     * @param {number} from_index - Its position before the move.
     */
    dispatch_reorder = (row_entry, from_index) => {
        this.announce(`Moved ${this.get_item_label(row_entry)} to position ${row_entry.index + 1} of ${this.row_entries.length}.`);

        let detail = {order: this.order, rows: this.rows, row_id: row_entry.row_id, row: structuredClone(row_entry.row), from_index: from_index, to_index: row_entry.index};

        this.dispatchEvent(new CustomEvent("reorder", {bubbles: true, detail: detail}));
    }

    /**
     * Sets the visually hidden live region's text, which screen readers read out.
     * @param {string} message - The message.
     */
    announce = (message) => {
        if (this.live_region) {
            this.live_region.textContent = message;
        }
    }

    /***************  Rendering  ***************/

    /**
     * {@link GalaxyTable#create_leading_header_cells}
     * @override
     */
    create_leading_header_cells = () => {
        return this.has_drag_handles ? [this.create_control_header("handle-header", "Reorder")] : [];
    }

    /**
     * {@link GalaxyTable#create_extra_header_cells}
     * @override
     */
    create_extra_header_cells = () => {
        return this.has_move_buttons ? [this.create_control_header("move-header", "Move")] : [];
    }

    /**
     * Creates a header cell for a control column, labeled for screen readers only.
     * @param {string} class_name - The cell's class.
     * @param {string} label - Its label.
     * @return {HTMLTableCellElement} - The header cell.
     */
    create_control_header = (class_name, label) => {
        let header_cell = document.createElement("th");
        header_cell.className = class_name;
        header_cell.scope = "col";

        let label_element = document.createElement("span");
        label_element.className = "visually-hidden";
        label_element.textContent = label;

        header_cell.appendChild(label_element);

        return header_cell;
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

        if (this.has_drag_handles) {
            table_row.appendChild(this.create_handle_cell(row_entry));
        }

        for (let column of columns) {
            let cell = document.createElement("td");

            this.apply_column_layout(cell, column);
            this.fill_cell(cell, column, row_entry.row);

            table_row.appendChild(cell);
        }

        if (this.has_move_buttons) {
            table_row.appendChild(this.create_move_cell(row_entry));
        }

        return table_row;
    }

    /**
     * Creates a row's drag handle cell.
     * @param {Object} row_entry - The row entry.
     * @return {HTMLTableCellElement} - The cell.
     */
    create_handle_cell = (row_entry) => {
        let handle_cell = document.createElement("td");
        handle_cell.className = "handle-cell";

        let handle_button = document.createElement("button");
        handle_button.className = "row-action drag-handle";
        handle_button.type = "button";
        handle_button.dataset.rowId = row_entry.row_id;
        handle_button.setAttribute("aria-label", `Reorder ${this.get_item_label(row_entry)}`);
        handle_button.title = "Drag to reorder, or press Alt+Up or Alt+Down";
        handle_button.innerHTML = GRIP_ICON_HTML;

        handle_cell.appendChild(handle_button);

        return handle_cell;
    }

    /**
     * Creates a row's up and down button cell, with each button disabled at its end of the list.
     * @param {Object} row_entry - The row entry.
     * @return {HTMLTableCellElement} - The cell.
     */
    create_move_cell = (row_entry) => {
        let move_cell = document.createElement("td");
        move_cell.className = "move-cell";

        let up_button = this.create_move_button("move-up", "Move up", UP_ICON_HTML, row_entry);
        let down_button = this.create_move_button("move-down", "Move down", DOWN_ICON_HTML, row_entry);

        up_button.disabled = row_entry.index === 0;
        down_button.disabled = row_entry.index === this.row_entries.length - 1;

        move_cell.append(up_button, down_button);

        return move_cell;
    }

    /**
     * Creates an up or down button.
     * @param {string} action - "move-up" or "move-down".
     * @param {string} label - Its label.
     * @param {string} icon_html - Its icon.
     * @param {Object} row_entry - The row entry.
     * @return {HTMLButtonElement} - The button.
     */
    create_move_button = (action, label, icon_html, row_entry) => {
        let move_button = document.createElement("button");
        move_button.className = `row-action ${action}-action`;
        move_button.type = "button";
        move_button.dataset.action = action;
        move_button.dataset.rowId = row_entry.row_id;
        move_button.setAttribute("aria-label", label);
        move_button.title = label;
        move_button.innerHTML = icon_html;

        return move_button;
    }

    /***************  User Actions  ***************/

    /**
     * Handles an up or down button click, keeping focus on a button of the moved row.
     * @param {MouseEvent} event - The click event.
     */
    on_move_button_click = (event) => {
        let move_button = event.target.closest?.("button[data-action]");

        if (!move_button || move_button.disabled) {
            return;
        }

        let row_id = move_button.dataset.rowId;
        let row_entry = this.row_entries.find((entry) => entry.row_id === row_id);

        if (!row_entry) {
            return;
        }

        let action = move_button.dataset.action;
        let offset = 0;

        if (action === "move-up") {
            offset = -1;
        }
        else if (action === "move-down") {
            offset = 1;
        }
        else {
            throw new Error(`Move action "${action}" is not valid here.`);
        }

        if (!this.move_row_for_user(row_id, row_entry.index + offset)) {
            return;
        }

        // Moving the <tr> drops focus; keep it on the same button, or on the other one once this one is disabled at the end of the list.
        let table_row = this.find_table_row(row_id);
        let same_button = table_row?.querySelector(`.${action}-action`);
        let other_button = table_row?.querySelector(action === "move-up" ? ".move-down-action" : ".move-up-action");

        (same_button && !same_button.disabled ? same_button : other_button)?.focus();
    }

    /**
     * Handles Alt+ArrowUp and Alt+ArrowDown on a focused drag handle, and Escape during a drag.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_handle_keydown = (event) => {
        let handle_button = event.target.closest?.(".drag-handle");

        if (!handle_button) {
            return;
        }

        let is_move_key = event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown");

        if (!is_move_key) {
            return;
        }

        event.preventDefault();

        if (this.drag_state) {
            return;
        }

        let row_id = handle_button.dataset.rowId;
        let row_entry = this.row_entries.find((entry) => entry.row_id === row_id);

        if (!row_entry) {
            return;
        }

        let offset = event.key === "ArrowUp" ? -1 : 1;

        if (this.move_row_for_user(row_id, row_entry.index + offset)) {
            this.find_table_row(row_id)?.querySelector(".drag-handle")?.focus();
        }
    }

    /***************  Dragging  ***************/

    /**
     * Starts a drag when a handle is pressed with the primary button, or touched.
     * @param {PointerEvent} event - The pointerdown event.
     */
    on_handle_pointerdown = (event) => {
        let handle_button = event.target.closest?.(".drag-handle");
        let is_primary_press = event.button === 0 || event.button === undefined;

        if (!handle_button || !is_primary_press || this.readonly || this.drag_state) {
            return;
        }

        let row_id = handle_button.dataset.rowId;
        let row_entry = this.row_entries.find((entry) => entry.row_id === row_id);
        let table_row = this.find_table_row(row_id);

        if (!row_entry || !table_row) {
            return;
        }

        // Keeps the press from selecting text, and a touch from scrolling the page (with the handle's touch-action: none).
        event.preventDefault();

        let drag_controller = new AbortController();

        this.drag_state = {
            row_id: row_id,
            row_entry: row_entry,
            table_row: table_row,
            handle_button: handle_button,
            pointer_id: event.pointerId,
            start_index: row_entry.index,
            pointer_y: event.clientY,
            scroll_frame: null,
            controller: drag_controller,
        };

        try {
            handle_button.setPointerCapture?.(event.pointerId);
        }
        catch (error) {
            console.warn(`${this.constructor.name}: The pointer could not be captured for dragging.`, error);
        }

        handle_button.focus();
        table_row.classList.add("dragging");
        this.toggleAttribute("dragging", true);

        // On window: a captured pointer's events still bubble there, and the drag keeps working if capture was refused.
        window.addEventListener("pointermove", this.on_drag_pointermove, {signal: drag_controller.signal});
        window.addEventListener("pointerup", this.on_drag_pointerup, {signal: drag_controller.signal});
        window.addEventListener("pointercancel", this.on_drag_pointercancel, {signal: drag_controller.signal});
        window.addEventListener("keydown", this.on_drag_keydown, {signal: drag_controller.signal, capture: true});
    }

    /**
     * Follows the pointer during a drag.
     * @param {PointerEvent} event - The pointermove event.
     */
    on_drag_pointermove = (event) => {
        if (!this.drag_state || event.pointerId !== this.drag_state.pointer_id) {
            return;
        }

        this.drag_state.pointer_y = event.clientY;

        this.update_drag_position();
        this.update_auto_scroll();
    }

    /**
     * Drops the dragged row where it is.
     * @param {PointerEvent} event - The pointerup event.
     */
    on_drag_pointerup = (event) => {
        if (!this.drag_state || event.pointerId !== this.drag_state.pointer_id) {
            return;
        }

        this.end_drag(true);
    }

    /**
     * Puts the dragged row back when the browser cancels the pointer (a touch taken over for scrolling, for one).
     * @param {PointerEvent} event - The pointercancel event.
     */
    on_drag_pointercancel = (event) => {
        if (!this.drag_state || event.pointerId !== this.drag_state.pointer_id) {
            return;
        }

        this.end_drag(false);
    }

    /**
     * Puts the dragged row back on Escape.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_drag_keydown = (event) => {
        if (event.key !== "Escape") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.end_drag(false);
    }

    /**
     * Moves the dragged `<tr>` past each neighbor whose midpoint the pointer has crossed, so the other rows shift around it as it goes. The order itself changes on drop.
     */
    update_drag_position = () => {
        let {table_row, pointer_y} = this.drag_state;
        let has_moved = true;

        while (has_moved) {
            has_moved = false;

            let previous_row = table_row.previousElementSibling;
            let next_row = table_row.nextElementSibling;

            if (previous_row && pointer_y < this.get_row_midpoint(previous_row)) {
                this.body_element.insertBefore(table_row, previous_row);
                has_moved = true;
            }
            else if (next_row && pointer_y > this.get_row_midpoint(next_row)) {
                this.body_element.insertBefore(table_row, next_row.nextElementSibling);
                has_moved = true;
            }
        }
    }

    /**
     * Gets a row's vertical midpoint in viewport coordinates.
     * @param {HTMLTableRowElement} table_row - The row.
     * @return {number} - The midpoint.
     */
    get_row_midpoint = (table_row) => {
        let rect = table_row.getBoundingClientRect();

        return rect.top + rect.height / 2;
    }

    /**
     * Gets how far the scrolling body should scroll this frame: toward whichever edge the pointer is near, faster the nearer it is, or 0 away from both.
     * @return {number} - The scroll step in pixels, negative to scroll up.
     */
    get_auto_scroll_step = () => {
        if (!this.drag_state || !this.max_body_height || !this.table_container) {
            return 0;
        }

        let rect = this.table_container.getBoundingClientRect();
        let pointer_y = this.drag_state.pointer_y;
        let distance_into_top_edge = rect.top + AUTO_SCROLL_EDGE_SIZE - pointer_y;
        let distance_into_bottom_edge = pointer_y - (rect.bottom - AUTO_SCROLL_EDGE_SIZE);

        if (distance_into_top_edge > 0) {
            return -Math.ceil(AUTO_SCROLL_MAXIMUM_STEP * Math.min(distance_into_top_edge / AUTO_SCROLL_EDGE_SIZE, 1));
        }

        if (distance_into_bottom_edge > 0) {
            return Math.ceil(AUTO_SCROLL_MAXIMUM_STEP * Math.min(distance_into_bottom_edge / AUTO_SCROLL_EDGE_SIZE, 1));
        }

        return 0;
    }

    /**
     * Starts the auto-scroll loop when the pointer nears an edge of the scrolling body. The loop scrolls every frame and stops itself once the pointer leaves the edge.
     */
    update_auto_scroll = () => {
        let is_scroll_running = this.drag_state.scroll_frame !== null;
        let can_animate = typeof window.requestAnimationFrame === "function";

        if (is_scroll_running || !can_animate || this.get_auto_scroll_step() === 0) {
            return;
        }

        let step = () => {
            if (!this.drag_state) {
                return;
            }

            let scroll_step = this.get_auto_scroll_step();

            if (scroll_step === 0) {
                this.drag_state.scroll_frame = null;
                return;
            }

            this.table_container.scrollTop += scroll_step;
            this.update_drag_position();
            this.drag_state.scroll_frame = window.requestAnimationFrame(step);
        };

        this.drag_state.scroll_frame = window.requestAnimationFrame(step);
    }

    /**
     * Ends a drag, either keeping the row where it was dropped - a user move, dispatching `reorder` when its position changed - or putting it back.
     * @param {boolean} should_keep_position - True to keep the drop position.
     */
    end_drag = (should_keep_position) => {
        let drag_state = this.drag_state;

        if (!drag_state) {
            return;
        }

        this.drag_state = null;

        drag_state.controller.abort();

        if (drag_state.scroll_frame !== null) {
            window.cancelAnimationFrame?.(drag_state.scroll_frame);
        }

        try {
            drag_state.handle_button.releasePointerCapture?.(drag_state.pointer_id);
        }
        catch (error) {
            // The capture was already released, or never taken; there is nothing to release.
        }

        drag_state.table_row.classList.remove("dragging");
        this.removeAttribute("dragging");

        // The body's own rows only: a column's render function may put a table of its own in a cell.
        let data_rows = Array.from(this.body_element?.children ?? []).filter((child) => child.classList.contains("data-row"));
        let drop_index = data_rows.indexOf(drag_state.table_row);

        if (should_keep_position && drop_index !== -1 && drop_index !== drag_state.start_index) {
            this.move_row_for_user(drag_state.row_id, drop_index);
        }
        else {
            this.place_table_row(drag_state.row_entry);
        }

        drag_state.handle_button.focus();
    }

    /***************  Form Association  ***************/

    /**
     * Sets the submitted value: the ids in their order, as JSON.
     */
    update_form_value = () => {
        let order_json = JSON.stringify(this.order);

        this._internals.setFormValue(order_json, order_json);
    }

    /**
     * Web Components API - restores the order the rows were last set in.
     */
    formResetCallback = () => {
        this.rows = structuredClone(this.initial_rows);
    }

    /**
     * Web Components API - restores a previously submitted order.
     * @param {string|File|FormData|null} state - The order JSON previously passed to setFormValue.
     */
    formStateRestoreCallback = (state) => {
        if (typeof state === "string") {
            this.order = state;
        }
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#post_on_create}
     * @note Runs after GalaxyTable's on_create has built and rendered the table.
     * @override
     */
    post_on_create = async () => {
        this.body_element.addEventListener("click", this.on_move_button_click);
        this.body_element.addEventListener("keydown", this.on_handle_keydown);
        this.body_element.addEventListener("pointerdown", this.on_handle_pointerdown);

        this.live_region = document.createElement("div");
        this.live_region.className = "visually-hidden";
        this.live_region.setAttribute("aria-live", "polite");

        this.shadow.appendChild(this.live_region);

        this.update_form_value();
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_on_destroy}
     * @note Runs before GalaxyTable's on_destroy removes the table.
     * @override
     */
    pre_on_destroy = async () => {
        this.end_drag(false);

        this.body_element?.removeEventListener("click", this.on_move_button_click);
        this.body_element?.removeEventListener("keydown", this.on_handle_keydown);
        this.body_element?.removeEventListener("pointerdown", this.on_handle_pointerdown);

        this.live_region?.remove();
        this.live_region = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_component_css}
     * @override
     */
    get post_component_css() {
        return `
            .handle-header, .handle-cell, .move-header, .move-cell {
                width: 1%;
                padding: 0.25rem;
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

            .row-action:disabled {
                cursor: default;
                opacity: 0.35;
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

            /* The handle owns its touches, so dragging it never scrolls the page */
            .drag-handle {
                cursor: grab;
                touch-action: none;
            }

            .drag-handle svg {
                fill: currentColor;
                stroke: none;
            }

            :host([dragging]) {
                user-select: none;
            }

            :host([dragging]), :host([dragging]) .drag-handle {
                cursor: grabbing;
            }

            tbody tr.data-row.dragging {
                position: relative;
                z-index: 1;
                background-color: #e7f1ff;
                box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);
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
