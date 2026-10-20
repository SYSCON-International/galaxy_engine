import { describe, expect, test } from "vitest";
import { create_select, flush, press_key, SIMPLE_OPTIONS } from "./test-helpers.js";

const OPTIONS_JSON = JSON.stringify(SIMPLE_OPTIONS);

/**
 * Records the select's value at each change event it dispatches.
 * @param {HTMLElement} select - The select.
 * @return {Array[]} - The values seen by the listener, in order.
 */
const record_changes = (select) => {
    let values_at_change = [];

    select.addEventListener("change", () => values_at_change.push([...select.value]));

    return values_at_change;
};

/**
 * Clicks a rendered option row by its text, the way a user would.
 * @param {HTMLElement} select - The select.
 * @param {string} text - The option's text.
 */
const click_option = (select, text) => {
    let option_element = Array.from(select.options_layer.children).find((element) => element.textContent.includes(text));

    option_element.click();
};

describe("select change event", () => {
    test("clicking an option fires one bubbling change, with the value already updated", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON});
        let values_at_change = record_changes(select);
        let bubbled_count = 0;

        document.body.addEventListener("change", () => bubbled_count++);
        select.open = true;
        await flush();
        click_option(select, "Banana");
        await flush();

        expect(values_at_change).toEqual([["banana"]]);
        expect(bubbled_count).toBe(1);
    });

    test("re-picking the current option of a single select fires nothing", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: JSON.stringify(["banana"])});
        let values_at_change = record_changes(select);

        select.open = true;
        await flush();
        click_option(select, "Banana");
        await flush();

        expect(values_at_change).toEqual([]);
    });

    test("a multi-select fires on selecting and on deselecting", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON});
        let values_at_change = record_changes(select);

        // Apple and Banana: jsdom does no layout, so only the first rows of the virtualized list are rendered.
        click_option(select, "Apple");
        await flush();
        click_option(select, "Banana");
        await flush();
        click_option(select, "Apple");
        await flush();

        expect(values_at_change).toEqual([["apple"], ["apple", "banana"], ["banana"]]);
    });

    test("choosing with the keyboard fires change too", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON});
        let values_at_change = record_changes(select);

        select.input_element.focus();
        press_key(select.input_element, "ArrowDown");
        await flush();
        press_key(select.input_element, "Enter");
        await flush();

        expect(values_at_change).toHaveLength(1);
        expect(values_at_change[0]).toEqual(select.value);
        expect(select.value).toHaveLength(1);
    });

    test("setting value from code, a state write, and a form reset fire nothing", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, "property-name": "fruits", value: JSON.stringify(["apple"])});
        let values_at_change = record_changes(select);

        select.value = JSON.stringify(["banana"]);
        await flush();
        window.galaxy_state_manager.data.fruits = ["cherry"];
        await flush();
        select.formResetCallback();
        await flush();

        expect(select.value).toEqual(["apple"]);
        expect(values_at_change).toEqual([]);
    });
});
