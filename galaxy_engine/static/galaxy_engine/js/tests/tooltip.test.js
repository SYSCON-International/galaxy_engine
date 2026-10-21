import { afterEach, describe, expect, test, vi } from "vitest";
import { GalaxyTable } from "../components/GalaxyTable.js";
import { GalaxyTooltip } from "../components/GalaxyTooltip.js";
import { GalaxyTooltipController } from "../GalaxyTooltipController.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of Object.entries({"galaxy-tooltip": GalaxyTooltip, "galaxy-table": GalaxyTable})) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const BUBBLE_SIZE = {width: 100, height: 30};

afterEach(() => {
    vi.useRealTimers();
    GalaxyTooltipController.open_controller?.hide();
    document.body.innerHTML = "";
});

/**
 * Stubs an element's getBoundingClientRect, since jsdom does no layout.
 * @param {Element} element - The element.
 * @param {Object} rect - top, left, width, and height.
 */
const stub_rect = (element, rect) => {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({...rect, bottom: rect.top + rect.height, right: rect.left + rect.width});
};

/**
 * Creates a wrapping tooltip around a button and waits for it to finish creating. Its anchor sits at the given rect, in a 1000 x 800 viewport.
 * @param {Object} attributes - The tooltip's attributes.
 * @param {string} button_html - The wrapped button's markup.
 * @param {Object} anchor_rect - The anchor's rect.
 * @return {Promise<{tooltip: HTMLElement, button: HTMLElement, bubble: HTMLElement}>}
 */
const create_tooltip = async (attributes = {text: "Delete row"}, button_html = "<button type=\"button\"><svg></svg></button>", anchor_rect = {top: 400, left: 450, width: 40, height: 30}) => {
    window.innerWidth = 1000;
    window.innerHeight = 800;

    let tooltip = document.createElement("galaxy-tooltip");

    for (let [name, value] of Object.entries(attributes)) {
        tooltip.setAttribute(name, value);
    }

    tooltip.innerHTML = button_html;
    document.body.appendChild(tooltip);

    await flush();
    await flush();

    let bubble = tooltip.shadowRoot.querySelector(".galaxy-tooltip-bubble");

    stub_rect(tooltip, anchor_rect);
    stub_rect(bubble, {top: 0, left: 0, ...BUBBLE_SIZE});

    return {tooltip: tooltip, button: tooltip.querySelector("button"), bubble: bubble};
};

/**
 * Dispatches a pointer event as a browser would.
 * @param {EventTarget} target - The target.
 * @param {string} type - The event type.
 * @param {Object} options - Extra event options: pointerType, clientX, clientY, relatedTarget.
 */
const pointer = (target, type, options = {}) => {
    target.dispatchEvent(new window.PointerEvent(type, {bubbles: true, composed: true, cancelable: true, pointerId: 1, pointerType: "mouse", ...options}));
};

describe("hover", () => {
    test("shows after the delay, beside the trigger, and hides once the pointer leaves", async () => {
        let {tooltip, button, bubble} = await create_tooltip();

        vi.useFakeTimers();
        pointer(button, "pointerover");

        vi.advanceTimersByTime(399);
        expect(bubble._is_popover_open).toBeFalsy();

        vi.advanceTimersByTime(1);
        expect(bubble._is_popover_open).toBe(true);
        expect(tooltip.open).toBe(true);
        expect(bubble.textContent).toBe("Delete row");
        expect(bubble.dataset.placement).toBe("top");
        expect(bubble.style.top).toBe("362px");
        expect(bubble.style.left).toBe("420px");

        pointer(button, "pointerout", {relatedTarget: document.body});
        vi.advanceTimersByTime(100);

        expect(bubble._is_popover_open).toBe(false);
    });

    test("leaving before the delay never shows it", async () => {
        let {button, bubble} = await create_tooltip();

        vi.useFakeTimers();
        pointer(button, "pointerover");
        vi.advanceTimersByTime(200);
        pointer(button, "pointerout", {relatedTarget: document.body});
        vi.advanceTimersByTime(1000);

        expect(bubble._is_popover_open).toBeFalsy();
    });

    test("stays open while the pointer moves onto the bubble", async () => {
        let {button, bubble} = await create_tooltip();

        vi.useFakeTimers();
        pointer(button, "pointerover");
        vi.advanceTimersByTime(400);

        pointer(button, "pointerout", {relatedTarget: bubble});
        bubble.dispatchEvent(new window.PointerEvent("pointerenter", {pointerType: "mouse"}));
        vi.advanceTimersByTime(1000);

        expect(bubble._is_popover_open).toBe(true);

        bubble.dispatchEvent(new window.PointerEvent("pointerleave", {pointerType: "mouse", relatedTarget: document.body}));
        vi.advanceTimersByTime(100);

        expect(bubble._is_popover_open).toBe(false);
    });

    test("the delay attribute changes how long the pointer must rest", async () => {
        let {button, bubble} = await create_tooltip({text: "Delete row", delay: "0"});

        vi.useFakeTimers();
        pointer(button, "pointerover");

        expect(bubble._is_popover_open).toBe(true);
    });

    test("Escape hides it", async () => {
        let {tooltip} = await create_tooltip();

        tooltip.show();
        window.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));

        expect(tooltip.open).toBe(false);
    });

    test("only one tooltip shows at a time", async () => {
        let first = await create_tooltip({text: "First"});
        let second = await create_tooltip({text: "Second"});

        first.tooltip.show();
        second.tooltip.show();

        expect(first.tooltip.open).toBe(false);
        expect(second.tooltip.open).toBe(true);
    });

    test("a disabled tooltip never shows", async () => {
        let {tooltip, button, bubble} = await create_tooltip({text: "Delete row", disabled: ""});

        vi.useFakeTimers();
        pointer(button, "pointerover");
        vi.advanceTimersByTime(1000);
        tooltip.show();

        expect(bubble._is_popover_open).toBeFalsy();
    });
});

