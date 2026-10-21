import { describe, expect, test, vi } from "vitest";
import { GalaxySortableList } from "../components/GalaxySortableList.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-sortable-list")) {
    customElements.define("galaxy-sortable-list", GalaxySortableList);
}

const COLUMNS = [
    {key: "label", label: "Column", sortable: true},
    {key: "type", label: "Type"},
];

const ROWS = [
    {id: "machine", label: "Machine", type: "Text"},
    {id: "job", label: "Job", type: "Text"},
    {id: "parts", label: "Parts", type: "Integer"},
    {id: "rate", label: "Rate", type: "Float"},
];

const ROW_HEIGHT = 30;

/**
 * Creates and connects a <galaxy-sortable-list> and waits for it to finish creating.
 * @param {Object} options - columns, rows, and attributes.
 * @return {Promise<HTMLElement>}
 */
const create_list = async ({columns = COLUMNS, rows = ROWS, attributes = {}} = {}) => {
    let list = document.createElement("galaxy-sortable-list");

    for (let [name, value] of Object.entries(attributes)) {
        list.setAttribute(name, value);
    }

    list.columns = columns;
    list.rows = rows;
    document.body.appendChild(list);

    await flush();
    await flush();

    return list;
};

const get_table_rows = (list) => Array.from(list.shadowRoot.querySelectorAll("tbody tr.data-row"));
const get_labels = (list) => get_table_rows(list).map((table_row) => table_row.children[1].textContent);
const get_button = (list, row_index, selector) => get_table_rows(list)[row_index].querySelector(selector);

/**
 * Records every event of a kind the list dispatches.
 * @param {HTMLElement} list - The list.
 * @param {string} event_name - The event name.
 * @return {Object[]} - Each event's detail, in order.
 */
const record = (list, event_name) => {
    let details = [];

    list.addEventListener(event_name, (event) => details.push(event.detail));

    return details;
};

/**
 * Lays the rows out top to bottom, ROW_HEIGHT apart, wherever they currently sit in the body - jsdom does no layout of its own.
 * @param {HTMLElement} list - The list.
 */
const stub_row_layout = (list) => {
    for (let table_row of get_table_rows(list)) {
        vi.spyOn(table_row, "getBoundingClientRect").mockImplementation(() => {
            let position = get_table_rows(list).indexOf(table_row);

            return {top: position * ROW_HEIGHT, bottom: (position + 1) * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 500, width: 500};
        });
    }
};

/**
 * Dispatches a pointer event as a browser would.
 * @param {EventTarget} target - The target.
 * @param {string} type - The event type.
 * @param {number} client_y - The pointer's vertical position.
 */
const pointer = (target, type, client_y) => {
    target.dispatchEvent(new window.PointerEvent(type, {bubbles: true, composed: true, cancelable: true, pointerId: 1, button: 0, clientY: client_y}));
};

describe("controls", () => {
    test("each row has a drag handle before its cells and up and down buttons after, disabled at the ends", async () => {
        let list = await create_list();
        let table_rows = get_table_rows(list);

        expect(table_rows[0].firstElementChild.querySelector(".drag-handle").getAttribute("aria-label")).toBe("Reorder Machine");
        expect(table_rows[0].lastElementChild.classList.contains("move-cell")).toBe(true);
        expect(get_button(list, 0, ".move-up-action").disabled).toBe(true);
        expect(get_button(list, 0, ".move-down-action").disabled).toBe(false);
        expect(get_button(list, 3, ".move-down-action").disabled).toBe(true);
        expect(list.shadowRoot.querySelectorAll("thead th").length).toBe(4);
    });

    test("columns never sort, even with sortable and client-sort", async () => {
        let list = await create_list({attributes: {"client-sort": ""}});

        list.sort = [{key: "label", direction: "asc"}];
        await flush();

        expect(list.shadowRoot.querySelector(".sort-button")).toBeNull();
        expect(get_labels(list)).toEqual(["Machine", "Job", "Parts", "Rate"]);
    });

    test("hide-handle, hide-buttons, and readonly hide the controls", async () => {
        let list = await create_list({attributes: {"hide-handle": ""}});

        expect(list.shadowRoot.querySelector(".drag-handle")).toBeNull();
        expect(list.shadowRoot.querySelector(".move-up-action")).not.toBeNull();

        list.hide_buttons = true;
        await flush();

        expect(list.shadowRoot.querySelector(".move-up-action")).toBeNull();
        expect(list.shadowRoot.querySelectorAll("thead th").length).toBe(2);

        list.hide_handle = false;
        list.hide_buttons = false;
        list.readonly = true;
        await flush();

        expect(list.shadowRoot.querySelector(".drag-handle")).toBeNull();
        expect(list.shadowRoot.querySelector(".move-up-action")).toBeNull();
    });

    test("the empty state spans the control columns", async () => {
        let list = await create_list({rows: []});

        expect(list.shadowRoot.querySelector(".empty-state").colSpan).toBe(4);
    });
});

