import { afterEach, describe, expect, test, vi } from "vitest";
import "../GalaxyEngine.js";
import { GalaxyNotificationManager } from "../GalaxyNotificationManager.js";
import { GalaxySocket } from "../GalaxySocket.js";
import { flush_all } from "./modal-test-helpers.js";

// GalaxyEngine.js registers every component. Each group below covers one audit item left open before this batch.

/**
 * Parses markup into the document and waits for every component in it to be created.
 * @param {string} markup
 */
const render = async (markup) => {
    document.body.innerHTML = markup;

    await flush_all();
    await flush_all();
};

/**
 * Gets the element that really has focus, inside any shadow roots.
 * @return {Element|null}
 */
const get_deep_active_element = () => {
    let active_element = document.activeElement;

    while (active_element?.shadowRoot?.activeElement) {
        active_element = active_element.shadowRoot.activeElement;
    }

    return active_element;
};

/**
 * A stand-in for a native WebSocket, driven by the test.
 */
class FakeWebSocket {
    constructor() {
        this.readyState = 0;
    }

    send() {}

    close() {
        this.readyState = 2;
    }

    open() {
        this.readyState = 1;
        this.onopen?.({});
    }

    fail() {
        this.onerror?.({type: "error"});
        this.readyState = 3;
        this.onclose?.({code: 1006, reason: "", wasClean: false});
    }
}

describe("A8.1: connect() from a close handler", () => {
    test("a connect started in the close handler is not rejected with the one that failed", async () => {
        let sockets = [];
        let socket = new GalaxySocket({url: "ws://example.test/ws", reconnect: false, socket_factory: () => {
            let fake_socket = new FakeWebSocket();

            sockets.push(fake_socket);

            return fake_socket;
        }});
        let retried_connect = null;

        socket.on("close", () => {
            retried_connect ??= socket.connect();
        });

        let first_connect = socket.connect();

        sockets[0].fail();
        await expect(first_connect).rejects.toThrow();

        sockets[1].open();
        await expect(retried_connect).resolves.not.toThrow();
    });
});

describe("A8.3: notification durations a timer cannot hold", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test("Infinity keeps the notification, and 30 days does not close it at once", async () => {
        vi.useFakeTimers();

        let manager = new GalaxyNotificationManager();

        manager.add("info", "Forever", Infinity);
        manager.add("info", "A month", 30 * 24 * 60 * 60);
        await vi.advanceTimersByTimeAsync(1000);

        expect(manager.notifications).toHaveLength(2);
    });
});

describe("A7.3: galaxy-table edge cases", () => {
    test("a null column is skipped, and NaN and an invalid date sort last instead of breaking the sort", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await render("<galaxy-table client-sort></galaxy-table>");

        let table = document.querySelector("galaxy-table");

        table.columns = [null, {key: "count", label: "Count", sortable: true}];
        table.rows = [{count: 3}, {count: NaN}, {count: 1}, {count: new Date("not a date")}, {count: 2}];
        table.sort = [{key: "count", direction: "asc"}];
        await flush_all();

        let cell_texts = [...table.shadowRoot.querySelectorAll("tbody tr td")].map((cell) => cell.textContent.trim());

        expect(table.columns).toHaveLength(1);
        expect(cell_texts.slice(0, 3)).toEqual(["1", "2", "3"]);

        warn_spy.mockRestore();
    });
});

describe("A7.4: galaxy-pagination for= links a table added later", () => {
    test("a table connected after the pagination is linked when it arrives", async () => {
        await render("<galaxy-pagination for=\"late_table\" page-size=\"10\"></galaxy-pagination>");

        let pagination = document.querySelector("galaxy-pagination");

        expect(pagination.linked_table ?? null).toBe(null);

        document.body.insertAdjacentHTML("beforeend", "<galaxy-table id=\"late_table\"></galaxy-table>");
        await flush_all();

        expect(pagination.linked_table).toBe(document.getElementById("late_table"));
    });
});

