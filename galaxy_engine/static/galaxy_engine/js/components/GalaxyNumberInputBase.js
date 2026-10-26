/**
 * @file GalaxyNumberInputBase.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";

/**
 * @class
 * @description
 *     A base class for float and integer input components.
 * @extends GalaxyInputBase
 */
export class GalaxyNumberInputBase extends GalaxyInputBase {
    /**
     * {@link GalaxyInputBase.submits_form_on_enter}
     * @override
     */
    static submits_form_on_enter = true;

    /**
     * @constructor
     * @param {string} component_template_html - The HTML template for the component.
     */
    constructor(component_template_html) {
        super(component_template_html);

        this.type = null;
    }

    /**
     * {@link GalaxyInputBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["step", "min", "max"];
    };

    /**
     * Sets a number attribute from a property, or removes it for null, undefined or "" - so 0 is a real value, and a limit can be cleared.
     * @param {string} attribute_name - The attribute.
     * @param {string|number|null} value - The value.
     */
    set_number_attribute = (attribute_name, value) => {
        if (value === null || value === undefined || value === "") {
            this.removeAttribute(attribute_name);
        }
        else {
            this.setAttribute(attribute_name, String(value));
        }
    }

    /**
     * Gets the min attribute of the Galaxy input.
     * @return {string} - The minimum value of the input.
     */
    get min() {return this.getAttribute("min")}

    /**
     * Sets the min attribute of the Galaxy input; null, undefined or "" removes it.
     * @param {string|number|null} value - The minimum value of the input.
     */
    set min(value) {
        this.set_number_attribute("min", value);
    }

    /**
     * Gets the max attribute of the Galaxy input.
     * @return {string} - The maximum value of the input.
     */
    get max() {return this.getAttribute("max")}

    /**
     * Sets the max attribute of the Galaxy input; null, undefined or "" removes it.
     * @param {string|number|null} value - The maximum value of the input.
     */
    set max(value) {
        this.set_number_attribute("max", value);
    }

    /**
     * Gets the step attribute of the Galaxy input.
     * @return {string} - The step value of the input.
     */
    get step() {return this.getAttribute("step")}

    /**
     * Sets the step attribute of the Galaxy input; null, undefined or "" removes it.
     * @param {string|number|null} value - The step value of the input.
     */
    set step(value) {
        this.set_number_attribute("step", value);
    }

    /**
     * Applies a min or max attribute to the field - so its spinner stops there - and revalidates when the form validates instantly or the input already shows an
     * error, so a changed limit takes effect at once.
     * @param {string} name - "min" or "max".
     * @param {string|null} new_value - The attribute's value, or null when removed.
     */
    handle_observed_limit = (name, new_value) => {
        // A limit present before the field exists is applied by on_create instead.
        if (!this.input_element) {
            return;
        }

        if (new_value === null) {
            this.input_element.removeAttribute(name);
        }
        else {
            this.input_element.setAttribute(name, new_value);
        }

        let is_instant_validation = Boolean(this.parent_form?.hasAttribute("instant-validation"));
        let shows_error = !this._internals.checkValidity();

        if (this.is_initialized && (is_instant_validation || shows_error)) {
            this.validate();
        }
    }

    /**
     * Handles the observed step attribute.
     * @param {string} new_value - The new value of the step attribute.
     */
    handle_observed_step = (new_value) => {
        // A step attribute present before the field exists (in markup, or set before the input is connected) is applied by on_create instead.
        if (!this.input_element) {
            return;
        }

        this.input_element.step = new_value || "any";
    }

    /**
     * Reads a min or max limit as a number. It is not cut to a whole number for an integer input: `min="1.5"` still means at least 1.5, so 1 is too small and 2 is
     * the least valid value.
     * @param {string|number} value - The limit.
     * @return {number|null} - The limit, or null when it is not set or not a number.
     */
    cast_value_for_input_type = (value) => {
        // Checked against empty rather than falsy, so a min or max of 0 is a real limit rather than none.
        if (value === null || value === undefined || String(value).trim() === "") {
            return null;
        }

        let number_value = Number(value);

        return Number.isNaN(number_value) ? null : number_value;
    }

    /**
     * {@link GalaxyInputBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (name === "step") {
            this.handle_observed_step(new_value);
        }
        else if (name === "min" || name === "max") {
            this.handle_observed_limit(name, new_value);
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     * @note Applies a step, min or max attribute that arrived before the field existed; without a step, the field keeps its template's own.
     */
    on_create = async () => {
        if (this.hasAttribute("step")) {
            this.handle_observed_step(this.getAttribute("step"));
        }

        for (let limit_name of ["min", "max"]) {
            if (this.hasAttribute(limit_name)) {
                this.input_element.setAttribute(limit_name, this.getAttribute(limit_name));
            }
        }
    }

    /**
     * {@link GalaxyInputBase#get_validation_errors}
     * @override
     */
    get_validation_errors = (value) => {
        let validity_text_list = [];

        let value_string = String(value ?? "").trim();
        let number_value = Number(value_string);
        let casted_min_value = this.cast_value_for_input_type(this.min);
        let casted_max_value = this.cast_value_for_input_type(this.max);
        let is_number = value_string !== "" && !Number.isNaN(number_value);

        // 0 is a valid number; only text that is not a number fails here, and it fails once rather than once per check below.
        if (!is_number) {
            validity_text_list.push(`Please enter a valid ${this.type} value.`);

            return validity_text_list;
        }

        if (this.type === "integer" && !Number.isInteger(number_value)) {
            validity_text_list.push("Please enter a valid integer value.");
        }

        if (casted_min_value !== null && number_value < casted_min_value) {
            validity_text_list.push(`Please enter a value greater than or equal to ${casted_min_value}.`);
        }

        if (casted_max_value !== null && number_value > casted_max_value) {
            validity_text_list.push(`Please enter a value less than or equal to ${casted_max_value}.`);
        }

        return validity_text_list;
    }
}