import { afterEach, describe, expect, test, vi } from "vitest";
import { GalaxyEditableTable } from "../components/GalaxyEditableTable.js";
import { GalaxyPagination } from "../components/GalaxyPagination.js";
import { GalaxySortableList } from "../components/GalaxySortableList.js";
import { GalaxyTable } from "../components/GalaxyTable.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

const COMPONENTS = {
    "galaxy-pagination": GalaxyPagination,
    "galaxy-table": GalaxyTable,
    "galaxy-editable-table": GalaxyEditableTable,
    "galaxy-sortable-list": GalaxySortableList,
    "galaxy-text-input": GalaxyTextInput,
};

for (let [tag_name, component_class] of Object.entries(COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
});

/**
 * Creates and connects a <galaxy-pagination> and waits for it to finish creating.
 * @param {Object} attributes - Its attributes.
 * @return {Promise<HTMLElement>}
 */
const create_pagination = async (attributes = {"page-count": "20"}) => {
    let pagination = document.createElement("galaxy-pagination");

    for (let [name, value] of Object.entries(attributes)) {
        pagination.setAttribute(name, value);
    }

    document.body.appendChild(pagination);

    await flush();
    await flush();

    return pagination;
};

const get = (pagination, selector) => pagination.shadowRoot.querySelector(selector);
const get_numbers = (pagination) => Array.from(pagination.shadowRoot.querySelectorAll(".page-numbers li")).map((item) => item.textContent);

/**
 * Records every page_change the pagination dispatches.
 * @param {HTMLElement} pagination - The pagination.
 * @return {Object[]} - Each event's detail, in order.
 */
const record_page_changes = (pagination) => {
    let details = [];

    pagination.addEventListener("page_change", (event) => details.push(event.detail));

    return details;
};

const rows_of = (count) => Array.from({length: count}, (_value, index) => ({id: index + 1, name: `Machine ${index + 1}`}));