describe("keyboard focus", () => {
    test("shows at once on keyboard focus and hides on blur", async () => {
        let {tooltip, button} = await create_tooltip();

        vi.spyOn(button, "matches").mockImplementation((selector) => selector === ":focus-visible");
        button.focus();

        expect(tooltip.open).toBe(true);

        button.blur();

        expect(tooltip.open).toBe(false);
    });

    test("focus from a click does not show it", async () => {
        let {tooltip, button} = await create_tooltip();

        vi.spyOn(button, "matches").mockReturnValue(false);
        button.focus();

        expect(tooltip.open).toBe(false);
    });
});

describe("touch", () => {
    test("a held touch shows it, swallows the click the release causes, and it lingers before hiding", async () => {
        let {tooltip, button} = await create_tooltip();
        let clicks = [];

        button.addEventListener("click", () => clicks.push("click"));

        vi.useFakeTimers();
        pointer(button, "pointerdown", {pointerType: "touch", clientX: 470, clientY: 415});
        vi.advanceTimersByTime(500);

        expect(tooltip.open).toBe(true);

        let context_menu = new window.MouseEvent("contextmenu", {bubbles: true, composed: true, cancelable: true});

        button.dispatchEvent(context_menu);
        expect(context_menu.defaultPrevented).toBe(true);

        pointer(button, "pointerup", {pointerType: "touch"});
        button.click();

        expect(clicks).toEqual([]);

        vi.advanceTimersByTime(1499);
        expect(tooltip.open).toBe(true);

        vi.advanceTimersByTime(1);
        expect(tooltip.open).toBe(false);

        // Only the one click was swallowed.
        vi.advanceTimersByTime(1000);
        button.click();

        expect(clicks).toEqual(["click"]);
    });

    test("the next tap anywhere hides a lingering tooltip", async () => {
        let {tooltip, button} = await create_tooltip();

        vi.useFakeTimers();
        pointer(button, "pointerdown", {pointerType: "touch", clientX: 470, clientY: 415});
        vi.advanceTimersByTime(500);
        pointer(button, "pointerup", {pointerType: "touch"});

        pointer(document.body, "pointerdown", {pointerType: "touch", clientX: 10, clientY: 10});

        expect(tooltip.open).toBe(false);

        // Lets the swallowed-click window close, as it does after any hold.
        vi.advanceTimersByTime(1000);
    });

    test("moving the finger or lifting it early cancels the hold, and a quick tap still clicks", async () => {
        let {tooltip, button} = await create_tooltip();
        let clicks = [];

        button.addEventListener("click", () => clicks.push("click"));

        vi.useFakeTimers();
        pointer(button, "pointerdown", {pointerType: "touch", clientX: 470, clientY: 415});
        pointer(button, "pointermove", {pointerType: "touch", clientX: 470, clientY: 440});
        vi.advanceTimersByTime(600);

        expect(tooltip.open).toBe(false);

        pointer(button, "pointerdown", {pointerType: "touch", clientX: 470, clientY: 415});
        vi.advanceTimersByTime(200);
        pointer(button, "pointerup", {pointerType: "touch"});
        button.click();
        vi.advanceTimersByTime(600);

        expect(tooltip.open).toBe(false);
        expect(clicks).toEqual(["click"]);
    });
});

