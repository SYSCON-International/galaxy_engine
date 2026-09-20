/**
 * @file GalaxyDurationDisplay.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {
    GalaxyDurationUtils,
    DEFAULT_SHORT_UNIT_LABELS,
    DEFAULT_LONG_UNIT_LABELS,
    DISPLAY_UNIT_ORDER
} from "../GalaxyDurationUtils.js";

/**
 * @class
 * @description
 *     Renders a duration as read-only formatted text, showing only the configured visible units
 *     (visible-units attribute). Any larger unit is absorbed into the highest visible unit (e.g.
 *     2 days 3 hours, shown as hours/minutes, becomes "51h 0m").
 *
 *     The smallest visible unit's precision is controlled by precision-mode: "truncate" (drop
 *     anything finer), "round_up" (round up, cascading into larger units as needed), or
 *     "fraction" (show a decimal at fraction-digits places).
 *
 *     The format attribute selects "short" ("2d 4h 12m") or "long" ("2 days, 4 hours, 12
 *     minutes") rendering, each with correct singular/plural unit labels.
 * @extends GalaxyHTMLComponentBase
 * @example
 *     <galaxy-duration-display unit="seconds" value="90061"></galaxy-duration-display>
 *     <!-- renders "1d 1h 1m 1s" -->
 *
 *     // Updating dynamically - .value is read-only in the sense that it returns the formatted
 *     // text; set it with a new scalar to update and re-render:
 *     document.querySelector("galaxy-duration-display").value = 120;
 */
export class GalaxyDurationDisplay extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(`<span class="duration-display"></span>`);
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["unit", "visible-units", "format", "precision-mode", "fraction-digits", "separator", "short-unit-labels", "long-unit-labels", "value"];
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
     * @returns {string[]} - Which day/hour/minute/second units are shown. Defaults to all four.
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
     * @returns {"short"|"long"} - "short" ("2d 4h 12m") or "long" ("2 days, 4 hours, 12 minutes"). Defaults to "short".
     */
    get format() {
        let raw_value = this.getAttribute("format") || "short";

        if (raw_value !== "short" && raw_value !== "long") {
            console.warn(`${this.constructor.name}: Unsupported "format" attribute value "${raw_value}", falling back to "short".`);

            return "short";
        }

        return raw_value;
    }

    /**
     * @param {"short"|"long"} value
     */
    set format(value) {this.setAttribute("format", value)}

    /**
     * @returns {"truncate"|"round_up"|"fraction"} - How the smallest visible unit handles a remainder. Defaults to "truncate".
     */
    get precision_mode() {
        let raw_value = this.getAttribute("precision-mode") || "truncate";

        if (!["truncate", "round_up", "fraction"].includes(raw_value)) {
            console.warn(`${this.constructor.name}: Unsupported "precision-mode" attribute value "${raw_value}", falling back to "truncate".`);

            return "truncate";
        }

        return raw_value;
    }

    /**
     * @param {"truncate"|"round_up"|"fraction"} value
     */
    set precision_mode(value) {this.setAttribute("precision-mode", value)}

    /**
     * @returns {number} - Decimal places for the smallest unit when precision_mode is "fraction". Defaults to 0.
     */
    get fraction_digits() {return Number(this.getAttribute("fraction-digits")) || 0}

    /**
     * @param {number} value
     */
    set fraction_digits(value) {this.setAttribute("fraction-digits", value.toString())}

    /**
     * @returns {string|null} - Text joining segments. Defaults to null (" " for short, ", " for long).
     */
    get separator() {return this.getAttribute("separator")}

    /**
     * @param {string} value
     */
    set separator(value) {this.setAttribute("separator", value)}

    /**
     * @returns {Object<string, string>} - Abbreviations used in "short" format.
     */
    get short_unit_labels() {
        return GalaxyDurationUtils.parse_json_attribute(this.getAttribute("short-unit-labels"), DEFAULT_SHORT_UNIT_LABELS, this.constructor.name, "short-unit-labels");
    }

    /**
     * @param {Object<string, string>} value
     */
    set short_unit_labels(value) {this.setAttribute("short-unit-labels", JSON.stringify(value))}

    /**
     * @returns {Object<string, {singular: string, plural: string}>} - Singular/plural labels used in "long" format.
     */
    get long_unit_labels() {
        return GalaxyDurationUtils.parse_json_attribute(this.getAttribute("long-unit-labels"), DEFAULT_LONG_UNIT_LABELS, this.constructor.name, "long-unit-labels");
    }

    /**
     * @param {Object<string, {singular: string, plural: string}>} value
     */
    set long_unit_labels(value) {this.setAttribute("long-unit-labels", JSON.stringify(value))}

    /**
     * The currently displayed formatted text. Note the getter/setter are intentionally asymmetric,
     * matching the vanilla DurationDisplay this was ported from: writing sets the raw duration
     * (expressed in the unit attribute) and re-renders; reading returns the formatted text, not
     * the raw number back.
     * @returns {string}
     */
    get value() {return this.formatted_text}

    /**
     * Replaces the displayed duration with a new scalar value, expressed in the unit attribute,
     * and re-renders.
     * @param   {number}    new_value
     */
    set value(new_value) {
        this.setAttribute("value", (Number(new_value) || 0).toString());
    }

    /**
     * Builds the formatted duration text for the current value/properties.
     * @returns {string}
     */
    get formatted_text() {
        let received_value = Number(this.getAttribute("value")) || 0;
        let visible_unit_order = this.safe_visible_unit_order;
        let total_microseconds = GalaxyDurationUtils.to_microseconds(received_value, this.unit);
        let precision_result = GalaxyDurationUtils.apply_precision(total_microseconds, visible_unit_order, this.precision_mode, this.fraction_digits);
        let smallest_unit = visible_unit_order[visible_unit_order.length - 1];
        let is_short_format = this.format === "short";
        let separator = this.separator !== null ? this.separator : (is_short_format ? " " : ", ");
        let short_unit_labels = this.short_unit_labels;
        let long_unit_labels = this.long_unit_labels;

        let segments = visible_unit_order.map(unit => {
            let unit_value = precision_result.parts[unit];
            let is_fractional_smallest = unit === smallest_unit && precision_result.fractional_smallest_unit_value !== null;
            let displayed_number = is_fractional_smallest ? unit_value.toFixed(this.fraction_digits) : String(unit_value);

            if (is_short_format) {
                return `${displayed_number}${short_unit_labels[unit]}`;
            }

            let long_unit_label = GalaxyDurationUtils.is_plural_count(unit_value) ? long_unit_labels[unit].plural : long_unit_labels[unit].singular;

            return `${displayed_number} ${long_unit_label}`;
        });

        return segments.join(separator);
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (this.display_element) {
            this.render();
        }
    }

    /***************  Lifecycle Methods  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     * @override
     */
    on_create = async () => {
        this.display_element = await this.get_template();

        this.shadow.appendChild(this.display_element);

        this.render();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     * @override
     */
    on_destroy = async () => {
        this.display_element = null;
    }

    /***************  Other Methods  ***************/

    /**
     * Re-renders the element's text from the current value/properties. Call this after changing
     * multiple attributes at once (attribute_changed_callback already calls it automatically for
     * a single attribute change).
     */
    render = () => {
        this.display_element.textContent = this.formatted_text;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return `<span class="duration-display"></span>`;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            .duration-display {
                white-space: nowrap;
            }
        `;
    }
}
