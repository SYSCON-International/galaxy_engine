import { GalaxyNotification } from "../components/GalaxyNotification.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-notification")) {
    customElements.define("galaxy-notification", GalaxyNotification);
}

export { flush };

/**
 * Creates a <galaxy-notification>, appends it to document.body, and waits for its async on_create to
 * finish.
 * @param {{type: string, title: string, message: string}} [config] - Passed straight to `new
 * GalaxyNotification(config)`. Omit to test the no-config (standard custom-element construction) path.
 * @return {Promise<HTMLElement>}
 */
export const create_notification = async (config) => {
    let element = config === undefined ? new GalaxyNotification() : new GalaxyNotification(config);

    document.body.appendChild(element);

    await flush();

    return element;
};
