import { GalaxySelect } from "../components/GalaxySelect.js";
import { GalaxyMultiSelect } from "../components/GalaxyMultiSelect.js";

if (!customElements.get("galaxy-select")) {
    customElements.define("galaxy-select", GalaxySelect);
}

if (!customElements.get("galaxy-multi-select")) {
    customElements.define("galaxy-multi-select", GalaxyMultiSelect);
}

/**
 * Flushes microtasks (and one macrotask turn) so a just-connected component's async connectedCallback
 * chain (pre_on_create -> on_create -> post_on_create, each themselves async) has fully settled before
 * assertions run. Custom element lifecycle callbacks are invoked but never awaited by the browser/jsdom.
 */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Creates and connects a <galaxy-select> or <galaxy-multi-select>, sets any given attributes before
 * connecting (so they go through the same "already present at upgrade" attribute-ordering the real custom
 * element upgrade path uses), and waits for its async on_create to finish.
 * @param {"select"|"multi-select"} kind
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_select = async (kind, attributes = {}) => {
    let tag_name = kind === "multi-select" ? "galaxy-multi-select" : "galaxy-select";
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

export const SIMPLE_OPTIONS = [
    {text: "Apple", value: "apple", node_type: "Option"},
    {text: "Banana", value: "banana", node_type: "Option"},
    {text: "Cherry", value: "cherry", node_type: "Option"},
];

export const GROUPED_OPTIONS = [
    {text: "Apple", value: "apple", node_type: "Option"},
    {
        text: "Berries", value: "berries", node_type: "Option Group",
        children: [
            {text: "Blueberry", value: "blueberry", node_type: "Option"},
            {text: "Blackberry", value: "blackberry", node_type: "Option"},
        ],
    },
    {text: "Cherry", value: "cherry", node_type: "Option"},
];

/**
 * Dispatches a real keydown KeyboardEvent (bubbling + composed, matching what a browser fires) on the
 * given element.
 * @param {HTMLElement} element
 * @param {string} key - e.g. "ArrowDown", "Enter", "Escape".
 */
export const press_key = (element, key) => {
    element.dispatchEvent(new window.KeyboardEvent("keydown", {key, bubbles: true, composed: true, cancelable: true}));
};