describe("moving rows", () => {
    test("the down button moves its row, keeps the same <tr>, and dispatches reorder with the new order", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");
        let machine_row = get_table_rows(list)[0];

        get_button(list, 0, ".move-down-action").click();

        expect(get_labels(list)).toEqual(["Job", "Machine", "Parts", "Rate"]);
        expect(get_table_rows(list)[1]).toBe(machine_row);
        expect(get_button(list, 1, ".move-up-action").disabled).toBe(false);
        expect(get_button(list, 0, ".move-up-action").disabled).toBe(true);
        expect(reorders).toHaveLength(1);
        expect(reorders[0]).toMatchObject({order: ["job", "machine", "parts", "rate"], from_index: 0, to_index: 1, row: ROWS[0]});
        expect(reorders[0].rows.map((row) => row.id)).toEqual(["job", "machine", "parts", "rate"]);
        expect(list.order).toEqual(["job", "machine", "parts", "rate"]);
    });

    test("focus stays on the moved row, moving to its other button at the end of the list", async () => {
        let list = await create_list();

        get_button(list, 2, ".move-down-action").click();

        expect(list.shadowRoot.activeElement).toBe(get_button(list, 3, ".move-up-action"));
    });

    test("move_row() and setting order move rows without an event", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");

        expect(list.move_row(3, 0)).toBe(true);
        expect(get_labels(list)).toEqual(["Rate", "Machine", "Job", "Parts"]);
        expect(list.move_row(0, 0)).toBe(false);

        list.order = ["parts", "job"];
        await flush();

        expect(list.order).toEqual(["parts", "job", "rate", "machine"]);
        expect(reorders).toHaveLength(0);
    });

    test("Alt+ArrowDown on a handle moves its row, keeps focus on the handle, and announces the move", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");
        let handle = get_button(list, 0, ".drag-handle");

        handle.focus();
        handle.dispatchEvent(new window.KeyboardEvent("keydown", {key: "ArrowDown", altKey: true, bubbles: true, composed: true, cancelable: true}));

        expect(get_labels(list)).toEqual(["Job", "Machine", "Parts", "Rate"]);
        expect(list.shadowRoot.activeElement).toBe(handle);
        expect(list.shadowRoot.querySelector("[aria-live]").textContent).toBe("Moved Machine to position 2 of 4.");
        expect(reorders).toHaveLength(1);
    });

    test("an arrow key without Alt does nothing", async () => {
        let list = await create_list();
        let handle = get_button(list, 0, ".drag-handle");

        handle.dispatchEvent(new window.KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, composed: true}));

        expect(get_labels(list)).toEqual(["Machine", "Job", "Parts", "Rate"]);
    });
});

