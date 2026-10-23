/**
 * @file GalaxyCheckbox.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";

const INPUT_ID = "galaxy_checkbox_input";

const COMPONENT_TEMPLATE_HTML = `
    <input id="${INPUT_ID}" type="checkbox" />
`;

const TRUE_STRINGS = ["true", "1", "on", "yes"];
const NULL_STRINGS = ["", "null", "indeterminate", "mixed"];

/**
 * @class
 * @description
 *     A boolean input, drawn as a checkbox or - with the `switch` attribute - as a toggle switch. Its {@link value} is a real boolean that mirrors the `checked` attribute,
 *     and it submits `"true"` or `"false"` with its form, including when unchecked (unlike a native checkbox, which submits nothing then). The `label` sits beside the box and
 *     toggles it when clicked. `indeterminate` shows a mixed state until the user next toggles it. `readonly` blocks toggling while keeping the current value submitted,
 *     which a native checkbox does not support. A user toggle dispatches `change` on the element; setting `checked` or `value` from code does not.
 *
 *     With `tri-state`, the mixed state is a third value the user can pick: clicks cycle unchecked -> indeterminate -> checked -> unchecked, and while indeterminate
 *     {@link value} is `null` and the form submits `""` - a nullable boolean.
 * @extends GalaxyInputBase
 */
