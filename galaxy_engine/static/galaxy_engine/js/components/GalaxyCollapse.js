/**
 * @file GalaxyCollapse.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {GalaxyUtils} from "../GalaxyUtils.js";

const COLLAPSE_HTML_TEMPLATE = `
    <div class="galaxy-collapse">
        <button id="collapse_heading" class="heading" type="button" aria-expanded="false" aria-controls="collapse_body">
            <span class="heading-content"><slot name="heading"></slot></span>
            <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
        </button>
        <div id="collapse_body" class="body" role="region" aria-labelledby="collapse_heading" inert>
            <div class="body-clip">
                <div class="body-content"><slot></slot></div>
            </div>
        </div>
    </div>
`;

/**
 * @class
 * @description
 *     A panel that shows and hides its content. An element with `slot="heading"` is the clickable heading; everything else inside the element - any HTML, Galaxy
 *     components included - is the collapsible body. `open` shows the body. Every change to `open`, from a click or from code, dispatches a bubbling `toggle` event with
 *     `event.detail.open`. Nothing is stored: the open state lives only in the `open` attribute, so a page that wants it remembered keeps it itself.
 *
 *     While closed, the body is `inert`, so the keyboard cannot reach content that is not visible. Opening and closing animate the height unless the user prefers reduced
 *     motion. Closing also calls `close_floating_content()` on every element inside the panel that has one, so an open select dropdown or date picker popup - which
 *     floats outside the panel - closes with it. {@link reveal} opens the panel; a galaxy-form calls it on the panels around its first invalid field.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyCollapse extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(COLLAPSE_HTML_TEMPLATE);

        this.collapse_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["open"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (name !== "open" || !this.collapse_element) {
            return;
        }

        this.apply_open_state();

        // This reaction runs a microtask after the change, so several changes in one tick each report their own old and new state rather than this.open, which by then is
        // the last one's. setAttribute("open", "") on an already-open panel also reaches here, and is not a toggle.
        let was_open = old_value !== null;
        let is_now_open = new_value !== null;

        if (was_open !== is_now_open) {
            if (!is_now_open) {
                this.close_floating_content();
            }

            this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: {open: is_now_open}}));
        }
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets whether the body is shown.
     * @return {boolean} - True when open.
     */
    get open() {return this.hasAttribute("open");}

    /**
     * Shows or hides the body, dispatching `toggle` if that changes it.
     * @param {boolean} value - True to open.
     */
    set open(value) {
        if (value) {
            this.setAttribute("open", "");
        }
        else {
            this.removeAttribute("open");
        }
    }

    /***************  Other Methods  ***************/

    /**
     * Opens the panel.
     */
    expand = () => {
        this.open = true;
    }

    /**
     * Closes the panel.
     */
    collapse = () => {
        this.open = false;
    }

    /**
     * Opens the panel if it is closed, and closes it if it is open.
     */
    toggle = () => {
        this.open = !this.open;
    }

    /**
     * Opens the panel so something inside it can be seen. The shared hook a galaxy-form calls on every ancestor of its first invalid field.
     */
    reveal = () => {
        this.expand();
    }

    /**
     * Closes everything inside the panel that floats outside it - a select's dropdown, a date picker's popup - by calling `close_floating_content()` on each element that
     * has one, through nested shadow roots. Such content is not clipped by the panel, so it would otherwise stay on screen after the panel closes.
     */
    close_floating_content = () => {
        for (let element of GalaxyUtils.get_descendants_through_shadow_roots(this)) {
            if (typeof element.close_floating_content === "function") {
                element.close_floating_content();
            }
        }
    }

    /**
     * Reflects {@link open} on the heading's `aria-expanded` and the body's `inert`.
     */
    apply_open_state = () => {
        this.heading_element.setAttribute("aria-expanded", String(this.open));
        this.body_element.toggleAttribute("inert", !this.open);
    }

    /**
     * Toggles the panel when the heading is activated, by mouse or by Enter/Space on the focused heading button.
     */
    on_heading_click = () => {
        this.toggle();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.collapse_element = await this.get_template();

        this.shadow.appendChild(this.collapse_element);

        this.heading_element = this.collapse_element.querySelector(".heading");
        this.body_element = this.collapse_element.querySelector(".body");

        this.heading_element.addEventListener("click", this.on_heading_click);

        // An open attribute already in markup was reacted to before the markup existed; apply it now, without a toggle event for the initial state.
        this.apply_open_state();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.heading_element?.removeEventListener("click", this.on_heading_click);

        // Removed so a reconnect, which runs on_create again, does not render a second panel.
        this.collapse_element?.remove();
        this.collapse_element = null;
        this.heading_element = null;
        this.body_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return COLLAPSE_HTML_TEMPLATE;
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
            }

            .galaxy-collapse {
                border: 1px solid var(--lightgrey);
                border-radius: 0.25rem;
            }

            .heading {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                width: 100%;
                padding: 0.75rem 1rem;
                border: none;
                font: inherit;
                font-weight: bold;
                color: inherit;
                text-align: left;
                background-color: rgba(0, 0, 0, 0.03);
                border-radius: 0.25rem;
                cursor: pointer;
            }

            :host([open]) .heading {
                border-bottom: 1px solid var(--lightgrey);
                border-radius: 0.25rem 0.25rem 0 0;
            }

            .heading:hover {
                background-color: rgba(0, 0, 0, 0.06);
            }

            .heading:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: -2px;
            }

            .heading-content {
                flex: 1 1 auto;
                min-width: 0;
            }

            .chevron {
                flex: 0 0 auto;
                width: 1rem;
                height: 1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                transition: transform 0.2s ease-in-out;
            }

            :host([open]) .chevron {
                transform: rotate(180deg);
            }

            /* Animating grid rows from 0fr to 1fr animates to the content's natural height, whatever it is */
            .body {
                display: grid;
                grid-template-rows: 0fr;
                transition: grid-template-rows 0.2s ease-in-out;
            }

            :host([open]) .body {
                grid-template-rows: 1fr;
            }

            .body-clip {
                min-height: 0;
                overflow: hidden;
            }

            .body-content {
                padding: 0.75rem 1rem;
            }

            @media (prefers-reduced-motion: reduce) {
                .body, .chevron {
                    transition: none;
                }
            }
        `;
    }
}
