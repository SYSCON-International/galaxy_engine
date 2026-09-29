import { flush, flush_frame, flush_all, click_button } from "./button-test-helpers.js";

export { flush, flush_frame, flush_all, click_button };

/**
 * Creates and connects a <galaxy-modal>, sets any given attributes before connecting, and waits for its
 * full (requestAnimationFrame-deferred) initialization to finish.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_modal = async (attributes = {}) => {
    let element = document.createElement("galaxy-modal");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush_all();

    return element;
};
