import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyDurationDisplay } from "../components/GalaxyDurationDisplay.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-duration-input")) {
    customElements.define("galaxy-duration-input", GalaxyDurationInput);
}

if (!customElements.get("galaxy-duration-display")) {
    customElements.define("galaxy-duration-display", GalaxyDurationDisplay);
}

export { flush };

/**
 * Creates and connects a <galaxy-duration-input> or <galaxy-duration-display>, sets any given attributes
 * before connecting, and waits for its async on_create to finish.
 * @param {"input"|"display"} kind
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_duration = async (kind, attributes = {}) => {
    let tag_name = kind === "display" ? "galaxy-duration-display" : "galaxy-duration-input";
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};
