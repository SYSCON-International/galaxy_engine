import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { create_select, flush, GROUPED_OPTIONS, SIMPLE_OPTIONS } from "./test-helpers.js";

const MANY_OPTIONS = Array.from({length: 40}, (_, index) => ({text: `Option ${index}`, value: `option_${index}`, node_type: "Option"}));

/**
 * Gives an element a fixed clientHeight, since jsdom does no layout and reports 0 for every element.
 * @param {HTMLElement} element
 * @param {number} height
 */
const set_client_height = (element, height) => {
    Object.defineProperty(element, "clientHeight", {configurable: true, get: () => height});
};

describe("a select created out of sight renders a full list once it can be seen", () => {
    let resize_observers = [];

    beforeEach(() => {
        resize_observers = [];

        vi.stubGlobal("ResizeObserver", class {
            constructor(callback) {
                this.callback = callback;
                this.observed_elements = [];
                this.is_disconnected = false;
                resize_observers.push(this);
            }

            observe(element) {
                this.observed_elements.push(element);
            }

            disconnect() {
                this.is_disconnected = true;
            }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /**
     * Reports a new size to every live observer watching the given element, as the browser does when it is laid out.
     * @param {HTMLElement} element
     * @param {number} height
     */
    const resize = (element, height) => {
        for (let resize_observer of resize_observers) {
            if (!resize_observer.is_disconnected && resize_observer.observed_elements.includes(element)) {
                resize_observer.callback([{target: element, contentRect: {height: height}}]);
            }
        }
    };

    test("an inline multi-select created hidden grows its rows when its list gets a height", async () => {
        let multi_select = await create_select("multi-select", {"options-data": JSON.stringify(MANY_OPTIONS)});
        let list_element = multi_select.scroll_container.parentElement;

        // Hidden: no height, so only the buffer rows.
        expect(multi_select.option_elements_pool.length).toBeLessThanOrEqual(2);

        set_client_height(list_element, 210);
        set_client_height(multi_select.scroll_container, 210);
        resize(list_element, 210);

        let rows_needed = Math.ceil(210 / multi_select.option_height);

        expect(multi_select.option_elements_pool.length).toBeGreaterThanOrEqual(rows_needed);
        expect(multi_select.options_layer.children.length).toBeGreaterThanOrEqual(rows_needed);
    });

    test("growing keeps the current search filter", async () => {
        let multi_select = await create_select("multi-select", {"options-data": JSON.stringify(MANY_OPTIONS), "search-enabled": ""});
        let list_element = multi_select.scroll_container.parentElement;

        multi_select.input_element.value = "Option 1";
        multi_select.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));

        let filtered_count = multi_select.flat_data.length;

        expect(filtered_count).toBeLessThan(MANY_OPTIONS.length);

        set_client_height(list_element, 210);
        resize(list_element, 210);

        expect(multi_select.flat_data.length).toBe(filtered_count);
    });

    test("the observer is disconnected when the select is removed", async () => {
        let multi_select = await create_select("multi-select", {"options-data": JSON.stringify(MANY_OPTIONS)});
        let live_observers = resize_observers.filter((resize_observer) => !resize_observer.is_disconnected);

        expect(live_observers.length).toBeGreaterThan(0);

        multi_select.remove();
        await flush();

        expect(resize_observers.every((resize_observer) => resize_observer.is_disconnected)).toBe(true);
    });
});

describe("without a ResizeObserver, scrolling still fills the list", () => {
    test("a scroll after the list gets a height grows the rows", async () => {
        vi.stubGlobal("ResizeObserver", undefined);

        let multi_select = await create_select("multi-select", {"options-data": JSON.stringify(MANY_OPTIONS)});

        set_client_height(multi_select.scroll_container.parentElement, 210);
        multi_select.scroll_container.dispatchEvent(new Event("scroll"));

        expect(multi_select.options_layer.children.length).toBeGreaterThanOrEqual(Math.ceil(210 / multi_select.option_height));

        vi.unstubAllGlobals();
    });
});

describe("options are indented for an icon column only when the list has one", () => {
    const rendered_padding = (select) => Array.from(select.options_layer.children).map((option_element) => option_element.style.paddingLeft);

    test("a list with no left icons is not indented for them", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        select.open = true;
        await flush();

        expect(rendered_padding(select).length).toBeGreaterThan(0);
        expect(rendered_padding(select).every((padding) => padding === "calc(0px + 0.5rem)")).toBe(true);
    });

    test("when any option has left icons, every row keeps the icon column so they line up", async () => {
        let options = [{...SIMPLE_OPTIONS[0], left_icons: ["fa-solid fa-star"]}, SIMPLE_OPTIONS[1], SIMPLE_OPTIONS[2]];
        let select = await create_select("select", {"options-data": JSON.stringify(options)});

        select.open = true;
        await flush();

        expect(rendered_padding(select).every((padding) => padding === "calc(36px + 0.5rem)")).toBe(true);
    });

    test("group indentation is kept without the icon column", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(GROUPED_OPTIONS)});

        // Room for every row, so the group's children are rendered too.
        set_client_height(select.scroll_container, 210);
        set_client_height(select.scroll_container.parentElement, 210);
        select.open = true;
        await flush();

        let child_element = select.options_layer.querySelector("[value=\"blueberry\"]");

        expect(child_element.style.paddingLeft).toBe("calc(36px + 0.5rem)");
    });
});
