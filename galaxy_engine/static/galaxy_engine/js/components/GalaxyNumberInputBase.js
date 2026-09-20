/**
 * @file GalaxyNumberInputBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
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
        return ["step"];
    };

    /**
     * Gets the min attribute of the Galaxy input.
     * @return {string} - The minimum value of the input.
     */
    get min() {return this.getAttribute("min")}

    /**
     * Sets the min attribute of the Galaxy input.
     * @param {string|number} value - The minimum value of the input.
     */
    set min(value) {
        if (value) {
            this.setAttribute("min", value.toString());
        }
    }

    /**
     * Gets the max attribute of the Galaxy input.
     * @return {string} - The maximum value of the input.
     */
    get max() {return this.getAttribute("max")}

    /**
     * Sets the max attribute of the Galaxy input.
     * @param {string|number} value - The maximum value of the input.
     */
    set max(value) {
        if (value) {
            this.setAttribute("max", value.toString());
        }
    }

    /**
     * Gets the step attribute of the Galaxy input.
     * @return {string} - The step value of the input.
     */
    get step() {return this.getAttribute("step")}

    /**
     * Sets the step attribute of the Galaxy input.
     * @param {string|number} value - The step value of the input.
     */
    set step(value) {
        if (value) {
            this.setAttribute("step", value.toString());
        }
    }

    /**
     * Handles the observed step attribute.
     * @param {string} new_value - The new value of the step attribute.
     */
    handle_observed_step = (new_value) => {
        this.input_element.step = new_value || "any";
    }

    /**
     * Casts the value to the correct type for the number input.
     * If the input is a float, the value is parsed as a float. If the input is an integer, the value is parsed as an integer.
     * @param {string|number} value - The value to cast.
     * @return {number|null} - The casted value or null if the value is not a number.
     */
    cast_value_for_input_type = (value) => {
        if (value) {
            value = Number(value);

            if (isNaN(value)) {
                return null;
            }
        }

        if (value && this.type === "float") {
            return parseFloat(value);
        }
        else if (value && this.type === "integer") {
            return parseInt(value);
        }
        else {
            return null;
        }
    }

    /**
     * {@link GalaxyInputBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (name === "step") {
            this.handle_observed_step(new_value);
        }
    }

    /**
     * {@link GalaxyInputBase#get_validation_errors}
     * @override
     */
    get_validation_errors = (value) => {
        let validity_text_list = [];

        let number_value = Number(value?.toString().trim());
        let casted_min_value = this.cast_value_for_input_type(this.min);
        let casted_max_value = this.cast_value_for_input_type(this.max);

        if (!number_value || isNaN(number_value)) {
            validity_text_list.push(`Please enter a valid ${this.type} value.`);
        }

        if (this.type === "integer" && !Number.isInteger(number_value)) {
            validity_text_list.push("Please enter a valid integer value.");
        }

        if (casted_min_value && number_value < casted_min_value) {
            validity_text_list.push(`Please enter a value greater than or equal to ${casted_min_value}.`);
        }

        if (casted_max_value && number_value > casted_max_value) {
            validity_text_list.push(`Please enter a value less than or equal to ${casted_max_value}.`);
        }

        return validity_text_list;
    }
}