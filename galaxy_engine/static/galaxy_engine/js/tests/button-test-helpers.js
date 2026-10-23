import { GalaxyButton } from "../components/GalaxyButton.js";
import { GalaxyModal } from "../components/GalaxyModal.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-button")) {
    customElements.define("galaxy-button", GalaxyButton);
}

if (!customElements.get("galaxy-modal")) {
    customElements.define("galaxy-modal", GalaxyModal);
}

export { flush };

/**
 * Waits for one animation frame, which a plain flush() (a single macrotask tick) is not guaranteed to outlast. GalaxyModal no longer defers any of its
 * wiring to a frame (see tests/modal-ready.test.js), but waiting for one as well keeps these helpers safe for anything that still does.
 */
export const flush_frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Flushes the microtask-based custom-element lifecycle chains (this component's own, and any nested <galaxy-modal>/<galaxy-button> created along the
 * way), and then an animation frame as well.
 */
export const flush_all = async () => {
    await flush();
    await flush_frame();
    await flush();
};

/**
 * Creates and connects a <galaxy-button>, sets any given attributes before connecting, and waits for its
 * (and any nested confirm modal's) async initialization to fully finish.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @param {string} [text] - The button's label (its default-slotted text content).
 * @return {Promise<HTMLElement>}
 */
export const create_button = async (attributes = {}, text = "Click me") => {
    let element = document.createElement("galaxy-button");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    element.textContent = text;

    document.body.appendChild(element);

    await flush_all();

    return element;
};

/**
 * Simulates a real user click on a Galaxy component's internal native <button>.
 * @param {HTMLElement} galaxy_button_element - A <galaxy-button> (or any element whose shadow root's first
 * <button> is the one to click - matches both GalaxyButton itself and, e.g., a modal's ok/cancel buttons).
 */
export const click_button = (galaxy_button_element) => {
    galaxy_button_element.shadowRoot.querySelector("button").click();
};
