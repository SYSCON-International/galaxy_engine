/**
 * @file GalaxyPasswordInput.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyTextInput} from "./GalaxyTextInput.js";

const COMPONENT_TEMPLATE_HTML = `
    <input type="password" class="form-control" autocomplete="current-password" spellcheck="false" />
`;

const PASSWORD_EXTRAS_TEMPLATE_HTML = `
    <div class="password-extras">
        <button class="visibility-toggle" type="button" aria-label="Show password" aria-pressed="false">
            <svg class="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg class="eye-slash-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7c2.2 0 4 .8 5.6 1.9M22 12s-3.6 7-10 7c-2.2 0-4-.8-5.6-1.9"></path>
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>
                <path d="M3 3l18 18"></path>
            </svg>
        </button>
        <div class="caps-lock-warning" role="status" hidden></div>
    </div>
`;

const DEFAULT_AUTOCOMPLETE = "current-password";
const DEFAULT_CAPS_LOCK_MESSAGE = "Caps Lock is on";

/**
 * @class
 * @description
 *     A password field: a {@link GalaxyTextInput} that masks its value, with a show/hide toggle (`hide-visibility-toggle` removes it), a Caps Lock warning while the field is
 *     focused, and an `autocomplete` attribute defaulting to "current-password" ("new-password" for set/change-password forms).
 *
 *     It keeps the password inside the field: `property-name` is ignored with a warning, so the password never enters the state manager; a value set from code is not
 *     reflected to the `value` attribute, so it does not appear in devtools or `outerHTML`; and it submits no restore state, so the browser does not keep it in session
 *     history. It is submitted with its form like any other field.
 * @extends GalaxyTextInput
 */
export class GalaxyPasswordInput extends GalaxyTextInput {
    /**
     * @constructor
     */
    constructor() {
        super(COMPONENT_TEMPLATE_HTML);

        this.type = "password";
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["autocomplete", "hide-visibility-toggle", "caps-lock-message"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.visibility_toggle_element) {
            return;
        }

        // disabled is observed by GalaxyInputBase, which has already disabled the field; the toggle follows it.
        const attribute_lookup_table = {
            "autocomplete": this.handle_observed_autocomplete,
            "hide-visibility-toggle": this.handle_observed_hide_visibility_toggle,
            "caps-lock-message": this.handle_observed_caps_lock_message,
            "disabled": this.handle_observed_toggle_disabled,
        }

        attribute_lookup_table[name]?.(new_value);
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the autocomplete hint for browsers and password managers.
     * @return {string} - The autocomplete value; defaults to "current-password".
     */
    get autocomplete() {return this.getAttribute("autocomplete") || DEFAULT_AUTOCOMPLETE;}

    /**
     * Sets the autocomplete hint: "current-password" for a login field, "new-password" for a set/change-password field, or "off".
     * @param {string|null} value - The autocomplete value, or null for the default.
     */
    set autocomplete(value) {
        if (value) {
            this.setAttribute("autocomplete", value);
        }
        else {
            this.removeAttribute("autocomplete");
        }
    }

    /**
     * Gets whether the show/hide toggle is removed.
     * @return {boolean} - True when there is no toggle.
     */
    get hide_visibility_toggle() {return this.hasAttribute("hide-visibility-toggle");}

    /**
     * Sets whether the show/hide toggle is removed. Removing it while the password is shown masks it again.
     * @param {boolean} value - True to remove the toggle.
     */
    set hide_visibility_toggle(value) {
        if (value) {
            this.setAttribute("hide-visibility-toggle", "");
        }
        else {
            this.removeAttribute("hide-visibility-toggle");
        }
    }

    /**
     * Gets the Caps Lock warning text.
     * @return {string} - The warning; defaults to "Caps Lock is on".
     */
    get caps_lock_message() {
        let explicit_message = this.getAttribute("caps-lock-message");

        return explicit_message !== null ? explicit_message : DEFAULT_CAPS_LOCK_MESSAGE;
    }

    /**
     * Sets the Caps Lock warning text, e.g. a translated string.
     * @param {string|null|undefined} value - The warning, or null/undefined for the default.
     */
    set caps_lock_message(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("caps-lock-message");
        }
        else {
            this.setAttribute("caps-lock-message", value);
        }
    }

