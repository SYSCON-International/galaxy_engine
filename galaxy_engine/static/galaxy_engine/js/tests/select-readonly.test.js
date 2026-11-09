import { describe, expect, test } from "vitest";
import { create_select, flush, press_key, SIMPLE_OPTIONS } from "./test-helpers.js";

/**
 * T03B2-F1: while readonly, a galaxy-select or galaxy-multi-select ignores the user's selection - an option clicked, or the highlighted row chosen with Enter - but keeps
 * focus, opening and highlighting, and still takes a value from code or a reset.
 */

const OPTIONS_JSON = JSON.stringify(SIMPLE_OPTIONS);

/**
 * Counts the change events an element dispatches.
 * @param {HTMLElement} element
 * @return {{count: number}}
 */
const count_changes = (element) => {
    let counter = {count: 0};
    element.addEventListener("change", () => {
        counter.count += 1;
    });

    return counter;
};

/**
 * The rendered option row for a value - the element a mouse click lands on, wired by update_option_element. jsdom has no layout, so only the first rows are rendered:
 * the tests click "apple", the first option.
 * @param {HTMLElement} select
 * @param {string} value
 * @return {HTMLElement}
 */
const option_row = (select, value) => {
    let row = select.option_elements_pool.find((element) => element.getAttribute("role") === "option" && element.getAttribute("value") === value);

    if (!row) {
        throw new Error(`No rendered row for "${value}".`);
    }

    return row;
};

describe("a readonly galaxy-select", () => {
    test("Enter on a highlighted row selects nothing and fires no change, while the keyboard still opens the list and moves the highlight", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: "apple", readonly: ""});
        let changes = count_changes(select);

        press_key(select, "ArrowDown");
        await flush();
        press_key(select, "ArrowDown");
        let highlighted_value = select.flat_data[select.highlighted_flat_index]?.value;
        press_key(select, "Enter");
        await flush();

        expect(select.open).toBe(true);
        expect(highlighted_value).toBe("banana");
        expect(select.value).toEqual(["apple"]);
        expect(changes.count).toBe(0);
    });

    test("a click on an option in the open list selects nothing and fires no change", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: "banana", readonly: ""});
        let changes = count_changes(select);

        select.open = true;
        await flush();
        option_row(select, "apple").click();
        await flush();

        expect(select.value).toEqual(["banana"]);
        expect(select.input_element.value).toBe("Banana");
        expect(changes.count).toBe(0);
    });

    test("a value from code still changes it, without a change event", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: "apple", readonly: ""});
        let changes = count_changes(select);

        select.value = "cherry";
        await flush();

        expect(select.value).toEqual(["cherry"]);
        expect(select.input_element.value).toBe("Cherry");
        expect(changes.count).toBe(0);
    });

    test("removing readonly makes a click select again, with one change event", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: "banana", readonly: ""});
        let changes = count_changes(select);

        select.readonly = false;
        select.open = true;
        await flush();
        option_row(select, "apple").click();
        await flush();

        expect(select.value).toEqual(["apple"]);
        expect(changes.count).toBe(1);
    });

    test("after being removed and re-appended it is still readonly to the user", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: "banana", readonly: ""});
        let changes = count_changes(select);

        select.remove();
        document.body.appendChild(select);
        await flush();
        select.open = true;
        await flush();
        option_row(select, "apple").click();
        await flush();

        expect(select.value).toEqual(["banana"]);
        expect(changes.count).toBe(0);
    });
});

describe("a readonly galaxy-multi-select", () => {
    test("a click on an unselected option does not add it, and fires no change", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, value: "[\"banana\"]", readonly: ""});
        let changes = count_changes(select);

        option_row(select, "apple").click();
        await flush();

        expect(select.value).toEqual(["banana"]);
        expect(option_row(select, "apple").hasAttribute("selected")).toBe(false);
        expect(changes.count).toBe(0);
    });

    test("a click on a selected option does not remove it, and fires no change", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, value: "[\"apple\"]", readonly: ""});
        let changes = count_changes(select);

        option_row(select, "apple").click();
        await flush();

        expect(select.value).toEqual(["apple"]);
        expect(option_row(select, "apple").hasAttribute("selected")).toBe(true);
        expect(changes.count).toBe(0);
    });

    test("with search-enabled, Enter on a highlighted row toggles nothing", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, value: "[\"apple\"]", "search-enabled": "", readonly: ""});
        let changes = count_changes(select);

        press_key(select.input_element, "ArrowDown");
        press_key(select.input_element, "ArrowDown");
        press_key(select.input_element, "Enter");
        await flush();

        expect(select.highlighted_flat_index).toBeGreaterThanOrEqual(0);
        expect(select.value).toEqual(["apple"]);
        expect(changes.count).toBe(0);
    });

    test("a value from code still changes it", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, value: "[\"apple\"]", readonly: ""});

        select.value = JSON.stringify(["banana", "cherry"]);
        await flush();

        expect(select.value).toEqual(["banana", "cherry"]);
    });
});

describe("without readonly, user selection is unchanged", () => {
    test("a multi-select click toggles the option on and off, firing change each time, and keeps selection order", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, value: "[\"cherry\"]"});
        let changes = count_changes(select);

        option_row(select, "apple").click();
        await flush();
        let after_adding = select.value;

        option_row(select, "apple").click();
        await flush();

        expect(after_adding).toEqual(["cherry", "apple"]);
        expect(select.value).toEqual(["cherry"]);
        expect(changes.count).toBe(2);
    });

    test("a select picks the highlighted row with Enter, firing one change", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, value: "apple"});
        let changes = count_changes(select);

        press_key(select, "ArrowDown");
        await flush();
        press_key(select, "ArrowDown");
        press_key(select, "Enter");
        await flush();

        expect(select.value).toEqual(["banana"]);
        expect(changes.count).toBe(1);
    });
});
