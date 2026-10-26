/**
 * @file GalaxyDatetimePickerBase.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";
import {GalaxyUtils} from "../GalaxyUtils.js";

// The popup is appended to the body, outside this element's shadow root, so its styles are page-wide; create_popup() adds them once.
const DATETIME_POPUP_CSS = `
    .galaxy-datetime-popup {
        /* A manual popover in the top layer, so it shows above a galaxy-modal; fixed, in viewport coordinates (see position_popup) */
        position: fixed;
        inset: auto;
        margin: 0;
        background: var(--dropdown-background, #ffffff);
        border: 1px solid var(--lightgrey, #ced4da);
        border-radius: 0.5rem;
        padding: 0.75rem;
        box-shadow: 0 4px 10px var(--dropdown-shadow, rgba(0, 0, 0, 0.15));
        /* Only matters where the Popover API is missing: above a galaxy-modal's 1050 */
        z-index: 1060;

        .calendar {
            .calendar-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
                font-weight: bold;

                button {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1.2rem;
                }
            }

            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);

                div {
                    text-align: center;
                    padding: 0.5rem;
                    border-radius: 0.25rem;
                    cursor: pointer;

                    &:hover {
                        background: var(--dropdown-option-hover, #f8f9fa);
                    }

                    &.selected {
                        background: var(--blue, #007bff);
                        color: var(--text-light, #ffffff);
                    }
                }

                .day-name {
                    font-weight: bold;
                    cursor: default;
                    border-bottom: 1px solid var(--lightgrey, #ced4da);

                    &:hover {
                        background: unset;
                    }
                }
            }
        }

        .time-picker {
            display: flex;
            justify-content: center;
            margin-top: 0.75rem;

            input, select {
                text-align: center;
                height: calc(1.5em + 0.75rem + 2px);
                padding: 0.375rem 0.75rem;
                font-family: inherit;
                font-size: 1rem;
                font-weight: 400;
                line-height: 1.5;
                color: var(--text-grey, #495057);
                background-color: var(--dropdown-background, #ffffff);
                background-clip: padding-box;
                border: 1px solid var(--lightgrey, #ced4da);
                border-radius: 0.25rem;
                transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            }

            span {
                align-self: center;
                margin: 0 0.25rem;
            }
        }
    }
`;

// The text forms a value may take. The canonical value is always a date "YYYY-MM-DD", a 24-hour time "HH:mm", or a datetime "YYYY-MM-DDTHH:mm" - whatever the
// display format. Seconds (as Django sends them) are accepted and dropped; a timezone offset is not accepted.
const DATETIME_REGEX = {
    date: /^(\d{4})-(\d{2})-(\d{2})$/,
    time: {
        "12": /^(\d{1,2}):(\d{2})\s*([ap])\.?\s?m\.?$/i,
        "24": /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/
    },
    datetime: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/,
}

// The display fields a picker's text is read in, by mode, in the order the display locale writes them (see get_display_field_order)
const DISPLAY_FIELD_TYPES = ["year", "month", "day", "hour", "minute"];

const DATETIME_PICKER_HTML_TEMPLATE = `
    <input type="text" />
`;

/**
 * @class
 * @description
 *     A custom datetime picker component.
 * @extends GalaxyInputBase
 */
export class GalaxyDatetimePickerBase extends GalaxyInputBase {
    /**
     * @constructor
     * @param {string} mode - The picker mode: "date", "time", or "datetime". Set by the GalaxyDatePicker/GalaxyTimePicker/GalaxyDatetimePicker subclasses.
     */
    constructor(mode) {
        super(DATETIME_PICKER_HTML_TEMPLATE);

        this.mode = mode;

        this._is_valid = false;

        // Guards show_popup() against the popup being built twice - see its own comment.
        this._popup_creation_promise = null;

        this.custom_validated_event = new CustomEvent("input_validated", {
            detail: {picker: this}
        });
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [
            "label",
            "layout", // "vertical" or "horizontal" for label layout
            "time-format", // "12" or "24" for time format
            "value",
        ];
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        const attribute_lookup_table = {
            "label": this.handle_observed_confirm_label_text,
            "layout": this.handle_observed_layout,
            "time-format": this.handle_observed_time_format,
            "value": this.handle_observed_value,
        }

        attribute_lookup_table[name]?.(new_value);
    }

    /***************  Getters and Setters  ***************/

    /**
     * Get the layout of the datetime picker.
     * @returns {string|string}
     */
    get layout() {return this.getAttribute("layout") || "horizontal";}

    /**
     * Set the layout of the datetime picker.
     * @param {string} value - The layout to set.
     */
    set layout(value) {
        this.setAttribute("layout", value.toString());
    }

    /**
     * Get the time format of the datetime picker.
     * @returns {string|string}
     */
    get time_format() {return this.getAttribute("time-format") || "12";}

    /**
     * Set the time format of the datetime picker.
     * @param {string} value - The time format to set.
     */
    set time_format(value) {this.setAttribute("time-format", value.toString());}

    /**
     * {@link GalaxyInputBase#value}
     * @override
     * @note A class that defines `set value()` without also redefining `get value()` in that *same* class
     * gets an accessor property with no getter at all on its own prototype - accessor pairs aren't merged
     * across the prototype chain, so this would otherwise silently shadow GalaxyInputBase's getter for every
     * instance of this class, making `.value` always read back as undefined.
     */
    get value() {return this._value;}

    /**
     * Sets the value of the datetime picker. Accepts everything normalize_value() does - an ISO string, a
     * JSON-encoded one, or a {year, month, day, hour, minute} dictionary (e.g. a moment-like object).
     * @note Deliberately normalizes before reflecting to the attribute, rather than just doing
     * this.setAttribute("value", value) (the inherited GalaxyInputBase behavior, which is enough for every
     * plain-string-valued input) - setAttribute stringifies its argument, and a plain object would become
     * the literal, useless string "[object Object]" before apply_value() ever got a chance to parse it.
     * normalize_value() is idempotent on an already-normalized ISO string, so apply_value() re-normalizing
     * it again (via handle_observed_value, once the attribute reaction runs) is a harmless no-op.
     * @param {string|Object} value - The value to set.
     */
    set value(value) {
        this.setAttribute("value", this.normalize_value(value));
    }

    /**
     * Gets the current value of the datetime picker as a structured dictionary.
     * @returns {{__type__: string, year: (number|null), month: (number|null), day: (number|null), hour: (number|null), minute: (number|null), second: number, microsecond: number, tzinfo: string}}
     */
    get value_dictionary() {
        return this.convert_datetime_value_to_dictionary(this.parse_from_display(this.input_element.value));
    }

    /**
         * Gets the validity state of the current input value.
         * @return {boolean} - True if the input value is valid, false otherwise.
         */
    get is_valid() {
        return this._is_valid;
    }

    /**
     * Sets the validity state of the current input value.
     * @param {boolean} new_value - The new validity state.
     */
    set is_valid(new_value) {
        this._is_valid = new_value;
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * Handles the label attribute change.
     * @param {string} new_value - The new value of the label text.
     */
    handle_observed_confirm_label_text = (new_value) => {
        if (!this.label_element) {
            return;
        }

        if (new_value && new_value.length > 0) {
            this.label_element.textContent = new_value;
        }
        else {
            this.label_element.textContent = "";
        }
    }

    /**
     * Handles the layout attribute change.
     * @param {string} new_value - The new value of the layout.
     */
    handle_observed_layout = (new_value) => {}

    /**
     * Handles the time-format attribute change.
     * @param {string} new_value - The new value of the time format.
     */
    handle_observed_time_format = (new_value) => {}

    /**
     * Applies `raw_value` (the `value` attribute's raw string, as set via the `value` property - inherited
     * from GalaxyInputBase, which just does this.setAttribute("value", value) - or directly via
     * setAttribute) as this picker's canonical value.
     * @note This used to be split between an overridden `set value()` (which updated the display but never
     * touched this._value/_internals.setFormValue) and a handle_observed_value() that was a no-op beyond an
     * existence guard - so this.value (inherited from GalaxyInputBase, returns this._value) never reflected
     * anything, and the only path that ever called setFormValue was the native "input"/"change" listener,
     * which submits event.target.value - the locale-formatted *display* text - instead of a clean value.
     * This is now the single place that keeps the display, this._value, and the form value all in sync from
     * whichever of those two paths triggered it.
     * @param {string} raw_value - The value attribute's raw string.
     */
    apply_value = (raw_value) => {
        let normalized_value = this.normalize_value(raw_value);

        // Compares normalized (parsed) forms, not raw display strings, so reassigning an equivalent value
        // (e.g. a user typed "1/15/2024" and code sets .value = "2024-01-15") doesn't clobber their exact
        // typed text with a differently-formatted-but-equal string - it only redraws the display when the
        // logical value actually changed.
        if (normalized_value !== this.parse_from_display(this.input_element.value)) {
            this.input_element.value = this.format_for_display(normalized_value);
        }

        this.sync_value_and_form_value(normalized_value);

        // As for every Galaxy field, an empty field is not shown invalid until it is validated by the form or by instant validation.
        let is_instant_validation = Boolean(this.parent_form?.hasAttribute("instant-validation"));

        if (normalized_value || this.input_element.value.trim() || is_instant_validation) {
            this.validate();
        }
        else {
            this.input_element.classList.remove("error");
            this._internals.setValidity({});
        }
    }

    /**
     * {@link GalaxyInputBase#is_value_empty}
     * @override
     * @note Empty only when the field shows nothing too: text that does not read as a date or time leaves the value empty but is not an empty field, so it is
     *     checked by get_validation_errors and fails.
     * @param {string} value - The canonical value.
     * @return {boolean}
     */
    is_value_empty = (value) => {
        return value === "" && !this.input_element?.value.trim();
    }

    /**
     * Keeps this._value (what the inherited `value` getter returns) and the ElementInternals form value in
     * sync with `normalized_value` - the canonical, ISO-formatted value, never the locale-formatted display
     * text. Shared by apply_value() (the attribute/property-driven path) and sync_from_display() (the native
     * "input"/"change" event path - real typing, and the popup's synthetic "change" events).
     * @param {string} normalized_value - An already-normalized ISO value (or "").
     */
    sync_value_and_form_value = (normalized_value) => {
        this._value = normalized_value;

        // One argument: the restore state then defaults to the value. (A second argument is the restore state, never the field's name.)
        this._internals.setFormValue(normalized_value);
    }

    /**
     * Handles the value attribute change.
     * @param {string} new_value - The new value of the datetime picker.
     */
    handle_observed_value = (new_value) => {
        if (!this.input_element) {
            return;
        }

        this.apply_value(new_value);
    }

    /**
     * {@link GalaxyInputBase#on_input_event}
     * @override
     * @note The base implementation sets the form value (and any state-manager-mirrored property) straight
     * from event.target.value - the locale-formatted *display* text (e.g. "1/15/2024"), not the ISO value
     * (e.g. "2024-01-15") the rest of this class's API is built around. Every calendar-day click and
     * time-input change explicitly dispatches a synthetic "change" event for exactly this path (see
     * create_popup()/build_calendar()'s own comments), so this isn't a rare edge case - route it through the
     * same canonical value apply_value() uses instead.
     * @param {Event} event - The input/change event.
     */
    on_input_event = (event) => {
        this.sync_from_display();
        this.on_input(event);
    }

    /**
     * {@link GalaxyInputBase#on_change_event}
     * @override
     * @note Overridden for the same reason as on_input_event: the base implementation would store the display text, not the ISO value. The popup's synthetic "change"
     * events arrive here.
     * @param {Event} event - The change event.
     */
    on_change_event = (event) => {
        this.sync_from_display();
        this.on_change(event);
        this.dispatch_host_change();
    }

    /**
     * Parses the field's display text into the canonical ISO value, and writes it to the state manager, this._value and the form value.
     */
    sync_from_display = () => {
        let normalized_value = this.parse_from_display(this.input_element.value);

        this.write_state_value(normalized_value);

        this.sync_value_and_form_value(normalized_value);

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /**
     * {@link GalaxyInputBase#restore_value_after_reconnect}
     * @override
     * @note The field shows the display form of the value, not the canonical value itself.
     */
    restore_value_after_reconnect = () => {
        this.input_element.value = this.format_for_display(this._value ?? "");
    }

    /***************  Other Methods  ***************/
    /**
         * Sets up event listeners for the input field and document to handle focus, input changes, and clicks outside the popup.
         */
    set_event_listeners = () => {
        this.input_element.addEventListener("focus", this.show_popup);
        this.input_element.addEventListener("click", this.show_popup);

        document.addEventListener("click", this.hide_popup);
    }

    /**
     * Formats an ISO string (YYYY-MM-DDTHH:mm) for display based on the specified time format (12 or 24).
     * @param {string} iso_string - The ISO string to format.
     * @return {string} - The formatted date-time string for display.
     */
    format_for_display = (iso_string) => {
        if (!iso_string) {
            return "";
        }

        let fields = this.read_canonical_value(iso_string);

        if (!fields) {
            return "";
        }

        let date = new Date(fields.year ?? 1970, (fields.month ?? 1) - 1, fields.day ?? 1, fields.hour ?? 0, fields.minute ?? 0);

        return this.display_format.format(date);
    };

    /**
     * Gets the locale dates and times are shown and read in: the browser's (undefined). Kept in one place so formatting and parsing always agree.
     * @return {string|undefined}
     */
    get display_locale() {
        return undefined;
    }

    /**
     * Gets the format dates and times are shown in, for this picker's mode and time format.
     * @return {Intl.DateTimeFormat}
     */
    get display_format() {
        let date_options = {year: "numeric", month: "2-digit", day: "2-digit"};
        let time_options = {hour: "2-digit", minute: "2-digit", hour12: this.time_format === "12"};
        let options = {date: date_options, time: time_options, datetime: {...date_options, ...time_options}}[this.mode];

        return new Intl.DateTimeFormat(this.display_locale, options);
    }

    /**
     * Gets the order the display format writes its fields in - for example ["month", "day", "year"] in en-US and ["day", "month", "year"] in en-GB - so typed text
     * is read in the order it is shown.
     * @return {string[]}
     */
    get_display_field_order = () => {
        let sample_date = new Date(2001, 10, 22, 13, 45);

        return this.display_format.formatToParts(sample_date).map((part) => part.type).filter((type) => DISPLAY_FIELD_TYPES.includes(type));
    }

    /**
     * Reads the AM/PM marker in typed text, in the display locale's own words or as "am"/"pm".
     * @param {string} text - The typed text.
     * @return {"am"|"pm"|null} - The marker, or null when there is none.
     */
    read_day_period = (text) => {
        let lower_text = text.toLowerCase();
        let day_period_format = new Intl.DateTimeFormat(this.display_locale, {hour: "numeric", hour12: true});
        let get_label = (hour) => day_period_format.formatToParts(new Date(2001, 0, 1, hour)).find((part) => part.type === "dayPeriod")?.value.toLowerCase();
        let am_label = get_label(1);
        let pm_label = get_label(13);

        if (pm_label && lower_text.includes(pm_label)) {
            return "pm";
        }

        if (am_label && lower_text.includes(am_label)) {
            return "am";
        }

        if (/p\.?\s?m\.?/.test(lower_text)) {
            return "pm";
        }

        if (/a\.?\s?m\.?/.test(lower_text)) {
            return "am";
        }

        return null;
    }

    /**
     * Builds the canonical value for this picker's mode from numeric fields, or returns "" when a field the mode needs is missing or out of range - a 13th month,
     * February 30th, hour 24.
     * @param {{year?: number, month?: number, day?: number, hour?: number, minute?: number}} fields - The fields.
     * @return {string}
     */
    build_canonical_value = (fields) => {
        let pad = (number, length = 2) => String(number).padStart(length, "0");
        let has_date = this.mode !== "time";
        let has_time = this.mode !== "date";

        if (has_date) {
            let {year, month, day} = fields;
            let is_valid_date = Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && year >= 1000 && year <= 9999 && month >= 1 &&
                month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate();

            if (!is_valid_date) {
                return "";
            }
        }

        if (has_time) {
            let {hour, minute} = fields;
            let is_valid_time = Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;

            if (!is_valid_time) {
                return "";
            }
        }

        let date_text = has_date ? `${pad(fields.year, 4)}-${pad(fields.month)}-${pad(fields.day)}` : "";
        let time_text = has_time ? `${pad(fields.hour)}:${pad(fields.minute)}` : "";

        return {date: date_text, time: time_text, datetime: `${date_text}T${time_text}`}[this.mode];
    }

    /**
     * Reads text in one of the value forms - a canonical value, an ISO datetime with seconds, a 24-hour time with or without seconds, or a 12-hour time such as
     * "2:30 PM" - into numeric fields. Never parsed with Date, which would read an ISO date as UTC.
     * @param {string} text - The text.
     * @return {Object|null} - The fields, or null when the text is not one of these forms.
     */
    read_canonical_value = (text) => {
        let trimmed_text = text.trim();
        let match;

        if (this.mode === "date" && (match = trimmed_text.match(DATETIME_REGEX.date))) {
            return {year: Number(match[1]), month: Number(match[2]), day: Number(match[3])};
        }

        if (this.mode === "datetime" && (match = trimmed_text.match(DATETIME_REGEX.datetime))) {
            return {year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5])};
        }

        if (this.mode === "time" && (match = trimmed_text.match(DATETIME_REGEX.time["24"]))) {
            return {hour: Number(match[1]), minute: Number(match[2])};
        }

        if (this.mode === "time" && (match = trimmed_text.match(DATETIME_REGEX.time["12"]))) {
            let hour = Number(match[1]);
            let is_pm = match[3].toLowerCase() === "p";

            // A 12-hour hour outside 1-12 is not a time.
            if (hour < 1 || hour > 12) {
                return {hour: -1, minute: Number(match[2])};
            }

            return {hour: (hour % 12) + (is_pm ? 12 : 0), minute: Number(match[2])};
        }

        return null;
    }

    /**
     * Parses a display string back into an ISO string (YYYY-MM-DDTHH:mm).
     * @param {string} display_value - The display string to parse.
     * @return {*|string}
     */
    parse_from_display = (display_value) => {
        if (!display_value || !display_value.trim()) {
            return "";
        }

        // A value form typed directly - an ISO date, or a time such as "14:30" or "2:30 PM" - is read as such, whatever the display locale.
        let canonical_fields = this.read_canonical_value(display_value);

        if (canonical_fields) {
            return this.build_canonical_value(canonical_fields);
        }

        // Otherwise the text is read as the display shows it: its numbers, in the display locale's field order, all of them required.
        let numbers = display_value.match(/\d+/g) || [];
        let field_order = this.get_display_field_order();

        if (numbers.length !== field_order.length) {
            return "";
        }

        let fields = {};

        for (let [index, field_type] of field_order.entries()) {
            fields[field_type] = Number(numbers[index]);
        }

        // A two-digit year is not a full date.
        if (field_order.includes("year") && numbers[field_order.indexOf("year")].length !== 4) {
            return "";
        }

        if (field_order.includes("hour")) {
            let day_period = this.read_day_period(display_value);

            if (day_period) {
                if (fields.hour < 1 || fields.hour > 12) {
                    return "";
                }

                fields.hour = (fields.hour % 12) + (day_period === "pm" ? 12 : 0);
            }
        }

        return this.build_canonical_value(fields);
    };

    /**
     * Validates the input value and adds/removes an error class based on validity.
     */
    validate_format = () => {
        let valid = false;
        let raw = this.input_element.value.trim();

        if (!raw) {
            this.input_element.classList.remove("error");

            this.is_valid = true;

            this.dispatchEvent(this.custom_validated_event);
            this.input_element.dispatchEvent(this.custom_validated_event);

            return true;
        }

        // parse_from_display range-checks every field, so text that reads as a value is a valid one.
        valid = Boolean(this.parse_from_display(raw));

        this.input_element.classList.toggle("error", !valid);

        this.dispatchEvent(this.custom_validated_event);
        this.input_element.dispatchEvent(this.custom_validated_event);

        this.is_valid = valid;

        return valid;
    };

    /**
     * Gets validation errors for the current input value.
     * @param {string} value - The input value to validate.
     * @returns {*[]|string[]}
     */
    get_validation_errors = (value) => {
        let is_valid_formatting = this.validate_format(true);

        return is_valid_formatting ? [] : ["Invalid date/time format."];
    }

    /**
     * Displays the datetime picker popup when the input field is focused or clicked.
     * @param {Event} event - The event object.
     * @return {Promise<void>} - A promise that resolves when the popup is shown.
     */
    show_popup = async (event) => {
        // A readonly or disabled picker's value cannot be changed, so it has no popup to change it with.
        if (this.hasAttribute("readonly") || this.is_disabled) {
            return;
        }

        event.preventDefault();

        if (!this.datetime_popup) {
            // A single mouse click on an unfocused input fires "focus" then "click" synchronously, both
            // bound to show_popup (set_event_listeners) - without this guard, both calls would see
            // !this.datetime_popup (create_popup() hasn't resolved and assigned it yet for either one) and
            // each would build and append its own popup. Sharing one in-flight promise means only the first
            // call actually starts create_popup(); the second just awaits the same promise.
            this._popup_creation_promise ??= this.create_popup().then((popup) => {
                // Removed while the popup was being built: it is never shown.
                if (!this.isConnected) {
                    this.datetime_popup = null;
                    return;
                }

                document.body.append(popup);

                try {
                    popup.showPopover();
                }
                catch (error) {
                    console.warn(`${this.constructor.name}: The popup could not be shown in the top layer.`, error);
                }

                window.addEventListener("scroll", this.position_popup, true);
                window.addEventListener("resize", this.position_popup);
            });

            await this._popup_creation_promise;

            this._popup_creation_promise = null;
        }

        if (!this.datetime_popup) {
            return;
        }

        this.position_popup();
        this.sync_popup_from_input();
    };

    /**
     * Places the popup under the field in viewport coordinates, or above it when there is not room below and there is more above, as a select's dropdown is. Runs
     * on open, and on scroll and resize while open.
     */
    position_popup = () => {
        if (!this.datetime_popup) {
            return;
        }

        let input_rect = this.input_element.getBoundingClientRect();
        let popup_height = this.datetime_popup.offsetHeight;
        let space_below = window.innerHeight - input_rect.bottom;
        let is_above = popup_height > space_below && input_rect.top > space_below;

        this.datetime_popup.style.top = `${is_above ? input_rect.top - popup_height : input_rect.bottom}px`;
        this.datetime_popup.style.left = `${input_rect.left}px`;
    }

    /**
     * Hides the datetime picker popup if a click occurs outside of it or the input field.
     * @param {Event} event - The event object.
     */
    hide_popup = (event) => {
        if (!this.datetime_popup) {
            return;
        }

        // event.target is unreliable here: a composed event crossing a shadow boundary gets retargeted
        // to the enclosing shadow host, and this component sits inside a second shadow root whenever
        // it's used inside <galaxy-form> (which moves its children into a <form> in its own shadow
        // root) - so event.target would appear as <galaxy-form> itself for every click, even clicks on
        // this picker's own input. composedPath() gives the real, un-retargeted path regardless of how
        // many shadow boundaries were crossed.
        let event_path = event.composedPath();
        let clicked_in_popup = event_path.includes(this.datetime_popup);
        let clicked_in_picker = event_path.includes(this) || event_path.includes(this.input_element);

        if (!clicked_in_popup && !clicked_in_picker) {
            this.destroy_popup(this.datetime_popup);
        }
    };

    /**
     * Creates the datetime picker popup with a calendar and time selection inputs.
     * @return {Promise<HTMLElement|NodeListOf<HTMLElement>>} - The created popup element.
     */
    create_popup = async () => {
        GalaxyUtils.add_default_css(DATETIME_POPUP_CSS, "galaxy-datetime-popup-css");

        let use_24 = this.time_format === "24";

        let calendar_html = `
            <div class="calendar">
                <div class="calendar-header">
                    <button class="prev">&lt;</button>
                    <span class="month-year"></span>
                    <button class="next">&gt;</button>
                </div>
                <div class="calendar-grid"></div>
            </div>
        `;

        let time_html = `
            <div class="time-picker">
                <input type="number" class="hours" min="${use_24 ? 0 : 1}" max="${use_24 ? 23 : 12}" value="${use_24 ? "00" : 12}" />
                <span>:</span>
                <input type="number" class="minutes" min="0" max="59" value="00" />
                ${use_24 ? "" : `
                    <select class="am-pm-select">
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                `}
            </div>
        `;

        let html = `
            <div class="galaxy-datetime-popup">
                ${this.mode !== "time" ? calendar_html : ""}
                ${this.mode !== "date" ? time_html : ""}
            </div>
        `;
        let wrapper = await this.get_template(html);

        // Shown in the top layer (see show_popup), so it appears above a galaxy-modal.
        wrapper.setAttribute("popover", "manual");
        this.datetime_popup = wrapper;

        if (this.mode !== "time") {
            this.build_calendar(new Date());
        }

        if (this.mode !== "date") {
            let hours_input = wrapper.querySelector(".hours");
            let minutes_input = wrapper.querySelector(".minutes");
            let am_pm_select = wrapper.querySelector(".am-pm-select");

            let sync_to_input = () => {
                let iso_value = this.parse_from_display(this.input_element.value);
                let date = iso_value && this.mode === "datetime" ? new Date(iso_value) : new Date();

                let hours = parseInt(hours_input.value, 10);
                let minutes = parseInt(minutes_input.value, 10);

                if (use_24) {
                    if (isNaN(hours) || hours < 0) {
                        hours = 0;
                    }

                    if (hours > 23) {
                        hours = 23;
                    }
                }
                else {
                    if (isNaN(hours) || hours < 1) {
                        hours = 1;
                    }

                    if (hours > 12) {
                        hours = 12;
                    }
                }

                if (isNaN(minutes) || minutes < 0) {
                    minutes = 0;
                }

                if (minutes > 59) {
                    minutes = 59;
                }

                /** Pad time inputs with leading zeros if needed */
                if (hours < 10) {
                    hours_input.value = String(hours).padStart(2, "0");
                }

                if (minutes < 10) {
                    minutes_input.value = String(minutes).padStart(2, "0");
                }

                let new_hours = hours;
                if (!use_24) {
                    let ampm = am_pm_select?.value;

                    if (ampm === "PM" && hours < 12) {
                        new_hours += 12;
                    }

                    if (ampm === "AM" && hours === 12) {
                        new_hours = 0;
                    }
                }

                let new_iso;

                if (this.mode === "datetime") {
                    let year = date.getFullYear();
                    let month = String(date.getMonth() + 1).padStart(2, "0");
                    let day = String(date.getDate()).padStart(2, "0");

                    new_iso = `${year}-${month}-${day}T${String(new_hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
                }
                else {
                    new_iso = `${String(new_hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
                }

                this.input_element.value = this.format_for_display(new_iso);
                this.validate_format();

                // input_element is a readonly-ish display field the popup drives directly, so this
                // assignment doesn't fire a native "input"/"change" event on its own - dispatch one so
                // on_change_event (state manager write + form value) still runs.
                this.input_element.dispatchEvent(new Event("change", {bubbles: true}));
            };

            hours_input.addEventListener("input", sync_to_input);
            minutes_input.addEventListener("input", sync_to_input);

            if (am_pm_select) {
                am_pm_select.addEventListener("change", sync_to_input);
            }
        }

        return wrapper;
    };

    /**
     * Builds the calendar view for the specified month and year.
     * @param {Date} date - The date object representing the month and year to display.
     */
    build_calendar = (date) => {
        let month_year = this.datetime_popup.querySelector(".month-year");
        let grid = this.datetime_popup.querySelector(".calendar-grid");

        if (!month_year || !grid) {
            return;
        }

        grid.innerHTML = "";

        let year = date.getFullYear();
        let month = date.getMonth();

        month_year.textContent = `${date.toLocaleString(undefined, { month: "long" })} ${year}`;

        let first_day = new Date(year, month, 1).getDay();
        let days_in_month = new Date(year, month + 1, 0).getDate();

        let iso_value = this.parse_from_display(this.input_element.value);
        let selected_date = null;

        if (iso_value) {
            if (this.mode === "date") {
                let [year, month, day] = iso_value.split("-").map(Number);

                selected_date = { year: year, month: month - 1, day: day }; // manual object
            }
            else {
                selected_date = new Date(iso_value);
            }
        }

        // Add row for day names
        let day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        for (let day_name of day_names) {
            let day_name_div = document.createElement("div");

            day_name_div.classList.add("day-name");
            day_name_div.textContent = day_name;

            grid.appendChild(day_name_div);
        }

        // Add empty cells for days before the first of the month
        for (let i = 0; i < first_day; i++) {
            grid.appendChild(document.createElement("div"));
        }

        for (let day = 1; day <= days_in_month; day++) {
            let day_div = document.createElement("div");
            day_div.textContent = day.toString();

            if (selected_date) {
                if (this.mode === "date") {
                    if (selected_date.year === year && selected_date.month === month && selected_date.day === day) {
                        day_div.classList.add("selected");
                    }
                }
                else {
                    if (selected_date.getFullYear() === year && selected_date.getMonth() === month && selected_date.getDate() === day) {
                        day_div.classList.add("selected");
                    }
                }
            }

            day_div.addEventListener("click", () => {
                let iso_value = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

                if (!this.mode || this.mode === "datetime") {
                    let hours = this.datetime_popup.querySelector(".hours").value.padStart(2, "0");
                    let mins = this.datetime_popup.querySelector(".minutes").value.padStart(2, "0");
                    let am_pm = this.datetime_popup.querySelector(".am-pm-select")?.value;

                    if (this.time_format === "24") {
                        hours = Math.min(Math.max(hours, 0), 23);
                    }
                    else {
                        hours = Math.min(Math.max(hours, 1), 12);
                        if (am_pm === "PM" && hours < 12) {
                            hours += 12;
                        }

                        if (am_pm === "AM" && hours === 12) {
                            hours = 0;
                        }
                    }

                    mins = Math.min(Math.max(mins, 0), 59);

                    iso_value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${mins}`;
                }

                this.input_element.value = this.format_for_display(iso_value);

                this.build_calendar(new Date(year, month, 1));
                this.validate_format();

                // See the matching comment in create_popup's sync_to_input - a direct .value assignment
                // doesn't fire a native event on its own, so the state manager write never happens without this.
                this.input_element.dispatchEvent(new Event("change", {bubbles: true}));
            });

            grid.appendChild(day_div);
        }

        this.datetime_popup.querySelector(".prev").onclick = () => this.build_calendar(new Date(year, month - 1, 1));
        this.datetime_popup.querySelector(".next").onclick = () => this.build_calendar(new Date(year, month + 1, 1));
    };

    /**
     * Synchronizes the popup's calendar and time inputs with the current value of the main input field.
     */
    sync_popup_from_input = () => {
        if (!this.input_element.value) {
            return;
        }

        this.validate_format();

        if (!this.datetime_popup || !this.input_element.value) {
            return;
        }

        let iso_value = this.parse_from_display(this.input_element.value);

        if (!iso_value) {
            return;
        }

        if (this.mode === "date") {
            let [year, month, day] = iso_value.split("-").map(Number);

            this.build_calendar(new Date(year, month - 1, day));

            return;
        }

        if (this.mode === "time") {
            let [hours, minutes] = iso_value.split(":").map(Number);

            this.datetime_popup.querySelector(".hours").value = hours;
            this.datetime_popup.querySelector(".minutes").value = minutes;

            if (this.time_format === "12") {
                let am_pm_select = this.datetime_popup.querySelector(".am-pm-select");
                let display_hours = hours % 12 || 12;

                am_pm_select.value = hours >= 12 ? "PM" : "AM";

                this.datetime_popup.querySelector(".hours").value = display_hours;
            }

            return;
        }

        // datetime
        let [date_part, time_part] = iso_value.split("T");
        let [year, month, day] = date_part.split("-").map(Number);
        let [hours, minutes] = time_part.split(":").map(Number);

        this.build_calendar(new Date(year, month - 1, day));

        this.datetime_popup.querySelector(".hours").value = hours;
        this.datetime_popup.querySelector(".minutes").value = minutes;

        if (this.time_format === "12") {
            let am_pm_select = this.datetime_popup.querySelector(".am-pm-select");
            let display_hours = hours % 12 || 12;

            am_pm_select.value = hours >= 12 ? "PM" : "AM";

            this.datetime_popup.querySelector(".hours").value = display_hours;
        }
    };

    /**
     * Closes the popup if it is open. The shared hook a container calls when it hides this picker - a galaxy-collapse closing, for one - since the popup is attached to
     * the document body and would otherwise stay on screen.
     */
    close_floating_content = () => {
        if (this.datetime_popup) {
            this.destroy_popup();
        }
    }

    /**
     * Destroys the popup element and cleans up references.
     */
    destroy_popup = () => {
        this.validate_format();

        if (this.mode !== "time") {
            this.datetime_popup.querySelector(".prev").onclick = null;
            this.datetime_popup.querySelector(".next").onclick = null;
        }

        this.datetime_popup.remove();

        this.datetime_popup = null;

        window.removeEventListener("scroll", this.position_popup, true);
        window.removeEventListener("resize", this.position_popup);
    };

    /**
     * Converts an ISO string to a structured dictionary format.
     * @param {string} iso_string - The ISO string to convert.
     * @returns {{__type__: string, year: number|null, month: number|null, day: number|null, hour: number|null, minute: number|null, second: number, microsecond: number, tzinfo: string}}
     */
    convert_datetime_value_to_dictionary = (iso_string) => {
        let datetime_dictionary = {
            __type__: this.mode,
            year: null,
            month: null,
            day: null,
            hour: null,
            minute: null,
            second: 0,
            microsecond: 0,
            tzinfo: "TIME_ZONE" in window ? TIME_ZONE : Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        if (!iso_string) {
            return datetime_dictionary;
        }

        if (this.mode === "date") {
            let [year, month, day] = iso_string.split("-").map(Number);

            datetime_dictionary.year = year;
            datetime_dictionary.month = month;
            datetime_dictionary.day = day;
        }
        else if (this.mode === "time") {
            let [hour, minute] = iso_string.split(":").map(Number);

            datetime_dictionary.hour = hour;
            datetime_dictionary.minute = minute;
        }
        else {
            // datetime
            let [date_part, time_part] = iso_string.split("T");
            let [year, month, day] = date_part.split("-").map(Number);
            let [hour, minute] = time_part.split(":").map(Number);

            datetime_dictionary.year = year;
            datetime_dictionary.month = month;
            datetime_dictionary.day = day;
            datetime_dictionary.hour = hour;
            datetime_dictionary.minute = minute;
        }

        return datetime_dictionary;
    }

    /**
     * Normalizes various input formats into a standard ISO string (YYYY-MM-DDTHH:mm).
     * @param {string|object} new_value - The input value to normalize.
     * @returns {string} - The normalized ISO string or an empty string if invalid.
     */
    normalize_value = (new_value) => {
        if (!new_value) {
            return "";
        }

        // A string is JSON (a dictionary, or a JSON-encoded string) or one of the value forms - in a time picker, a 24-hour time whatever the display format.
        if (typeof new_value === "string") {
            try {
                new_value = JSON.parse(new_value);
            }
            catch (error) {
                let canonical_fields = this.read_canonical_value(new_value);

                return canonical_fields ? this.build_canonical_value(canonical_fields) : "";
            }

            if (typeof new_value === "string") {
                let canonical_fields = this.read_canonical_value(new_value);

                return canonical_fields ? this.build_canonical_value(canonical_fields) : "";
            }
        }

        if (typeof new_value === "object" && new_value !== null && !Array.isArray(new_value)) {
            if (new_value._isAMomentObject) {
                new_value = {
                    year: new_value.year(),
                    month: new_value.month() + 1,
                    day: new_value.date(),
                    hour: new_value.hour(),
                    minute: new_value.minute()
                }
            }

            // check if has correct keys
            let required_keys = ["year", "month", "day", "hour", "minute"];
            let has_all_keys = required_keys.every(key => key in new_value);

            if (has_all_keys) {
                // A missing (null) part takes its default, as before; every part is then range-checked, so month 13 is not a value.
                return this.build_canonical_value({
                    year: new_value.year ? Number(new_value.year) : 1970,
                    month: new_value.month ? Number(new_value.month) : 1,
                    day: new_value.day ? Number(new_value.day) : 1,
                    hour: new_value.hour ? Number(new_value.hour) : 0,
                    minute: new_value.minute ? Number(new_value.minute) : 0,
                });
            }
        }

        return "";
    }

    /***************  Event Listener Methods  ***************/
    on_input = (event) => {
        this.sync_popup_from_input();
    }

    /***************  Lifecycle Methods  ***************/

    /**
    * {@link GalaxyHTMLComponentBase#on_create}
    */
    on_create = async () => {
        // A `value` attribute present in markup at upgrade time isn't guaranteed to have been applied yet -
        // attributeChangedCallback reactions race against connectedCallback (both are async methods with
        // internal awaits; see the identical fix in GalaxySelectBase.on_create). Apply it directly instead
        // of trusting timing.
        if (this.has_completed_create) {
            // A reconnect (a move): keep the value as it now is, not the value attribute, which a typed or picked date never updates.
            this.apply_value(this._value ?? "");
        }
        else if (this.hasAttribute("value")) {
            this.apply_value(this.getAttribute("value"));
        }
        else {
            this.input_element.value = this.format_for_display(this.parse_from_display(this.input_element.value));
        }

        // Added once: the stylesheet outlives a disconnect, so adding it on every create would stack another copy per reconnect.
        if (!this.has_secondary_css) {
            this.add_shadow_css(this.secondary_css);
            this.has_secondary_css = true;
        }

        this.set_event_listeners();
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_destroy}
    */
    on_destroy = async () => {
        if (this.datetime_popup) {
            this.destroy_popup();
        }

        this.input_element.removeEventListener("focus", this.show_popup);
        this.input_element.removeEventListener("click", this.show_popup);

        document.removeEventListener("click", this.hide_popup);
    }

    /**
     * Additional CSS, applied via add_shadow_css() in on_create() rather than baked into the constructor's <style> tag
     * like pre_component_css/component_css/post_component_css are. Those three are read during the super() call chain,
     * before this.mode/this.time_format (set by the date/time/datetime subclasses) are assigned -- so any CSS that
     * needs to vary per mode has to be applied later, from here, once those are available.
     * @return {string} - The CSS styles for the input's height and error state.
     */
    get secondary_css() {
        return `
            input {
                height: calc(1.5em + 0.75rem + 2px);

                &.error {
                    border-color: var(--red);
                    background-color: #f8d7da;
                }
            }
        `;
    }
}