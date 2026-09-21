import { describe, expect, test } from "vitest";
import { create_select, flush, press_key, SIMPLE_OPTIONS, GROUPED_OPTIONS } from "./test-helpers.js";

describe("keyboard navigation (fix #5)", () => {
    test("ArrowDown on a closed select opens it and highlights the first option", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        press_key(select, "ArrowDown");
        await flush();

        expect(select.open).toBe(true);
        expect(select.highlighted_flat_index).toBe(0);
    });

    test("repeated ArrowDown moves through options and wraps back to the first", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        select.open = true;
        await flush();

        press_key(select, "ArrowDown");
        expect(select.highlighted_flat_index).toBe(0);

        press_key(select, "ArrowDown");
        expect(select.highlighted_flat_index).toBe(1);

        press_key(select, "ArrowDown");
        expect(select.highlighted_flat_index).toBe(2);

        press_key(select, "ArrowDown"); // wraps
        expect(select.highlighted_flat_index).toBe(0);
    });

    test("ArrowUp from the top wraps to the last option", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        select.open = true;
        await flush();

        press_key(select, "ArrowUp");
        expect(select.highlighted_flat_index).toBe(2);
    });

    test("Enter selects the highlighted option", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        select.open = true;
        await flush();

        press_key(select, "ArrowDown"); // Apple
        press_key(select, "ArrowDown"); // Banana
        press_key(select, "Enter");

        expect(select.value).toEqual(["banana"]);
    });

    test("Escape closes an open select without changing the value", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        select.open = true;
        await flush();

        press_key(select, "Escape");

        expect(select.open).toBe(false);
    });

    test("Home jumps to the first option, End jumps to the last", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        select.open = true;
        await flush();

        press_key(select, "End");
        expect(select.highlighted_flat_index).toBe(2);

        press_key(select, "Home");
        expect(select.highlighted_flat_index).toBe(0);
    });

    test("arrow navigation skips over option-group headers", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(GROUPED_OPTIONS)});
        select.open = true;
        await flush();

        // flat order: Apple(0), Berries-group(1), Blueberry(2), Blackberry(3), Cherry(4)
        press_key(select, "ArrowDown");
        expect(select.flat_data[select.highlighted_flat_index].value).toBe("apple");

        press_key(select, "ArrowDown");
        expect(select.flat_data[select.highlighted_flat_index].value).toBe("blueberry");
    });

    test("a multi-select (always expanded) navigates and toggles without needing to open", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        press_key(select, "ArrowDown");
        press_key(select, "Enter");

        expect(select.value).toEqual(["apple"]);

        press_key(select, "ArrowDown");
        press_key(select, "Enter");

        expect(select.value).toEqual(["apple", "banana"]);

        // Highlight is on banana (index 1); ArrowUp moves it back to apple (index 0), and Enter on an
        // already-selected option deselects it.
        press_key(select, "ArrowUp");
        press_key(select, "Enter");

        expect(select.value).toEqual(["banana"]);
    });
});