describe("placement and the viewport", () => {
    test("flips to the other side when there is no room", async () => {
        let {tooltip, bubble} = await create_tooltip({text: "Delete row"}, undefined, {top: 10, left: 450, width: 40, height: 30});

        tooltip.show();

        expect(bubble.dataset.placement).toBe("bottom");
        expect(bubble.style.top).toBe("48px");
    });

    test("the placement attribute picks the side", async () => {
        let {tooltip, bubble} = await create_tooltip({text: "Delete row", placement: "right"});

        tooltip.show();

        expect(bubble.dataset.placement).toBe("right");
        expect(bubble.style.left).toBe("498px");
        expect(bubble.style.top).toBe("400px");
    });

    test("is kept inside the viewport, with the arrow still pointing at the trigger", async () => {
        let {tooltip, bubble} = await create_tooltip({text: "Delete row"}, undefined, {top: 400, left: 960, width: 30, height: 30});

        tooltip.show();

        // Centered it would end at 1025; it is held 8px inside the 1000px viewport, and the arrow moves to the trigger's center (975 - 892).
        expect(bubble.style.left).toBe("892px");
        expect(bubble.style.getPropertyValue("--galaxy-tooltip-arrow-offset")).toBe("83px");
    });

    test("hides once the trigger scrolls out of view", async () => {
        let {tooltip} = await create_tooltip();

        tooltip.show();
        tooltip.getBoundingClientRect.mockReturnValue({top: -100, bottom: -70, left: 450, right: 490, width: 40, height: 30});
        window.dispatchEvent(new window.Event("scroll"));

        expect(tooltip.open).toBe(false);
    });
});

describe("content and attachment", () => {
    test("slotted content wins over text, and is what screen readers get", async () => {
        let {tooltip, button, bubble} = await create_tooltip(
            {text: "Plain"}, "<button type=\"button\"><svg></svg></button><span slot=\"content\"><b>PVAC</b> Process Variable Analysis Configuration</span>"
        );

        tooltip.show();

        let slot = bubble.querySelector("slot[name='content']");

        expect(slot.assignedElements()[0].textContent).toBe("PVAC Process Variable Analysis Configuration");
        expect(bubble.textContent).not.toContain("Plain");
        expect(button.getAttribute("aria-label")).toBe("PVAC Process Variable Analysis Configuration");
    });

    test("an icon-only trigger is labeled by the tooltip; a trigger with text is described by it", async () => {
        let icon_only = await create_tooltip();
        let with_text = await create_tooltip({text: "Removes the row for good"}, "<button type=\"button\">Remove</button>");

        expect(icon_only.button.getAttribute("aria-label")).toBe("Delete row");
        expect(with_text.button.getAttribute("aria-description")).toBe("Removes the row for good");
        expect(with_text.button.hasAttribute("aria-label")).toBe(false);
    });

    test("a label the trigger already has is left alone, and only what the tooltip set is removed", async () => {
        let {tooltip, button} = await create_tooltip({text: "Delete row"}, "<button type=\"button\" aria-label=\"Delete\"></button>");

        expect(button.getAttribute("aria-label")).toBe("Delete");
        expect(button.getAttribute("aria-description")).toBe("Delete row");

        tooltip.remove();
        await flush();

        expect(button.getAttribute("aria-label")).toBe("Delete");
        expect(button.hasAttribute("aria-description")).toBe(false);
    });

    test("changing the text updates the label", async () => {
        let {tooltip, button} = await create_tooltip();

        tooltip.text = "Remove row";
        await flush();

        expect(button.getAttribute("aria-label")).toBe("Remove row");
    });

    test("for points it at another element, which it follows when for changes", async () => {
        window.innerWidth = 1000;
        window.innerHeight = 800;
        document.body.innerHTML = `
            <button id="first_button" type="button"></button>
            <button id="second_button" type="button"></button>
            <galaxy-tooltip for="first_button" text="Save"></galaxy-tooltip>
        `;
        await flush();
        await flush();

        let tooltip = document.querySelector("galaxy-tooltip");
        let first_button = document.getElementById("first_button");
        let second_button = document.getElementById("second_button");

        stub_rect(first_button, {top: 400, left: 100, width: 40, height: 30});
        stub_rect(second_button, {top: 400, left: 600, width: 40, height: 30});

        expect(first_button.getAttribute("aria-label")).toBe("Save");

        vi.useFakeTimers();
        pointer(first_button, "pointerover");
        vi.advanceTimersByTime(400);

        expect(tooltip.open).toBe(true);

        tooltip.hide();
        vi.useRealTimers();
        tooltip.for = "second_button";
        await flush();

        expect(first_button.hasAttribute("aria-label")).toBe(false);
        expect(second_button.getAttribute("aria-label")).toBe("Save");

        vi.useFakeTimers();
        pointer(first_button, "pointerover");
        vi.advanceTimersByTime(400);

        expect(tooltip.open).toBe(false);

        pointer(second_button, "pointerover");
        vi.advanceTimersByTime(400);

        expect(tooltip.open).toBe(true);
    });

    test("removing the tooltip stops it listening and removes its bubble", async () => {
        let {tooltip, button} = await create_tooltip();
        let controller = tooltip.tooltip_controller;

        tooltip.remove();
        await flush();

        vi.useFakeTimers();
        pointer(button, "pointerover");
        vi.advanceTimersByTime(1000);

        expect(controller.is_open).toBe(false);
        expect(controller.bubble.isConnected).toBe(false);
    });
});

