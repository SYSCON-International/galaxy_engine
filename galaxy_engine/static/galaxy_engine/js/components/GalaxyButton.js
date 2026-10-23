/**
 * @file GalaxyButton.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyModal } from './GalaxyModal.js';
import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

const BUTTON_HTML_TEMPLATE = `
    <button part="button"><slot>Button</slot></button>
`;

/**
 * @class
 * @description
 *     A custom button component with optional confirmation modal.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyButton extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(BUTTON_HTML_TEMPLATE);

        this._cancel_callback = null;
        this._confirm_callback = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [
            "confirm-title-text",
            "confirm-body-text",
            "confirm-button-text",
            "cancel-button-text",
            "has-confirm",
            "disabled",
        ];
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        const attribute_lookup_table = {
            "confirm-title-text": this.handle_observed_confirm_title_text,
            "confirm-body-text": this.handle_observed_confirm_body_text,
            "confirm-button-text": this.handle_observed_confirm_button_text,
            "cancel-button-text": this.handle_observed_cancel_button_text,
            "has-confirm": this.handle_observed_has_confirm,
            "disabled": this.handle_observed_disabled,
        }

        attribute_lookup_table[name]?.(new_value);
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
    }

    /**
     * Gets the has confirm state of the button.
     * @return {boolean} - The has confirm state of the button.
     */
    get has_confirm() {return this.hasAttribute("has-confirm");}

    /**
     * Sets the has confirm state of the button.
     * @param {boolean} value - The has confirm state of the button.
     */
    set has_confirm(value) {
        if (value) {
            this.setAttribute("has-confirm", "");
        }
        else {
            this.removeAttribute("has-confirm");
        }
    }

    /**
     * Handles the has-confirm attribute change - lazily builds the confirm modal the first time has-confirm
     * becomes true, whether that's at initial connection (on_create already covers that directly) or later,
     * e.g. a script enabling confirmation on a button that's already connected.
     */
    handle_observed_has_confirm = async () => {
        if (!this.button) {
            return; // Not yet connected - on_create() builds the modal itself from the current attribute state.
        }

        await this.ensure_confirm_modal();
    }

    /**
     * Gets whether the button is disabled.
     * @return {boolean} - True when disabled.
     */
    get disabled() {return this.hasAttribute("disabled");}

    /**
     * Sets whether the button is disabled. A disabled button looks disabled, cannot be focused, and its clicks reach no listener on this element and open no confirmation.
     * @param {boolean} value - Whether the button is disabled.
     */
    set disabled(value) {
        this.toggleAttribute("disabled", Boolean(value));
    }

    /**
     * Forwards the disabled attribute to the inner button.
     */
    handle_observed_disabled = () => {
        // Before on_create has built the button; on_create applies it itself once it has.
        if (!this.button) {
            return;
        }

        this.button.disabled = this.disabled;
    }

    /**
     * Stops a click on a disabled button from reaching any listener on this element or above it - including element.click() from code, which a disabled inner button
     * cannot stop, since that click is dispatched on this element directly. Registered for the capture phase, which runs first at the target.
     * @param {MouseEvent} event - The click event.
     */
    on_host_click_capture = (event) => {
        if (this.disabled) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    /**
     * Gets the confirm text of the button.
     * @return {string} - The confirm text of the button.
     */
    get confirm_title_text() {return this.getAttribute("confirm-title-text");}

    /**
     * Sets the confirm text of the button.
     * @param {string} value - The confirm text of the button.
     */
    set confirm_title_text(value) {
        if (value) {
            this.setAttribute("confirm-title-text", value);
        }
        else {
            this.removeAttribute("confirm-title-text");
        }
    }

    /**
     * Gets the confirm text of the button.
     * @return {string} - The confirm text of the button.
     */
    get confirm_body_text() {return this.getAttribute("confirm-body-text");}

    /**
     * Sets the confirm text of the button.
     * @param {string} value - The confirm text of the button.
     */
    set confirm_body_text(value) {
        if (value) {
            this.setAttribute("confirm-body-text", value);
        }
        else {
            this.removeAttribute("confirm-body-text");
        }
    }

    /**
     * Gets the confirm button text of the button.
     * @return {string} - The confirm button text of the button.
     */
    get confirm_button_text() {return this.getAttribute("confirm-button-text");}

    /**
     * Sets the confirm button text of the button.
     * @param {string} value - The confirm button text of the button.
     */
    set confirm_button_text(value) {
        if (value) {
            this.setAttribute("confirm-button-text", value);
        }
        else {
            this.removeAttribute("confirm-button-text");
        }
    }

    /**
     * Gets the cancel button text of the button.
     * @return {string} - The cancel button text of the button.
     */
    get cancel_button_text() {return this.getAttribute("cancel-button-text");}

    /**
     * Sets the cancel button text of the button.
     * @param {string} value - The cancel button text of the button.
     */
    set cancel_button_text(value) {
        if (value) {
            this.setAttribute("cancel-button-text", value);
        }
        else {
            this.removeAttribute("cancel-button-text");
        }
    }

    /**
     * Handles the confirm title attribute change.
     * @param {string} new_value - The new value of the confirm title text.
     */
    handle_observed_confirm_title_text = (new_value) => {
        if (!this.confirm_modal || !this.confirm_modal.modal_title) {
            return;
        }

        if (new_value) {
            this.confirm_modal.modal_title.textContent = new_value;
        }
        else {
            this.confirm_modal.modal_title.textContent = "Confirm";
        }
    }

    /**
     * Handles the confirm body attribute change.
     * @param {string} new_value - The new value for the confirm body text.
     */
    handle_observed_confirm_body_text = (new_value) => {
        if (!this.confirm_modal || !this.confirm_modal.body_element) {
            return;
        }

        if (new_value) {
            this.confirm_modal.body_element.textContent = new_value;
        } else {
            this.confirm_modal.body_element.textContent = "Are you sure?";
        }
    }

    /**
     * Handles the confirm button text attribute change.
     * @param {string} new_value - The new value for the confirm button text.
     */
    handle_observed_confirm_button_text = (new_value) => {
        if (!this.confirm_modal) {
            return;
        }

        // Through the dialog's own footer attribute, so the dialog keeps the label when its other footer attributes change; removing it restores "OK".
        this.set_or_remove_attribute(this.confirm_modal, "ok-button-text", new_value);
        this.confirm_modal.apply_footer_buttons?.();
    }

    /**
     * Handles the cancel button text attribute change.
     * @param {string} new_value - The new value for the cancel button text.
     */
    handle_observed_cancel_button_text = (new_value) => {
        if (!this.confirm_modal) {
            return;
        }

        // As for the confirm button text; removing it restores "Cancel".
        this.set_or_remove_attribute(this.confirm_modal, "cancel-button-text", new_value);
        this.confirm_modal.apply_footer_buttons?.();
    }

    /**
     * Sets an attribute, or removes it when the value is empty.
     * @param {Element} element - The element.
     * @param {string} attribute_name - The attribute.
     * @param {string|null} value - Its value; empty or null removes it.
     */
    set_or_remove_attribute = (element, attribute_name, value) => {
        if (value) {
            element.setAttribute(attribute_name, value);
        }
        else {
            element.removeAttribute(attribute_name);
        }
    }

    /**
     * Handles the button click event. Triggers the confirm modal if needed..
     */
    on_button_click = () => {
        if (this.disabled) {
            return;
        }

        if (this.has_confirm && this.confirm_modal) {
            this.confirm_modal.modal_title.textContent = this.confirm_title_text || "Confirm";
            this.confirm_modal.body_element.textContent = this.confirm_body_text || "Are you sure?";
            this.set_or_remove_attribute(this.confirm_modal, "ok-button-text", this.confirm_button_text);
            this.set_or_remove_attribute(this.confirm_modal, "cancel-button-text", this.cancel_button_text);
            // Applied now rather than when the attribute reactions run, so the dialog opens with its labels.
            this.confirm_modal.apply_footer_buttons?.();

            this.confirm_modal.ok_button.addEventListener("click", this.on_confirm_modal_ok_button_click, {once: true});
            this.confirm_modal.cancel_button.addEventListener("click", this.on_confirm_modal_cancel_button_click, {once: true});

            this.confirm_modal.open_modal();
        }
    }

    /**
     * Handles the confirm modal button click event. Triggers the confirm callback if provided and closes the modal.
     */
    on_confirm_modal_ok_button_click = () => {
        if (this.confirm_callback) {
            this.confirm_callback();
        }

        this.confirm_modal.close_modal();
    }

    /**
     * Handles the cancel button click event in the confirm modal. Triggers the cancel callback if provided and closes the modal.
     */
    on_confirm_modal_cancel_button_click = () => {
        if (this.cancel_callback) {
            this.cancel_callback();
        }

        this.confirm_modal.close_modal();
    }

    /**
     * Builds the confirm modal, if has_confirm is set and it doesn't already exist. Called once at initial
     * connection (from on_create) and again by handle_observed_has_confirm if has-confirm is added after
     * the button has already connected.
     */
    ensure_confirm_modal = async () => {
        if (this.has_confirm && !this.confirm_modal) {
            this.confirm_modal = await this.get_template(`<galaxy-modal size="1"></galaxy-modal>`);

            // Named slot with no matching <slot> in the template keeps the modal out of the button's default (label) slot.
            this.confirm_modal.setAttribute("slot", "galaxy-button-internal");

            this.appendChild(this.confirm_modal);
        }
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_create}
    */
    on_create = async () => {
        this.button = await this.get_template();

        this.shadow.appendChild(this.button);
        this.handle_observed_disabled();

        await this.ensure_confirm_modal();

        this.button.addEventListener("click", this.on_button_click);
        this.addEventListener("click", this.on_host_click_capture, {capture: true});
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_destroy}
    */
    on_destroy = async () => {
        this.button.removeEventListener("click", this.on_button_click);
        this.removeEventListener("click", this.on_host_click_capture, {capture: true});

        // The inner button goes, so a reconnect (a move) builds one rather than a second. The confirmation callbacks stay: they belong to the page, and a moved button
        // must still run them.
        this.button.remove();
        this.button = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return BUTTON_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            :host {
                color: transparent;
                background-color: transparent;
                border: 0;
            }

            button {
                /* A centered flex row, so an icon sits level with the label rather than at the top of its line */
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.3em;
                font-family: inherit;
                font-weight: 400;
                color: var(--black);
                text-align: center;
                vertical-align: middle;
                -webkit-user-select: none;
                -ms-user-select: none;
                user-select: none;
                background-color: transparent;
                border: 1px solid transparent;
                padding: 0.375rem 0.75rem;
                font-size: 1rem;
                line-height: 1.5;
                border-radius: 0.25rem;
                transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

                /* Default */
                color: var(--text-light);
                background-color: var(--blue);
                border-color: var(--blue);

                &:hover:not(:disabled) {
                    color: var(--text-light);
                    background-color: #0069d9;
                    border-color: #0062cc;

                    text-decoration: none;
                }

                &:focus-visible {
                    outline: 2px solid var(--blue);
                    outline-offset: 2px;
                }

                &:before {
                    display: inline-block;
                    text-rendering: auto;
                    -webkit-font-smoothing: antialiased;
                }
            }

            :host([disabled]) button {
                opacity: 0.65;
                cursor: not-allowed;
            }

            /* Sizes - any other size value is the default size */
            :host([size="sm"]) button {
                padding: 0.25rem 0.5rem;
                font-size: 0.875rem;
                border-radius: 0.2rem;
            }

            :host([size="lg"]) button {
                padding: 0.5rem 1rem;
                font-size: 1.25rem;
                border-radius: 0.3rem;
            }

            /* Block: fills its container's width */
            :host([block]) {
                display: block;
            }

            :host([block]) button {
                width: 100%;
            }

            :host([type="danger"]) button {
                color: var(--text-light);
                background-color: var(--red);
                border-color: var(--red);

                &:hover:not(:disabled) {
                    color: var(--text-light);
                    background-color: #c82333;
                    border-color: #bd2131;

                    text-decoration: none;
                }
            }

            :host([type="success"]) button {
                color: var(--text-light);
                background-color: var(--green);
                border-color: var(--green);

                &:hover:not(:disabled) {
                    color: var(--text-light);
                    background-color: #218838;
                    border-color: #1e7e34;

                    text-decoration: none;
                }
            }

            :host([type="warning"]) button {
                color: var(--black);
                background-color: var(--yellow);
                border-color: var(--yellow);

                &:hover:not(:disabled) {
                    color: var(--black);
                    background-color: #e0a800;
                    border-color: #d39e00;

                    text-decoration: none;
                }
            }

            :host([type="secondary"]) button {
                color: var(--text-light);
                background-color: var(--grey);
                border-color: var(--grey);

                &:hover:not(:disabled) {
                    color: var(--text-light);
                    background-color: #5a6268;
                    border-color: #545b62;

                    text-decoration: none;
                }
            }

            :host([type="light"]) button {
                color: var(--black);
                background-color: var(--dropdown-option-hover);
                border-color: var(--dropdown-option-hover);

                &:hover:not(:disabled) {
                    color: var(--black);
                    background-color: #e2e6ea;
                    border-color: #dae0e5;

                    text-decoration: none;
                }
            }

            :host([icon="import"]) button:before {
                content: "\\f56e";
                font: var(--fa-font-regular);
            }

            :host([icon="export"]) button:before {
                content: "\\f56f";
                font: var(--fa-font-regular);
            }

            :host([icon="save"]) button:before {
                content: "\\f0c7";
                font: var(--fa-font-solid);
            }

            :host([icon="confirm"]) button:before {
                content: "\\f00c";
                font: var(--fa-font-solid);
            }

            :host([icon="cancel"]) button:before {
                content: "\\f05e";
                font: var(--fa-font-solid);
            }

            :host([icon="delete"]) button:before {
                content: "\\f1f8";
                font: var(--fa-font-solid);
            }

            :host([icon="create"]) button:before {
                content: "\\2b";
                font: var(--fa-font-solid);
            }

            :host([icon="locked"]) button:before {
                content: "\\f023";
                font: var(--fa-font-solid);
            }

            :host([icon="unlocked"]) button:before {
                content: "\\f09c";
                font: var(--fa-font-solid);
            }
        `;
    }
}

