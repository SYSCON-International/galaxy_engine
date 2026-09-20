/**
 * @file GalaxyDurationUtils.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * Canonical conversion relationships between duration units, expressed as microseconds per unit.
 * All conversions pass through this integer-microsecond canonical value so that unit conversion
 * involving very small units never accumulates floating-point rounding error.
 * @type {Object<string, number>}
 */
export const MICROSECONDS_PER_UNIT = {
    microseconds: 1,
    milliseconds: 1000,
    seconds: 1000 * 1000,
    minutes: 1000 * 1000 * 60,
    hours: 1000 * 1000 * 60 * 60,
    days: 1000 * 1000 * 60 * 60 * 24
};

/**
 * Units a scalar duration value may be received in or converted out to.
 * @type {string[]}
 */
export const SOURCE_UNITS = ["microseconds", "milliseconds", "seconds", "minutes", "hours", "days"];

/**
 * Units galaxy-duration-input/galaxy-duration-display can render, ordered from largest to
 * smallest. This order is the canonical rendering order regardless of what order visible-units
 * lists them in.
 * @type {string[]}
 */
export const DISPLAY_UNIT_ORDER = ["days", "hours", "minutes", "seconds"];

/**
 * Default long-form label text per unit, used as galaxy-duration-input's visible <label> and,
 * label-less, as aria-label. Also the default fallback for galaxy-duration-input's
 * unit-labels attribute.
 * @type {Object<string, string>}
 */
export const DEFAULT_UNIT_LABELS = {days: "Days", hours: "Hours", minutes: "Minutes", seconds: "Seconds"};

/**
 * Default abbreviations used by galaxy-duration-display's "short" format.
 * @type {Object<string, string>}
 */
export const DEFAULT_SHORT_UNIT_LABELS = {days: "d", hours: "h", minutes: "m", seconds: "s"};

/**
 * Default singular/plural labels used by galaxy-duration-display's "long" format.
 * @type {Object<string, {singular: string, plural: string}>}
 */
export const DEFAULT_LONG_UNIT_LABELS = {
    days: {singular: "day", plural: "days"},
    hours: {singular: "hour", plural: "hours"},
    minutes: {singular: "minute", plural: "minutes"},
    seconds: {singular: "second", plural: "seconds"}
};

/**
 * Default template for galaxy-duration-input's received-value truncation warning. %s placeholders
 * are filled, in order, with: original value, unit, remainder value, unit.
 * @type {string}
 */
export const DEFAULT_TRUNCATION_WARNING_TEMPLATE = "%s %s was received. %s %s could not be represented at this precision and was truncated.";

/**
 * Thrown by GalaxyDurationUtils methods for a malformed argument (unsupported unit, non-finite/
 * negative value, unsupported precision_mode, or an empty/invalid visible_units list). Component
 * code should validate attribute-sourced configuration before calling into these methods rather
 * than letting this escape a custom element lifecycle callback uncaught.
 */
export class DurationValidationError extends Error {
}

/**
 * @class
 * @classdesc
 *  Pure, side-effect-free unit-conversion, decomposition, normalization, and formatting math
 *  shared by galaxy-duration-input and galaxy-duration-display. Every method is static, matching
 *  the shape of {@link GalaxyUtils} - this class holds no DOM or per-instance state.
 */
export class GalaxyDurationUtils {
    /**
     * @param   {string}    unit
     * @returns {boolean}   True if unit is a supported source/output unit.
     */
    static is_supported_unit = (unit) => {
        return SOURCE_UNITS.includes(unit);
    }

    /**
     * @param   {string}    unit
     * @returns {boolean}   True if unit is a supported visible/display unit (days/hours/minutes/seconds).
     */
    static is_supported_display_unit = (unit) => {
        return DISPLAY_UNIT_ORDER.includes(unit);
    }

    /**
     * Converts a scalar duration value expressed in the given unit into canonical integer microseconds.
     *
     * @param   {number}    value   Duration value. May be fractional (e.g. 1.5 hours).
     * @param   {string}    unit    One of SOURCE_UNITS.
     * @returns {number}            Whole microseconds, rounded to the nearest integer to remove floating-point dust.
     */
    static to_microseconds = (value, unit) => {
        if (!GalaxyDurationUtils.is_supported_unit(unit)) {
            throw new DurationValidationError(`Unsupported duration unit: ${unit}`);
        }

        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new DurationValidationError(`Duration value must be a finite number, received: ${value}`);
        }

        if (value < 0) {
            throw new DurationValidationError(`Duration value must not be negative, received: ${value}`);
        }

