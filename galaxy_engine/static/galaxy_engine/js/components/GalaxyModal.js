/**
 * @file GalaxyModal.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {GalaxyUtils} from "../GalaxyUtils.js";

const MODAL_HTML_TEMPLATE = `
    <div class="galaxy-modal">
        <div class="dialogue-box">
            <div class="dialogue-content">
                <div class="header">
                    <h3></h3> <!-- title -->
                    <button>×</button> <!-- close button -->
                </div>
                <div class="body"></div>
                <div class="footer"></div>
            </div>
        </div>
        <div class="backdrop"></div>
    </div>
`;

const DEFAULT_MODAL_SIZE = 2; // Default size is 2

// What each footer button shows when its attributes are not set
const FOOTER_BUTTON_DEFAULTS = {
    ok: {text: "OK", type: "success"},
    cancel: {text: "Cancel", type: "danger"},
};

/**
 * @class
 * @description
 *     A modal dialog component with a header, body, footer, and built-in OK/Cancel buttons.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyModal extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(MODAL_HTML_TEMPLATE);

        this._cancel_callback = null;
        this._confirm_callback = null;

        this.reset_ready();
    }

    /**
     * Replaces {@link ready} with a new, pending promise. Called when the modal is constructed and each time it is torn down, so after a reconnect `ready` waits for the
     * modal to be wired again.
     */
    reset_ready = () => {
        this.ready = new Promise((resolve) => {
            this.resolve_ready = resolve;
        });
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [
            "has-ok-confirm", "has-cancel-confirm",
            "ok-button-text", "ok-button-type", "ok-button-icon",
            "cancel-button-text", "cancel-button-type", "cancel-button-icon",
            "hide-cancel",
        ];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        const attribute_lookup_table = {
            "has-ok-confirm": this.handle_observed_has_ok_confirm,
            "has-cancel-confirm": this.handle_observed_has_cancel_confirm,
            "ok-button-text": this.apply_footer_buttons,
            "ok-button-type": this.apply_footer_buttons,
            "ok-button-icon": this.apply_footer_buttons,
            "cancel-button-text": this.apply_footer_buttons,
            "cancel-button-type": this.apply_footer_buttons,
            "cancel-button-icon": this.apply_footer_buttons,
            "hide-cancel": this.apply_footer_buttons,
        }

        attribute_lookup_table[name]?.();
    }

    /**
     * Keeps the OK button's own has-confirm in sync with this modal's has-ok-confirm, for a change made
     * after the button was already built (on_create applies the initial state directly, from the attribute,
     * when first building the button).
     */
    handle_observed_has_ok_confirm = () => {
        if (this.ok_button) {
            this.ok_button.has_confirm = this.has_ok_confirm;
        }
    }

    /**
     * Keeps the Cancel button's own has-confirm in sync with this modal's has-cancel-confirm - see
     * {@link handle_observed_has_ok_confirm}.
     */
    handle_observed_has_cancel_confirm = () => {
        if (this.cancel_button) {
            this.cancel_button.has_confirm = this.has_cancel_confirm;
        }
    }

    /**
     * Applies the footer attributes to the OK and Cancel buttons: each one's text, type and icon (`ok-button-text`, `cancel-button-type`, ...), falling back to
     * {@link FOOTER_BUTTON_DEFAULTS} for any that is not set, and `hide-cancel`. Run when the buttons are built and whenever one of those attributes changes.
     */
    apply_footer_buttons = () => {
        // Before on_create has built the buttons; on_create applies the attributes itself once it has.
        if (!this.ok_button || !this.cancel_button) {
            return;
        }

        for (let [button_name, galaxy_button] of [["ok", this.ok_button], ["cancel", this.cancel_button]]) {
            let defaults = FOOTER_BUTTON_DEFAULTS[button_name];
            let icon = this.getAttribute(`${button_name}-button-icon`);

            this.set_footer_button_label(galaxy_button, this.getAttribute(`${button_name}-button-text`) ?? defaults.text);
            galaxy_button.setAttribute("type", this.getAttribute(`${button_name}-button-type`) || defaults.type);

            if (icon) {
                galaxy_button.setAttribute("icon", icon);
            }
            else {
                galaxy_button.removeAttribute("icon");
            }
        }

        this.cancel_button.hidden = this.hasAttribute("hide-cancel");
    }

    /**
     * Sets a footer button's label as text. Only the button's own text nodes are replaced: a button with has-confirm holds its confirmation modal as a child, which
     * setting textContent would remove.
     * @param {HTMLElement} galaxy_button - The OK or Cancel button.
     * @param {string} label - The label; markup in it stays text.
     */
    set_footer_button_label = (galaxy_button, label) => {
        for (let child_node of Array.from(galaxy_button.childNodes)) {
            if (child_node.nodeType === Node.TEXT_NODE) {
                child_node.remove();
            }
        }

        galaxy_button.prepend(document.createTextNode(label));
    }

    /**
     * Gets the modal callback of the button.
     * @return {function} - The modal callback of the button.
     */
    get confirm_callback() {return this._confirm_callback;}

    /**
     * Sets the modal callback of the button.
     * @param {function} value - The modal callback state of the select.
     */
    set confirm_callback(value) {
        if (value) {
            this._confirm_callback = value;
        }
        else {
            this._confirm_callback = null;
        }

        if (this.ok_button) {
            this.ok_button.confirm_callback = value; // Set the confirm callback on the ok button
        }
    }

    /**
     * Gets the cancel callback of the button.
     * @return {function} - The cancel callback of the button.
     */
    get cancel_callback() {return this._cancel_callback;}

    /**
     * Sets the cancel callback of the button.
     * @param {function} value - The cancel callback state of the select.
     */
    set cancel_callback(value) {
        if (value) {
            this._cancel_callback = value;
        } else {
            this._cancel_callback = null;
        }

        if (this.cancel_button) {
            this.cancel_button.cancel_callback = value; // Set the cancel callback on the cancel button
        }
    }

    /**
     * Gets the has ok confirm state of the modal.
     * @return {boolean} - The has ok confirm state of the modal.
     */
    get has_ok_confirm() {return this.hasAttribute("has-ok-confirm");}

    /**
     * Sets the has ok confirm state of the modal.
     * @param {boolean} value - The has ok confirm state of the modal.
     */
    set has_ok_confirm(value) {
        if (value) {
            this.setAttribute("has-ok-confirm", "");
        }
        else {
            this.removeAttribute("has-ok-confirm");
        }
    }

    /**
     * Gets the has cancel confirm state of the modal.
     * @return {boolean} - The has cancel confirm state of the modal.
     */
    get has_cancel_confirm() {return this.hasAttribute("has-cancel-confirm");}

    /**
     * Sets the has cancel confirm state of the modal.
     * @param {boolean} value - The has cancel confirm state of the modal.
     */
    set has_cancel_confirm(value) {
        if (value) {
            this.setAttribute("has-cancel-confirm", "");
        }
        else {
            this.removeAttribute("has-cancel-confirm");
        }
    }

    /**
     * Gets the quick close state of the modal.
     * @return {boolean} - The quick close state of the modal.
     */
    get quick_close() {return this.hasAttribute("quick-close");}

    /**
     * Sets the quick close state of the modal.
     * @param {boolean} value - The quick close state of the modal.
     */
    set quick_close(value) {
        if (value) {
            this.setAttribute("quick-close", "");
        }
        else {
            this.removeAttribute("quick-close");
        }
    }

    /**
     * Gets the open state of the modal.
     * @return {boolean} - The open state of the modal.
     */
    get open() {
        return this.hasAttribute("open");
    }

    /**
     * Sets the open state of the modal.
     * @param {boolean|string} value - The open state of the modal. If a string, it will be converted to boolean.
     */
    set open(value) {
        if (value || (typeof value === "string" && value.toLowerCase() !== "false")) {
            this.setAttribute("open", "");
        }
        else {
            this.removeAttribute("open");
        }
    }

    /**
     * Gets the value of the `size` attribute of the modal.
     * @return {number} - The size of the modal. Possible values are "1", "2", "3", or "4".
     */
    get size() {
        return Number(this.getAttribute("size")) || DEFAULT_MODAL_SIZE; // Default size is medium
    }

    /**
     * Sets the `size` attribute of the modal.
     * @param {string|number} value - The size of the modal. Possible values are "1", "2", "3", or "4".
     */
    set size(value) {
        if (value) {
            value = Number(value);

            if (isNaN(value) || value < 1 || value > 4) {
                console.warn(`Invalid size value: ${value}. Size must be a number between 1 and 4.`);
                value = DEFAULT_MODAL_SIZE; // Fallback to default size
            }

            // Set the size attribute
            this.setAttribute("size", value);
        }
        else {
            this.removeAttribute("size");
        }
    }

    /**
     * Gets the modal title element.
     */
    open_modal = () => {
        this.open = true;

        if (this.parent_modal) {
            let dialogue_element_rect = this.dialogue_element.getBoundingClientRect();

            this.parent_modal.size = this.size;
            this.parent_modal.dialogue_element.style.height = `${dialogue_element_rect.height}px`; // Set the parent modal height to the modal height
        }
    }

    /**
     * Closes the modal.
     */
    close_modal = () => {
        this.open = false;

        if (this.parent_modal_size) {
            this.parent_modal.size = this.parent_modal_size; // Reset the parent modal size if it exists
            this.parent_modal.dialogue_element.style.height = null; // Reset the parent modal height
        }
    }

    /**
     * Handles click events on the modal.
     * @param {MouseEvent} event - The click event.
     */
    on_backdrop_click = (event) => {
        if (this.quick_close && this.open && event.target === this.backdrop_element) {
            this.close_modal();
        }
    }

    /**
     * Handles keydown events on the document in order to close the modal when the Escape key is pressed.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_keydown = (event) => {
        // An Escape something inside the modal already used, such as closing an open select, is not also a request to close the modal.
        if (event.defaultPrevented) {
            return;
        }

        if (event.key === "Escape" && this.quick_close && this.open) {
            this.close_modal();
        }
    }

    /**
     * Handles the click event on the OK button.
     */
    on_ok_button_click = () => {
        if (!this.has_ok_confirm && this.confirm_callback) {
            this.confirm_callback(); // Call the confirm callback if it exists
        }
    }

    /**
     * Handles the click event on the Cancel button.
     */
    on_cancel_button_click = () => {
        if (!this.has_cancel_confirm && this.cancel_callback) {
            this.cancel_callback(); // Call the cancel callback if it exists
        }
    }

    /**
     * Sets the title of the modal.
     * @param {string} title - The title of the modal.
     */
    set_title(title) {
        if (this.modal_title) {
            this.modal_title.textContent = title;
        }
    }

    /**
     * Sets the body content of the modal. Content can be a string or an HTMLElement.
     * @param {string|HTMLElement} content - The body content of the modal.
     */
    set_body(content) {
        if (this.body_element) {
            if (typeof content === "string") {
                this.body_element.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                this.body_element.innerHTML = "";
                this.body_element.appendChild(content);
            } else {
                console.warn("Invalid content type. Content must be a string or an HTMLElement.");
            }
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        if (!this.is_initialized) {
            this.modal = await this.get_template();
            this.shadow.appendChild(this.modal);

            this.dialogue_element = this.modal.querySelector(".dialogue-box");
            this.backdrop_element = this.modal.querySelector(".backdrop");
            this.header_element = this.dialogue_element.querySelector(".header");
            this.body_element = this.dialogue_element.querySelector(".body");
            this.footer_element = this.dialogue_element.querySelector(".footer");

            // Built element by element, never from a string: their text, type and icon come from attributes (see apply_footer_buttons).
            this.ok_button = document.createElement("galaxy-button");
            this.cancel_button = document.createElement("galaxy-button");

            this.ok_button.toggleAttribute("has-confirm", this.has_ok_confirm);
            this.cancel_button.toggleAttribute("has-confirm", this.has_cancel_confirm);
            this.apply_footer_buttons();

            if (!this.footer_element.contains(this.ok_button)) {
                this.footer_element.appendChild(this.ok_button);
            }

            if (!this.footer_element.contains(this.cancel_button)) {
                this.footer_element.appendChild(this.cancel_button);
            }

            // Wired here, in the same step as the build, so the modal is usable as soon as it is created: set_title, the buttons, the backdrop and Escape all work at once.
            this.modal_title = this.header_element.querySelector("h3");
            this.close_button = this.header_element.querySelector("button");

            this.cancel_button.addEventListener("click", this.close_modal);
            this.close_button.addEventListener("click", this.close_modal);
            this.backdrop_element.addEventListener("click", this.on_backdrop_click);
            document.addEventListener("keydown", this.on_keydown);

            // if this modal is a child confirmation modal we need to find the parent modal
            // (uses a shadow-piercing closest() since a nested confirm modal's parent button typically lives inside another modal's shadow-rendered footer)
            this.parent_modal = GalaxyUtils.closest_through_shadow_roots(this.parentElement, "galaxy-modal");

            // this.parent_modal.size (the property, which falls back to DEFAULT_MODAL_SIZE), not
            // getAttribute("size") directly - the parent very commonly never sets an explicit "size"
            // attribute at all (2 already being the default), in which case getAttribute() returns null
            // and close_modal()'s "if (this.parent_modal_size)" restoration branch would never run,
            // permanently leaving the parent resized/height-pinned to this nested modal's dimensions.
            this.parent_modal_size = this.parent_modal ? this.parent_modal.size : null;

            this.ok_button.addEventListener("click", this.on_ok_button_click);
            this.cancel_button.addEventListener("click", this.on_cancel_button_click);

            this.is_initialized = true;

            this.resolve_ready();
            this.dispatchEvent(new Event("ready"));
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        if (this.is_initialized) {
            this.cancel_button.removeEventListener("click", this.close_modal);
            this.close_button.removeEventListener("click", this.close_modal);
            this.backdrop_element.removeEventListener("click", this.on_backdrop_click);
            document.removeEventListener("keydown", this.on_keydown);

            this.ok_button.removeEventListener("click", this.on_ok_button_click);
            this.cancel_button.removeEventListener("click", this.on_cancel_button_click);

            // Removes the DOM on_create built, not just its listeners - on_create's own guard
            // (if (!this.is_initialized)) only decides whether to *build*, so leaving the old this.modal
            // in place would make a later reconnect (e.g. moving the modal to document.body, a common
            // "portal" pattern to dodge an ancestor's overflow/stacking context) build and append a second,
            // duplicate .galaxy-modal tree alongside the first rather than replacing it.
            this.modal.remove();
            this.modal = null;

            this.is_initialized = false;

            this.reset_ready();
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return MODAL_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            .galaxy-modal {
                position: fixed;
                display: none;
                top: 0;
                left: 0;
                z-index: 1050;
                width: 100%;
                height: 100%;
                max-width: 100vw;
                max-height: 100vh;
                box-sizing: border-box;
                overflow: hidden;
                color: var(--black);

                .dialogue-box {
                    position: relative;
                    width: auto;
                    max-width: 576px;
                    top: 40%;
                    left: 50%;
                    z-index: 2000;
                    transform: translate(-50%, -40%);

                    .dialogue-content {
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        width: 100%;
                        pointer-events: auto;
                        background-color: #fff;
                        background-clip: padding-box;
                        border: 1px solid rgba(0, 0, 0, 0.2);
                        border-radius: 0.3rem;
                        outline: 0;

                        .header {
                            display: flex;
                            align-items: flex-start;
                            justify-content: space-between;
                            padding: 1rem 1rem;
                            border-bottom: 1px solid #dee2e6;
                            border-top-left-radius: 0.3rem;
                            border-top-right-radius: 0.3rem;

                            h3 {
                                margin-bottom: 0;
                                line-height: 1.5;
                            }

                            button {
                                padding: 1rem 1rem;
                                margin: -1rem -1rem -1rem auto;
                                background-color: transparent;
                                border: 0;
                                -webkit-appearance: none;
                                appearance: none;
                                font-weight: 700;
                                font-size: 1.5em;
                                line-height: 1;
                                color: #000;
                                text-shadow: 0 1px 0 #fff;
                                opacity: .5;
                            }
                        }

                        .body {
                            position: relative;
                            flex: 1 1 auto;
                            padding: 1rem;
                        }

                        .footer {
                            display: flex;
                            align-items: center;
                            justify-content: flex-end;
                            padding: 1rem;
                            border-top: 1px solid #dee2e6;
                            border-bottom-right-radius: 0.3rem;
                            border-bottom-left-radius: 0.3rem;

                            galaxy-button:first-child {
                                margin-right: 0.25rem;
                            }

                            /* hide-cancel - a rule here, since a button's own :host display would otherwise outrank the hidden attribute */
                            galaxy-button[hidden] {
                                display: none;
                            }
                        }
                    }
                }

                .backdrop {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    top: 0;
                    left: 0;
                    z-index: 1051;

                    background-color: rgba(0, 0, 0, 0.5);
                }
            }

            :host([size="1"]) .dialogue-box {
                max-width: 576px;
            }

            :host([size="2"]) .dialogue-box {
                max-width: 992px;
            }

            :host([size="3"]) .dialogue-box {
                max-width: 1280px;
            }

            :host([size="4"]) .dialogue-box {
                max-width: 94%;
                margin: 30px 0;
            }

            :host([open]) .galaxy-modal {
                display: block;
            }
        `;
    }
}