    /**
     * Gets whether the password is currently shown as plain text.
     * @return {boolean} - True while shown.
     */
    get is_password_visible() {
        return this.input_element?.type === "text";
    }

    /**
     * Gets the password.
     * @override
     * @return {string} - The password.
     */
    get value() {return this._value;}

    /**
     * Sets the password. Written straight to the field and the form value - never to the `value` attribute, where it would show in devtools and `outerHTML`.
     * @override
     * @param {string|null|undefined} value - The password; null/undefined clear it.
     */
    set value(value) {
        let value_string = value === null || value === undefined ? "" : String(value);

        this._value = value_string;

        if (this.input_element) {
            this.input_element.value = value_string;
        }

        // No restore state, so the browser does not keep the password in session history.
        this._internals.setFormValue(value_string, "");

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * Applies {@link autocomplete} to the field.
     */
    handle_observed_autocomplete = () => {
        this.input_element.setAttribute("autocomplete", this.autocomplete);
    }

    /**
     * Shows or removes the toggle, masking the password when the toggle is removed.
     */
    handle_observed_hide_visibility_toggle = () => {
        this.visibility_toggle_element.hidden = this.hide_visibility_toggle;

        if (this.hide_visibility_toggle) {
            this.hide_password();
        }
    }

    /**
     * Applies {@link caps_lock_message} to the warning.
     */
    handle_observed_caps_lock_message = () => {
        this.caps_lock_warning_element.textContent = this.caps_lock_message;
    }

    /**
     * Disables the toggle along with the field.
     */
    handle_observed_toggle_disabled = () => {
        this.visibility_toggle_element.disabled = this.disabled;
    }

    /*******************************************************
     *                    Event Methods                    *
     *******************************************************/

    /**
     * Handles the user typing. The same as GalaxyInputBase#on_input_event, except that there is no state-manager write and no restore state.
     * @override
     * @param {Event} event - The input or change event.
     */
    on_input_event = (event) => {
        this._value = event.target.value;
        this._internals.setFormValue(event.target.value, "");

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }

        this.on_input(event);
    }

    /**
     * Toggles between showing and masking the password.
     */
    on_visibility_toggle_click = () => {
        if (this.is_password_visible) {
            this.hide_password();
        }
        else {
            this.show_password();
        }
    }

    /**
     * Keeps focus in the field when the toggle is pressed with the mouse, so typing can continue where it left off.
     * @param {MouseEvent} event - The mousedown event.
     */
    on_visibility_toggle_mousedown = (event) => {
        event.preventDefault();
    }

    /**
     * Shows or hides the Caps Lock warning from the key event's modifier state.
     * @param {KeyboardEvent} event - The keydown or keyup event.
     */
    on_field_key = (event) => {
        let is_caps_lock_on = Boolean(event.getModifierState?.("CapsLock"));

        this.caps_lock_warning_element.hidden = !is_caps_lock_on;
    }

    /**
     * Hides the Caps Lock warning when the field loses focus.
     */
    on_field_blur = () => {
        this.caps_lock_warning_element.hidden = true;
    }

    /*******************************************************
     *                    Other Methods                    *
     *******************************************************/

    /**
     * Shows the password as plain text.
     */
    show_password = () => {
        this.set_password_visibility(true);
    }

    /**
     * Masks the password.
     */
    hide_password = () => {
        this.set_password_visibility(false);
    }

    /**
     * Switches the field between plain text and masked, keeping the caret and selection where they were, and updates the toggle's label and pressed state.
     * @param {boolean} is_visible - True to show the password.
     */
    set_password_visibility = (is_visible) => {
        if (!this.input_element || !this.visibility_toggle_element) {
            return;
        }

        let selection_start = this.input_element.selectionStart;
        let selection_end = this.input_element.selectionEnd;

        this.input_element.type = is_visible ? "text" : "password";

        if (selection_start !== null && selection_end !== null) {
            this.input_element.setSelectionRange(selection_start, selection_end);
        }

        this.visibility_toggle_element.setAttribute("aria-pressed", String(is_visible));
        this.visibility_toggle_element.setAttribute("aria-label", is_visible ? "Hide password" : "Show password");
        this.visibility_toggle_element.classList.toggle("is-visible", is_visible);
    }

