import { GalaxyLoader } from "../components/GalaxyLoader.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-loader")) {
    customElements.define("galaxy-loader", GalaxyLoader);
}

export { flush };

/**
 * Creates and connects a <galaxy-loader>, sets any given attributes before connecting, and waits for its
 * async on_create to finish.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_loader = async (attributes = {}) => {
    let element = document.createElement("galaxy-loader");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};
