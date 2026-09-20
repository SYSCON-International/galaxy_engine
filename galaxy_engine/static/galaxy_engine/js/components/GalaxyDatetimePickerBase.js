/**
 * @file GalaxyDatetimePickerBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";

const DATETIME_REGEX = {
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: {
        "12": /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i,
        "24": /^([01]?\d|2[0-3]):[0-5]\d$/
    },
    datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
}

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
     * Set the value of the datetime picker.
     * @param {string} value - The value to set.
     */
    set value(value) {
        let normalized_value = this.normalize_value(value);

        if (normalized_value === this.parse_from_display(this.input_element.value)) {
            return;
        }

        this.input_element.value = this.format_for_display(normalized_value);

        this.validate();

        this.setAttribute("value", value);
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
     * Handles the value attribute change.
     * @param {string} new_value - The new value of the datetime picker.
     */
    handle_observed_value = (new_value) => {
        if (!this.input_element) {
            return;
        }
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

        if (this.mode === "date") {
            let [year, month, day] = iso_string.split("-").map(Number);
            let date = new Date(year, month - 1, day);

            return date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
        }

        if (this.mode === "time") {
            let [hour, minute] = iso_string.split(":").map(Number);
            let date = new Date(1970, 0, 1, hour, minute);

            return date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: this.time_format === "12"
            });
        }

        // datetime
        let [date_part, time_part] = iso_string.split("T");
        let [year, month, day] = date_part.split("-").map(Number);
        let [hour, minute] = time_part.split(":").map(Number);
        let date = new Date(year, month - 1, day, hour, minute);

        return date.toLocaleString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: this.time_format === "12"
        });
    };

    /**
     * Parses a display string back into an ISO string (YYYY-MM-DDTHH:mm).
     * @param {string} display_value - The display string to parse.
     * @return {*|string}
     */
    parse_from_display = (display_value) => {
        if (!display_value) {
            return "";
        }

        if (this.mode === "date") {
            let parsed = new Date(display_value);

            if (!isNaN(parsed.getTime())) {
                let year = parsed.getFullYear();
                let month = String(parsed.getMonth() + 1).padStart(2, "0");
                let day = String(parsed.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
            }

            if (/^\d{4}-\d{2}-\d{2}$/.test(display_value)) {
                return display_value;
            }

            return "";
        }

        if (this.mode === "time") {
            let parsed = new Date(`1970-01-01 ${display_value}`);

            if (!isNaN(parsed.getTime())) {
                let hours = String(parsed.getHours()).padStart(2, "0");
                let minutes = String(parsed.getMinutes()).padStart(2, "0");

                return `${hours}:${minutes}`;
            }

            if (/^\d{2}:\d{2}$/.test(display_value)) {
                return display_value;
            }

            return "";
        }

        // datetime
        let parsed = new Date(display_value);

        if (!isNaN(parsed.getTime())) {
            let year = parsed.getFullYear();
            let month = String(parsed.getMonth() + 1).padStart(2, "0");
            let day = String(parsed.getDate()).padStart(2, "0");
            let hours = String(parsed.getHours()).padStart(2, "0");
            let minutes = String(parsed.getMinutes()).padStart(2, "0");

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(display_value)) {
            return display_value;
        }

        return "";
    };

    /**
     * Validates the input value and adds/removes an error class based on validity.
     */
    validate_format = () => {
        let valid = false;
        let raw = this.input_element.value.trim();

        if (!raw) {
            this.input_element.classList.remove("error");

            return true;
        }

        if (this.mode === "date") {
            let regex = /^\d{4}-\d{2}-\d{2}$/;
            let iso_value = this.parse_from_display(raw);
            valid = !!iso_value && regex.test(iso_value);
        }
        else if (this.mode === "time") {
            let use_24 = this.time_format === "24";
            let regex = use_24 ? /^([01]?\d|2[0-3]):[0-5]\d$/ : /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;
            valid = regex.test(raw);
        }
        else {
            // datetime
            let iso_value = this.parse_from_display(raw);

            if (!iso_value) {
                this.input_element.classList.add("error");

                return false;
            }

            let isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

            if (!isoRegex.test(iso_value)) {
                this.input_element.classList.add("error");

                return false;
            }

            // Extract parts
            let [date_part, time_part] = iso_value.split("T");
            let [year, month, day] = date_part.split("-").map(Number);
            let [hours, minutes] = time_part.split(":").map(Number);

            // Range checks
            valid = (
                year >= 1000 &&
                month >= 1 &&
                month <= 12 &&
                day >= 1 &&
                day <= 31 &&
                hours >= 0 &&
                hours <= 23 &&
                minutes >= 0 &&
                minutes <= 59
            );
        }

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
        event.preventDefault();

        if (!this.datetime_popup) {
            await this.create_popup();

            document.body.append(this.datetime_popup);
        }

        const rect = this.input_element.getBoundingClientRect();
        this.datetime_popup.style.top = `${rect.bottom + window.scrollY}px`;
        this.datetime_popup.style.left = `${rect.left + window.scrollX}px`;

        this.sync_popup_from_input();
    };

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
                // the base class's on_input_event (state manager write + form value) still runs.
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

        // if string try to JSON parse, if fails check if ISO string
        if (typeof new_value === "string") {
            try {
                new_value = JSON.parse(new_value);
            }
            catch (error) {
                let iso_regex;

                if (this.mode === "date") {
                    iso_regex = DATETIME_REGEX.date;
                }
                else if (this.mode === "time") {
                    iso_regex = DATETIME_REGEX.time[this.time_format];
                }
                else {
                    iso_regex = DATETIME_REGEX.datetime;
                }

                if (iso_regex.test(new_value)) {
                    return new_value;
                }

                return "";
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
                // convert to ISO string
                let year = new_value.year ? String(new_value.year).padStart(4, "0") : "1970";
                let month = new_value.month ? String(new_value.month).padStart(2, "0") : "01";
                let day = new_value.day ? String(new_value.day).padStart(2, "0") : "01";
                let hour = new_value.hour ? String(new_value.hour).padStart(2, "0") : "00";
                let minute = new_value.minute ? String(new_value.minute).padStart(2, "0") : "00";

                if (this.mode === "date") {
                    return `${year}-${month}-${day}`;
                }
                else if (this.mode === "time") {
                    return `${hour}:${minute}`;
                }
                else {
                    return `${year}-${month}-${day}T${hour}:${minute}`;
                }
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
        this.input_element.value = this.format_for_display(this.parse_from_display(this.input_element.value));

        this.add_shadow_css(this.secondary_css);

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