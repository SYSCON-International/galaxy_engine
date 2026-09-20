/**
 * @file GalaxyDurationInput.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";
import {
    GalaxyDurationUtils,
    DEFAULT_UNIT_LABELS,
    DEFAULT_TRUNCATION_WARNING_TEMPLATE,
    DISPLAY_UNIT_ORDER
} from "../GalaxyDurationUtils.js";

const INPUT_TEMPLATE_HTML = `
    <input type="hidden" />
`;

/**
 * @class
 * @description
 *     Renders a duration as a row of coordinated integer inputs (a subset of days/hours/minutes/
 *     seconds, per the visible-units attribute). Editing any field re-derives the combined
 *     duration, expressed in output-unit (or unit if output-unit is not set) - that output unit
 *     stays independent of which fields are shown.
 *
 *     If the received value carries more precision than the visible fields can hold (e.g. 90
 *     seconds with only a minutes field), the un-representable remainder is shown as a warning
 *     message below the fields rather than silently dropped. The warning describes the
 *     originally received value; once the user edits any field, it is cleared, since the fields
 *     themselves are then the source of truth and can no longer be "missing" anything.
 * @extends GalaxyInputBase
 */
export class GalaxyDurationInput extends GalaxyInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(INPUT_TEMPLATE_HTML);

        this.field_values = {};
        this.field_inputs = {};
        this.field_input_handlers = {};
        this.field_blur_handlers = {};
        this.has_been_edited = false;
        this.received_truncation = {was_truncated: false};
    }

    /**
     * {@link GalaxyInputBase#pre_observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["unit", "output-unit", "visible-units", "hide-labels", "label-less-separator", "unit-labels", "truncation-warning-template"];
    }

    /***************  Getters and Setters  ***************/

    /**
     * @returns {string} - The unit the received value is expressed in. Defaults to "seconds"; falls back to it if the attribute holds an unsupported unit.
     */
    get unit() {
        let raw_value = this.getAttribute("unit") || "seconds";

        if (!GalaxyDurationUtils.is_supported_unit(raw_value)) {
            console.warn(`${this.constructor.name}: Unsupported "unit" attribute value "${raw_value}", falling back to "seconds".`);

            return "seconds";
        }

        return raw_value;
    }

    /**
     * @param {string} value
     */
    set unit(value) {this.setAttribute("unit", value)}

    /**
     * @returns {string|null} - The unit .value is returned in. Falls back to unit when not set or unsupported.
     */
    get output_unit() {
        let raw_value = this.getAttribute("output-unit");

        if (raw_value && !GalaxyDurationUtils.is_supported_unit(raw_value)) {
            console.warn(`${this.constructor.name}: Unsupported "output-unit" attribute value "${raw_value}", falling back to "unit".`);

            return null;
        }

        return raw_value;
    }

    /**
     * @param {string} value
     */
    set output_unit(value) {this.setAttribute("output-unit", value)}

    /**
     * @returns {string[]} - Which day/hour/minute/second fields are rendered. Defaults to all four.
     */
    get visible_units() {
        return GalaxyDurationUtils.parse_json_attribute(this.getAttribute("visible-units"), DISPLAY_UNIT_ORDER, this.constructor.name, "visible-units");
    }

    /**
     * @param {string[]} value
     */
    set visible_units(value) {this.setAttribute("visible-units", JSON.stringify(value))}

    /**
     * Reduces visible_units to the canonical days-to-seconds rendering order, falling back to all
     * four units (with a console.warn) if the configured list is malformed or names an
     * unsupported unit, rather than letting a bad attribute value throw out of a lifecycle callback.
     * @returns {string[]}
     */
    get safe_visible_unit_order() {
        try {
            return GalaxyDurationUtils.get_visible_unit_order(this.visible_units);
        }
        catch (error) {
            console.warn(`${this.constructor.name}: Invalid "visible-units" attribute value, falling back to all units. (${error.message})`);

            return DISPLAY_UNIT_ORDER;
        }
    }

    /**
     * @returns {boolean} - True if per-field <label>s are hidden (fields are separated by label-less-separator and carry aria-label instead).
     */
    get hide_labels() {return this.hasAttribute("hide-labels")}

    /**
     * @param {boolean} value
     */
    set hide_labels(value) {
        if (value) {
            this.setAttribute("hide-labels", "");
        }
        else {
            this.removeAttribute("hide-labels");
        }
    }

    /**
     * @returns {string} - Text shown between fields when hide_labels is true. Defaults to ":".
     */
    get label_less_separator() {return this.getAttribute("label-less-separator") || ":"}

    /**
     * @param {string} value
     */
    set label_less_separator(value) {this.setAttribute("label-less-separator", value)}

    /**
     * @returns {Object<string, string>} - Long-form label text per unit, used as the visible <label> and, label-less, as aria-label.
     */
    get unit_labels() {
        return GalaxyDurationUtils.parse_json_attribute(this.getAttribute("unit-labels"), DEFAULT_UNIT_LABELS, this.constructor.name, "unit-labels");
    }

    /**
     * @param {Object<string, string>} value
     */
    set unit_labels(value) {this.setAttribute("unit-labels", JSON.stringify(value))}

    /**
     * @returns {string} - Template for the received-value truncation warning. %s placeholders are filled with: original value, unit, remainder value, unit.
     */
    get truncation_warning_template() {return this.getAttribute("truncation-warning-template") || DEFAULT_TRUNCATION_WARNING_TEMPLATE}

    /**
     * @param {string} value
     */
    set truncation_warning_template(value) {this.setAttribute("truncation-warning-template", value)}

    /**
     * Recombines the current field values into a single scalar, expressed in output_unit (falling
     * back to unit if output_unit was not configured). Field values are used at face value, so
     * this is correct even between an edit and the following blur's normalize().
     * @override
     * @returns {number}
     */
    get value() {
        if (!this.field_inputs || Object.keys(this.field_values).length === 0) {
            return 0;
        }

        let total_microseconds = GalaxyDurationUtils.compose(this.field_values);

        return GalaxyDurationUtils.from_microseconds(total_microseconds, this.output_unit || this.unit);
    }

    /**
     * Replaces the current duration with a new scalar value, expressed in the unit attribute.
     * Re-decomposes into the visible fields and resets the truncation warning and edited state, as
     * if this were a freshly received value.
     * @override
     * @param   {number}    new_value
     */
    set value(new_value) {
        let numeric_value = Number(new_value) || 0;

        this.received_truncation = GalaxyDurationUtils.decompose(GalaxyDurationUtils.to_microseconds(numeric_value, this.unit), this.safe_visible_unit_order);
        this.field_values = this.received_truncation.parts;
        this.has_been_edited = false;

        // Reuses GalaxyInputBase's value-attribute plumbing (hidden input sync, form value, required-validation)
        // even though the visible day/hour/minute/second fields below are what the user actually edits.
        super.value = numeric_value;

        if (this.field_inputs && Object.keys(this.field_inputs).length > 0) {
            this.render_fields();
            this.render_warning();
        }
    }

    /**
     * Structured truncation information for the originally received value, so consumers do not
     * need to parse the warning text. Reports was_truncated: false once the user has edited any
     * field, matching the warning message's own behavior.
     * @returns {{was_truncated: boolean, original_value: (number|undefined), unit: (string|undefined), represented_value: (number|undefined), remainder_value: (number|undefined)}}
     */
    get truncation_info() {
        if (this.has_been_edited || !this.received_truncation.was_truncated) {
            return {was_truncated: false};
        }

        return {
            was_truncated: true,
            original_value: Number(this.getAttribute("value")) || 0,
            unit: this.unit,
            represented_value: GalaxyDurationUtils.from_microseconds(this.received_truncation.represented_microseconds, this.unit),
            remainder_value: GalaxyDurationUtils.from_microseconds(this.received_truncation.remainder_microseconds, this.unit)
        };
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @note Deliberately the middle (non-"pre_") tier: GalaxyInputBase's own pre_attribute_changed_callback
     * already handles disabled/label/name/readonly/required/value, and - since these lifecycle hooks are
     * arrow-function class fields, not prototype methods - a subclass has no way to call into it via
     * super. Per the framework's own convention, only GalaxyInputBase itself should touch the "pre_" tier;
     * feature subclasses hook the plain tier instead.
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.field_inputs || Object.keys(this.field_inputs).length === 0) {
            return;
        }

        if (["visible-units", "hide-labels", "label-less-separator", "unit-labels"].includes(name)) {
            await this.rebuild_fields();
        }
    }

    /***************  Lifecycle Methods  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     * @note Deliberately the middle tier, not pre_on_create - see the note on attribute_changed_callback
     * above. By the time this runs, GalaxyInputBase's own pre_on_create has already built the label/hidden-
     * input structure and, if a "value" attribute was present, already invoked our value setter below
     * (which populates field_values itself).
     * @override
     */
    on_create = async () => {
        if (Object.keys(this.field_values).length === 0) {
            // No "value" attribute was present, so our value setter never ran - seed the default
            // (all-zero) duration ourselves.
            this.received_truncation = GalaxyDurationUtils.decompose(GalaxyDurationUtils.to_microseconds(0, this.unit), this.safe_visible_unit_order);
            this.field_values = this.received_truncation.parts;
        }

        await this.build_fields();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     * @override
     */
    on_destroy = async () => {
        this.remove_field_listeners();
    }

    /***************  Other Methods  ***************/

    /**
     * Builds the visible field row (one input per visible unit, plus a hidden warning paragraph
     * for truncation messages) and inserts it as a shadow-DOM sibling of the label/hidden-input
     * row, matching GalaxyDatetimeRangePickerBase's on_create pattern.
     */
    build_fields = async () => {
        this.visible_unit_order = this.safe_visible_unit_order;

        this.fields_element = await this.build_fields_element();
        this.field_inputs = {};

        for (let unit of this.visible_unit_order) {
            this.field_inputs[unit] = this.fields_element.querySelector(`[data-duration-unit="${unit}"]`);
        }

        this.warning_element = this.fields_element.querySelector(".duration-input-warning");

        this.label_element.parentElement.after(this.fields_element);

        this.set_field_listeners();
        this.render_fields();
        this.render_warning();
    }

    /**
     * Tears down and rebuilds the field row in place, used when visible-units/hide-labels/
     * label-less-separator/unit-labels change after creation.
     */
    rebuild_fields = async () => {
        this.remove_field_listeners();
        this.fields_element.remove();

        let total_microseconds = GalaxyDurationUtils.compose(this.field_values);

        this.visible_unit_order = this.safe_visible_unit_order;
        this.field_values = GalaxyDurationUtils.decompose(total_microseconds, this.visible_unit_order).parts;

        await this.build_fields();
    }

    /**
     * @returns {Promise<HTMLElement>} - The field row + warning paragraph, as a single container element.
     */
    build_fields_element = async () => {
        let unit_labels = this.unit_labels;
        let hide_labels = this.hide_labels;

        let field_html_fragments = this.visible_unit_order.map(unit => {
            let field_id = `${this.id || "duration_input"}_${unit}`;
            let natural_range = GalaxyDurationUtils.natural_range_for_unit(unit, this.visible_unit_order);
            let max_attribute = natural_range.max !== null ? `max="${natural_range.max}"` : "";

            if (!hide_labels) {
                return `
                    <div class="duration-input-field">
                        <label class="duration-input-label" for="${field_id}">${unit_labels[unit]}</label>
                        <input class="duration-input-control" type="number" step="1" min="0" ${max_attribute} id="${field_id}" data-duration-unit="${unit}" />
                    </div>
                `;
            }

            return `
                <div class="duration-input-field">
                    <input class="duration-input-control" type="number" step="1" min="0" ${max_attribute}
                           id="${field_id}" data-duration-unit="${unit}" aria-label="${unit_labels[unit]}" />
                </div>
            `;
        });

        let separator_html = `<span class="duration-input-separator" aria-hidden="true">${this.label_less_separator}</span>`;
        let joined_fields_html = hide_labels ? field_html_fragments.join(separator_html) : field_html_fragments.join("");

        return this.get_template(`
            <div class="duration-input">
                <div class="duration-input-fields">
                    ${joined_fields_html}
                </div>
                <p class="duration-input-warning" role="alert"></p>
            </div>
        `);
    }

    /**
     * Wires input/blur listeners for each visible field.
     */
    set_field_listeners = () => {
        for (let unit of this.visible_unit_order) {
            this.field_input_handlers[unit] = (event) => this.handle_field_input(unit, event);
            this.field_blur_handlers[unit] = () => this.handle_field_blur(unit);

            this.field_inputs[unit].addEventListener("input", this.field_input_handlers[unit]);
            this.field_inputs[unit].addEventListener("blur", this.field_blur_handlers[unit]);
        }
    }

    /**
     * Removes the listeners set up by {@link set_field_listeners}.
     */
    remove_field_listeners = () => {
        for (let unit of Object.keys(this.field_inputs)) {
            this.field_inputs[unit].removeEventListener("input", this.field_input_handlers[unit]);
            this.field_inputs[unit].removeEventListener("blur", this.field_blur_handlers[unit]);
        }

        this.field_input_handlers = {};
        this.field_blur_handlers = {};
    }

    /**
     * Parses and applies one field's raw input text. Empty text is treated as 0. Negative numbers,
     * decimals, and non-numeric text are rejected (the field is marked invalid via the "error"
     * class and aria-invalid, and its last valid value is kept) rather than silently coerced,
     * since these fields are integer parts of one duration.
     *
     * A field exceeding its "natural" range (e.g. minutes: 75 with an hours field present) is not
     * an error - see normalize(), applied on blur.
     * @param   {string}    unit
     * @param   {Event}     event
     */
    handle_field_input = (unit, event) => {
        this.has_been_edited = true;

        let field_input = this.field_inputs[unit];
        let raw_value = event.target.value;

        if (raw_value === "") {
            this.field_values[unit] = 0;
        }
        else if (/^\d+$/.test(raw_value)) {
            this.field_values[unit] = Number(raw_value);
        }
        else {
            field_input.classList.add("error");
            field_input.setAttribute("aria-invalid", "true");

            return;
        }

        field_input.classList.remove("error");
        field_input.removeAttribute("aria-invalid");

        this.render_warning();
        this.sync_value();
    }

    /**
     * Redistributes overflow across the visible fields once the user leaves a field (e.g.
     * minutes: 75 with an hours field becomes hours: 1, minutes: 15), then re-renders all fields
     * with their canonical padded text.
     * @param   {string}    unit
     */
    handle_field_blur = (unit) => {
        if (this.field_inputs[unit].classList.contains("error")) {
            return;
        }

        this.field_values = GalaxyDurationUtils.normalize(this.field_values, this.visible_unit_order);

        this.render_fields();
    }

    /**
     * Pushes the current composed value out through GalaxyInputBase's value-attribute plumbing
     * (hidden input, form value, required-validation) and the state manager, and fires a native
     * "change" event on the host. Needed because GalaxyInputBase's own state-manager write only
     * happens on native input/change events targeting this.input_element (the hidden field) -
     * here the user actually edits the separate day/hour/minute/second fields instead.
     */
    sync_value = () => {
        let current_value = this.value;

        super.value = current_value;

        if (window.galaxy_state_manager && this.property_name) {
            window.galaxy_state_manager.data[this.property_name] = current_value;
        }

        this.dispatchEvent(new Event("change"));
    }

    /**
     * Writes the current field_values into their inputs. The highest visible unit is shown as a
     * plain integer (it may legitimately grow arbitrarily large); every other field is zero-padded
     * to two digits for readability.
     */
    render_fields = () => {
        let highest_unit = this.visible_unit_order[0];

        for (let unit of this.visible_unit_order) {
            let numeric_value = this.field_values[unit];

            this.field_inputs[unit].value = unit === highest_unit ? String(numeric_value) : String(numeric_value).padStart(2, "0");
        }
    }

    /**
     * Shows or clears the truncation warning for the originally received value. Once the user has
     * edited any field, the warning is cleared - the fields are then the source of truth and there
     * is nothing left "truncated" to report.
     */
    render_warning = () => {
        if (this.has_been_edited || !this.received_truncation.was_truncated) {
            this.warning_element.textContent = "";

            return;
        }

        let remainder_value = GalaxyDurationUtils.from_microseconds(this.received_truncation.remainder_microseconds, this.unit);
        let original_value = Number(this.getAttribute("value")) || 0;

        this.warning_element.textContent = GalaxyDurationUtils.format_message(this.truncation_warning_template, original_value, this.unit, remainder_value, this.unit);
    }

    /**
     * {@link GalaxyInputBase#get_validation_errors}
     * @override
     */
    get_validation_errors = () => []

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            .duration-input-fields {
                display: flex;
                align-items: flex-end;
                gap: 8px;
            }

            .duration-input-field {
                display: flex;
                flex-direction: column;
            }

            .duration-input-label {
                margin-bottom: 0.25rem;
                font-size: 0.875rem;
            }

            .duration-input-control {
                width: 4.5rem;
                height: calc(1.5em + 0.75rem + 2px);
                padding: 0.375rem 0.75rem;
                font-size: 1rem;
                font-weight: 400;
                line-height: 1.5;
                color: var(--text-grey);
                background-color: #fff;
                background-clip: padding-box;
                border: 1px solid var(--lightgrey);
                border-radius: 0.25rem;
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            }

            .duration-input-control.error {
                border-color: var(--red);
                box-shadow: rgba(255, 0, 0, 0.25) 0px 0px 0px 0.2rem;
            }

            .duration-input-separator {
                padding-bottom: 0.5rem;
                font-weight: 700;
            }

            .duration-input-warning:empty {
                display: none;
            }

            .duration-input-warning {
                margin-top: 0.5rem;
                margin-bottom: 0;
                color: var(--red);
                font-size: 0.875rem;
            }
        `;
    }
}
