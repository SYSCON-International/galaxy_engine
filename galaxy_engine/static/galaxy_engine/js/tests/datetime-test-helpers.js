import { GalaxyDatePicker } from "../components/GalaxyDatePicker.js";
import { GalaxyTimePicker } from "../components/GalaxyTimePicker.js";
import { GalaxyDatetimePicker } from "../components/GalaxyDatetimePicker.js";
import { GalaxyDatetimeRangePickerBase } from "../components/GalaxyDatetimeRangePickerBase.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-date-picker")) {
    customElements.define("galaxy-date-picker", GalaxyDatePicker);
}

if (!customElements.get("galaxy-time-picker")) {
    customElements.define("galaxy-time-picker", GalaxyTimePicker);
}

if (!customElements.get("galaxy-datetime-picker")) {
    customElements.define("galaxy-datetime-picker", GalaxyDatetimePicker);
}

if (!customElements.get("galaxy-datetime-range")) {
    customElements.define("galaxy-datetime-range", GalaxyDatetimeRangePickerBase);
}

export { flush };

const TAGS = {
    date: "galaxy-date-picker",
    time: "galaxy-time-picker",
    datetime: "galaxy-datetime-picker",
};

/**
 * Creates and connects a date/time/datetime picker, sets any given attributes before connecting, and waits
 * for its async on_create to finish.
 * @param {"date"|"time"|"datetime"} mode
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
export const create_picker = async (mode, attributes = {}) => {
    let element = document.createElement(TAGS[mode]);

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

/**
 * Creates and connects a <galaxy-datetime-range>, with the custom-event debounce delay collapsed to 0 so
 * tests don't need to wait out the real 200ms default.
 * @return {Promise<HTMLElement>}
 */
export const create_range_picker = async () => {
    let element = document.createElement("galaxy-datetime-range");

    element.properties = {event_debounce_delay: 0};

    document.body.appendChild(element);

    await flush();

    return element;
};
