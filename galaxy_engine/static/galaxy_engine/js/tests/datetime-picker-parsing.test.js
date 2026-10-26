import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { create_picker, flush } from "./datetime-test-helpers.js";

// The test environment runs in en-US, in US Eastern time - west of UTC, where reading an ISO date as UTC midnight lands on the previous day.

/**
 * Creates a picker that displays and reads dates in the given locale, as a browser set to that locale would.
 * @param {"date"|"time"|"datetime"} mode
 * @param {string} locale
 * @param {Object<string, string>} attributes
 * @return {Promise<HTMLElement>}
 */
const create_picker_in_locale = async (mode, locale, attributes = {}) => {
    let tag_name = {date: "galaxy-date-picker", time: "galaxy-time-picker", datetime: "galaxy-datetime-picker"}[mode];
    let picker = document.createElement(tag_name);

    Object.defineProperty(picker, "display_locale", {value: locale});

    for (let [name, value] of Object.entries(attributes)) {
        picker.setAttribute(name, value);
    }

    document.body.appendChild(picker);
    await flush();

    return picker;
};

/**
 * Types text into the picker's field and commits it, as a user leaving the field does.
 * @param {HTMLElement} picker
 * @param {string} text
 */
const type_and_commit = (picker, text) => {
    picker.input_element.value = text;
    picker.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));
    picker.input_element.dispatchEvent(new Event("change", {bubbles: true}));
};

describe("a time picker keeps a 24-hour HH:mm value whatever it displays", () => {
    test("the default 12-hour picker accepts 14:30 in markup and shows it as 2:30 PM", async () => {
        let picker = await create_picker("time", {value: "14:30"});

        expect(picker.value).toBe("14:30");
        expect(picker.input_element.value).toMatch(/2:30\s?PM/i);
    });

    test("a value set from code", async () => {
        let picker = await create_picker("time");

        picker.value = "09:05";
        await flush();

        expect(picker.value).toBe("09:05");
    });

    test("12-hour text and a dictionary become canonical 24-hour values", async () => {
        let picker = await create_picker("time");

        picker.value = "2:30 PM";
        await flush();
        expect(picker.value).toBe("14:30");

        picker.value = {year: null, month: null, day: null, hour: 0, minute: 15};
        await flush();
        expect(picker.value).toBe("00:15");
    });

    test("a form reset restores the markup's time", async () => {
        let picker = await create_picker("time", {value: "14:30"});

        picker.value = "08:00";
        await flush();
        picker.formResetCallback();
        await flush();

        expect(picker.value).toBe("14:30");
    });

    test("typed 12-hour and 24-hour times are both read", async () => {
        let picker = await create_picker("time");

        type_and_commit(picker, "2:30 PM");
        expect(picker.value).toBe("14:30");

        type_and_commit(picker, "12:05 AM");
        expect(picker.value).toBe("00:05");

        type_and_commit(picker, "18:45");
        expect(picker.value).toBe("18:45");
    });
});

describe("dates are read as local dates, in the display locale's order, and only when complete", () => {
    test("a typed ISO date keeps its day west of UTC", async () => {
        let picker = await create_picker("date");

        type_and_commit(picker, "2024-01-15");

        expect(picker.value).toBe("2024-01-15");
    });

    test("en-GB reads day/month/year, so a value survives being shown and read back", async () => {
        let picker = await create_picker_in_locale("date", "en-GB", {value: "2024-02-01"});

        expect(picker.input_element.value).toBe("01/02/2024");

        type_and_commit(picker, picker.input_element.value);
        expect(picker.value).toBe("2024-02-01");

        type_and_commit(picker, "15/01/2024");
        expect(picker.value).toBe("2024-01-15");
    });

    test("en-US reads month/day/year", async () => {
        let picker = await create_picker("date");

        type_and_commit(picker, "01/15/2024");

        expect(picker.value).toBe("2024-01-15");
    });

    test("partial or impossible dates are not values", async () => {
        let picker = await create_picker("date");

        for (let text of ["2", "1/15", "01/15/24", "02/30/2024", "13/01/2024"]) {
            type_and_commit(picker, text);
            expect(picker.value, text).toBe("");
        }

        type_and_commit(picker, "02/29/2024");
        expect(picker.value).toBe("2024-02-29");
    });

    test("a datetime survives being shown and read back, in en-US and en-GB", async () => {
        for (let locale of ["en-US", "en-GB"]) {
            let picker = await create_picker_in_locale("datetime", locale, {value: "2024-02-01T14:30"});

            type_and_commit(picker, picker.input_element.value);

            expect(picker.value, locale).toBe("2024-02-01T14:30");
        }
    });
});

