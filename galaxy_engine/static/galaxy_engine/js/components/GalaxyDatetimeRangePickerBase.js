/**
 * @file GalaxyDatetimeRangePickerBase.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";
import {GalaxyDatetimePickerBase} from "./GalaxyDatetimePickerBase.js";
import {GalaxyUtils} from "../GalaxyUtils.js";

const INPUT_TEMPLATE_HTML = `
    <input type="hidden" />
`;

const RANGE_PICKER_TEMPLATE_HTML = `
    <div class="range-picker">
        <div>
            <select>
                <option value="All">All</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom">Custom</option>
            </select>
        </div>
        <div class="start-datetime"></div>
        <div class="end-datetime"></div>
    </div>
`;

const DEFAULT_RANGE = "All";
const CUSTOM_RANGE = "Custom";


/**
 * @class
 * @description
 *     A datetime range picker component with a preset range select (All, Today, This Week, This Month, Custom) and,
 *     for "Custom", a pair of start/end galaxy-datetime-picker fields. A full form field: it submits its range as JSON, binds to state, validates, resets, and
 *     follows disabled and readonly.
 * @extends GalaxyInputBase
 */
export class GalaxyDatetimeRangePickerBase extends GalaxyInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(INPUT_TEMPLATE_HTML);

        this.datetime_range_picker_options = [["All", "All"], ["Today", "Today"], ["This Week", "This Week"], ["This Month", "This Month"], ["Custom", "Custom"]];

        // The one source of truth for the value, kept whether or not the select and pickers exist yet: the range, and the start and end as canonical datetimes
        // ("YYYY-MM-DDTHH:mm", or "" when empty). The controls show it, and user edits write it.
        this.range_value = {range: DEFAULT_RANGE, start: "", end: ""};
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [];
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_attribute_changed_callback}
     * @note `disabled` and `readonly` are observed by the input base; they are applied to the select and pickers here as well.
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (name === "disabled" || name === "readonly") {
            this.apply_control_states();
        }
    }

    /***************  Getters and Setters  ***************/
    /**
     * Get the current value of the datetime range picker. Safe to read before the picker is created.
     * @return {{start, range, end}} - The selected range, and for "Custom" the start and end as {year, month, day, hour, minute, ...} dictionaries (all null when
     *     empty); null for a preset range.
     */
    get value() {
        let is_custom = this.range_value.range === CUSTOM_RANGE;

        return {
            start: is_custom ? GalaxyDatetimePickerBase.to_value_dictionary_for_mode("datetime", this.range_value.start) : null,
            end: is_custom ? GalaxyDatetimePickerBase.to_value_dictionary_for_mode("datetime", this.range_value.end) : null,
            range: this.range_value.range,
        };
    }

    /**
     * Set the value of the datetime range picker: an object `{range, start, end}`, its JSON, or a range name ("Today"). An empty value is "All". The start and
     * end take anything a datetime picker does (a canonical datetime, a dictionary); a missing one is empty. An unknown range is "All", and a value without a
     * range keeps the current one. Safe before the picker is created; it is shown once it is.
     * @param {Object|string|null} new_value - The new value.
     */
    set value(new_value) {
        this.range_value = this.parse_range_value(new_value);

        this.toggleAttribute("custom-range", this.range_value.range === CUSTOM_RANGE);
        this.render_range_value();
        this.sync_form_value();

        this.dispatch_range_change?.();
    }

    /**
     * Reads a value given in any accepted form into a canonical range value.
     * @param {Object|string|null} new_value - The value.
     * @return {{range: string, start: string, end: string}}
     */
    parse_range_value = (new_value) => {
        let is_empty = new_value === null || new_value === undefined || new_value === "";

        if (is_empty) {
            return {range: DEFAULT_RANGE, start: "", end: ""};
        }

        if (typeof new_value === "string") {
            try {
                new_value = JSON.parse(new_value);
            }
            catch (error) {
                new_value = {range: new_value};
            }
        }

        if (!new_value || typeof new_value !== "object") {
            return {range: DEFAULT_RANGE, start: "", end: ""};
        }

        let range = this.range_value.range;

        if (new_value.range !== undefined) {
            let is_known_range = this.datetime_range_picker_options.some((picker_option) => picker_option[0] === new_value.range);

            range = is_known_range ? new_value.range : DEFAULT_RANGE;
        }

        return {range: range, start: this.to_canonical_datetime(new_value.start), end: this.to_canonical_datetime(new_value.end)};
    }

    /**
     * Normalizes a start or end into a canonical datetime. A dictionary whose parts are all null - what the getter gives for an empty date - is empty, rather than
     * the datetime picker's reading of it as 1970-01-01.
     * @param {*} datetime_value - The start or end.
     * @return {string} - The canonical datetime, or "".
     */
    to_canonical_datetime = (datetime_value) => {
        let is_empty_dictionary = Boolean(datetime_value) && typeof datetime_value === "object" &&
            ["year", "month", "day", "hour", "minute"].every((part) => datetime_value[part] === null || datetime_value[part] === undefined);

        if (is_empty_dictionary) {
            return "";
        }

        return GalaxyDatetimePickerBase.normalize_value_for_mode("datetime", datetime_value);
    }

    /**
     * Gets the value submitted with a form, as JSON: `{"range": "...", "start": "...", "end": "..."}`, with the start and end as canonical datetimes for "Custom"
     * and null otherwise.
     * @return {string}
     */
    get form_value() {
        let is_custom = this.range_value.range === CUSTOM_RANGE;

        return JSON.stringify({
            range: this.range_value.range,
            start: is_custom ? this.range_value.start || null : null,
            end: is_custom ? this.range_value.end || null : null,
        });
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * {@link GalaxyInputBase#handle_observed_value}
     * @note The value attribute is read like the value setter's argument (JSON, or a range name); a removed attribute is "All". The picker never writes the attribute
     *     itself.
     * @override
     */
    handle_observed_value = (new_value) => {
        this.value = new_value;
    }

    /***************  Other Methods  ***************/

    /**
     * Shows the current value in the select and pickers, once they exist.
     */
    render_range_value = () => {
        if (!this.range_select_element) {
            return;
        }

        // A picker announces its new value (input_validated) as soon as it is set; while both are being set here, that must not read the other one, not yet set,
        // back into the value.
        this.is_rendering_range_value = true;

        try {
            this.range_select_element.value = this.range_value.range;
            this.start_datetime_picker.value = this.range_value.start;
            this.end_datetime_picker.value = this.range_value.end;
        }
        finally {
            this.is_rendering_range_value = false;
        }
    }

    /**
     * Reads the select and pickers into the value - after the user, or code acting on the pickers directly, changed them.
     */
    read_range_value_from_controls = () => {
        this.range_value = {
            range: this.range_select_element.value,
            start: this.start_datetime_picker.value || "",
            end: this.end_datetime_picker.value || "",
        };

        this.toggleAttribute("custom-range", this.range_value.range === CUSTOM_RANGE);
        this.sync_form_value();
    }

    /**
     * Sets the form value from the current value.
     */
    sync_form_value = () => {
        this._internals.setFormValue(this.form_value);
    }

    /**
     * Applies the input's disabled state (its own attribute, or a disabled fieldset) and readonly attribute to the select and both pickers. A select cannot be read-only,
     * so a read-only range picker disables its select; the form value comes from the picker itself, so it is still submitted.
     */
    apply_control_states = () => {
        if (!this.range_select_element) {
            return;
        }

        this.range_select_element.disabled = this.is_disabled || this.readonly;

        for (let nested_picker of [this.start_datetime_picker, this.end_datetime_picker]) {
            nested_picker.toggleAttribute("disabled", this.is_disabled);
            nested_picker.toggleAttribute("readonly", this.readonly);
        }
    }

    /**
     * {@link GalaxyInputBase#get_label_target}
     * @note The range select, which is what the user picks with; the hidden field holds nothing.
     * @override
     */
    get_label_target = () => this.range_select_element ?? null;

    /**
     * {@link GalaxyInputBase#on_disabled_state_change}
     * @override
     */
    on_disabled_state_change = () => {
        this.apply_control_states();
    }

    set_event_listeners = () => {
        this.range_select_element.addEventListener("change", this.on_user_edit);

        for (let nested_picker of [this.start_datetime_picker, this.end_datetime_picker]) {
            nested_picker.addEventListener("input", this.on_user_edit);
            nested_picker.addEventListener("change", this.on_user_edit);
            nested_picker.addEventListener("input_validated", this.on_range_change);
        }
    }

    /**
     * Handles the user changing the range or a date: the value and form value follow, the state is written, the picker revalidates when its form validates
     * instantly, and a committed change (`change`, not `input`) is dispatched on the element.
     * @param {Event} event - The select's or a picker's input or change event.
     */
    on_user_edit = (event) => {
        this.read_range_value_from_controls();
        this.write_state_value(this.value);

        if (this.parent_form?.hasAttribute("instant-validation")) {
            this.validate();
        }

        this.on_range_change();

        if (event.type === "change") {
            this.dispatch_host_change();
        }
    }

    /**
     * Fires whenever anything that affects the current range changes - the preset select, or either nested
     * picker's value (input_validated is dispatched by GalaxyDatetimePickerBase.validate_format on every
     * value change, not just invalid ones, despite the name).
     */
    on_range_change = (event) => {
        let is_picker_value_change = event?.type === "input_validated" && !this.is_rendering_range_value;

        // A picker's value changed from code reaches the value here (one the user edits arrives through on_user_edit too). Only the picker that changed is read: the
        // other may not have finished creating - after a move, say - and would read as empty.
        if (is_picker_value_change && event.currentTarget === this.start_datetime_picker) {
            this.range_value = {...this.range_value, start: this.start_datetime_picker.value || ""};
            this.sync_form_value();
        }
        else if (is_picker_value_change && event.currentTarget === this.end_datetime_picker) {
            this.range_value = {...this.range_value, end: this.end_datetime_picker.value || ""};
            this.sync_form_value();
        }

        this.dispatch_range_change?.();
        this.dispatch_range_valid?.();
    }

    /**
     * Whether the current range selection is complete and well-formed. A preset range ("All", "Today", etc.)
     * is always valid on its own; "Custom" additionally requires both the start and end to hold a well-formatted value, with the start not after the end.
     * @return {boolean}
     */
    is_range_valid = () => {
        if (this.range_value.range !== CUSTOM_RANGE) {
            return true;
        }

        let has_both_ends = Boolean(this.range_value.start) && Boolean(this.range_value.end);

        return has_both_ends && this.get_validation_errors().length === 0;
    }

    /**
     * {@link GalaxyInputBase#is_value_empty}
     * @note Only a "Custom" range with neither a start nor an end is empty; a preset range is always a value.
     * @override
     */
    is_value_empty = () => {
        return this.range_value.range === CUSTOM_RANGE && !this.range_value.start && !this.range_value.end;
    }

    /**
     * {@link GalaxyInputBase#get_validation_errors}
     * @note For "Custom": text in a picker that is not a datetime, a range with only one end, and a start after the end.
     * @override
     */
    get_validation_errors = () => {
        if (this.range_value.range !== CUSTOM_RANGE) {
            return [];
        }

        let has_unreadable_text = [this.start_datetime_picker, this.end_datetime_picker].some((nested_picker) => {
            return Boolean(nested_picker?.input_element?.value) && !nested_picker.value;
        });

        if (has_unreadable_text) {
            return ["Invalid date/time format."];
        }

        let has_only_one_end = Boolean(this.range_value.start) !== Boolean(this.range_value.end);

        if (has_only_one_end) {
            return ["Please enter both a start and an end."];
        }

        if (this.range_value.start && this.range_value.start > this.range_value.end) {
            return ["The start must not be after the end."];
        }

        return [];
    }

    /**
         * Set up custom events for the datetime range picker.
         */
    set_custom_events = () => {
        // Custom events are dispatched on this element itself (there is no separate wrapper element -
        // this.datetime_range_picker never existed; it was dead, always-undefined code that would have
        // thrown the moment either of these ever actually ran, which they never did - see set_event_listeners).
        this.dispatch_range_change = GalaxyUtils.debounce(() => {
            this.dispatchEvent(new CustomEvent("range_change", {detail: this.value}));
        }, this.properties?.event_debounce_delay ?? 200);

        this.dispatch_range_valid = GalaxyUtils.debounce(() => {
            if (this.is_range_valid()) {
                this.dispatchEvent(new CustomEvent("range_valid", {detail: this.value}));
            }
        }, this.properties?.event_debounce_delay ?? 200);
    }

    /**
     * Toggle the visibility of the datetime pickers based on the selected range.
     */
    toggle_datetime_pickers = () => {
        this.toggleAttribute("custom-range", this.range_select_element.value === CUSTOM_RANGE);
    }

    /***************  Event Listener Methods  ***************/


    /***************  Lifecycle Methods  ***************/

    /**
     * {@link GalaxyInputBase#restore_value_after_reconnect}
     * @override
     * @note Nothing to restore into the hidden field, which the range picker does not use. The value lives in range_value, which on_create shows in the rebuilt
     *     select and pickers, so a move keeps the chosen range.
     */
    restore_value_after_reconnect = () => {}

    /**
    * {@link GalaxyHTMLComponentBase#on_create}
    */
    on_create = async () => {
        this.range_picker_element = await this.get_template(RANGE_PICKER_TEMPLATE_HTML);
        this.range_select_element = this.range_picker_element.querySelector("select");

        let start_datetime_container = this.range_picker_element.children[1];
        let end_datetime_container = this.range_picker_element.children[2];

        this.start_datetime_picker = await this.get_template("<galaxy-datetime-picker></galaxy-datetime-picker>");
        this.end_datetime_picker = await this.get_template("<galaxy-datetime-picker></galaxy-datetime-picker>");

        start_datetime_container.appendChild(this.start_datetime_picker);
        end_datetime_container.appendChild(this.end_datetime_picker);

        this.label_element.parentElement.after(this.range_picker_element);

        this.render_range_value();
        this.apply_control_states();
        this.toggleAttribute("custom-range", this.range_value.range === CUSTOM_RANGE);
        this.sync_form_value();

        this.set_event_listeners();
        this.set_custom_events();
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_destroy}
    * @note The select and pickers go with the field markup (see GalaxyInputBase#post_on_destroy); forgetting them here means nothing writes to the detached copies.
    */
    on_destroy = async () => {
        this.range_select_element = null;
        this.start_datetime_picker = null;
        this.end_datetime_picker = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            .range-picker {
                display: flex;

                > div {
                    flex: 1;
                }

                > div:first-child {
                    padding: calc(0.375rem + 1px) 15px;
                    padding-right: 7.5px;

                    > select {
                        display: block;
                        width: 100%;
                        height: calc(1.5em + 0.75rem + 2px);
                        padding: 0.375rem 0.75rem;
                        font-family: inherit;
                        font-size: 1rem;
                        font-weight: 400;
                        line-height: 1.5;
                        color: var(--text-grey);
                        background-color: var(--input-background, #ffffff);
                        background-clip: padding-box;
                        border: 1px solid var(--lightgrey);
                        border-radius: 0.25rem;
                        transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

                        /* The same focus ring as the input base's fields */
                        &:focus {
                            outline: none;
                            border-color: var(--blue);
                            box-shadow: 0 0 0 0.2rem var(--focus-ring, rgba(0, 123, 255, 0.25));
                        }
                    }
                }

                > div.start-datetime {
                    display: none;

                    /* padding is applied to the picker's host tag, since CSS can't reach inside its own shadow root */
                    > galaxy-datetime-picker {
                        padding-left: 7.5px;
                        padding-right: 7.5px;
                    }
                }

                > div.end-datetime {
                    display: none;

                    > galaxy-datetime-picker {
                        padding-left: 7.5px;
                    }
                }
            }

            :host([custom-range]) .range-picker > div.start-datetime,
            :host([custom-range]) .range-picker > div.end-datetime {
                display: block;
            }
        `;
    }
}