    /**
     * Web Components API - masks the password and restores the value it had when created.
     * @override
     */
    formResetCallback = () => {
        this.hide_password();
        this.value = this.default_value;
    }

    /**
     * Web Components API - ignores any restore state; a password is never restored from session history.
     * @override
     */
    formStateRestoreCallback = () => {}

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        // Cleared before GalaxyInputBase#post_on_create binds, so the password never enters the state manager.
        if (this.property_name) {
            console.warn(`${this.constructor.name}: property-name is not supported on a password input, so the password stays out of the state manager; it is ignored.`);
            this.property_name = null;
        }

        // A value set from code before the field existed.
        this.input_element.value = this._value;

        // The field and its extras share a positioned wrapper, so the toggle can sit inside the field's right edge.
        let field_wrapper = document.createElement("div");
        field_wrapper.className = "password-field";

        this.input_element.before(field_wrapper);
        field_wrapper.appendChild(this.input_element);

        this.password_extras_element = await this.get_template(PASSWORD_EXTRAS_TEMPLATE_HTML);
        this.visibility_toggle_element = this.password_extras_element.querySelector(".visibility-toggle");
        this.caps_lock_warning_element = this.password_extras_element.querySelector(".caps-lock-warning");

        field_wrapper.appendChild(this.visibility_toggle_element);
        field_wrapper.after(this.caps_lock_warning_element);

        this.visibility_toggle_element.addEventListener("click", this.on_visibility_toggle_click);
        this.visibility_toggle_element.addEventListener("mousedown", this.on_visibility_toggle_mousedown);
        this.input_element.addEventListener("keydown", this.on_field_key);
        this.input_element.addEventListener("keyup", this.on_field_key);
        this.input_element.addEventListener("blur", this.on_field_blur);

        this.handle_observed_autocomplete();
        this.handle_observed_hide_visibility_toggle();
        this.handle_observed_caps_lock_message();
        this.handle_observed_toggle_disabled();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.visibility_toggle_element?.removeEventListener("click", this.on_visibility_toggle_click);
        this.visibility_toggle_element?.removeEventListener("mousedown", this.on_visibility_toggle_mousedown);
        this.input_element?.removeEventListener("keydown", this.on_field_key);
        this.input_element?.removeEventListener("keyup", this.on_field_key);
        this.input_element?.removeEventListener("blur", this.on_field_blur);

        this.visibility_toggle_element = null;
        this.caps_lock_warning_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            .password-field {
                position: relative;
            }

            :host(:not([hide-visibility-toggle])) .password-field input {
                padding-right: 2.5rem;
            }

            .visibility-toggle {
                position: absolute;
                top: 50%;
                right: 0.375rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1.75rem;
                height: 1.75rem;
                padding: 0;
                border: none;
                color: var(--grey);
                background: none;
                border-radius: 0.25rem;
                transform: translateY(-50%);
                cursor: pointer;
            }

            .visibility-toggle:hover {
                color: var(--text-dark);
            }

            .visibility-toggle:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 1px;
            }

            .visibility-toggle[hidden] {
                display: none;
            }

            .visibility-toggle:disabled {
                cursor: default;
                opacity: 0.5;
            }

            .visibility-toggle svg {
                width: 1.1rem;
                height: 1.1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .visibility-toggle .eye-slash-icon,
            .visibility-toggle.is-visible .eye-icon {
                display: none;
            }

            .visibility-toggle.is-visible .eye-slash-icon {
                display: block;
            }

            .caps-lock-warning {
                margin-top: 0.25rem;
                font-size: 0.8rem;
                color: var(--red);
            }

            .caps-lock-warning[hidden] {
                display: none;
            }

            /* The shared readonly style blocks pointer events on the field only; the toggle stays usable so a readonly password can still be viewed */
            :host([readonly]) .visibility-toggle {
                pointer-events: auto;
            }
        `;
    }
}