describe("other value forms", () => {
    test("a JSON-encoded ISO string is accepted", async () => {
        let picker = await create_picker("date");

        picker.value = "\"2024-01-15\"";
        await flush();

        expect(picker.value).toBe("2024-01-15");
    });

    test("an ISO datetime with seconds is accepted, and a time with seconds", async () => {
        let datetime_picker = await create_picker("datetime", {value: "2024-01-15T14:30:59"});
        let time_picker = await create_picker("time", {value: "14:30:00"});

        expect(datetime_picker.value).toBe("2024-01-15T14:30");
        expect(time_picker.value).toBe("14:30");
    });

    test("an out-of-range dictionary or ISO string is not a value", async () => {
        let picker = await create_picker("date");

        picker.value = {year: 2024, month: 13, day: 1, hour: 0, minute: 0};
        await flush();
        expect(picker.value).toBe("");

        picker.value = "2024-02-30";
        await flush();
        expect(picker.value).toBe("");
    });
});

describe("validation", () => {
    test("text that is not a date makes an optional picker invalid instead of silently empty", async () => {
        let picker = await create_picker("date");

        type_and_commit(picker, "not a date");

        expect(picker.value).toBe("");
        expect(picker.validate()).toBe(false);
    });

    test("a required, empty picker is not shown invalid on load", async () => {
        let picker = await create_picker("date", {required: ""});

        expect(picker._internals.validity.valid).toBe(true);
        expect(picker.input_element.classList.contains("error")).toBe(false);
    });

    test("a required, empty picker still fails validation when asked", async () => {
        let picker = await create_picker("date", {required: ""});

        expect(picker.validate()).toBe(false);
    });
});

describe("the popup", () => {
    let unhandled_rejections = [];
    let record_rejection = (reason) => {
        unhandled_rejections.push(reason);
    };

    beforeEach(() => {
        unhandled_rejections = [];
        process.on("unhandledRejection", record_rejection);
    });

    afterEach(() => {
        process.off("unhandledRejection", record_rejection);
    });

    test("a readonly or disabled picker opens no popup", async () => {
        for (let attribute_name of ["readonly", "disabled"]) {
            let picker = await create_picker("date", {[attribute_name]: "", value: "2024-01-15"});

            picker.input_element.dispatchEvent(new Event("focus"));
            await flush();

            expect(picker.datetime_popup ?? null, attribute_name).toBeNull();
        }

        expect(document.querySelectorAll(".galaxy-datetime-popup")).toHaveLength(0);
    });

    test("removing a picker right after focusing it causes no error", async () => {
        let picker = await create_picker("date");

        picker.input_element.dispatchEvent(new Event("focus"));
        picker.remove();
        await flush();
        await flush();

        expect(unhandled_rejections).toEqual([]);
    });

    test("the popup is a manual popover in the top layer, positioned in viewport coordinates", async () => {
        let picker = await create_picker("date");

        picker.input_element.getBoundingClientRect = () => ({top: 100, bottom: 130, left: 40, right: 240, width: 200, height: 30});
        picker.input_element.dispatchEvent(new Event("focus"));
        await flush();

        let popup = picker.datetime_popup;

        expect(popup.getAttribute("popover")).toBe("manual");
        expect(popup._is_popover_open).toBe(true);
        expect(popup.style.top).toBe("130px");
        expect(popup.style.left).toBe("40px");
        expect(document.getElementById("galaxy-datetime-popup-css").textContent).toMatch(/position:\s*fixed;/);
    });
});