export class GalaxyCheckbox extends GalaxyInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(COMPONENT_TEMPLATE_HTML);

        this.type = "checkbox";
        this.default_checked = false;
        this.default_indeterminate = false;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["checked", "indeterminate", "switch", "tri-state"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.input_element) {
            return;
        }

        const attribute_lookup_table = {
            "checked": this.handle_observed_checked,
            "indeterminate": this.handle_observed_indeterminate,
            "switch": this.handle_observed_switch,
            "tri-state": this.handle_state_change,
        }

        attribute_lookup_table[name]?.(new_value);
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the checked state.
     * @return {boolean} - True when checked.
     */
    get checked() {return this.hasAttribute("checked");}

    /**
     * Sets the checked state. Does not dispatch `change`.
     * @param {boolean} value - True to check the box.
     */
    set checked(value) {
        if (value) {
            this.setAttribute("checked", "");
        }
        else {
            this.removeAttribute("checked");
        }
    }

    /**
     * Gets the indeterminate (mixed) state.
     * @return {boolean} - True while the box shows the mixed state.
     */
    get indeterminate() {return this.hasAttribute("indeterminate");}

    /**
     * Sets the indeterminate (mixed) state. Without {@link tri_state} it is purely visual - {@link value} still reports {@link checked} - and cleared when the user next toggles
     * the box. With {@link tri_state} it is the third value, and {@link value} reports `null`.
     * @param {boolean} value - True to show the mixed state.
     */
    set indeterminate(value) {
        if (value) {
            this.setAttribute("indeterminate", "");
        }
        else {
            this.removeAttribute("indeterminate");
        }
    }

    /**
     * Gets whether the box is drawn as a toggle switch.
     * @return {boolean} - True for the switch look.
     */
    get switch() {return this.hasAttribute("switch");}

    /**
     * Sets whether the box is drawn as a toggle switch.
     * @param {boolean} value - True for the switch look.
     */
    set switch(value) {
        if (value) {
            this.setAttribute("switch", "");
        }
        else {
            this.removeAttribute("switch");
        }
    }

    /**
     * Gets whether clicks cycle through the indeterminate state as a third value.
     * @return {boolean} - True in tri-state mode.
     */
    get tri_state() {return this.hasAttribute("tri-state");}

    /**
     * Sets whether clicks cycle through the indeterminate state as a third value - unchecked -> indeterminate -> checked -> unchecked - with {@link value} `null` while
     * indeterminate.
     * @param {boolean} value - True for tri-state mode.
     */
    set tri_state(value) {
        if (value) {
            this.setAttribute("tri-state", "");
        }
        else {
            this.removeAttribute("tri-state");
        }
    }

    /**
     * Gets the value - the {@link checked} state as a boolean, or `null` while indeterminate in {@link tri_state} mode.
     * @override
     * @return {boolean|null} - True when checked, false when unchecked, null when tri-state and indeterminate.
     */
    get value() {
        if (this.tri_state && this.indeterminate) {
            return null;
        }

        return this.checked;
    }

    /**
     * Sets the value, checking or unchecking the box. Accepts a boolean, or a string where "true", "1", "on", and "yes" (any case) mean checked. In {@link tri_state} mode,
     * `null`, `undefined`, `""`, "null", "indeterminate", and "mixed" set the indeterminate state, and any other value clears it.
     * @override
     * @param {boolean|string|number|null} value - The new value.
     */
    set value(value) {
        if (!this.tri_state) {
            this.checked = this.parse_boolean(value);
            return;
        }

        let tri_state_value = this.parse_tri_state(value);

        // In tri-state mode indeterminate is its own value, so it never shares the box with checked.
        this.checked = tri_state_value === true;
        this.indeterminate = tri_state_value === null;
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * Applies the `checked` attribute to the inner box and the form value.
     */
    handle_observed_checked = () => {
        this.input_element.checked = this.checked;
        this.handle_state_change();
    }

    /**
     * Applies the `indeterminate` attribute to the inner box and, since it is a value in {@link tri_state} mode, the form value.
     */
    handle_observed_indeterminate = () => {
        this.input_element.indeterminate = this.indeterminate;
        this.handle_state_change();
    }

    /**
     * Updates the form value after the value may have changed, and revalidates when instant validation is on.
     */
    handle_state_change = () => {
        this.update_form_value();

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /**
     * Applies the `switch` attribute, announcing the box to assistive technology as a switch rather than a checkbox.
     */
    handle_observed_switch = () => {
        if (this.switch) {
            this.input_element.setAttribute("role", "switch");
        }
        else {
            this.input_element.removeAttribute("role");
        }
    }

    /**
     * A `value` attribute written in markup sets the value, e.g. `value="true"` - or, in {@link tri_state} mode, `value="null"` for indeterminate.
     * @override
     * @param {string|null} new_value - The new value of the value attribute.
     */
    handle_observed_value = (new_value) => {
        if (new_value === null) {
            return;
        }

        this.value = new_value;
    }

    /**
     * Re-submits the current value under the new name.
     * @override
     */
    handle_observed_name = () => {
        this.update_form_value();
    }

    /*******************************************************
     *                    Event Methods                    *
     *******************************************************/

    /**
     * Ignores the inner box's input event. A click fires both input and change on a checkbox; handling only change keeps it to one update and one dispatched event per toggle.
     * @override
     */
    on_input_event = () => {}

    /**
     * Handles the user toggling the box: mirrors it to the `checked` attribute and clears `indeterminate` - or, in {@link tri_state} mode, moves to the next value in the cycle -
     * updates the form value, validates when instant validation is on, then dispatches `change` on this element.
     * @override
     * @param {Event} event - The inner box's change event.
     */
    on_change_event = (event) => {
        if (this.tri_state) {
            // The browser's own toggle only goes between checked and unchecked, so the inner box is set to the next value in the cycle explicitly.
            let next_value = this.get_next_tri_state_value();

            this.input_element.checked = next_value === true;
            this.input_element.indeterminate = next_value === null;
            this.value = next_value;
        }
        else {
            this.indeterminate = false;
            this.checked = this.input_element.checked;
        }

        this.update_form_value();

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }

        this.on_change(event);

        // The inner box's change event does not cross the shadow boundary, so this element dispatches its own.
        this.dispatch_host_change();
    }

    /**
     * Blocks toggling while `readonly` - a native checkbox ignores readonly. Cancelling the click also covers the keyboard (Space) and clicks on the label.
     * @param {MouseEvent} event - The inner box's click event.
     */
    on_input_click = (event) => {
        if (this.readonly) {
            event.preventDefault();
        }
    }

    /*******************************************************
     *                    Other Methods                    *
     *******************************************************/

    /**
     * Converts a boolean-like value to a boolean.
     * @param {boolean|string|number|null|undefined} value - The value to convert.
     * @return {boolean} - True for `true`, a non-zero number, or "true", "1", "on", or "yes" in any case.
     */
    parse_boolean = (value) => {
        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        if (typeof value === "string") {
            return TRUE_STRINGS.includes(value.trim().toLowerCase());
        }

        return false;
    }

    /**
     * Converts a value to a tri-state value.
     * @param {boolean|string|number|null|undefined} value - The value to convert.
     * @return {boolean|null} - Null for `null`, `undefined`, or "", "null", "indeterminate", or "mixed" in any case; otherwise as {@link parse_boolean}.
     */
    parse_tri_state = (value) => {
        if (value === null || value === undefined) {
            return null;
        }

        let is_null_string = typeof value === "string" && NULL_STRINGS.includes(value.trim().toLowerCase());

        if (is_null_string) {
            return null;
        }

        return this.parse_boolean(value);
    }

    /**
     * Gets the value a click moves to in {@link tri_state} mode, from the value before the click: unchecked -> indeterminate -> checked -> unchecked.
     * @return {boolean|null} - The next value.
     */
    get_next_tri_state_value = () => {
        if (this.value === null) {
            return true;
        }

        if (this.value === true) {
            return false;
        }

        return null;
    }

    /**
     * Submits the current value as `"true"` or `"false"` (or `""` while indeterminate in {@link tri_state} mode), and mirrors it to the state manager under `property-name`.
     */
    update_form_value = () => {
        let value = this.value;
        let value_string = value === null ? "" : String(value);

        this._internals.setFormValue(value_string, value_string);

        this.write_state_value(value);
    }

    /**
     * A required checkbox must be checked.
     * @override
     */
    is_value_empty = (value) => value !== true;

    /**
     * {@link GalaxyInputBase#required_error_message}
     * @override
     */
    required_error_message = "Please check this box.";

    /**
     * Web Components API - restores the checked state the element had when it was created, and in {@link tri_state} mode its indeterminate state too.
     * @override
     */
    formResetCallback() {
        this.checked = this.default_checked;

        if (this.tri_state) {
            this.indeterminate = this.default_indeterminate;
        }
    }

    /**
     * Web Components API - restores a previously submitted `"true"`/`"false"` state (or `""`, indeterminate, in {@link tri_state} mode).
     * @override
     * @param {string|File|FormData|null} state - The state previously passed to `_internals.setFormValue`.
     */
    formStateRestoreCallback(state) {
        if (typeof state === "string") {
            this.value = state;
        }
    }

    /**
     * {@link GalaxyInputBase#restore_value_after_reconnect}
     * @override
     * @note Nothing to do: the box's state lives in the checked and indeterminate attributes, which on_create applies to the new box.
     */
    restore_value_after_reconnect = () => {}

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        // Same shadow root, so the label's for= works natively: clicking it toggles the box.
        this.label_element.htmlFor = INPUT_ID;

        this.input_element.addEventListener("click", this.on_input_click);

        this.default_checked = this.checked;
        this.default_indeterminate = this.indeterminate;

        this.input_element.checked = this.checked;
        this.handle_observed_indeterminate();
        this.handle_observed_switch();
        this.update_form_value();

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.input_element?.removeEventListener("click", this.on_input_click);
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            /* Label beside the box, unless a label-layout asks for the shared input layout */
            :host(:not([label-layout])) .galaxy-input-container {
                flex-wrap: nowrap;
                align-items: center;
                gap: 0.5rem;
                margin-right: 0;
                margin-left: 0;

                .label-container, .input-container {
                    flex: 0 0 auto;
                    width: auto;
                    max-width: none;
                    padding-right: 0;
                    padding-left: 0;
                }

                .input-container {
                    order: -1;
                    display: flex;
                }
            }

            label {
                margin: 0;
                cursor: pointer;
                user-select: none;
            }

            :host input[type="checkbox"] {
                display: inline-block;
                width: 1.15rem;
                height: 1.15rem;
                margin: 0;
                padding: 0;
                border: none;
                accent-color: var(--blue);
                cursor: pointer;
            }

            :host input[type="checkbox"]:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 2px;
            }

            /* Switch look */
            :host([switch]) input[type="checkbox"] {
                position: relative;
                width: 2.25rem;
                height: 1.25rem;
                appearance: none;
                background-color: var(--lightgrey);
                border-radius: 1.25rem;
                transition: background-color 0.15s ease-in-out;
            }

            :host([switch]) input[type="checkbox"]::before {
                position: absolute;
                top: 0.125rem;
                left: 0.125rem;
                width: 1rem;
                height: 1rem;
                content: "";
                background-color: #ffffff;
                border-radius: 50%;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                transition: transform 0.15s ease-in-out;
            }

            :host([switch]) input[type="checkbox"]:checked {
                background-color: var(--blue);
            }

            :host([switch]) input[type="checkbox"]:checked::before {
                transform: translateX(1rem);
            }

            :host([switch]) input[type="checkbox"]:indeterminate {
                background-color: var(--grey);
            }

            :host([switch]) input[type="checkbox"]:indeterminate::before {
                transform: translateX(0.5rem);
            }

            :host(:invalid) input[type="checkbox"] {
                outline: 2px solid var(--red);
                outline-offset: 2px;
            }

            :host([disabled]) input[type="checkbox"] {
                opacity: 0.5;
            }

            /* The shared readonly style flattens inputs with appearance: none, which would erase a native checkbox */
            :host([readonly]) input[type="checkbox"] {
                padding: 0;
                appearance: auto;
                background-color: transparent !important;
                opacity: 0.7;
                pointer-events: auto;
                cursor: default;
            }

            :host([readonly][switch]) input[type="checkbox"] {
                appearance: none;
                background-color: var(--lightgrey) !important;
            }

            :host([readonly][switch]) input[type="checkbox"]:checked {
                background-color: var(--blue) !important;
            }

            :host([readonly]) label {
                cursor: default;
            }
        `;
    }
}
