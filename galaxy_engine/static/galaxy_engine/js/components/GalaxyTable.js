/**
 * @file GalaxyTable.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

const TABLE_HTML_TEMPLATE = `
    <div class="galaxy-table-container">
        <table class="galaxy-table">
            <thead><tr class="header-row"></tr></thead>
            <tbody class="body"></tbody>
        </table>
        <slot></slot>
    </div>
`;

const SORT_DIRECTIONS = {
    ASCENDING: "asc",
    DESCENDING: "desc",
};

const VALID_ALIGNMENTS = ["left", "center", "right"];

/**
 * @class
 * @description
 *     A data table. Its data comes from one of two sources:
 *     - the `columns` and `rows` attributes/properties (a JSON array of `{key, label, sortable, align, width}` column definitions and a JSON array of row objects keyed by
 *       column `key`), or
 *     - a light-DOM `<table>` child, read as a declarative data source when no `columns` have been supplied. Each header `<th>` may carry `data-key`, `data-sortable`,
 *       `data-align`, and `data-width`; each body `<td>` may carry `data-sort-value` to sort by something other than its text. Cell markup is cloned into the rendered table,
 *       and edits to the light-DOM table re-render it.
 *
 *     A column may also carry a `render(value, row)` function (set through the `columns` property, since a function cannot travel in JSON) returning a string, shown as text,
 *     or a Node, appended as-is.
 *
 *     Sortable headers show an arrow for their direction, plus their position in the sort order when more than one column is sorted. Clicking a sortable header sorts by that
 *     column alone, cycling ascending -> descending -> unsorted; shift-clicking adds it to (or cycles it within) the existing sort. Every sort change dispatches `sort_change`.
 *     With `clickable-rows` set, rows are focusable and a click, Enter, or Space dispatches `row_click`. Rows are only reordered locally when `client-sort` is set - otherwise
 *     the consumer is expected to respond to `sort_change` by supplying already-sorted rows (e.g. from the server).
 *
 *     Light-DOM children other than the `<table>` are slotted over the rendered table's area, so an absolutely positioned child (e.g. a `GalaxyLoaderManager` element loader
 *     shown on the table) covers it.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyTable extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(TABLE_HTML_TEMPLATE);

        this._columns = null; // null (rather than []) means "not supplied", so the light-DOM table is used instead.
        this._rows = [];
        this._sort = [];
        this._light_dom_row_entries = null;
        this.light_dom_observer = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["columns", "rows", "sort", "client-sort", "clickable-rows", "empty-message"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        const attribute_lookup_table = {
            "columns": () => this.apply_columns(new_value),
            "rows": () => this.apply_rows(new_value),
            "sort": () => this.apply_sort(new_value),
            "client-sort": this.render_body,
            "clickable-rows": this.render_body,
            "empty-message": this.render_body,
        }

        attribute_lookup_table[name]?.();
    }

    /**
     * Gets the column definitions in use - the supplied `columns`, or those read from the light-DOM `<table>` when none were supplied.
     * @return {Object[]} - The column definitions, each `{key, label, sortable, align, width}`.
     */
    get columns() {
        if (this._columns) {
            return this._columns;
        }

        return this.light_dom_data.columns;
    }

    /**
     * Sets the column definitions. Takes precedence over a light-DOM `<table>`.
     * @param {Object[]|string|null} value - An array of `{key, label, sortable, align, width}` objects, or that array as a JSON string. `null` clears it, reverting to the
     *     light-DOM `<table>` if there is one.
     */
    set columns(value) {
        this.apply_columns(value);
    }

    /**
     * Gets the row objects in use, in their supplied (unsorted) order.
     * @return {Object[]} - The row objects, keyed by column `key`.
     */
    get rows() {
        return this.row_entries.map((row_entry) => {
            return row_entry.row;
        });
    }

    /**
     * Sets the row objects. Prefer this property over the `rows` attribute for anything beyond a handful of rows, since it skips serializing them to JSON.
     * @param {Object[]|string|null} value - An array of row objects keyed by column `key`, or that array as a JSON string.
     */
    set rows(value) {
        this.apply_rows(value);
    }

    /**
     * Gets the current sort order, highest priority first.
     * @return {Object[]} - A copy of the sort order, each `{key, direction}` where `direction` is `"asc"` or `"desc"`.
     */
    get sort() {
        return this._sort.map((sort_entry) => {
            return {...sort_entry};
        });
    }

    /**
     * Sets the sort order without dispatching `sort_change` - use this to reflect a sort the consumer already applied (e.g. on page load).
     * @param {Object[]|string|null} value - An array of `{key, direction}` objects, or that array as a JSON string.
     */
    set sort(value) {
        this.apply_sort(value);
    }

    /**
     * Gets whether the table sorts its rows itself.
     * @return {boolean} - True when rows are reordered locally on a sort change.
     */
    get client_sort() {return this.hasAttribute("client-sort");}

    /**
     * Sets whether the table sorts its rows itself. Intended for small tables; large or paginated data should be sorted by the consumer in response to `sort_change`.
     * @param {boolean} value - True to reorder rows locally on a sort change.
     */
    set client_sort(value) {
        if (value) {
            this.setAttribute("client-sort", "");
        }
        else {
            this.removeAttribute("client-sort");
        }
    }

    /**
     * Gets whether rows are clickable.
     * @return {boolean} - True when rows are focusable and dispatch `row_click`.
     */
    get clickable_rows() {return this.hasAttribute("clickable-rows");}

    /**
     * Sets whether rows are clickable. Clickable rows are focusable, show a pointer on hover, and dispatch `row_click` on a click, Enter, or Space.
     * @param {boolean} value - True to make rows clickable.
     */
    set clickable_rows(value) {
        if (value) {
            this.setAttribute("clickable-rows", "");
        }
        else {
            this.removeAttribute("clickable-rows");
        }
    }

    /**
     * Gets the message shown when there are no rows.
     * @return {string} - The empty-state message. Defaults to "No data".
     */
    get empty_message() {
        let explicit_message = this.getAttribute("empty-message");

        return explicit_message !== null ? explicit_message : "No data";
    }

    /**
     * Sets the message shown when there are no rows.
     * @param {string|null|undefined} value - The empty-state message. `null`/`undefined` revert to the "No data" default.
     */
    set empty_message(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("empty-message");
        }
        else {
            this.setAttribute("empty-message", value);
        }
    }

    /**
     * Gets whether the table is reading its data from a light-DOM `<table>` rather than supplied `columns`/`rows`.
     * @return {boolean} - True when the light-DOM `<table>` is the data source.
     */
    get is_using_light_dom() {
        return !this._columns && Boolean(this.querySelector(":scope > table"));
    }

    /**
     * Gets the row entries in their supplied order. A row entry is `{row, index, cell_nodes}`, where `cell_nodes` holds the light-DOM cells to clone (or null for supplied rows).
     * @return {Object[]} - The row entries.
     */
    get row_entries() {
        if (this.is_using_light_dom) {
            return this.light_dom_data.row_entries;
        }

        return this._rows.map((row, index) => {
            return {row: row, index: index, cell_nodes: null};
        });
    }

    /**
     * Gets the row entries in display order - sorted by {@link sort} when {@link client_sort} is set, otherwise in their supplied order.
     * @return {Object[]} - The row entries to render.
     */
    get display_row_entries() {
        let row_entries = this.row_entries;
        let should_sort_locally = this.client_sort && this._sort.length > 0;

        if (should_sort_locally) {
            // Array.prototype.sort is stable, so rows with equal sort values keep their supplied order.
            return [...row_entries].sort(this.compare_row_entries);
        }

        return row_entries;
    }

    /**
     * Gets the columns and row entries read from the light-DOM `<table>`, re-reading it only after it has changed.
     * @return {{columns: Object[], row_entries: Object[]}} - The light-DOM data, empty when there is no light-DOM `<table>`.
     */
    get light_dom_data() {
        if (!this._light_dom_row_entries) {
            this._light_dom_row_entries = this.read_light_dom_table();
        }

        return this._light_dom_row_entries;
    }

    /**
     * Reads column definitions and rows from the light-DOM `<table>`. Header cells come from the `<thead>`'s first row, or the table's first row when there is no `<thead>`.
     * @return {{columns: Object[], row_entries: Object[]}} - The columns and row entries; both empty when there is no light-DOM `<table>`.
     */
    read_light_dom_table = () => {
        let light_dom_data = {columns: [], row_entries: []};
        let table = this.querySelector(":scope > table");

        if (table === null) {
            return light_dom_data;
        }

        let header_row = table.querySelector(":scope > thead > tr") || table.rows[0];

        if (!header_row) {
            return light_dom_data;
        }

        light_dom_data.columns = Array.from(header_row.cells).map((header_cell, index) => {
            let sortable_value = header_cell.dataset.sortable;

            return {
                key: header_cell.dataset.key || `column_${index}`,
                label: header_cell.textContent.trim(),
                sortable: sortable_value !== undefined && sortable_value !== "false",
                align: header_cell.dataset.align,
                width: header_cell.dataset.width,
            };
        });

        let body_rows = Array.from(table.rows).filter((table_row) => {
            return table_row !== header_row && table_row.parentElement.tagName !== "THEAD";
        });

        light_dom_data.row_entries = body_rows.map((table_row, index) => {
            let row = {};
            let cell_nodes = Array.from(table_row.cells);

            for (let [column_index, column] of light_dom_data.columns.entries()) {
                let cell = cell_nodes[column_index];

                row[column.key] = cell ? this.get_light_dom_cell_value(cell) : null;
            }

            return {row: row, index: index, cell_nodes: cell_nodes};
        });

        return light_dom_data;
    }

    /**
     * Gets the sortable value of a light-DOM cell - its `data-sort-value` when present, otherwise its trimmed text - converting numeric strings to numbers so they sort
     * numerically.
     * @param {HTMLTableCellElement} cell - The light-DOM cell.
     * @return {number|string} - The cell's value.
     */
    get_light_dom_cell_value = (cell) => {
        let value_string = cell.dataset.sortValue !== undefined ? cell.dataset.sortValue : cell.textContent.trim();
        let is_numeric = value_string !== "" && !Number.isNaN(Number(value_string));

        if (is_numeric) {
            return Number(value_string);
        }

        return value_string;
    }

    /**
     * Parses a JSON-array value (an attribute's JSON string, or an array passed to a property) shared by {@link apply_columns}, {@link apply_rows}, and {@link apply_sort}.
     * @param {Array|string|null|undefined} value - The value to parse.
     * @param {string} name - The name of the value, for the warning on invalid input.
     * @return {Array|null} - The parsed array, or null when the value is empty or invalid.
     */
    parse_array_value = (value, name) => {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        let parsed_value = value;

        if (typeof value === "string") {
            try {
                parsed_value = JSON.parse(value);
            }
            catch (error) {
                console.warn(`${this.constructor.name}: Invalid ${name} JSON string, ignoring it.`);
                return null;
            }
        }

        if (!Array.isArray(parsed_value)) {
            console.warn(`${this.constructor.name}: ${name} must be an array, ignoring it.`);
            return null;
        }

        return parsed_value;
    }

    /**
     * Applies new column definitions, dropping any sort entry whose column no longer exists or is no longer sortable.
     * @param {Object[]|string|null} value - The column definitions, or a JSON string of them.
     */
    apply_columns = (value) => {
        let parsed_columns = this.parse_array_value(value, "columns");

        if (parsed_columns === null) {
            this._columns = null;
        }
        else {
            this._columns = parsed_columns.map(this.normalize_column);
        }

        this.prune_sort();
        this.render();
    }

    /**
     * Normalizes one column definition: `label` defaults to `key`, `sortable` becomes a real boolean, and an unrecognized `align` or a non-function `render` is dropped with a
     * warning.
     * @param {Object} column - The column definition as supplied.
     * @return {Object} - The normalized column definition.
     */
    normalize_column = (column) => {
        let align = column.align;
        let has_invalid_alignment = Boolean(align) && !VALID_ALIGNMENTS.includes(align);

        if (has_invalid_alignment) {
            console.warn(`${this.constructor.name}: Column "${column.key}" has an invalid align "${align}"; expected one of ${VALID_ALIGNMENTS.join(", ")}.`);
            align = undefined;
        }

        let render = column.render;
        let has_invalid_render = render !== undefined && render !== null && typeof render !== "function";

        if (has_invalid_render) {
            console.warn(`${this.constructor.name}: Column "${column.key}" has a render that is not a function; ignoring it.`);
            render = undefined;
        }

        return {
            key: String(column.key),
            label: column.label !== undefined && column.label !== null ? String(column.label) : String(column.key),
            sortable: Boolean(column.sortable),
            align: align,
            width: column.width,
            render: render || undefined,
        };
    }

    /**
     * Applies new rows.
     * @param {Object[]|string|null} value - The row objects, or a JSON string of them.
     */
    apply_rows = (value) => {
        this._rows = this.parse_array_value(value, "rows") || [];

        this.render_body();
    }

    /**
     * Applies a new sort order, keeping only entries that name a sortable column with a valid direction.
     * @param {Object[]|string|null} value - The sort order, or a JSON string of it.
     */
    apply_sort = (value) => {
        let parsed_sort = this.parse_array_value(value, "sort") || [];

        this._sort = parsed_sort
            .filter((sort_entry) => {
                return sort_entry && Object.values(SORT_DIRECTIONS).includes(sort_entry.direction);
            })
            .map((sort_entry) => {
                return {key: String(sort_entry.key), direction: sort_entry.direction};
            });

        this.prune_sort();
        this.render();
    }

    /**
     * Removes sort entries that do not name a sortable column, or that repeat a key already in the sort.
     * @note Skipped while the columns are not yet known - before connection a light-DOM `<table>` may not have been parsed yet, and a `sort` attribute is applied before
     *     `columns` when it comes first in the markup.
     */
    prune_sort = () => {
        let columns = this.columns;

        if (columns.length === 0) {
            return;
        }

        let sortable_keys = new Set(columns.filter((column) => {
            return column.sortable;
        }).map((column) => {
            return column.key;
        }));
        let seen_keys = new Set();

        this._sort = this._sort.filter((sort_entry) => {
            let is_kept = sortable_keys.has(sort_entry.key) && !seen_keys.has(sort_entry.key);

            seen_keys.add(sort_entry.key);

            return is_kept;
        });
    }

    /**
     * Gets the sort order that clicking a sortable header would produce. A plain click sorts by that column alone, and a shift-click changes only that column's place in the
     * existing sort; either way the column cycles ascending -> descending -> unsorted.
     * @param {string} key - The clicked column's key.
     * @param {boolean} is_additive - True for a shift-click.
     * @return {Object[]} - The new sort order.
     */
    get_next_sort = (key, is_additive) => {
        let existing_entry = this._sort.find((sort_entry) => {
            return sort_entry.key === key;
        });
        let next_direction = SORT_DIRECTIONS.ASCENDING;

        if (existing_entry && existing_entry.direction === SORT_DIRECTIONS.ASCENDING) {
            next_direction = SORT_DIRECTIONS.DESCENDING;
        }
        else if (existing_entry) {
            next_direction = null;
        }

        if (!is_additive) {
            // A plain click on a column that is one of several restarts the sort on that column, rather than continuing its cycle within the old multi-column sort.
            let is_sole_sort = this._sort.length === 1 && existing_entry;

            if (!is_sole_sort) {
                return [{key: key, direction: SORT_DIRECTIONS.ASCENDING}];
            }

            return next_direction ? [{key: key, direction: next_direction}] : [];
        }

        if (existing_entry === undefined) {
            return [...this.sort, {key: key, direction: SORT_DIRECTIONS.ASCENDING}];
        }

        if (next_direction === null) {
            return this.sort.filter((sort_entry) => {
                return sort_entry.key !== key;
            });
        }

        return this.sort.map((sort_entry) => {
            if (sort_entry.key === key) {
                return {key: key, direction: next_direction};
            }

            return sort_entry;
        });
    }

    /**
     * Handles a click on a sortable header: updates the sort order, re-renders, and dispatches `sort_change` with the new order in `event.detail.sort`.
     * @param {MouseEvent} event - The click event.
     */
    on_header_click = (event) => {
        let sort_button = event.target.closest(".sort-button");

        if (sort_button === null) {
            return;
        }

        this._sort = this.get_next_sort(sort_button.dataset.key, event.shiftKey);

        this.render();
        this.dispatchEvent(new CustomEvent("sort_change", {bubbles: true, composed: true, detail: {sort: this.sort}}));
    }

    /**
     * Dispatches `row_click` for a rendered body row, with the row object and its index among the supplied (unsorted) rows in `event.detail`. Does nothing unless
     * {@link clickable_rows} is set.
     * @param {HTMLTableRowElement|null} table_row - The rendered row, or null when the event did not land on one.
     * @param {Event} original_event - The click or keydown event that triggered it.
     */
    dispatch_row_click = (table_row, original_event) => {
        if (table_row === null || !this.clickable_rows) {
            return;
        }

        let index = Number(table_row.dataset.index);
        let row_entry = this.row_entries[index];

        this.dispatchEvent(new CustomEvent("row_click", {bubbles: true, composed: true, detail: {row: row_entry.row, index: index, original_event: original_event}}));
    }

    /**
     * Handles a click on a body row.
     * @param {MouseEvent} event - The click event.
     */
    on_body_click = (event) => {
        this.dispatch_row_click(event.target.closest("tr.data-row"), event);
    }

    /**
     * Handles Enter or Space on a focused body row, so clickable rows work from the keyboard. Keys pressed inside the row's own content (a link or button in a cell) are left
     * to that content.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_body_keydown = (event) => {
        let is_activation_key = event.key === "Enter" || event.key === " ";
        let is_row_focused = event.target.matches?.("tr.data-row");

        if (!is_activation_key || !is_row_focused) {
            return;
        }

        // Space would otherwise scroll the page.
        event.preventDefault();

        this.dispatch_row_click(event.target, event);
    }

    /**
     * Compares two row entries by the current sort order, for {@link display_row_entries}.
     * @param {Object} first_row_entry - The first row entry.
     * @param {Object} second_row_entry - The second row entry.
     * @return {number} - Negative, zero, or positive, as `Array.prototype.sort` expects.
     */
    compare_row_entries = (first_row_entry, second_row_entry) => {
        for (let sort_entry of this._sort) {
            let first_value = first_row_entry.row[sort_entry.key];
            let second_value = second_row_entry.row[sort_entry.key];
            let first_is_empty = this.is_empty_value(first_value);
            let second_is_empty = this.is_empty_value(second_value);

            // Empty values sort last in both directions, so they are handled before the direction is applied.
            if (first_is_empty && second_is_empty) {
                continue;
            }

            if (first_is_empty || second_is_empty) {
                return first_is_empty ? 1 : -1;
            }

            let comparison = this.compare_values(first_value, second_value);

            if (comparison !== 0) {
                return sort_entry.direction === SORT_DIRECTIONS.DESCENDING ? -comparison : comparison;
            }
        }

        return 0;
    }

    /**
     * Gets whether a cell value is empty for sorting purposes.
     * @param {*} value - The cell value.
     * @return {boolean} - True for `null`, `undefined`, and `""`.
     */
    is_empty_value = (value) => {
        return value === null || value === undefined || value === "";
    }

    /**
     * Compares two non-empty cell values in ascending order. Numbers and dates compare numerically, and anything else compares as text with numeric awareness ("Item 2" before
     * "Item 10").
     * @param {*} first_value - The first value.
     * @param {*} second_value - The second value.
     * @return {number} - Negative, zero, or positive.
     */
    compare_values = (first_value, second_value) => {
        let first_is_comparable_number = typeof first_value === "number" || first_value instanceof Date;
        let second_is_comparable_number = typeof second_value === "number" || second_value instanceof Date;
        let both_are_numeric = first_is_comparable_number && second_is_comparable_number;

        if (both_are_numeric) {
            return Number(first_value) - Number(second_value);
        }

        return String(first_value).localeCompare(String(second_value), undefined, {numeric: true, sensitivity: "base"});
    }

    /**
     * Applies a column's `align` and `width` to a header or body cell.
     * @param {HTMLTableCellElement} cell - The cell to style.
     * @param {Object} column - The cell's column definition.
     */
    apply_column_layout = (cell, column) => {
        if (column.align) {
            cell.classList.add(`align-${column.align}`);
        }

        if (column.width) {
            cell.style.width = column.width;
        }
    }

    /**
     * Rebuilds the header row from {@link columns}, with each sortable header's arrow and multi-sort order number reflecting {@link sort}.
     */
    render_header = () => {
        if (!this.header_row_element) {
            return;
        }

        let header_fragment = document.createDocumentFragment();
        let has_multiple_sort_entries = this._sort.length > 1;

        for (let column of this.columns) {
            let header_cell = document.createElement("th");
            header_cell.scope = "col";

            this.apply_column_layout(header_cell, column);

            if (!column.sortable) {
                header_cell.textContent = column.label;
                header_fragment.appendChild(header_cell);
                continue;
            }

            let sort_index = this._sort.findIndex((sort_entry) => {
                return sort_entry.key === column.key;
            });
            let sort_entry = this._sort[sort_index];
            let aria_sort = "none";

            if (sort_entry) {
                aria_sort = sort_entry.direction === SORT_DIRECTIONS.ASCENDING ? "ascending" : "descending";
            }

            header_cell.setAttribute("aria-sort", aria_sort);

            let sort_button = document.createElement("button");
            sort_button.className = "sort-button";
            sort_button.type = "button";
            sort_button.dataset.key = column.key;
            sort_button.title = "Click to sort, shift-click to add to the sort";

            let label_element = document.createElement("span");
            label_element.className = "label";
            label_element.textContent = column.label;

            let indicator_element = document.createElement("span");
            indicator_element.className = "sort-indicator";
            indicator_element.setAttribute("aria-hidden", "true");

            let arrow_element = document.createElement("span");
            arrow_element.className = "arrow";

            if (sort_entry) {
                arrow_element.classList.add(sort_entry.direction);
                arrow_element.textContent = sort_entry.direction === SORT_DIRECTIONS.ASCENDING ? "▲" : "▼";
            }
            else {
                arrow_element.classList.add("unsorted");
                arrow_element.textContent = "↕";
            }

            indicator_element.appendChild(arrow_element);

            if (sort_entry && has_multiple_sort_entries) {
                let order_element = document.createElement("span");
                order_element.className = "order";
                order_element.textContent = String(sort_index + 1);
                indicator_element.appendChild(order_element);
            }

            sort_button.append(label_element, indicator_element);
            header_cell.appendChild(sort_button);
            header_fragment.appendChild(header_cell);
        }

        this.header_row_element.replaceChildren(header_fragment);
    }

    /**
     * Rebuilds the body from {@link display_row_entries}, or shows {@link empty_message} when there are no rows.
     */
    render_body = () => {
        if (!this.body_element) {
            return;
        }

        let columns = this.columns;
        let row_entries = this.display_row_entries;
        let rows_are_clickable = this.clickable_rows;
        let body_fragment = document.createDocumentFragment();

        if (row_entries.length === 0) {
            let empty_row = document.createElement("tr");
            empty_row.className = "empty-row";

            let empty_cell = document.createElement("td");
            empty_cell.className = "empty-state";
            empty_cell.colSpan = Math.max(columns.length, 1);
            empty_cell.textContent = this.empty_message;

            empty_row.appendChild(empty_cell);
            body_fragment.appendChild(empty_row);
        }

        for (let row_entry of row_entries) {
            let table_row = document.createElement("tr");
            table_row.className = "data-row";
            table_row.dataset.index = String(row_entry.index);

            if (rows_are_clickable) {
                table_row.classList.add("clickable");
                table_row.tabIndex = 0;
            }

            for (let [column_index, column] of columns.entries()) {
                let cell = document.createElement("td");

                this.apply_column_layout(cell, column);

                if (row_entry.cell_nodes) {
                    let light_dom_cell = row_entry.cell_nodes[column_index];

                    if (light_dom_cell) {
                        cell.append(...Array.from(light_dom_cell.childNodes).map((child_node) => {
                            return child_node.cloneNode(true);
                        }));
                    }
                }
                else {
                    this.fill_cell(cell, column, row_entry.row);
                }

                table_row.appendChild(cell);
            }

            body_fragment.appendChild(table_row);
        }

        this.body_element.replaceChildren(body_fragment);
    }

    /**
     * Fills a body cell for a supplied row: the column's `render(value, row)` result when it has one, otherwise the raw value. A string is always set as text, never markup, and
     * a Node is appended as-is.
     * @param {HTMLTableCellElement} cell - The cell to fill.
     * @param {Object} column - The cell's column definition.
     * @param {Object} row - The row object.
     */
    fill_cell = (cell, column, row) => {
        let value = row[column.key];
        let content = value;

        if (column.render) {
            try {
                content = column.render(value, row);
            }
            catch (error) {
                console.warn(`${this.constructor.name}: Column "${column.key}" render threw; showing the raw value instead.`, error);
                content = value;
            }
        }

        if (content instanceof Node) {
            cell.appendChild(content);
            return;
        }

        cell.textContent = content === null || content === undefined ? "" : String(content);
    }

    /**
     * Re-renders the header and the body.
     */
    render = () => {
        this.render_header();
        this.render_body();
    }

    /**
     * Discards the cached light-DOM data and re-renders, so edits to the light-DOM `<table>` show up.
     * @param {MutationRecord[]} mutations - The observed mutations.
     */
    on_light_dom_change = (mutations) => {
        // Only changes to the light-DOM <table> itself matter. The host's own attributes are handled by attribute_changed_callback, and other light-DOM children (a
        // GalaxyLoaderManager element loader, for one) are not part of the table's data.
        let light_dom_table = this.querySelector(":scope > table");
        let has_light_dom_change = mutations.some((mutation) => {
            let changed_nodes = [...mutation.addedNodes, ...mutation.removedNodes];
            let is_table_added_or_removed = mutation.target === this && changed_nodes.some((node) => {
                return node.nodeName === "TABLE";
            });
            let is_inside_table = light_dom_table !== null && light_dom_table.contains(mutation.target);

            return is_table_added_or_removed || is_inside_table;
        });

        if (!has_light_dom_change) {
            return;
        }

        this._light_dom_row_entries = null;

        this.prune_sort();
        this.render();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.table_container = await this.get_template();

        this.shadow.appendChild(this.table_container);

        this.header_row_element = this.table_container.querySelector(".header-row");
        this.body_element = this.table_container.querySelector(".body");

        this.header_row_element.addEventListener("click", this.on_header_click);
        this.body_element.addEventListener("click", this.on_body_click);
        this.body_element.addEventListener("keydown", this.on_body_keydown);

        this.light_dom_observer = new MutationObserver(this.on_light_dom_change);
        this.light_dom_observer.observe(this, {childList: true, subtree: true, characterData: true, attributes: true});

        this._light_dom_row_entries = null;

        this.prune_sort();
        this.render();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.light_dom_observer?.disconnect();
        this.light_dom_observer = null;

        this.header_row_element?.removeEventListener("click", this.on_header_click);
        this.body_element?.removeEventListener("click", this.on_body_click);
        this.body_element?.removeEventListener("keydown", this.on_body_keydown);

        this.table_container?.remove();
        this.table_container = null;
        this.header_row_element = null;
        this.body_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return TABLE_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            :host {
                display: block;
                color: var(--text-dark);
            }

            .galaxy-table-container {
                position: relative;
                width: 100%;
                overflow-x: auto;
            }

            /* The light-DOM <table> is a data source only - it is rendered above, never shown as-is. */
            ::slotted(table) {
                display: none;
            }

            .galaxy-table {
                width: 100%;
                border-collapse: collapse;
            }

            th, td {
                padding: 0.5rem 0.75rem;
                border: 1px solid var(--lightgrey);
                text-align: left;
                vertical-align: middle;
            }

            th {
                font-weight: bold;
                color: var(--text-light);
                background-color: var(--table-header);
                user-select: none;
            }

            .align-left {
                text-align: left;
            }

            .align-center {
                text-align: center;
            }

            .align-right {
                text-align: right;
            }

            .sort-button {
                display: inline-flex;
                align-items: center;
                gap: 0.35em;
                width: 100%;
                padding: 0;
                border: none;
                font: inherit;
                color: inherit;
                text-align: inherit;
                background: none;
                cursor: pointer;
            }

            .align-center .sort-button {
                justify-content: center;
            }

            .align-right .sort-button {
                justify-content: flex-end;
            }

            .sort-indicator {
                display: inline-flex;
                align-items: center;
                gap: 0.15em;
                font-size: 0.75em;
            }

            .arrow.unsorted {
                opacity: 0.45;
            }

            .order {
                min-width: 1.4em;
                padding: 0 0.3em;
                font-size: 0.9em;
                line-height: 1.4em;
                text-align: center;
                color: var(--table-header);
                background-color: var(--text-light);
                border-radius: 0.7em;
            }

            tbody tr.data-row:nth-child(even) {
                background-color: rgba(0, 0, 0, 0.03);
            }

            tbody tr.data-row.clickable:hover {
                background-color: rgba(0, 0, 0, 0.07);
                cursor: pointer;
            }

            tbody tr.data-row.clickable:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: -2px;
            }

            .empty-state {
                padding: 1.5rem 0.75rem;
                text-align: center;
                font-style: italic;
                color: var(--grey);
            }
        `;
    }
}
