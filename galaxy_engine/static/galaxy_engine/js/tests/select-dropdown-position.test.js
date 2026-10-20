import { describe, expect, test, vi } from "vitest";
import { create_select, flush, SIMPLE_OPTIONS } from "./test-helpers.js";

/**
 * Stubs an element's getBoundingClientRect, since jsdom does no layout.
 * @param {Element} element - The element.
 * @param {Object} rect - The rect to report: top, left, width, height.
 */
const stub_rect = (element, rect) => {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({...rect, bottom: rect.top + rect.height, right: rect.left + rect.width});
};

/**
 * Creates a single select with options, its input stubbed at the given viewport position, and the window at the given height.
 * @param {Object} input_rect - The input's viewport rect.
 * @param {number} window_height - The viewport height.
 * @param {Object<string, string>} attributes - Extra attributes.
 * @return {Promise<HTMLElement>}
 */
const create_positioned_select = async (input_rect, window_height = 800, attributes = {}) => {
    window.innerHeight = window_height;

    let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS), ...attributes});

    stub_rect(select.input_element, input_rect);

    return select;
};

describe("floating single-select dropdown", () => {
    test("the options element is a manual popover, shown on open and hidden on close", async () => {
        let select = await create_positioned_select({top: 100, left: 400, width: 270, height: 38});

        expect(select.options_element.getAttribute("popover")).toBe("manual");
        expect(select.options_element._is_popover_open).toBeFalsy();

        select.input_element.click();
        await flush();

        expect(select.open).toBe(true);
        expect(select.options_element._is_popover_open).toBe(true);

        select.close_options();
        await flush();

        expect(select.options_element._is_popover_open).toBe(false);
    });

    test("opens below the input, in viewport coordinates, matching the input's width", async () => {
        let select = await create_positioned_select({top: 100, left: 400, width: 270, height: 38});

        select.open = true;
        await flush();

        let dropdown_height = parseFloat(select.options_element.style.height);

        expect(select.options_element.style.top).toBe("138px");
        expect(select.options_element.style.left).toBe("400px");
        expect(select.options_element.style.width).toBe("270px");
        expect(dropdown_height).toBeGreaterThan(0);
        expect(dropdown_height).toBeLessThanOrEqual(210);
        expect(select.scroll_container.style.height).toBe(select.options_element.style.height);
    });

    test("opens above the input when there is not room below but there is above", async () => {
        let select = await create_positioned_select({top: 700, left: 50, width: 200, height: 38}, 800);

        select.open = true;
        await flush();

        let dropdown_height = parseFloat(select.options_element.style.height);

        expect(select.options_element.style.top).toBe(`${700 - dropdown_height}px`);
    });

    test("stays below when neither side has room but below has more", async () => {
        let select = await create_positioned_select({top: 40, left: 50, width: 200, height: 38}, 200);

        select.open = true;
        await flush();

        expect(select.options_element.style.top).toBe("78px");
    });

    test("follows the input on scroll", async () => {
        let select = await create_positioned_select({top: 100, left: 400, width: 270, height: 38});

        select.open = true;
        await flush();

        stub_rect(select.input_element, {top: 60, left: 400, width: 270, height: 38});
        window.dispatchEvent(new window.Event("scroll"));

        expect(select.options_element.style.top).toBe("98px");
    });

    test("opening one select hides another's popover", async () => {
        let first_select = await create_positioned_select({top: 100, left: 0, width: 200, height: 38});
        let second_select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        first_select.open = true;
        await flush();
        second_select.open = true;
        await flush();

        expect(first_select.open).toBe(false);
        expect(first_select.options_element._is_popover_open).toBe(false);
        expect(second_select.options_element._is_popover_open).toBe(true);
    });

    test("an open select created in markup shows its popover on create", async () => {
        let select = await create_positioned_select({top: 100, left: 0, width: 200, height: 38}, 800, {open: ""});

        expect(select.options_element._is_popover_open).toBe(true);
    });

    test("removing an open select hides its popover, and reconnecting it open shows it again", async () => {
        let select = await create_positioned_select({top: 100, left: 0, width: 200, height: 38});

        select.open = true;
        await flush();
        select.remove();
        await flush();

        expect(select.is_dropdown_popover_shown).toBe(false);

        document.body.appendChild(select);
        await flush();

        expect(select.options_element.getAttribute("popover")).toBe("manual");
        expect(select.options_element._is_popover_open).toBe(true);
    });

    test("anchor-dropdown puts the list in the page, and removing it floats the list again", async () => {
        let select = await create_positioned_select({top: 100, left: 400, width: 270, height: 38});

        select.open = true;
        await flush();
        select.anchor_dropdown = true;
        await flush();

        expect(select.options_element.hasAttribute("popover")).toBe(false);
        expect(select.options_element.style.top).toBe("");
        expect(select.options_element.style.left).toBe("");

        select.anchor_dropdown = false;
        await flush();

        expect(select.options_element.getAttribute("popover")).toBe("manual");
        expect(select.options_element._is_popover_open).toBe(true);
    });

    test("a multi-select's list is not a popover", async () => {
        let select = await create_select("multi-select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});

        select.open = true;
        await flush();

        expect(select.options_element.hasAttribute("popover")).toBe(false);
        expect(select.options_element.style.top).toBe("");
    });
});