        return Math.round(value * MICROSECONDS_PER_UNIT[unit]);
    }

    /**
     * Converts canonical integer microseconds into a scalar value expressed in the given unit. The
     * result may be fractional when unit does not evenly divide total_microseconds - that is a
     * correct conversion, not an error. Callers that need a whole number should round the result.
     *
     * @param   {number}    total_microseconds
     * @param   {string}    unit                One of SOURCE_UNITS.
     * @returns {number}
     */
    static from_microseconds = (total_microseconds, unit) => {
        if (!GalaxyDurationUtils.is_supported_unit(unit)) {
            throw new DurationValidationError(`Unsupported duration unit: ${unit}`);
        }

        return total_microseconds / MICROSECONDS_PER_UNIT[unit];
    }

    /**
     * Reduces an arbitrary visible_units configuration to the canonical days-to-seconds rendering
     * order, deduplicated, containing only recognized display units.
     *
     * @param   {string[]}  visible_units
     * @returns {string[]}
     */
    static get_visible_unit_order = (visible_units) => {
        if (!Array.isArray(visible_units) || visible_units.length === 0) {
            throw new DurationValidationError("visible_units must be a non-empty array");
        }

        let unrecognized_unit = visible_units.find(unit => !GalaxyDurationUtils.is_supported_display_unit(unit));

        if (unrecognized_unit) {
            throw new DurationValidationError(`Unsupported visible unit: ${unrecognized_unit}`);
        }

        return DISPLAY_UNIT_ORDER.filter(unit => visible_units.includes(unit));
    }

    /**
     * Decomposes canonical integer microseconds into the configured visible unit fields.
     *
     * The highest configured unit absorbs any amount that a smaller field set could not hold (e.g.
     * decomposing into hours/minutes only never loses whole days - they show up as extra hours).
     * Any amount finer than the smallest configured unit cannot be represented and is reported
     * separately as remainder_microseconds/was_truncated rather than silently dropped.
     *
     * @param   {number}    total_microseconds
     * @param   {string[]}  visible_units
     * @returns {{parts: Object<string, number>, original_microseconds: number, represented_microseconds: number, remainder_microseconds: number, was_truncated: boolean}}
     */
    static decompose = (total_microseconds, visible_units) => {
        if (typeof total_microseconds !== "number" || !Number.isFinite(total_microseconds) || total_microseconds < 0) {
            throw new DurationValidationError(`total_microseconds must be a finite, non-negative number, received: ${total_microseconds}`);
        }

        let ordered_units = GalaxyDurationUtils.get_visible_unit_order(visible_units);
        let remaining_microseconds = Math.round(total_microseconds);
        let parts = {};

        for (let unit of ordered_units) {
            let unit_value = Math.floor(remaining_microseconds / MICROSECONDS_PER_UNIT[unit]);

            parts[unit] = unit_value;
            remaining_microseconds -= unit_value * MICROSECONDS_PER_UNIT[unit];
        }

        return {
            parts: parts,
            original_microseconds: total_microseconds,
            represented_microseconds: total_microseconds - remaining_microseconds,
            remainder_microseconds: remaining_microseconds,
            was_truncated: remaining_microseconds > 0
        };
    }

    /**
     * Recombines a set of duration field values (e.g. {hours: 1, minutes: 30}) back into canonical
     * integer microseconds. Field values are treated at face value - a field holding more than its
     * "natural" range (e.g. minutes: 75) still contributes exactly that many minutes' worth of
     * microseconds, which is what makes normalize() below correct.
     *
     * @param   {Object<string, number>}    parts
     * @returns {number}
     */
    static compose = (parts) => {
        let total_microseconds = 0;

        for (let unit of Object.keys(parts)) {
            let value = parts[unit];

            if (value === null || value === undefined) {
                continue;
            }

            if (!GalaxyDurationUtils.is_supported_display_unit(unit)) {
                throw new DurationValidationError(`Unsupported duration part unit: ${unit}`);
            }

            if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
                throw new DurationValidationError(`Duration part ${unit} must be a finite integer, received: ${value}`);
            }

            if (value < 0) {
                throw new DurationValidationError(`Duration part ${unit} must not be negative, received: ${value}`);
            }

            total_microseconds += value * MICROSECONDS_PER_UNIT[unit];
        }

        return total_microseconds;
    }

    /**
     * Redistributes overflow across the configured visible fields (e.g. {minutes: 75} with
     * hours+minutes visible becomes {hours: 1, minutes: 15}). The highest configured field absorbs
     * whatever a higher field would otherwise have held, so {hours: 49} with only hours/minutes
     * visible legitimately stays {hours: 49}.
     *
     * @param   {Object<string, number>}    parts
     * @param   {string[]}                  visible_units
     * @returns {Object<string, number>}
     */
    static normalize = (parts, visible_units) => {
        let total_microseconds = GalaxyDurationUtils.compose(parts);

        return GalaxyDurationUtils.decompose(total_microseconds, visible_units).parts;
    }

    /**
     * Returns the natural editing range for a single visible field, given the full set of visible
     * fields. A field with no larger configured field above it (i.e. it is the highest visible
     * unit) is unbounded, since there is nowhere for overflow above it to go.
     *
     * @param   {string}    unit
     * @param   {string[]}  visible_units
     * @returns {{min: number, max: (number|null)}}
     */
    static natural_range_for_unit = (unit, visible_units) => {
        let ordered_units = GalaxyDurationUtils.get_visible_unit_order(visible_units);
        let unit_index = ordered_units.indexOf(unit);

        if (unit_index === -1) {
            throw new DurationValidationError(`${unit} is not among visible_units: ${visible_units}`);
        }

        if (unit_index === 0) {
            return {min: 0, max: null};
        }

        let next_larger_unit = ordered_units[unit_index - 1];
        let max_value = (MICROSECONDS_PER_UNIT[next_larger_unit] / MICROSECONDS_PER_UNIT[unit]) - 1;

        return {min: 0, max: max_value};
    }

    /**
     * Applies a galaxy-duration-display smallest-unit precision policy to a decomposed duration.
     *
     * - "truncate": the smallest visible unit shows its whole-number value; anything finer is dropped.
     * - "round_up": if any amount finer than the smallest visible unit exists, the smallest unit's
     *   value is incremented by one, cascading into larger visible units as needed (e.g. 59 -> 60
     *   minutes becomes 1 hour 0 minutes when hours is visible).
     * - "fraction": the smallest visible unit's value is a fractional number - its whole part plus
     *   whatever remainder exists, expressed in that unit's own terms and rounded to fraction_digits
     *   (standard round-half-away-from-zero, per Number.prototype.toFixed).
     *
     * @param   {number}                                    total_microseconds
     * @param   {string[]}                                  visible_units
     * @param   {"truncate"|"round_up"|"fraction"}          precision_mode
     * @param   {number}                                    [fraction_digits=0]  Only used when precision_mode is "fraction".
     * @returns {{parts: Object<string, number>, fractional_smallest_unit_value: (number|null)}}
     */
    static apply_precision = (total_microseconds, visible_units, precision_mode, fraction_digits = 0) => {
        let ordered_units = GalaxyDurationUtils.get_visible_unit_order(visible_units);
        let smallest_unit = ordered_units[ordered_units.length - 1];
        let decomposed = GalaxyDurationUtils.decompose(total_microseconds, visible_units);

        if (precision_mode === "fraction") {
            let exact_smallest_value = decomposed.parts[smallest_unit] + (decomposed.remainder_microseconds / MICROSECONDS_PER_UNIT[smallest_unit]);
            let rounded_smallest_value = Number(exact_smallest_value.toFixed(fraction_digits));

            return {
                parts: {...decomposed.parts, [smallest_unit]: rounded_smallest_value},
                fractional_smallest_unit_value: rounded_smallest_value
            };
        }

        if (precision_mode === "round_up") {
            let should_round_up = decomposed.remainder_microseconds > 0;
            let rounded_total_microseconds = should_round_up ? decomposed.represented_microseconds + MICROSECONDS_PER_UNIT[smallest_unit] : decomposed.represented_microseconds;

            return {
                parts: GalaxyDurationUtils.decompose(rounded_total_microseconds, visible_units).parts,
                fractional_smallest_unit_value: null
            };
        }

        if (precision_mode === "truncate") {
            return {parts: decomposed.parts, fractional_smallest_unit_value: null};
        }

        throw new DurationValidationError(`Unsupported precision_mode: ${precision_mode}`);
    }

    /**
     * @param   {number}    count
     * @returns {boolean}   True if count should use the plural form of a unit label (i.e. count is not exactly 1).
     */
    static is_plural_count = (count) => {
        return count !== 1;
    }

    /**
     * Substitutes "%s" placeholders in template with values, in order. Used for the (configurable,
     * localizable) truncation warning message.
     *
     * @param   {string}    template
     * @param   {...*}      values
     * @returns {string}
     */
    static format_message = (template, ...values) => {
        let result = template;

        for (let value of values) {
            result = result.replace("%s", value);
        }

        return result;
    }

    /**
     * Parses a JSON-valued attribute (an array or object), falling back to default_value and
     * warning on malformed JSON, matching the convention established by GalaxyNavbarBase's
     * "config" attribute.
     *
     * @param   {string|null}   raw_value       The attribute's raw string value (from getAttribute).
     * @param   {*}             default_value   Returned when raw_value is null/empty or fails to parse.
     * @param   {string}        component_name  Used in the console.warn message.
     * @param   {string}        attribute_name  Used in the console.warn message.
     * @returns {*}
     */
    static parse_json_attribute = (raw_value, default_value, component_name, attribute_name) => {
        if (!raw_value) {
            return default_value;
        }

        try {
            return JSON.parse(raw_value);
        }
        catch (error) {
            console.warn(`${component_name}: Invalid JSON in "${attribute_name}" attribute, falling back to default.`);

            return default_value;
        }
    }
}
