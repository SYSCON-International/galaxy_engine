/**
 * @file GalaxyDatetimeRangePickerBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";
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


/**
 * @class
 * @description
 *     A datetime range picker component with a preset range select (All, Today, This Week, This Month, Custom) and,
 *     for "Custom", a pair of start/end galaxy-datetime-picker fields.
 * @extends GalaxyInputBase
 */
export class GalaxyDatetimeRangePickerBase extends GalaxyInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(INPUT_TEMPLATE_HTML);

        this.datetime_range_picker_options = [["All", "All"], ["Today", "Today"], ["This Week", "This Week"], ["This Month", "This Month"], ["Custom", "Custom"]];
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
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        const attribute_lookup_table = {}

        attribute_lookup_table[name]?.(new_value);
    }

    /***************  Getters and Setters  ***************/
    /**
         * Get the current value of the datetime range picker.
         * @return {{start, range, end}} - An object containing the start datetime, end datetime, and selected range.
         */
    get value() {
        return {
            start: this.range_select_element.value !== "Custom" ? null : this.start_datetime_picker.value_dictionary,
            end: this.range_select_element.value !== "Custom" ? null : this.end_datetime_picker.value_dictionary,
            range: this.range_select_element.value,
        };
    }

    /**
     * Set the value of the datetime range picker.
     * @param {{start, range, end}} new_value - An object containing the new start datetime, end datetime, and selected range.
     */
    set value(new_value) {
        if (new_value.range) {
            if (this.datetime_range_picker_options.some((picker_option) => picker_option[0] === new_value.range)) {
                this.select_element.value = new_value.range;
            }
            else {
                this.select_element.value = "All";
            }

            if (new_value.range === "Custom") {
                this.datetime_range_picker.setAttribute("custom-range", true);
            }
            else {
                this.datetime_range_picker.removeAttribute("custom-range");
            }
        }

        if (new_value.start) {
            this.start_datetime_picker.value = new_value.start;
        }

        if (new_value.end) {
            this.end_datetime_picker.value = new_value.end;
        }
    }

    /***************  Attribute Observer Methods  ***************/

    /***************  Other Methods  ***************/
    set_event_listeners = () => {
        this.range_select_element.addEventListener("change", this.toggle_datetime_pickers);
    }

    /**
         * Set up custom events for the datetime range picker.
         */
    set_custom_events = () => {
        // Custom events are dispatched on the main .syscon-datetime-range-picker div
        this.dispatch_range_change = GalaxyUtils.debounce(() => {
            this.datetime_range_picker.dispatchEvent(new CustomEvent("range_change", {detail: this.value}));
        }, this.properties?.event_debounce_delay || 200);

        this.dispatch_range_valid = GalaxyUtils.debounce(() => {
            this.datetime_range_picker.dispatchEvent(new CustomEvent("range_valid", {detail: this.value}));
        }, this.properties?.event_debounce_delay || 200);
    }

    /**
     * Toggle the visibility of the datetime pickers based on the selected range.
     */
    toggle_datetime_pickers = () => {
        if (this.range_select_element.value === "Custom") {
            this.setAttribute("custom-range", true);
        }
        else {
            this.removeAttribute("custom-range");
        }
    }

    /***************  Event Listener Methods  ***************/


    /***************  Lifecycle Methods  ***************/

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

        this.set_event_listeners();
        this.set_custom_events();
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_destroy}
    */
    on_destroy = async () => {}

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