describe("dragging", () => {
    test("dragging a handle past rows' midpoints moves its row live, and dropping dispatches reorder", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");
        let machine_row = get_table_rows(list)[0];
        let handle = get_button(list, 0, ".drag-handle");

        stub_row_layout(list);

        pointer(handle, "pointerdown", 15);
        expect(machine_row.classList.contains("dragging")).toBe(true);
        expect(list.hasAttribute("dragging")).toBe(true);

        pointer(handle, "pointermove", 80);
        expect(get_labels(list)).toEqual(["Job", "Parts", "Machine", "Rate"]);
        expect(reorders).toHaveLength(0);

        pointer(handle, "pointerup", 80);

        expect(get_table_rows(list)[2]).toBe(machine_row);
        expect(machine_row.classList.contains("dragging")).toBe(false);
        expect(list.order).toEqual(["job", "parts", "machine", "rate"]);
        expect(reorders).toHaveLength(1);
        expect(reorders[0]).toMatchObject({from_index: 0, to_index: 2});
    });

    test("pointercancel puts the row back, without an event", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");
        let handle = get_button(list, 0, ".drag-handle");

        stub_row_layout(list);

        pointer(handle, "pointerdown", 15);
        pointer(handle, "pointermove", 110);
        pointer(handle, "pointercancel", 110);

        expect(get_labels(list)).toEqual(["Machine", "Job", "Parts", "Rate"]);
        expect(reorders).toHaveLength(0);
    });

    test("Escape during a drag puts the row back, and later pointer events are ignored", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");
        let handle = get_button(list, 3, ".drag-handle");

        stub_row_layout(list);

        pointer(handle, "pointerdown", 105);
        pointer(handle, "pointermove", 10);
        expect(get_labels(list)).toEqual(["Rate", "Machine", "Job", "Parts"]);

        window.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));
        pointer(handle, "pointerup", 10);

        expect(get_labels(list)).toEqual(["Machine", "Job", "Parts", "Rate"]);
        expect(list.hasAttribute("dragging")).toBe(false);
        expect(reorders).toHaveLength(0);
    });

    test("dropping where it started dispatches nothing", async () => {
        let list = await create_list();
        let reorders = record(list, "reorder");
        let handle = get_button(list, 1, ".drag-handle");

        stub_row_layout(list);

        pointer(handle, "pointerdown", 45);
        pointer(handle, "pointermove", 50);
        pointer(handle, "pointerup", 50);

        expect(reorders).toHaveLength(0);
    });

    test("a readonly list cannot be dragged or moved from the keyboard", async () => {
        let list = await create_list();
        let handle = get_button(list, 0, ".drag-handle");

        list.readonly = true;
        await flush();

        pointer(handle, "pointerdown", 15);

        expect(list.drag_state).toBeNull();
    });
});

describe("item ids and form association", () => {
    test("id-key names the id field, and a row without it is identified by its original position", async () => {
        let list = await create_list({
            rows: [{key: "a", label: "A"}, {label: "B"}, {key: "c", label: "C"}],
            attributes: {"id-key": "key"},
        });

        list.move_row(1, 0);

        expect(list.order).toEqual([1, "a", "c"]);
    });

    test("the rows are copies: moving never changes the objects passed in", async () => {
        let rows = ROWS.map((row) => ({...row}));
        let list = await create_list({rows: rows});

        list.move_row(0, 3);
        list.rows[0].label = "Changed";

        expect(rows[0].label).toBe("Machine");
        expect(list.rows[0].label).toBe("Job");
    });

    test("with a name it submits the order as JSON, and reset restores the order the rows were last set in", async () => {
        let list = await create_list({rows: [], attributes: {name: "column_order"}});

        list.rows = ROWS;
        await flush();

        list.move_row(0, 2);

        expect(JSON.parse(list._internals._form_value)).toEqual(["job", "parts", "machine", "rate"]);

        list.formResetCallback();
        await flush();

        expect(list.order).toEqual(["machine", "job", "parts", "rate"]);
        expect(JSON.parse(list._internals._form_value)).toEqual(["machine", "job", "parts", "rate"]);
    });

    test("a restored form state reorders the rows", async () => {
        let list = await create_list();

        list.formStateRestoreCallback(JSON.stringify(["rate", "parts", "job", "machine"]));
        await flush();

        expect(get_labels(list)).toEqual(["Rate", "Parts", "Job", "Machine"]);
    });
});
