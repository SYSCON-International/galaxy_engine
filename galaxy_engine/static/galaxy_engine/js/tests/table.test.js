import { describe, expect, test, vi } from "vitest";
import { COLUMNS, ROWS, click_header, create_table, flush, get_column_text } from "./table-test-helpers.js";

describe("rendering from columns and rows", () => {
    test("renders headers and cells from JSON attributes, applying align and width", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});

        let header_cells = table.shadowRoot.querySelectorAll("th");

        expect(header_cells[0].querySelector(".label").textContent).toBe("Name");
        expect(header_cells[1].querySelector(".label").textContent).toBe("Count");
        expect(header_cells[2].textContent).toBe("Notes");
        expect(header_cells[1].classList.contains("align-right")).toBe(true);
        expect(header_cells[1].style.width).toBe("120px");
        expect(header_cells[2].querySelector(".sort-button")).toBeNull();
        expect(get_column_text(table, 0)).toEqual(["Press 10", "Press 2", "Press 2", "Lathe"]);
        expect(get_column_text(table, 1)).toEqual(["5", "20", "3", ""]);
    });

    test("the rows property accepts an array directly", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS)});

        table.rows = ROWS;

        expect(get_column_text(table, 2)).toEqual(["a", "b", "c", "d"]);
    });

    test("row values are rendered as text, never markup", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS)});

        table.rows = [{name: "<img src=x onerror=alert(1)>", count: 1, notes: ""}];

        expect(table.shadowRoot.querySelector("img")).toBeNull();
        expect(get_column_text(table, 0)).toEqual(["<img src=x onerror=alert(1)>"]);
    });

    test("invalid JSON is ignored with a warning instead of throwing", async () => {
        let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: "{not json"});

        expect(warn).toHaveBeenCalled();
        expect(table.shadowRoot.querySelector(".empty-state")).not.toBeNull();

        warn.mockRestore();
    });

    test("an invalid align is dropped with a warning", async () => {
        let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let table = await create_table({columns: JSON.stringify([{key: "name", align: "middle"}])});

        expect(warn).toHaveBeenCalled();
        expect(table.columns[0].align).toBeUndefined();
        expect(table.columns[0].label).toBe("name");

        warn.mockRestore();
    });
});

describe("empty state", () => {
    test("shows the default message spanning every column when there are no rows", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS)});
        let empty_cell = table.shadowRoot.querySelector(".empty-state");

        expect(empty_cell.textContent).toBe("No data");
        expect(empty_cell.colSpan).toBe(3);
    });

    test("uses empty-message and updates when it changes", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), "empty-message": "No Machines found"});

        expect(table.shadowRoot.querySelector(".empty-state").textContent).toBe("No Machines found");

        table.empty_message = "Nothing here";
        await flush();

        expect(table.shadowRoot.querySelector(".empty-state").textContent).toBe("Nothing here");
    });
});

