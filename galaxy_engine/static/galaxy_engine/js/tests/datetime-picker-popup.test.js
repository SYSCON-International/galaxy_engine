import { describe, expect, test } from "vitest";
import { create_picker, flush } from "./datetime-test-helpers.js";

describe("popup creation race (fix #2)", () => {
    test("a single click on an unfocused input (which fires focus then click) only ever creates one popup", async () => {
        let picker = await create_picker("date");

        // Mirrors a real mouse click on an unfocused input: the browser fires "focus" then "click"
        // synchronously, back to back, before show_popup's internal `await create_popup()` for either call
        // has a chance to resolve.
        picker.input_element.dispatchEvent(new window.Event("focus"));
        picker.input_element.dispatchEvent(new window.Event("click"));

        await flush();

        expect(document.querySelectorAll(".galaxy-datetime-popup")).toHaveLength(1);
        expect(picker.datetime_popup).toBeTruthy();
    });

    test("closing and reopening the popup still only ever produces one at a time", async () => {
        let picker = await create_picker("date");

        picker.input_element.dispatchEvent(new window.Event("focus"));
        picker.input_element.dispatchEvent(new window.Event("click"));
        await flush();

        picker.destroy_popup();
        expect(document.querySelectorAll(".galaxy-datetime-popup")).toHaveLength(0);

        picker.input_element.dispatchEvent(new window.Event("focus"));
        picker.input_element.dispatchEvent(new window.Event("click"));
        await flush();

        expect(document.querySelectorAll(".galaxy-datetime-popup")).toHaveLength(1);
    });
});
