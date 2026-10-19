import { GalaxyTable } from "../components/GalaxyTable.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-table")) {
    customElements.define("galaxy-table", GalaxyTable);
}

export { flush };

export const COLUMNS = [
    {key: "name", label: "Name", sortable: true},
    {key: "count", label: "Count", sortable: true, align: "right", width: "120px"},
    {key: "notes", label: "Notes"},
];

export const ROWS = [
    {name: "Press 10", count: 5, notes: "a"},
    {name: "Press 2", count: 20, notes: "b"},
    {name: "Press 2", count: 3, notes: "c"},
    {name: "Lathe", count: null, notes: "d"},
];

/**
 * Creates and connects a <galaxy-table>, sets any given attributes (and optional light-DOM markup) before connecting, and waits for its async on_create to finish.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @param {string} inner_html - Light-DOM markup to place inside the table before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_table = async (attributes = {}, inner_html = "") => {
    let element = document.createElement("galaxy-table");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    element.innerHTML = inner_html;
    document.body.appendChild(element);

    await flush();

    return element;
};

/**
 * Gets the rendered text of one column, top to bottom.
 * @param {HTMLElement} table - The <galaxy-table>.
 * @param {number} column_index - The column's index.
 * @return {string[]}
 */
export const get_column_text = (table, column_index) => {
    return Array.from(table.shadowRoot.querySelectorAll("tr.data-row")).map((table_row) => {
        return table_row.cells[column_index].textContent;
    });
};

/**
 * Clicks a sortable header's sort button.
 * @param {HTMLElement} table - The <galaxy-table>.
 * @param {string} key - The column's key.
 * @param {boolean} shift_key - Whether shift is held.
 */
export const click_header = (table, key, shift_key = false) => {
    let sort_button = table.shadowRoot.querySelector(`.sort-button[data-key="${key}"]`);

    sort_button.dispatchEvent(new window.MouseEvent("click", {bubbles: true, composed: true, shiftKey: shift_key}));
};