describe("page numbers", () => {
    test("every page shows when there are few, with no ellipses", () => {
        expect(GalaxyPagination.get_page_items(3, 7, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(GalaxyPagination.get_page_items(1, 1, 1)).toEqual([1]);
        expect(GalaxyPagination.get_page_items(1, 0, 1)).toEqual([]);
    });

    test("the first and last pages show, with the current page and its siblings between ellipses", () => {
        expect(GalaxyPagination.get_page_items(10, 20, 1)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
        expect(GalaxyPagination.get_page_items(10, 20, 2)).toEqual([1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20]);
    });

    test("near either end the window widens instead of shrinking, so the length stays the same, and an ellipsis never stands for a single page", () => {
        expect(GalaxyPagination.get_page_items(1, 20, 1)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
        expect(GalaxyPagination.get_page_items(4, 20, 1)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
        expect(GalaxyPagination.get_page_items(5, 20, 1)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 20]);
        expect(GalaxyPagination.get_page_items(17, 20, 1)).toEqual([1, "ellipsis", 16, 17, 18, 19, 20]);
        expect(GalaxyPagination.get_page_items(20, 20, 1)).toEqual([1, "ellipsis", 16, 17, 18, 19, 20]);

        for (let page = 1; page <= 20; page++) {
            expect(GalaxyPagination.get_page_items(page, 20, 1)).toHaveLength(7);
        }
    });

    test("the current page is marked, and sibling-count widens the window", async () => {
        let pagination = await create_pagination({"page-count": "20", page: "10", "sibling-count": "2"});

        expect(get_numbers(pagination)).toEqual(["1", "…", "8", "9", "10", "11", "12", "…", "20"]);
        expect(get(pagination, "[aria-current='page']").textContent).toBe("10");
        expect(get(pagination, ".page-total").textContent).toBe("/ 20");
        expect(get(pagination, ".page-input").value).toBe("10");
    });
});

describe("moving between pages", () => {
    test("first, previous, a number, next, and last each dispatch page_change, and the end arrows are disabled", async () => {
        let pagination = await create_pagination({"page-count": "20", page: "1", "page-size": "10"});
        let changes = record_page_changes(pagination);

        expect(get(pagination, "[data-action='first']").disabled).toBe(true);
        expect(get(pagination, "[data-action='previous']").disabled).toBe(true);

        get(pagination, "[data-action='next']").click();
        get(pagination, "[data-page='5']").click();
        get(pagination, "[data-action='previous']").click();
        get(pagination, "[data-action='last']").click();

        expect(get(pagination, "[data-action='next']").disabled).toBe(true);
        expect(get(pagination, "[data-action='last']").disabled).toBe(true);

        get(pagination, "[data-action='first']").click();

        expect(changes.map((detail) => [detail.previous_page, detail.page])).toEqual([[1, 2], [2, 5], [5, 4], [4, 20], [20, 1]]);
        expect(changes[0]).toEqual({page: 2, previous_page: 1, page_size: 10, previous_page_size: 10});
    });

    test("a typed page commits on Enter and on leaving the field, clamped to the pages there are", async () => {
        let pagination = await create_pagination();
        let changes = record_page_changes(pagination);
        let page_input = get(pagination, ".page-input");

        page_input.value = "7";
        page_input.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true}));

        page_input.value = "99";
        page_input.dispatchEvent(new window.Event("change", {bubbles: true}));

        expect(changes.map((detail) => detail.page)).toEqual([7, 20]);
        expect(page_input.value).toBe("20");
    });

    test("Escape, an empty field, or a non-number puts back the current page without an event", async () => {
        let pagination = await create_pagination({"page-count": "20", page: "3"});
        let changes = record_page_changes(pagination);
        let page_input = get(pagination, ".page-input");

        page_input.value = "12";
        page_input.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));
        expect(page_input.value).toBe("3");

        page_input.value = "";
        page_input.dispatchEvent(new window.Event("change", {bubbles: true}));
        expect(page_input.value).toBe("3");

        expect(changes).toHaveLength(0);
    });

    test("a new page size keeps the first item shown on screen", async () => {
        let pagination = await create_pagination({"total-items": "1000", "page-size": "25", page: "5"});
        let changes = record_page_changes(pagination);
        let select = get(pagination, ".page-size-select");

        // Page 5 of 25 starts with item 101, which is on page 3 of 50.
        select.value = "50";
        select.dispatchEvent(new window.Event("change", {bubbles: true}));

        expect(pagination.page).toBe(3);
        expect(pagination.page_count).toBe(20);
        expect(changes).toEqual([{page: 3, previous_page: 5, page_size: 50, previous_page_size: 25}]);
    });

    test("total-items works out the page count, and setting attributes from code dispatches nothing", async () => {
        let pagination = await create_pagination({"total-items": "101", "page-size": "10"});
        let changes = record_page_changes(pagination);

        expect(pagination.page_count).toBe(11);

        pagination.page = 4;
        pagination.page_size = 50;
        pagination.set_page(99);
        await flush();

        expect(pagination.page_count).toBe(3);
        expect(pagination.page).toBe(3);
        expect(changes).toHaveLength(0);
    });

    test("page-size-options sets the picker's choices, always including the current size", async () => {
        let pagination = await create_pagination({"page-count": "5", "page-size": "30", "page-size-options": "5, 15"});

        expect(Array.from(get(pagination, ".page-size-select").options).map((option) => option.value)).toEqual(["5", "15", "30"]);
        expect(get(pagination, ".page-size-select").value).toBe("30");

        pagination.hide_page_size = true;
        await flush();

        expect(get(pagination, ".page-size-label").hidden).toBe(true);
    });

    test("with no pages, or disabled, nothing can be pressed", async () => {
        let pagination = await create_pagination({"total-items": "0"});

        expect(get(pagination, ".page-total").textContent).toBe("/ 0");
        expect(get(pagination, ".page-input").value).toBe("0");
        expect(get(pagination, ".page-input").disabled).toBe(true);
        expect(get(pagination, "[data-action='next']").disabled).toBe(true);

        let disabled_pagination = await create_pagination({"page-count": "9", page: "4", disabled: ""});

        expect(Array.from(disabled_pagination.shadowRoot.querySelectorAll("button")).every((button) => button.disabled)).toBe(true);
        expect(get(disabled_pagination, ".page-size-select").disabled).toBe(true);
    });

    test("each arrow shows a Galaxy tooltip, even while disabled", async () => {
        let pagination = await create_pagination();

        vi.useFakeTimers();
        get(pagination, "[data-action='first']").parentElement.dispatchEvent(new window.PointerEvent("pointerover", {bubbles: true, composed: true, pointerType: "mouse"}));
        vi.advanceTimersByTime(400);

        expect(get(pagination, ".galaxy-tooltip-bubble").textContent).toBe("First page");
    });
});

