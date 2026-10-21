/**
 * @file GalaxyPagination.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {GalaxyTooltipController} from "../GalaxyTooltipController.js";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_SIBLING_COUNT = 1;

// The value a page item holds in place of a page number where pages are skipped.
const ELLIPSIS = "ellipsis";

const FIRST_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"></path></svg>`;
const PREVIOUS_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>`;
const NEXT_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"></path></svg>`;
const LAST_ICON_HTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"></path></svg>`;

const PAGINATION_HTML_TEMPLATE = `
    <nav class="galaxy-pagination" aria-label="Pagination">
        <span class="control-tooltip" data-tooltip="First page">
            <button class="page-arrow" type="button" data-action="first" aria-label="First page">${FIRST_ICON_HTML}</button>
        </span>
        <span class="control-tooltip" data-tooltip="Previous page">
            <button class="page-arrow" type="button" data-action="previous" aria-label="Previous page">${PREVIOUS_ICON_HTML}</button>
        </span>
        <ol class="page-numbers"></ol>
        <label class="page-input-label">
            Page <input class="page-input" type="number" min="1" inputmode="numeric" aria-label="Page number" /> <span class="page-total"></span>
        </label>
        <span class="control-tooltip" data-tooltip="Next page">
            <button class="page-arrow" type="button" data-action="next" aria-label="Next page">${NEXT_ICON_HTML}</button>
        </span>
        <span class="control-tooltip" data-tooltip="Last page">
            <button class="page-arrow" type="button" data-action="last" aria-label="Last page">${LAST_ICON_HTML}</button>
        </span>
        <label class="page-size-label">
            Rows per page <select class="page-size-select"></select>
        </label>
    </nav>
`;

/**
 * @class
 * @description
 *     Controls for moving through a paged list: first and previous buttons, the page numbers, a typed "Page n / N", next and last buttons, and a "Rows per page" picker.
 *     The page numbers always show the first and last pages and the current page with `sibling-count` pages either side, with "…" for the pages skipped; the row of
 *     numbers keeps the same length as the page changes, and hides in a narrow container, leaving the arrows and the typed page.
 *
 *     The pages come from `page-count`, or from `total-items` and `page-size` when `total-items` is set. A user's move - a button, a typed page, or a new page size -
 *     dispatches a bubbling `page_change` with `{page, previous_page, page_size, previous_page_size}`, for the page to fetch and show that page; a new page size keeps
 *     the first item that was shown on screen. Setting the attributes or properties from code dispatches nothing.
 *
 *     With `for` naming a galaxy-table's id, it pages that table in the browser instead: it sets the table's `page-size` and `page`, takes the page count from the
 *     table's rows, and follows the table when it moves itself - a galaxy-editable-table adding a row on a later page, for one. `page-count` and `total-items` are
 *     ignored while linked.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyPagination extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(PAGINATION_HTML_TEMPLATE);

        this.pagination_element = null;
        this.tooltip_controller = null;
        this.linked_table = null;
        this.linked_row_count = 0;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["page", "page-count", "page-size", "page-size-options", "total-items", "sibling-count", "hide-page-size", "disabled", "for"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.pagination_element) {
            return;
        }

        if (name === "for") {
            this.link_table();
            return;
        }

        if (name === "page" || name === "page-size") {
            this.push_page_to_table();
        }

        this.render();
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the page shown, clamped to the pages there are.
     * @return {number} - The 1-based page, or 0 when there are no pages.
     */
    get page() {
        let page_count = this.page_count;

        if (page_count === 0) {
            return 0;
        }

        return Math.min(Math.max(this.read_integer_attribute("page", 1), 1), page_count);
    }

    /**
     * Sets the page shown, without dispatching `page_change`.
     * @param {number} value - The 1-based page.
     */
    set page(value) {
        this.setAttribute("page", String(value));
    }

    /**
     * Gets how many pages there are: from the linked table's rows, from `total-items` and `page-size`, or from `page-count`.
     * @return {number} - The page count.
     */
    get page_count() {
        if (this.linked_table) {
            return Math.ceil(this.linked_row_count / this.page_size);
        }

        if (this.hasAttribute("total-items")) {
            return Math.ceil(Math.max(this.read_integer_attribute("total-items", 0), 0) / this.page_size);
        }

        return Math.max(this.read_integer_attribute("page-count", 1), 0);
    }

    /**
     * Sets how many pages there are. Ignored while `total-items` is set or a table is linked.
     * @param {number} value - The page count.
     */
    set page_count(value) {
        this.setAttribute("page-count", String(value));
    }

    /**
     * Gets how many items a page shows.
     * @return {number} - The page size, 25 by default.
     */
    get page_size() {
        let page_size = this.read_integer_attribute("page-size", DEFAULT_PAGE_SIZE);

        return page_size > 0 ? page_size : DEFAULT_PAGE_SIZE;
    }

    /**
     * Sets how many items a page shows, without dispatching `page_change`.
     * @param {number} value - The page size.
     */
    set page_size(value) {
        this.setAttribute("page-size", String(value));
    }

    /**
     * Gets the page sizes the picker offers, in order, always including the current {@link page_size}.
     * @return {number[]} - The page sizes.
     */
    get page_size_options() {
        let options_value = this.getAttribute("page-size-options");
        let page_sizes = DEFAULT_PAGE_SIZE_OPTIONS;

        if (options_value) {
            let parsed_value = null;

            try {
                parsed_value = JSON.parse(options_value);
            }
            catch (error) {
                parsed_value = options_value.split(",");
            }

            let parsed_sizes = (Array.isArray(parsed_value) ? parsed_value : [parsed_value]).map(Number).filter((size) => Number.isInteger(size) && size > 0);

            if (parsed_sizes.length > 0) {
                page_sizes = parsed_sizes;
            }
            else {
                console.warn(`${this.constructor.name}: page-size-options "${options_value}" has no valid sizes; using the defaults.`);
            }
        }

        return [...new Set([...page_sizes, this.page_size])].sort((first_size, second_size) => first_size - second_size);
    }

    /**
     * Sets the page sizes the picker offers.
     * @param {number[]|string|null} value - The page sizes, as an array, a JSON array, or a comma-separated list; null for the defaults.
     */
    set page_size_options(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("page-size-options");
        }
        else {
            this.setAttribute("page-size-options", Array.isArray(value) ? JSON.stringify(value) : String(value));
        }
    }

    /**
     * Gets how many items there are in all, which the page count is worked out from.
     * @return {number|null} - The item count, or null when `page-count` is used instead.
     */
    get total_items() {
        return this.hasAttribute("total-items") ? Math.max(this.read_integer_attribute("total-items", 0), 0) : null;
    }

    /**
     * Sets how many items there are in all.
     * @param {number|null} value - The item count, or null to use `page-count` instead.
     */
    set total_items(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("total-items");
        }
        else {
            this.setAttribute("total-items", String(value));
        }
    }

    /**
     * Gets how many page numbers are shown on each side of the current page.
     * @return {number} - The sibling count, 1 by default.
     */
    get sibling_count() {
        return Math.max(this.read_integer_attribute("sibling-count", DEFAULT_SIBLING_COUNT), 0);
    }

    /**
     * Sets how many page numbers are shown on each side of the current page.
     * @param {number} value - The sibling count.
     */
    set sibling_count(value) {
        this.setAttribute("sibling-count", String(value));
    }

    /**
     * Gets whether the "Rows per page" picker is hidden.
     * @return {boolean} - True when hidden.
     */
    get hide_page_size() {return this.hasAttribute("hide-page-size");}

    /**
     * Sets whether the "Rows per page" picker is hidden.
     * @param {boolean} value - True to hide it.
     */
    set hide_page_size(value) {
        this.toggleAttribute("hide-page-size", Boolean(value));
    }

    /**
     * Gets whether every control is disabled.
     * @return {boolean} - True when disabled.
     */
    get disabled() {return this.hasAttribute("disabled");}

    /**
     * Sets whether every control is disabled - while a page loads, for one.
     * @param {boolean} value - True to disable them.
     */
    set disabled(value) {
        this.toggleAttribute("disabled", Boolean(value));
    }

    /**
     * Gets the id of the galaxy-table the pagination pages.
     * @return {string|null} - The id.
     */
    get for() {return this.getAttribute("for");}

    /**
     * Sets the id of the galaxy-table the pagination pages, found in the same document or shadow root.
     * @param {string|null} value - The id, or null to page nothing.
     */
    set for(value) {
        if (value) {
            this.setAttribute("for", value);
        }
        else {
            this.removeAttribute("for");
        }
    }

    /**
     * Reads an attribute as an integer.
     * @param {string} name - The attribute name.
     * @param {number} default_value - The value when it is missing or not an integer.
     * @return {number} - The integer.
     */
    read_integer_attribute = (name, default_value) => {
        let value = Number(this.getAttribute(name));
        let has_integer_value = this.hasAttribute(name) && this.getAttribute(name).trim() !== "" && Number.isInteger(value);

        return has_integer_value ? value : default_value;
    }

    /***************  Page Numbers  ***************/

    /**
     * Gets the page numbers to show, with {@link ELLIPSIS} where pages are skipped: the first and last pages, and the current page with `sibling_count` pages either side.
     * The list always has the same length once there are enough pages to need skipping - near either end, the window widens toward the middle instead of shrinking -
     * so the controls do not shift as the page changes.
     * @param {number} page - The current page.
     * @param {number} page_count - The page count.
     * @param {number} sibling_count - How many pages to show either side of the current one.
     * @return {Array<number|string>} - The page numbers and ellipses, in order.
     */
    static get_page_items = (page, page_count, sibling_count = DEFAULT_SIBLING_COUNT) => {
        if (page_count <= 0) {
            return [];
        }

        // First, last, the current page with its siblings, and an ellipsis on each side.
        let item_count = sibling_count * 2 + 5;

        if (page_count <= item_count) {
            return Array.from({length: page_count}, (_value, index) => index + 1);
        }

        let range = (start, end) => Array.from({length: end - start + 1}, (_value, index) => start + index);
        let window_size = sibling_count * 2 + 3;

        if (page <= sibling_count + 3) {
            return [...range(1, window_size), ELLIPSIS, page_count];
        }

        if (page >= page_count - sibling_count - 2) {
            return [1, ELLIPSIS, ...range(page_count - window_size + 1, page_count)];
        }

        return [1, ELLIPSIS, ...range(page - sibling_count, page + sibling_count), ELLIPSIS, page_count];
    }

    /***************  Moving Between Pages  ***************/

    /**
     * Moves to a page from code, without dispatching `page_change`.
     * @param {number} page - The 1-based page, clamped to the pages there are.
     */
    set_page = (page) => {
        this.page = this.clamp_page(page);
    }

    /**
     * Clamps a page to the pages there are.
     * @param {number} page - The page.
     * @return {number} - The clamped page, or 0 when there are no pages.
     */
    clamp_page = (page) => {
        let page_count = this.page_count;

        return page_count === 0 ? 0 : Math.min(Math.max(Math.round(page), 1), page_count);
    }

    /**
     * Moves to a page for a user's action, dispatching `page_change` when the page changed.
     * @param {number} page - The page.
     */
    go_to_page_for_user = (page) => {
        let previous_page = this.page;
        let next_page = this.clamp_page(page);

        if (next_page === previous_page) {
            this.render();
            return;
        }

        this.setAttribute("page", String(next_page));
        this.push_page_to_table();
        this.render();
        this.dispatch_page_change(previous_page, this.page_size);
    }

    /**
     * Changes the page size for a user's action, moving to the page that holds the first item shown before, and dispatches `page_change`.
     * @param {number} page_size - The new page size.
     */
    change_page_size_for_user = (page_size) => {
        let previous_page = this.page;
        let previous_page_size = this.page_size;

        if (!Number.isInteger(page_size) || page_size <= 0 || page_size === previous_page_size) {
            return;
        }

        let first_item_index = Math.max(previous_page - 1, 0) * previous_page_size;

        this.setAttribute("page-size", String(page_size));
        this.setAttribute("page", String(this.clamp_page(Math.floor(first_item_index / page_size) + 1)));
        this.push_page_to_table();
        this.render();
        this.dispatch_page_change(previous_page, previous_page_size);
    }

    /**
     * Dispatches `page_change`.
     * @param {number} previous_page - The page before the change.
     * @param {number} previous_page_size - The page size before the change.
     */
    dispatch_page_change = (previous_page, previous_page_size) => {
        let detail = {page: this.page, previous_page: previous_page, page_size: this.page_size, previous_page_size: previous_page_size};

        this.dispatchEvent(new CustomEvent("page_change", {bubbles: true, detail: detail}));
    }

    /***************  User Actions  ***************/

    /**
     * Handles the arrow and page number buttons.
     * @param {MouseEvent} event - The click event.
     */
    on_click = (event) => {
        let button = event.target.closest?.("button");

        if (!button || button.disabled || this.disabled) {
            return;
        }

        let action = button.dataset.action;
        let page = this.page;

        if (action === "first") {
            this.go_to_page_for_user(1);
        }
        else if (action === "previous") {
            this.go_to_page_for_user(page - 1);
        }
        else if (action === "next") {
            this.go_to_page_for_user(page + 1);
        }
        else if (action === "last") {
            this.go_to_page_for_user(this.page_count);
        }
        else if (action === "page") {
            this.go_to_page_for_user(Number(button.dataset.page));
        }
        else {
            throw new Error(`Pagination action "${action}" is not valid here.`);
        }
    }

    /**
     * Commits the typed page on Enter, and puts back the current page on Escape.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_page_input_keydown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            this.commit_page_input();
        }
        else if (event.key === "Escape") {
            event.preventDefault();
            this.page_input.value = String(this.page);
        }
    }

    /**
     * Commits the typed page when the field loses focus with a changed value.
     */
    on_page_input_change = () => {
        this.commit_page_input();
    }

    /**
     * Moves to the typed page, clamped to the pages there are; an empty or non-numeric entry puts back the current page instead.
     */
    commit_page_input = () => {
        let typed_page = Number(this.page_input.value);
        let is_valid_entry = this.page_input.value.trim() !== "" && Number.isFinite(typed_page);

        if (is_valid_entry) {
            this.go_to_page_for_user(typed_page);
        }

        this.page_input.value = String(this.page);
    }

    /**
     * Applies the page size picked.
     */
    on_page_size_change = () => {
        this.change_page_size_for_user(Number(this.page_size_select.value));
    }

    /***************  Linked Table  ***************/

    /**
     * Links the galaxy-table named by `for`, unlinking any table linked before, and has it show the pagination's page.
     */
    link_table = () => {
        this.unlink_table();

        if (!this.for) {
            this.render();
            return;
        }

        let root = this.getRootNode();
        let table = typeof root.getElementById === "function" ? root.getElementById(this.for) : null;

        if (!table) {
            console.warn(`${this.constructor.name}: No table with the id "${this.for}" was found to page.`);
            this.render();
            return;
        }

        this.linked_table = table;
        this.linked_table.addEventListener("table_render", this.on_table_render);

        // Attributes, not properties: the table may not be upgraded yet, and a property set on it now would hide its own once it is.
        this.linked_table.setAttribute("page-size", String(this.page_size));
        this.linked_table.setAttribute("page", String(Math.max(this.read_integer_attribute("page", 1), 1)));

        this.sync_from_table();
    }

    /**
     * Unlinks the linked table, which goes back to showing every row.
     */
    unlink_table = () => {
        if (!this.linked_table) {
            return;
        }

        this.linked_table.removeEventListener("table_render", this.on_table_render);
        this.linked_table.removeAttribute("page-size");
        this.linked_table.removeAttribute("page");
        this.linked_table = null;
        this.linked_row_count = 0;
    }

    /**
     * Sets the linked table's page size and page to the pagination's.
     */
    push_page_to_table = () => {
        if (!this.linked_table) {
            return;
        }

        this.linked_table.setAttribute("page-size", String(this.page_size));
        this.linked_table.setAttribute("page", String(Math.max(this.page, 1)));
    }

    /**
     * Follows a render of the linked table: its row count, and its page when the table moved itself.
     * @param {CustomEvent} event - The table_render event.
     */
    on_table_render = (event) => {
        this.linked_row_count = event.detail.row_count;

        if (event.detail.page_size === null) {
            console.warn(`${this.constructor.name}: The table "${this.for}" does not page; galaxy-sortable-list, for one, always shows every row.`);
        }

        if (event.detail.page !== this.page && event.detail.page_size !== null) {
            this.setAttribute("page", String(event.detail.page));
        }

        this.render();
    }

    /**
     * Reads the linked table's row count and page, for a table that has already rendered and so will not dispatch `table_render` until something changes.
     */
    sync_from_table = () => {
        let has_rendered = typeof this.linked_table.total_row_count === "number" && this.linked_table.rendered_page !== null && this.linked_table.rendered_page !== undefined;

        if (has_rendered) {
            this.linked_row_count = this.linked_table.total_row_count;
        }

        this.render();
    }

    /***************  Rendering  ***************/

    /**
     * Brings every control up to date with the page, page count, and page size.
     */
    render = () => {
        if (!this.pagination_element) {
            return;
        }

        let page = this.page;
        let page_count = this.page_count;
        let is_disabled = this.disabled || page_count === 0;

        this.arrow_buttons.first.disabled = is_disabled || page <= 1;
        this.arrow_buttons.previous.disabled = is_disabled || page <= 1;
        this.arrow_buttons.next.disabled = is_disabled || page >= page_count;
        this.arrow_buttons.last.disabled = is_disabled || page >= page_count;

        this.render_page_numbers(page, page_count, is_disabled);

        // A value being typed is left alone; it is committed or put back when the field is left.
        if (this.shadow.activeElement !== this.page_input) {
            this.page_input.value = String(page);
        }

        this.page_input.max = String(Math.max(page_count, 1));
        this.page_input.disabled = is_disabled;
        this.page_total_element.textContent = `/ ${page_count}`;

        this.render_page_size_options();
        this.page_size_label.hidden = this.hide_page_size;
        this.page_size_select.disabled = this.disabled;
    }

    /**
     * Rebuilds the page number buttons.
     * @param {number} page - The current page.
     * @param {number} page_count - The page count.
     * @param {boolean} is_disabled - Whether the buttons are disabled.
     */
    render_page_numbers = (page, page_count, is_disabled) => {
        let list_items = GalaxyPagination.get_page_items(page, page_count, this.sibling_count).map((page_item) => {
            let list_item = document.createElement("li");

            if (page_item === ELLIPSIS) {
                list_item.className = "ellipsis";
                list_item.setAttribute("aria-hidden", "true");
                list_item.textContent = "…";

                return list_item;
            }

            let page_button = document.createElement("button");
            page_button.className = "page-number";
            page_button.type = "button";
            page_button.dataset.action = "page";
            page_button.dataset.page = String(page_item);
            page_button.textContent = String(page_item);
            page_button.setAttribute("aria-label", `Page ${page_item}`);
            page_button.disabled = is_disabled;

            if (page_item === page) {
                page_button.setAttribute("aria-current", "page");
            }

            list_item.appendChild(page_button);

            return list_item;
        });

        this.page_numbers_element.replaceChildren(...list_items);
    }

    /**
     * Rebuilds the picker's options when they changed, and selects the current page size.
     */
    render_page_size_options = () => {
        let page_sizes = this.page_size_options;
        let rendered_sizes = Array.from(this.page_size_select.options).map((option) => Number(option.value));
        let has_changed = rendered_sizes.length !== page_sizes.length || rendered_sizes.some((size, index) => size !== page_sizes[index]);

        if (has_changed) {
            this.page_size_select.replaceChildren(...page_sizes.map((size) => new Option(String(size), String(size))));
        }

        this.page_size_select.value = String(this.page_size);
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.pagination_element = await this.get_template();

        this.shadow.appendChild(this.pagination_element);

        this.arrow_buttons = {};

        for (let action of ["first", "previous", "next", "last"]) {
            this.arrow_buttons[action] = this.pagination_element.querySelector(`[data-action="${action}"]`);
        }

        this.page_numbers_element = this.pagination_element.querySelector(".page-numbers");
        this.page_input = this.pagination_element.querySelector(".page-input");
        this.page_total_element = this.pagination_element.querySelector(".page-total");
        this.page_size_label = this.pagination_element.querySelector(".page-size-label");
        this.page_size_select = this.pagination_element.querySelector(".page-size-select");

        this.pagination_element.addEventListener("click", this.on_click);
        this.page_input.addEventListener("keydown", this.on_page_input_keydown);
        this.page_input.addEventListener("change", this.on_page_input_change);
        this.page_size_select.addEventListener("change", this.on_page_size_change);

        this.tooltip_controller = new GalaxyTooltipController(this.shadow);
        this.tooltip_controller.attach(this.pagination_element, (target) => {
            let tooltip_element = target.closest("[data-tooltip]");

            return tooltip_element ? {anchor: tooltip_element, content: tooltip_element.dataset.tooltip} : null;
        });

        this.link_table();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.unlink_table();

        this.pagination_element?.removeEventListener("click", this.on_click);
        this.page_input?.removeEventListener("keydown", this.on_page_input_keydown);
        this.page_input?.removeEventListener("change", this.on_page_input_change);
        this.page_size_select?.removeEventListener("change", this.on_page_size_change);

        this.tooltip_controller?.destroy();
        this.tooltip_controller = null;

        // Removed so a reconnect, which runs on_create again, does not render a second set of controls.
        this.pagination_element?.remove();
        this.pagination_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return PAGINATION_HTML_TEMPLATE;
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
                container-type: inline-size;
            }

            .galaxy-pagination {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.25rem 0.5rem;
            }

            .control-tooltip {
                display: inline-flex;
            }

            .page-arrow, .page-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 2rem;
                height: 2rem;
                padding: 0 0.4rem;
                border: 1px solid var(--lightgrey);
                font: inherit;
                color: inherit;
                background-color: #ffffff;
                border-radius: 0.25rem;
                cursor: pointer;
            }

            .page-arrow:hover:not(:disabled), .page-number:hover:not(:disabled) {
                background-color: rgba(0, 0, 0, 0.06);
            }

            .page-arrow:focus-visible, .page-number:focus-visible, .page-input:focus-visible, .page-size-select:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 1px;
            }

            /* Passes the pointer through to the tooltip's wrapper, which a disabled button would otherwise swallow */
            .page-arrow:disabled, .page-number:disabled {
                opacity: 0.4;
                cursor: default;
                pointer-events: none;
            }

            .page-arrow svg {
                width: 1rem;
                height: 1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .page-numbers {
                display: flex;
                gap: 0.25rem;
                margin: 0;
                padding: 0;
                list-style: none;
            }

            .page-number[aria-current="page"] {
                font-weight: bold;
                color: #ffffff;
                background-color: var(--blue);
                border-color: var(--blue);
            }

            .ellipsis {
                display: inline-flex;
                align-items: flex-end;
                min-width: 1.25rem;
                justify-content: center;
                color: var(--grey);
            }

            .page-input-label, .page-size-label {
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                margin: 0;
                white-space: nowrap;
            }

            .page-input {
                width: 4.5rem;
                height: 2rem;
                padding: 0 0.4rem;
                border: 1px solid var(--lightgrey);
                font: inherit;
                text-align: right;
                border-radius: 0.25rem;
            }

            .page-size-label {
                margin-left: auto;
            }

            .page-size-label[hidden] {
                display: none;
            }

            .page-size-select {
                height: 2rem;
                padding: 0 0.25rem;
                border: 1px solid var(--lightgrey);
                font: inherit;
                background-color: #ffffff;
                border-radius: 0.25rem;
            }

            /* In a narrow container the numbers go, leaving the arrows and the typed page */
            @container (max-width: 560px) {
                .page-numbers {
                    display: none;
                }
            }
        `;
    }
}