describe("sort interaction", () => {
    test("a plain click cycles ascending -> descending -> unsorted and fires sort_change each time", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});
        let sort_details = [];

        table.addEventListener("sort_change", (event) => sort_details.push(event.detail.sort));

        click_header(table, "name");
        click_header(table, "name");
        click_header(table, "name");

        expect(sort_details).toEqual([
            [{key: "name", direction: "asc"}],
            [{key: "name", direction: "desc"}],
            [],
        ]);
        expect(table.sort).toEqual([]);
    });

    test("shift-click adds a column; a plain click then restarts the sort on one column", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});

        click_header(table, "name");
        click_header(table, "count", true);

        expect(table.sort).toEqual([{key: "name", direction: "asc"}, {key: "count", direction: "asc"}]);

        click_header(table, "count", true);
        expect(table.sort).toEqual([{key: "name", direction: "asc"}, {key: "count", direction: "desc"}]);

        click_header(table, "count", true);
        expect(table.sort).toEqual([{key: "name", direction: "asc"}]);

        click_header(table, "count", true);
        click_header(table, "count");
        expect(table.sort).toEqual([{key: "count", direction: "asc"}]);
    });

    test("headers show the arrow, aria-sort, and an order number only when several columns are sorted", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});

        click_header(table, "name");

        let name_header = table.shadowRoot.querySelector('.sort-button[data-key="name"]').parentElement;

        expect(name_header.getAttribute("aria-sort")).toBe("ascending");
        expect(name_header.querySelector(".arrow").classList.contains("asc")).toBe(true);
        expect(name_header.querySelector(".order")).toBeNull();

        click_header(table, "count", true);
        click_header(table, "count", true);

        let headers = table.shadowRoot.querySelectorAll("th");

        expect(headers[0].querySelector(".order").textContent).toBe("1");
        expect(headers[1].querySelector(".order").textContent).toBe("2");
        expect(headers[1].getAttribute("aria-sort")).toBe("descending");
        expect(headers[1].querySelector(".arrow").classList.contains("desc")).toBe(true);
    });

    test("without client-sort, a sort change does not reorder the rows", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});

        click_header(table, "name");

        expect(get_column_text(table, 2)).toEqual(["a", "b", "c", "d"]);
    });

    test("the sort setter applies a sort without firing sort_change, and drops unknown or unsortable keys", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});
        let listener = vi.fn();

        table.addEventListener("sort_change", listener);
        table.sort = [{key: "count", direction: "desc"}, {key: "notes", direction: "asc"}, {key: "missing", direction: "asc"}, {key: "name", direction: "sideways"}];

        expect(listener).not.toHaveBeenCalled();
        expect(table.sort).toEqual([{key: "count", direction: "desc"}]);
    });
});

describe("client-side sort", () => {
    test("sorts text with numeric awareness, ascending and descending, with empty values last both ways", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), "client-sort": ""});

        click_header(table, "name");
        expect(get_column_text(table, 0)).toEqual(["Lathe", "Press 2", "Press 2", "Press 10"]);

        click_header(table, "count");
        expect(get_column_text(table, 1)).toEqual(["3", "5", "20", ""]);

        click_header(table, "count");
        expect(get_column_text(table, 1)).toEqual(["20", "5", "3", ""]);
    });

    test("multi-sort breaks ties with the next column", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), "client-sort": ""});

        click_header(table, "name");
        click_header(table, "count", true);
        click_header(table, "count", true);

        expect(get_column_text(table, 2)).toEqual(["d", "b", "c", "a"]);
    });

    test("an initial sort attribute is applied on render", async () => {
        let table = await create_table({
            sort: JSON.stringify([{key: "count", direction: "asc"}]), columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), "client-sort": "",
        });

        expect(get_column_text(table, 1)).toEqual(["3", "5", "20", ""]);
    });
});

describe("row_click", () => {
    test("reports the row and its supplied index, even when the display order is sorted", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), "client-sort": "", "clickable-rows": ""});
        let details = [];

        table.addEventListener("row_click", (event) => details.push(event.detail));
        click_header(table, "name");

        let first_rendered_row = table.shadowRoot.querySelector("tr.data-row");

        first_rendered_row.cells[0].dispatchEvent(new window.MouseEvent("click", {bubbles: true, composed: true}));

        expect(details).toHaveLength(1);
        expect(details[0].index).toBe(3);
        expect(details[0].row).toEqual(ROWS[3]);
    });

    test("clicking the empty-state row fires nothing", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), "clickable-rows": ""});
        let listener = vi.fn();

        table.addEventListener("row_click", listener);
        table.shadowRoot.querySelector(".empty-state").dispatchEvent(new window.MouseEvent("click", {bubbles: true, composed: true}));

        expect(listener).not.toHaveBeenCalled();
    });
});