describe("paging a table", () => {
    test("a table with a page size shows one page of its sorted rows", async () => {
        let table = document.createElement("galaxy-table");

        table.setAttribute("client-sort", "");
        table.columns = [{key: "name", label: "Machine", sortable: true}];
        table.rows = rows_of(12);
        table.sort = [{key: "name", direction: "desc"}];
        table.page_size = 5;
        table.page = 2;
        document.body.appendChild(table);
        await flush();
        await flush();

        let renders = [];

        table.addEventListener("table_render", (event) => renders.push(event.detail));

        expect(Array.from(table.shadowRoot.querySelectorAll("tbody tr")).map((table_row) => table_row.textContent)).toEqual([
            "Machine 7", "Machine 6", "Machine 5", "Machine 4", "Machine 3",
        ]);
        expect(table.page_count).toBe(3);

        table.rows = rows_of(3);

        expect(table.page).toBe(1);
        expect(renders.at(-1)).toEqual({row_count: 3, page: 1, page_size: 5});
    });

    test("for links a table: it pages the table and takes its page count from the rows", async () => {
        document.body.innerHTML = `<galaxy-table id="machine_table"></galaxy-table><galaxy-pagination for="machine_table" page-size="10"></galaxy-pagination>`;

        let table = document.getElementById("machine_table");
        let pagination = document.querySelector("galaxy-pagination");

        table.columns = [{key: "name", label: "Machine"}];
        table.rows = rows_of(45);
        await flush();
        await flush();

        expect(pagination.page_count).toBe(5);
        expect(table.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(10);

        let changes = record_page_changes(pagination);

        get(pagination, "[data-action='last']").click();
        await flush();

        expect(table.page).toBe(5);
        expect(table.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(5);
        expect(changes).toHaveLength(1);

        table.rows = rows_of(15);
        await flush();

        expect(pagination.page_count).toBe(2);
        expect(pagination.page).toBe(2);
    });

    test("an editable table adding a row moves to its page, and the pagination follows without an event", async () => {
        document.body.innerHTML = `<galaxy-editable-table id="setup_table"></galaxy-editable-table><galaxy-pagination for="setup_table" page-size="5"></galaxy-pagination>`;

        let table = document.getElementById("setup_table");
        let pagination = document.querySelector("galaxy-pagination");
        let changes = record_page_changes(pagination);

        table.columns = [{key: "name", label: "Machine", type: "text"}];
        table.rows = rows_of(10);
        await flush();
        await flush();

        table.add_row({name: "New"});
        await flush();

        expect(table.page).toBe(3);
        expect(pagination.page).toBe(3);
        expect(pagination.page_count).toBe(3);
        expect(changes).toHaveLength(0);
    });

    test("an editable table validates every page, and moves to the first invalid cell's page to focus it", async () => {
        document.body.innerHTML = `<galaxy-editable-table id="setup_table"></galaxy-editable-table>`;

        let table = document.getElementById("setup_table");

        table.columns = [{key: "name", label: "Machine", type: "text", required: true}, {key: "count", label: "Count", type: "integer", min: 0}];
        table.rows = [...rows_of(6), {name: "", count: 3}];
        table.page_size = 5;
        await flush();
        await flush();

        expect(table.validate()).toBe(false);

        table.focus_first_invalid();
        await flush();
        await flush();

        expect(table.page).toBe(2);
        expect(table.shadowRoot.querySelector("td.has-error")).not.toBeNull();
    });

    test("unlinking, by removing for, shows every row again", async () => {
        document.body.innerHTML = `<galaxy-table id="machine_table"></galaxy-table><galaxy-pagination for="machine_table" page-size="10"></galaxy-pagination>`;

        let table = document.getElementById("machine_table");
        let pagination = document.querySelector("galaxy-pagination");

        table.columns = [{key: "name", label: "Machine"}];
        table.rows = rows_of(25);
        await flush();
        await flush();

        pagination.for = null;
        await flush();

        expect(table.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(25);
    });

    test("a for set after the table exists links it", async () => {
        let pagination = await create_pagination({"page-size": "10"});
        let table = document.createElement("galaxy-table");

        table.id = "late_table";
        table.columns = [{key: "name", label: "Machine"}];
        table.rows = rows_of(30);
        document.body.appendChild(table);
        await flush();
        await flush();

        pagination.for = "late_table";
        await flush();
        await flush();

        expect(pagination.page_count).toBe(3);
        expect(table.shadowRoot.querySelectorAll("tbody tr")).toHaveLength(10);
    });

    test("a sortable list ignores a page size and shows every row", async () => {
        let list = document.createElement("galaxy-sortable-list");

        list.columns = [{key: "name", label: "Machine"}];
        list.rows = rows_of(12);
        list.page_size = 5;
        document.body.appendChild(list);
        await flush();
        await flush();

        expect(list.page_size).toBeNull();
        expect(list.shadowRoot.querySelectorAll("tbody tr.data-row")).toHaveLength(12);
    });
});