describe("table tooltips", () => {
    /**
     * Creates and connects a <galaxy-table> with the given tooltips.
     * @param {Object} options - row_tooltip and a status column tooltip.
     * @return {Promise<HTMLElement>}
     */
    const create_table = async ({row_tooltip = null, status_tooltip = undefined} = {}) => {
        window.innerWidth = 1000;
        window.innerHeight = 800;

        let table = document.createElement("galaxy-table");

        table.columns = [{key: "name", label: "Machine"}, {key: "status", label: "Status", tooltip: status_tooltip}];
        table.rows = [{name: "Press 1", status: "Running"}, {name: "Press 2", status: "Down"}];
        table.row_tooltip = row_tooltip;
        document.body.appendChild(table);

        await flush();
        await flush();

        return table;
    };

    const get_table_rows = (table) => Array.from(table.shadowRoot.querySelectorAll("tbody tr.data-row"));

    test("a table with no tooltips creates none", async () => {
        let table = await create_table();

        expect(table.tooltip_controller).toBeNull();
        expect(table.shadowRoot.querySelector(".galaxy-tooltip-bubble")).toBeNull();
    });

    test("row_tooltip shows the hovered row's tooltip, and a column tooltip wins within its cells", async () => {
        let table = await create_table({
            row_tooltip: (row) => `${row.name} - click for details`,
            status_tooltip: (value) => value === "Down" ? "Down since 06:12" : "",
        });
        let table_rows = get_table_rows(table);
        let bubble = table.shadowRoot.querySelector(".galaxy-tooltip-bubble");

        for (let element of [...table_rows, ...table_rows[1].cells]) {
            stub_rect(element, {top: 200, left: 100, width: 300, height: 30});
        }

        stub_rect(bubble, {top: 0, left: 0, ...BUBBLE_SIZE});

        vi.useFakeTimers();
        pointer(table_rows[0].cells[0], "pointerover");
        vi.advanceTimersByTime(400);

        expect(bubble._is_popover_open).toBe(true);
        expect(bubble.textContent).toBe("Press 1 - click for details");
        expect(table.tooltip_controller.anchor).toBe(table_rows[0]);

        // Moving on while one is up shows the next at once.
        pointer(table_rows[1].cells[1], "pointerover");

        expect(bubble.textContent).toBe("Down since 06:12");
        expect(table.tooltip_controller.anchor).toBe(table_rows[1].cells[1]);

        // A cell whose column tooltip is empty falls back to the row's.
        pointer(table_rows[0].cells[1], "pointerover");

        expect(bubble.textContent).toBe("Press 1 - click for details");
    });

    test("tooltips are given to screen readers as aria-description at render", async () => {
        let table = await create_table({row_tooltip: (row) => `${row.name} details`, status_tooltip: (value) => value === "Down" ? "Down since 06:12" : null});
        let table_rows = get_table_rows(table);

        expect(table_rows[0].getAttribute("aria-description")).toBe("Press 1 details");
        expect(table_rows[1].cells[1].getAttribute("aria-description")).toBe("Down since 06:12");
        expect(table_rows[0].cells[1].hasAttribute("aria-description")).toBe(false);
    });

    test("a sortable header's sort button explains shift-clicking in a tooltip", async () => {
        let table = document.createElement("galaxy-table");

        table.columns = [{key: "name", label: "Machine", sortable: true}];
        table.rows = [{name: "Press 1"}];
        document.body.appendChild(table);
        await flush();
        await flush();

        let sort_button = table.shadowRoot.querySelector(".sort-button");

        expect(sort_button.hasAttribute("title")).toBe(false);

        vi.useFakeTimers();
        pointer(sort_button.querySelector(".label"), "pointerover");
        vi.advanceTimersByTime(400);

        expect(table.tooltip_controller.anchor).toBe(sort_button);
        expect(table.shadowRoot.querySelector(".galaxy-tooltip-bubble").textContent).toBe("Click to sort, shift-click to add to the sort");
    });

    test("clearing every tooltip removes the table's tooltip", async () => {
        let table = await create_table({row_tooltip: (row) => row.name});

        expect(table.tooltip_controller).not.toBeNull();

        table.row_tooltip = null;

        expect(table.tooltip_controller).toBeNull();
        expect(get_table_rows(table)[0].hasAttribute("aria-description")).toBe(false);
    });
});
