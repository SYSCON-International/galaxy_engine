/**
 * @file GalaxyTab.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

const TAB_HTML_TEMPLATE = `<slot></slot>`;

/**
 * @class
 * @description
 *     One tab of a galaxy-tabs: its content is everything inside it, and its `label` is its text in the tab bar. `name` identifies it to `selected`, `remember`, state,
 *     and events (`tab_<index>` when it has none). A `disabled` tab shows in the bar but cannot be selected, and `badge` shows a small count or marker beside its label
 *     (`badge-variant="danger"` for one that warns). It is the panel itself: only the selected tab of a galaxy-tabs shows.
 *
 *     {@link reveal} selects it - a galaxy-form calls it on every ancestor of its first invalid field, so a failed submit switches to the tab holding the problem.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyTab extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(TAB_HTML_TEMPLATE);

        this.slot_element = null;
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the tab's text in the tab bar.
     * @return {string} - The label.
     */
    get label() {return this.getAttribute("label") ?? "";}

    /**
     * Sets the tab's text in the tab bar.
     * @param {string} value - The label.
     */
    set label(value) {
        this.setAttribute("label", String(value ?? ""));
    }

    /**
     * Gets the name the tab's galaxy-tabs knows it by.
     * @return {string} - The name - its `name`, or `tab_<index>` when it has none.
     */
    get name() {
        return this.tabs_element?.get_tab_name(this) ?? this.getAttribute("name") ?? "";
    }

    /**
     * Sets the name the tab is known by.
     * @param {string|null} value - The name, or null for `tab_<index>`.
     */
    set name(value) {
        if (value) {
            this.setAttribute("name", value);
        }
        else {
            this.removeAttribute("name");
        }
    }

    /**
     * Gets whether the tab is disabled.
     * @return {boolean} - True when it cannot be selected.
     */
    get disabled() {return this.hasAttribute("disabled");}

    /**
     * Sets whether the tab is disabled. A disabled tab shows in the bar but cannot be selected.
     * @param {boolean} value - True to disable it.
     */
    set disabled(value) {
        this.toggleAttribute("disabled", Boolean(value));
    }

    /**
     * Gets the badge shown beside the label.
     * @return {string} - The badge, "" for none.
     */
    get badge() {return this.getAttribute("badge") ?? "";}

    /**
     * Sets the badge shown beside the label - a count or a short marker.
     * @param {string|number|null} value - The badge, or null or "" for none.
     */
    set badge(value) {
        if (value === null || value === undefined || value === "") {
            this.removeAttribute("badge");
        }
        else {
            this.setAttribute("badge", String(value));
        }
    }

    /**
     * Gets the badge's look.
     * @return {string} - "info" (the default) or "danger".
     */
    get badge_variant() {
        return this.getAttribute("badge-variant") === "danger" ? "danger" : "info";
    }

    /**
     * Sets the badge's look.
     * @param {string|null} value - "info" or "danger".
     */
    set badge_variant(value) {
        if (value) {
            this.setAttribute("badge-variant", value);
        }
        else {
            this.removeAttribute("badge-variant");
        }
    }

    /**
     * Gets whether the tab is the selected one.
     * @return {boolean} - True when selected.
     */
    get selected() {
        return this.tabs_element?.selected_tab === this;
    }

    /**
     * Gets the galaxy-tabs the tab belongs to.
     * @return {HTMLElement|null} - Its parent galaxy-tabs, or null.
     */
    get tabs_element() {
        let parent = this.parentElement;

        return parent?.tagName === "GALAXY-TABS" ? parent : null;
    }

    /***************  Other Methods  ***************/

    /**
     * Selects the tab so its content can be seen. The shared hook a galaxy-form calls on every ancestor of its first invalid field.
     */
    reveal = () => {
        this.tabs_element?.reveal_tab?.(this);
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.slot_element = await this.get_template();
        this.shadow.appendChild(this.slot_element);

        this.setAttribute("role", "tabpanel");
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        // Removed so a reconnect, which runs on_create again, does not add a second slot.
        this.slot_element?.remove();
        this.slot_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return TAB_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            :host {
                display: block;
            }

            :host([hidden]) {
                display: none;
            }
        `;
    }
}
