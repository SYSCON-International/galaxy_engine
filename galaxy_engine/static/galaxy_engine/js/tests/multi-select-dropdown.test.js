import { describe, expect, test } from "vitest";
import { create_select, flush, press_key, SIMPLE_OPTIONS } from "./test-helpers.js";

/**
 * Creates a multi-select with the simple options and the `dropdown` attribute.
 * @param {Object<string, string>} attributes - Extra attributes.
 * @return {Promise<HTMLElement>}
 */
const create_dropdown_multi_select = (attributes = {}) => {
    return create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), dropdown: "", ...attributes});
};

describe("GalaxyMultiSelect dropdown mode", () => {
    test("without dropdown, the list stays in the page and clicking the field does not open it", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        expect(select.has_dropdown).toBe(false);
        expect(select.options_element.hasAttribute("popover")).toBe(false);
        expect(select.input_element.hasAttribute("role")).toBe(false);

        select.input_element.click();
        await flush();

        expect(select.open).toBe(false);
    });

    test("with dropdown, the options element is a popover the field opens and closes", async () => {
        let select = await create_dropdown_multi_select();

        expect(select.has_dropdown).toBe(true);
        expect(select.options_element.getAttribute("popover")).toBe("manual");
        expect(select.input_element.getAttribute("role")).toBe("combobox");
        expect(select.input_element.getAttribute("aria-expanded")).toBe("false");

        select.input_element.click();
        await flush();

        expect(select.open).toBe(true);
        expect(select.options_element._is_popover_open).toBe(true);
        expect(select.input_element.getAttribute("aria-expanded")).toBe("true");

        select.input_element.click();
        await flush();

        expect(select.open).toBe(false);
        expect(select.options_element._is_popover_open).toBe(false);
    });

    test("choosing options keeps the dropdown open, and the closed field shows their texts joined", async () => {
        let select = await create_dropdown_multi_select();

        select.open = true;
        await flush();

        select.option_on_click(undefined, undefined, SIMPLE_OPTIONS[0]);
        select.option_on_click(undefined, undefined, SIMPLE_OPTIONS[2]);
        await flush();

        expect(select.open).toBe(true);
        expect(select.value).toEqual(["apple", "cherry"]);

        select.close_options();
        await flush();

        expect(select.input_element.value).toBe("Apple, Cherry");
    });

    test("a value set from code shows as the closed field's text", async () => {
        let select = await create_dropdown_multi_select();

        select.value = JSON.stringify(["banana", "cherry"]);
        await flush();

        expect(select.input_element.value).toBe("Banana, Cherry");
    });

    test("a value already present when the options load shows as the closed field's text", async () => {
        let select = await create_select("multi-select", {value: JSON.stringify(["banana"]), dropdown: ""});

        select.options = JSON.stringify(SIMPLE_OPTIONS);
        await flush();

        expect(select.input_element.value).toBe("Banana");
    });

    test("opening a searchable dropdown clears the field for searching", async () => {
        let select = await create_dropdown_multi_select({"search-enabled": "", value: JSON.stringify(["apple"])});
        await flush();

        expect(select.input_element.value).toBe("Apple");

        select.input_element.click();
        await flush();

        expect(select.input_element.value).toBe("");
    });

    test("the keyboard opens a closed dropdown and Escape closes it", async () => {
        let select = await create_dropdown_multi_select();

        press_key(select.input_element, "ArrowDown");
        await flush();

        expect(select.open).toBe(true);

        press_key(select.input_element, "Escape");
        await flush();

        expect(select.open).toBe(false);
    });

    test("turning dropdown on and off switches the list between a popover and the page", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), value: JSON.stringify(["apple"])});

        select.dropdown = true;
        await flush();

        expect(select.options_element.getAttribute("popover")).toBe("manual");
        expect(select.input_element.value).toBe("Apple");

        select.open = true;
        await flush();

        select.dropdown = false;
        await flush();

        expect(select.open).toBe(false);
        expect(select.options_element.hasAttribute("popover")).toBe(false);
        expect(select.input_element.hasAttribute("role")).toBe(false);
    });
});
