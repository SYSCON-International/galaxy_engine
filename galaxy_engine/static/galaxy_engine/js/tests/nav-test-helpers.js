import { GalaxyNavbar } from "../components/GalaxyNavbar.js";
import { GalaxySidebar } from "../components/GalaxySidebar.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-navbar")) {
    customElements.define("galaxy-navbar", GalaxyNavbar);
}

if (!customElements.get("galaxy-sidebar")) {
    customElements.define("galaxy-sidebar", GalaxySidebar);
}

export { flush };

/**
 * Creates and connects a <galaxy-navbar> or <galaxy-sidebar>, sets any given attributes before connecting,
 * and waits for its async on_create to finish.
 * @param {"navbar"|"sidebar"} kind
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_nav = async (kind, attributes = {}) => {
    let tag_name = kind === "sidebar" ? "galaxy-sidebar" : "galaxy-navbar";
    let element = document.createElement(tag_name);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

export const SIMPLE_NAV_CONFIG = {
    brand: {name: "Acme", logo_url: "", link: "/", tagline: "", should_show: true},
    navigation: [
        {label: "Home", link: "/"},
        {label: "About", link: "/about"},
    ],
};
