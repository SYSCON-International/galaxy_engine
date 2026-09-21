import { describe, expect, test } from "vitest";
import { create_select, SIMPLE_OPTIONS } from "./test-helpers.js";

describe("GalaxyMultiSelect option toggling", () => {
    test("clicking an option selects it and reflects [selected] on the clicked element", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        let option_element = document.createElement("div");
        let icons_element = document.createElement("div");

        select.option_on_click(option_element, icons_element, SIMPLE_OPTIONS[0]);

        expect(select.value).toEqual(["apple"]);
        expect(option_element.hasAttribute("selected")).toBe(true);
        expect(icons_element.hasAttribute("selected")).toBe(true);
    });

    test("clicking a selected option again deselects it - the value resync doesn't fight the toggle", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        let option_element = document.createElement("div");
        let icons_element = document.createElement("div");

        select.option_on_click(option_element, icons_element, SIMPLE_OPTIONS[0]);
        expect(select.value).toEqual(["apple"]);
        expect(option_element.hasAttribute("selected")).toBe(true);

        select.option_on_click(option_element, icons_element, SIMPLE_OPTIONS[0]);

        expect(select.value).toEqual([]);
        expect(option_element.hasAttribute("selected")).toBe(false);
        expect(icons_element.hasAttribute("selected")).toBe(false);
    });

    test("selecting multiple options accumulates in .value", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        select.option_on_click(document.createElement("div"), document.createElement("div"), SIMPLE_OPTIONS[0]);
        select.option_on_click(document.createElement("div"), document.createElement("div"), SIMPLE_OPTIONS[1]);

        expect(select.value).toEqual(["apple", "banana"]);
    });

    test("option_on_click tolerates missing DOM elements (the keyboard-selection path)", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        expect(() => select.option_on_click(undefined, undefined, SIMPLE_OPTIONS[0])).not.toThrow();
        expect(select.value).toEqual(["apple"]);
    });
});