describe("A7.5: controls keep keyboard focus when activated", () => {
    test("a page number keeps focus after the buttons are rebuilt", async () => {
        await render("<galaxy-pagination page-count=\"20\"></galaxy-pagination>");

        let pagination = document.querySelector("galaxy-pagination");
        let page_three_button = pagination.shadowRoot.querySelector(".page-number[data-page=\"3\"]");

        page_three_button.focus();
        page_three_button.click();
        await flush_all();

        let focused_element = pagination.shadowRoot.activeElement;

        expect(focused_element?.dataset.page).toBe("3");
    });

    test("the sidebar's collapse toggle stays the same, focused, button", async () => {
        await render("<galaxy-sidebar remember=\"none\"></galaxy-sidebar>");

        let sidebar = document.querySelector("galaxy-sidebar");
        let toggle_button = sidebar.shadowRoot.querySelector(".galaxy-nav-collapse-toggle");

        toggle_button.focus();
        toggle_button.click();
        await flush_all();

        expect(sidebar.collapsed).toBe(true);
        expect(sidebar.shadowRoot.querySelector(".galaxy-nav-collapse-toggle")).toBe(toggle_button);
        expect(sidebar.shadowRoot.activeElement).toBe(toggle_button);
        expect(toggle_button.getAttribute("aria-expanded")).toBe("false");
    });
});

describe("A7.6 and A7.7: the sidebar's session store", () => {
    afterEach(() => {
        delete window.galaxy_session_store;
    });

    test("a rejected session-store write is reported, not left unhandled", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
        let unhandled_rejections = [];
        let record_rejection = (reason) => unhandled_rejections.push(reason);

        process.on("unhandledRejection", record_rejection);
        window.galaxy_session_store = {get: async () => null, set: () => Promise.reject(new Error("offline"))};

        await render("<galaxy-sidebar remember=\"session\"></galaxy-sidebar>");
        document.querySelector("galaxy-sidebar").collapsed = true;
        await flush_all();
        await new Promise((resolve) => setTimeout(resolve, 0));

        process.off("unhandledRejection", record_rejection);

        expect(unhandled_rejections).toEqual([]);
        expect(warn_spy).toHaveBeenCalled();

        warn_spy.mockRestore();
    });

    test("restoring the remembered state does not write it straight back", async () => {
        let set_spy = vi.fn(async () => {});

        window.galaxy_session_store = {get: async () => "true", set: set_spy};

        await render("<galaxy-sidebar remember=\"session\"></galaxy-sidebar>");

        expect(document.querySelector("galaxy-sidebar").collapsed).toBe(true);
        expect(set_spy).not.toHaveBeenCalled();
    });
});

describe("A9.2: labels name their fields, and invalid fields say so", () => {
    test("a text input's label is linked to its field, and aria-invalid follows validation", async () => {
        await render("<galaxy-text-input label=\"Machine\" required></galaxy-text-input>");

        let text_input = document.querySelector("galaxy-text-input");
        let label = text_input.shadowRoot.querySelector("label");

        expect(label.htmlFor).toBe(text_input.input_element.id);
        expect(text_input.input_element.id).not.toBe("");

        text_input.validate();
        expect(text_input.input_element.getAttribute("aria-invalid")).toBe("true");

        text_input.value = "Press 1";
        text_input.validate();
        expect(text_input.input_element.hasAttribute("aria-invalid")).toBe(false);
    });

    test("a duration input's label names its group of unit fields, and a range picker's names its select", async () => {
        await render("<galaxy-duration-input label=\"Cycle\"></galaxy-duration-input><galaxy-datetime-range label=\"Period\"></galaxy-datetime-range>");
        await flush_all();

        let duration_input = document.querySelector("galaxy-duration-input");
        let duration_group = duration_input.shadowRoot.querySelector(".duration-input-fields");
        let range_picker = document.querySelector("galaxy-datetime-range");

        expect(duration_group.getAttribute("role")).toBe("group");
        expect(duration_group.getAttribute("aria-labelledby")).toBe(duration_input.shadowRoot.querySelector("label").id);
        expect(range_picker.shadowRoot.querySelector("label").htmlFor).toBe(range_picker.range_select_element.id);
    });
});