describe("light-DOM table source", () => {
    const LIGHT_DOM_TABLE = `
        <table>
            <thead>
                <tr>
                    <th data-key="machine" data-sortable>Machine</th>
                    <th data-key="parts" data-sortable data-align="right">Parts</th>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Press 10</td><td data-sort-value="1000">1,000</td><td><a href="/a">A</a></td></tr>
                <tr><td>Press 2</td><td data-sort-value="50">50</td><td><a href="/b">B</a></td></tr>
            </tbody>
        </table>
    `;

    test("reads columns from the header and clones cell markup", async () => {
        let table = await create_table({}, LIGHT_DOM_TABLE);

        expect(table.columns.map((column) => column.key)).toEqual(["machine", "parts", "column_2"]);
        expect(table.columns[1].sortable).toBe(true);
        expect(table.columns[2].sortable).toBe(false);
        expect(table.shadowRoot.querySelectorAll("a")).toHaveLength(2);
        expect(get_column_text(table, 1)).toEqual(["1,000", "50"]);
    });

    test("client-sort uses data-sort-value numerically", async () => {
        let table = await create_table({"client-sort": ""}, LIGHT_DOM_TABLE);

        click_header(table, "parts");

        expect(get_column_text(table, 1)).toEqual(["50", "1,000"]);
    });

    test("re-renders when the light-DOM table changes", async () => {
        let table = await create_table({}, LIGHT_DOM_TABLE);

        table.querySelector("tbody").insertAdjacentHTML("beforeend", "<tr><td>Lathe</td><td>7</td><td></td></tr>");
        await flush();

        expect(get_column_text(table, 0)).toEqual(["Press 10", "Press 2", "Lathe"]);
    });

    test("a light-DOM table added after creation is picked up, but other light-DOM children do not re-render", async () => {
        let table = await create_table();
        let render_spy = vi.spyOn(table, "render_body");

        table.appendChild(document.createElement("div"));
        await flush();

        expect(render_spy).not.toHaveBeenCalled();

        table.insertAdjacentHTML("beforeend", LIGHT_DOM_TABLE);
        await flush();

        expect(get_column_text(table, 0)).toEqual(["Press 10", "Press 2"]);
    });

    test("supplied columns take precedence over a light-DOM table", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS)}, LIGHT_DOM_TABLE);

        expect(table.is_using_light_dom).toBe(false);
        expect(table.columns.map((column) => column.key)).toEqual(["name", "count", "notes"]);
    });
});

describe("lifecycle", () => {
    test("disconnecting and reconnecting renders once, not twice", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});

        table.remove();
        await flush();
        document.body.appendChild(table);
        await flush();

        expect(table.shadowRoot.querySelectorAll("table")).toHaveLength(1);
        expect(table.shadowRoot.querySelectorAll("tr.data-row")).toHaveLength(4);
    });
});

