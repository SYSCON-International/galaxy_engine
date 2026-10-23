import { afterEach, describe, expect, test, vi } from "vitest";
import { GalaxyComboBox } from "../components/GalaxyComboBox.js";
import { create_modal, flush_all } from "./modal-test-helpers.js";
import { create_select, flush, press_key, SIMPLE_OPTIONS } from "./test-helpers.js";

if (!customElements.get("galaxy-combo-box")) {
    customElements.define("galaxy-combo-box", GalaxyComboBox);
}

// A document-level keydown listener stands in for a page's own key handling, such as a barcode scanner listening on the document.
let document_keydown_listener = null;

const listen_on_document = () => {
    document_keydown_listener = vi.fn();
    document.addEventListener("keydown", document_keydown_listener);

    return document_keydown_listener;
};

afterEach(() => {
    if (document_keydown_listener) {
        document.removeEventListener("keydown", document_keydown_listener);
        document_keydown_listener = null;
    }
});

const pressed_keys = (listener) => listener.mock.calls.map((call) => call[0].key);

describe("a select keeps the keys it handles to itself", () => {
    test("arrow keys, Home, End, Enter and Escape on an open select do not reach the document", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        let listener = listen_on_document();

        press_key(select, "ArrowDown");
        await flush();

        for (let key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
            press_key(select, key);
        }

        press_key(select, "Enter");
        await flush();

        select.open = true;
        await flush();
        press_key(select, "Escape");

        expect(pressed_keys(listener)).toEqual([]);
        expect(select.open).toBe(false);
    });

    test("keys the select does not handle still reach the document", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(SIMPLE_OPTIONS)});
        let listener = listen_on_document();

        press_key(select, "a");
        press_key(select, "Tab");
        // A closed select leaves Home, End and Escape alone.
        press_key(select, "Home");
        press_key(select, "Escape");

        expect(pressed_keys(listener)).toEqual(["a", "Tab", "Home", "Escape"]);
    });
});

describe("a quick-close modal stays open when Escape closes a select inside it", () => {
    test("the first Escape closes only the select; the next closes the modal", async () => {
        let modal = await create_modal({"quick-close": ""});
        let select = document.createElement("galaxy-select");

        select.setAttribute("options-data", JSON.stringify(SIMPLE_OPTIONS));
        modal.appendChild(select);
        modal.open_modal();
        await flush_all();

        select.open = true;
        await flush();

        press_key(select, "Escape");
        await flush_all();

        expect(select.open).toBe(false);
        expect(modal.open).toBe(true);

        press_key(select, "Escape");
        await flush_all();

        expect(modal.open).toBe(false);
    });

    test("an Escape another handler already used does not close the modal", async () => {
        let modal = await create_modal({"quick-close": ""});

        modal.open_modal();
        await flush_all();

        let event = new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true});

        event.preventDefault();
        document.dispatchEvent(event);
        await flush_all();

        expect(modal.open).toBe(true);
    });
});

describe("a combo box keeps the keys it handles to itself", () => {
    const create_combo_box = async () => {
        let combo_box = document.createElement("galaxy-combo-box");

        combo_box.setAttribute("suggestions", JSON.stringify(["Alpha", "Beta", "Gamma"]));
        document.body.appendChild(combo_box);
        await flush();
        await flush();

        return {combo_box: combo_box, field: combo_box.shadowRoot.querySelector("input")};
    };

    test("arrow keys and a picking Enter do not reach the document", async () => {
        let {field} = await create_combo_box();
        let listener = listen_on_document();

        press_key(field, "ArrowDown");
        press_key(field, "ArrowDown");
        press_key(field, "ArrowUp");
        press_key(field, "Enter");

        expect(pressed_keys(listener)).toEqual([]);
        expect(field.value).toBe("Alpha");
    });

    test("with no suggestions, or read-only, the arrow keys are left to the page", async () => {
        for (let attributes of [{}, {suggestions: JSON.stringify(["Alpha"]), readonly: ""}]) {
            let combo_box = document.createElement("galaxy-combo-box");

            for (let [name, value] of Object.entries(attributes)) {
                combo_box.setAttribute(name, value);
            }

            document.body.appendChild(combo_box);
            await flush();
            await flush();

            let field = combo_box.shadowRoot.querySelector("input");
            let listener = listen_on_document();

            press_key(field, "ArrowDown");
            press_key(field, "ArrowUp");

            expect(pressed_keys(listener)).toEqual(["ArrowDown", "ArrowUp"]);

            document.removeEventListener("keydown", listener);
            document_keydown_listener = null;
        }
    });

    test("an Enter that picks nothing still reaches the document, so it can submit a form", async () => {
        let {field} = await create_combo_box();
        let listener = listen_on_document();

        press_key(field, "Enter");

        expect(pressed_keys(listener)).toEqual(["Enter"]);
    });
});