describe("A9.3: the modal is a dialog that manages focus", () => {
    test("it has dialog semantics, takes focus on open, keeps Tab inside, locks page scrolling, and gives focus back on close", async () => {
        await render("<button id=\"opener\">Open</button><galaxy-modal id=\"dialog\" title=\"Edit\"></galaxy-modal>");

        let opener = document.getElementById("opener");
        let modal = document.getElementById("dialog");
        let dialogue_element = modal.dialogue_element;

        expect(dialogue_element.getAttribute("role")).toBe("dialog");
        expect(dialogue_element.getAttribute("aria-modal")).toBe("true");
        expect(modal.close_button.getAttribute("aria-label")).toBe("Close");

        opener.focus();
        modal.open_modal();

        expect(get_deep_active_element()).toBe(dialogue_element);
        expect(document.body.style.overflow).toBe("hidden");

        let focusable_elements = modal.get_focusable_elements();

        focusable_elements.at(-1).focus();
        dialogue_element.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Tab", bubbles: true, cancelable: true}));
        expect(get_deep_active_element()).toBe(focusable_elements[0]);

        modal.close_modal();

        expect(document.activeElement).toBe(opener);
        expect(document.body.style.overflow).toBe("");
    });
});

describe("A9.6: galaxy-button content", () => {
    test("an empty button shows no placeholder label, and one with text shows it", async () => {
        await render("<galaxy-button icon=\"save\"></galaxy-button><galaxy-button>Save</galaxy-button>");

        let [icon_button, text_button] = document.querySelectorAll("galaxy-button");

        expect(icon_button.shadowRoot.textContent).not.toContain("Button");
        expect(icon_button.shadowRoot.querySelector(".button-label").hidden).toBe(true);
        expect(text_button.shadowRoot.querySelector(".button-label").hidden).toBe(false);
    });
});

describe("A9.7: number-input limits", () => {
    test("min = 0 sets a limit, null clears it, and the field follows", async () => {
        await render("<galaxy-integer-input></galaxy-integer-input>");

        let integer_input = document.querySelector("galaxy-integer-input");

        integer_input.min = 0;
        await flush_all();
        expect(integer_input.getAttribute("min")).toBe("0");
        expect(integer_input.input_element.getAttribute("min")).toBe("0");

        integer_input.min = null;
        await flush_all();
        expect(integer_input.hasAttribute("min")).toBe(false);
        expect(integer_input.input_element.hasAttribute("min")).toBe(false);
    });

    test("an integer input's min of 1.5 is not cut to 1, and a changed limit revalidates a field showing an error", async () => {
        await render("<galaxy-integer-input min=\"1.5\" value=\"1\"></galaxy-integer-input>");

        let integer_input = document.querySelector("galaxy-integer-input");

        expect(integer_input.validate()).toBe(false);

        integer_input.setAttribute("min", "0");
        await flush_all();

        expect(integer_input._internals.checkValidity()).toBe(true);
    });
});

describe("Item 37: a confirming button's dialog takes a type and an icon", () => {
    test("confirm-button-type/-icon and cancel-button-type/-icon reach the dialog's footer buttons", async () => {
        await render("<galaxy-button has-confirm confirm-button-type=\"danger\" confirm-button-icon=\"delete\" cancel-button-type=\"secondary\">Delete</galaxy-button>");

        let button = document.querySelector("galaxy-button");

        expect(button.confirm_modal.getAttribute("ok-button-type")).toBe("danger");
        expect(button.confirm_modal.getAttribute("ok-button-icon")).toBe("delete");
        expect(button.confirm_modal.getAttribute("cancel-button-type")).toBe("secondary");

        button.removeAttribute("confirm-button-type");
        await flush_all();

        expect(button.confirm_modal.hasAttribute("ok-button-type")).toBe(false);
    });
});

describe("Select search with uncopyable option data", () => {
    test("searching options that hold a function does not throw", async () => {
        await render("<galaxy-select search-enabled></galaxy-select>");

        let select = document.querySelector("galaxy-select");
        let on_pick = () => {};

        select.options = [{text: "Alpha", value: "a", node_type: "Option", on_pick}, {text: "Beta", value: "b", node_type: "Option", on_pick}];
        await flush_all();

        expect(() => select.search_data("", select.options)).not.toThrow();
        expect(select.search_data("", select.options)[0].on_pick).toBe(on_pick);
    });
});