describe("clickable-rows", () => {
    test("without clickable-rows, rows are not focusable and fire no row_click", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});
        let listener = vi.fn();

        table.addEventListener("row_click", listener);

        let first_row = table.shadowRoot.querySelector("tr.data-row");

        first_row.cells[0].dispatchEvent(new window.MouseEvent("click", {bubbles: true, composed: true}));

        expect(listener).not.toHaveBeenCalled();
        expect(first_row.hasAttribute("tabindex")).toBe(false);
        expect(first_row.classList.contains("clickable")).toBe(false);
    });

    test("turning clickable-rows on re-renders focusable rows", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});

        table.clickable_rows = true;
        await flush();

        let first_row = table.shadowRoot.querySelector("tr.data-row");

        expect(first_row.tabIndex).toBe(0);
        expect(first_row.classList.contains("clickable")).toBe(true);
    });

    test("Enter and Space on a focused row fire row_click; keys inside cell content do not", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), "clickable-rows": ""});
        let indexes = [];

        table.addEventListener("row_click", (event) => indexes.push(event.detail.index));

        let rendered_rows = table.shadowRoot.querySelectorAll("tr.data-row");

        rendered_rows[1].dispatchEvent(new window.KeyboardEvent("keydown", {key: "Enter", bubbles: true, composed: true, cancelable: true}));

        let space_event = new window.KeyboardEvent("keydown", {key: " ", bubbles: true, composed: true, cancelable: true});

        rendered_rows[2].dispatchEvent(space_event);
        rendered_rows[0].cells[0].dispatchEvent(new window.KeyboardEvent("keydown", {key: "Enter", bubbles: true, composed: true, cancelable: true}));
        rendered_rows[0].dispatchEvent(new window.KeyboardEvent("keydown", {key: "a", bubbles: true, composed: true, cancelable: true}));

        expect(indexes).toEqual([1, 2]);
        expect(space_event.defaultPrevented).toBe(true);
    });

    test("a click on a button or link in a cell does not click its row", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), "clickable-rows": ""});
        let indexes = [];

        table.addEventListener("row_click", (event) => indexes.push(event.detail.index));

        let rendered_rows = table.shadowRoot.querySelectorAll("tr.data-row");
        let cell_button = document.createElement("button");
        let cell_link = document.createElement("a");
        let cell_text = document.createElement("span");

        cell_link.href = "#details";
        rendered_rows[0].cells[0].append(cell_button, cell_link, cell_text);

        cell_button.click();
        cell_link.dispatchEvent(new window.MouseEvent("click", {bubbles: true, composed: true, cancelable: true}));
        cell_text.click();

        expect(indexes).toEqual([0]);
    });
});

describe("column render", () => {
    test("a string result is shown as text and a Node result is appended", async () => {
        let table = await create_table();

        table.columns = [
            {key: "name", render: (value, row) => `${value} (${row.count})`},
            {
                key: "notes",
                render: (value) => {
                    let link = document.createElement("a");
                    link.href = `#${value}`;
                    link.textContent = "<b>open</b>";
                    return link;
                },
            },
        ];
        table.rows = [{name: "Press 1", count: 3, notes: "press_1"}];

        expect(get_column_text(table, 0)).toEqual(["Press 1 (3)"]);
        expect(table.shadowRoot.querySelector("a").getAttribute("href")).toBe("#press_1");
        expect(table.shadowRoot.querySelector("b")).toBeNull();
    });

    test("a string result containing markup is still text", async () => {
        let table = await create_table();

        table.columns = [{key: "name", render: () => "<img src=x onerror=alert(1)>"}];
        table.rows = [{name: "x"}];

        expect(table.shadowRoot.querySelector("img")).toBeNull();
    });

    test("a render that throws falls back to the raw value with a warning", async () => {
        let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let table = await create_table();

        table.columns = [{key: "name", render: () => {throw new Error("boom");}}];
        table.rows = [{name: "Press 1"}];

        expect(get_column_text(table, 0)).toEqual(["Press 1"]);
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    test("client-sort sorts by the raw value, not the rendered text", async () => {
        let table = await create_table({"client-sort": ""});

        table.columns = [{key: "count", sortable: true, render: (value) => `#${100 - value}`}];
        table.rows = [{count: 30}, {count: 10}, {count: 20}];
        click_header(table, "count");

        expect(get_column_text(table, 0)).toEqual(["#90", "#80", "#70"]);
    });

    test("a non-function render is dropped with a warning", async () => {
        let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        let table = await create_table({columns: JSON.stringify([{key: "name", render: "nope"}])});

        expect(table.columns[0].render).toBeUndefined();
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });
});

describe("overlay slot", () => {
    test("non-table light-DOM children are slotted into the positioned table container", async () => {
        let table = await create_table({columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS)});
        let overlay = document.createElement("div");

        table.appendChild(overlay);
        await flush();

        let slot = table.shadowRoot.querySelector(".galaxy-table-container > slot");

        expect(slot.assignedElements()).toContain(overlay);
        expect(table.shadowRoot.querySelectorAll("tr.data-row")).toHaveLength(4);
    });
});
