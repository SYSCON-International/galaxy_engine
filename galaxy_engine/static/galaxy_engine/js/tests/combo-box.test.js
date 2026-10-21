import { afterEach, describe, expect, test } from "vitest";
import { GalaxyComboBox } from "../components/GalaxyComboBox.js";
import { GalaxyEditableTable } from "../components/GalaxyEditableTable.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

const COMPONENTS = {"galaxy-combo-box": GalaxyComboBox, "galaxy-text-input": GalaxyTextInput, "galaxy-editable-table": GalaxyEditableTable};

for (let [tag_name, component_class] of Object.entries(COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const FORMATS = ["YYYY-MM-DD", "MM/DD/YYYY", "DD.MM.YYYY", {value: "HH:mm", text: "HH:mm (24-hour time)"}];

afterEach(() => {
    document.body.innerHTML = "";
});

/**
 * Creates and connects a <galaxy-combo-box> and waits for it to finish creating.
 * @param {Object} attributes - Its attributes.
 * @return {Promise<{input: HTMLElement, field: HTMLInputElement, list: HTMLElement|null}>}
 */
const create_input = async (attributes = {suggestions: JSON.stringify(FORMATS)}) => {
    let input = document.createElement("galaxy-combo-box");

    for (let [name, value] of Object.entries(attributes)) {
        input.setAttribute(name, value);
    }

    document.body.appendChild(input);

    await flush();
    await flush();

    return {input: input, field: input.shadowRoot.querySelector("input"), list: input.shadowRoot.querySelector(".suggestion-list")};
};

const get_shown = (list) => Array.from(list.children).map((option) => option.textContent);

/**
 * Types text into the field as a user would.
 * @param {HTMLInputElement} field - The field.
 * @param {string} text - The full text after typing.
 */
const type_into = (field, text) => {
    field.value = text;
    field.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
};

const press = (field, key) => {
    let event = new window.KeyboardEvent("keydown", {key: key, bubbles: true, composed: true, cancelable: true});

    field.dispatchEvent(event);

    return event;
};

describe("galaxy-combo-box", () => {
    test("is a combo box: a listbox popover and a down arrow, with the field marked for screen readers", async () => {
        let {input, field, list} = await create_input();

        expect(list.getAttribute("role")).toBe("listbox");
        expect(list.getAttribute("popover")).toBe("manual");
        expect(input.shadowRoot.querySelector(".suggestion-toggle")).not.toBeNull();
        expect(field.getAttribute("role")).toBe("combobox");
        expect(field.getAttribute("aria-controls")).toBe(list.id);
        expect(field.getAttribute("aria-expanded")).toBe("false");
        expect(input.suggestions[3]).toEqual({value: "HH:mm", text: "HH:mm (24-hour time)"});
    });

    test("without suggestions the down arrow hides and the list never opens, leaving free text", async () => {
        let {input, field, list} = await create_input({});

        expect(input.hasAttribute("has-suggestions")).toBe(false);

        field.click();
        press(field, "ArrowDown");
        type_into(field, "Anything");

        expect(list._is_popover_open).toBeFalsy();
        expect(input.value).toBe("Anything");
    });

    test("a galaxy-text-input stays a plain text input, even given suggestions", async () => {
        let text_input = document.createElement("galaxy-text-input");

        text_input.setAttribute("suggestions", JSON.stringify(FORMATS));
        document.body.appendChild(text_input);
        await flush();
        await flush();

        expect(text_input.shadowRoot.querySelector(".suggestion-list")).toBeNull();
        expect(text_input.shadowRoot.querySelector("input").hasAttribute("role")).toBe(false);
    });

    test("typing shows the suggestions containing the typed text, ignoring case, and closes the list when none match", async () => {
        let {field, list} = await create_input();

        type_into(field, "yyyy");

        expect(list._is_popover_open).toBe(true);
        expect(get_shown(list)).toEqual(["YYYY-MM-DD", "MM/DD/YYYY", "DD.MM.YYYY"]);

        type_into(field, "24-hour");

        expect(get_shown(list)).toEqual(["HH:mm (24-hour time)"]);

        type_into(field, "custom pattern");

        expect(list._is_popover_open).toBe(false);
    });

    test("a click in the field, or the down arrow, shows every suggestion", async () => {
        let {input, field, list} = await create_input({suggestions: JSON.stringify(FORMATS), value: "YYYY"});

        field.click();

        expect(get_shown(list)).toHaveLength(4);

        input.shadowRoot.querySelector(".suggestion-toggle").click();

        expect(list._is_popover_open).toBe(false);

        input.shadowRoot.querySelector(".suggestion-toggle").click();

        expect(list._is_popover_open).toBe(true);
    });

    test("ArrowDown opens and moves through the list, and Enter picks the highlighted suggestion as if typed", async () => {
        let {input, field, list} = await create_input();
        let events = [];

        // input is composed and reaches the element, as a typed one does; change, like a native one, stays on the field.
        input.addEventListener("input", () => events.push("input"));
        field.addEventListener("change", () => events.push("change"));

        press(field, "ArrowDown");

        expect(list._is_popover_open).toBe(true);
        expect(field.getAttribute("aria-activedescendant")).toBe(list.children[0].id);

        press(field, "ArrowDown");
        press(field, "ArrowUp");
        press(field, "ArrowUp");

        // ArrowUp from the first wraps to the last.
        expect(list.children[3].hasAttribute("highlighted")).toBe(true);

        let enter_event = press(field, "Enter");

        expect(enter_event.defaultPrevented).toBe(true);
        expect(field.value).toBe("HH:mm");
        expect(input.value).toBe("HH:mm");
        expect(list._is_popover_open).toBe(false);
        expect(events).toEqual(["input", "change"]);
    });

    test("Enter with nothing highlighted is left to the field, so a form still submits", async () => {
        let {field} = await create_input();

        type_into(field, "MM");

        expect(press(field, "Enter").defaultPrevented).toBe(false);
    });

    test("clicking a suggestion picks it; the typed text stays the value until then", async () => {
        let {input, field, list} = await create_input();

        type_into(field, "DD.");

        expect(input.value).toBe("DD.");

        list.children[0].click();

        expect(input.value).toBe("DD.MM.YYYY");
        expect(list._is_popover_open).toBe(false);
    });

    test("Escape closes the list, and blurring the field closes it", async () => {
        let {field, list} = await create_input();

        field.click();

        let escape_event = press(field, "Escape");

        expect(escape_event.defaultPrevented).toBe(true);
        expect(list._is_popover_open).toBe(false);

        field.click();
        field.dispatchEvent(new window.FocusEvent("blur"));

        expect(list._is_popover_open).toBe(false);
    });

    test("the value matching a suggestion is marked in the list", async () => {
        let {field, list} = await create_input({suggestions: JSON.stringify(FORMATS), value: "MM/DD/YYYY"});

        field.click();

        expect(list.children[1].hasAttribute("current")).toBe(true);
        expect(list.children[0].hasAttribute("current")).toBe(false);
    });

    test("a disabled or read-only field shows no suggestions", async () => {
        let {field, list} = await create_input({suggestions: JSON.stringify(FORMATS), readonly: ""});

        field.click();
        press(field, "ArrowDown");

        expect(list._is_popover_open).toBeFalsy();
    });

    test("suggestions set from code update an open list, and clearing them closes it and hides the arrow", async () => {
        let {input, field, list} = await create_input({});

        input.suggestions = ["A", "B"];
        await flush();

        field.click();

        expect(get_shown(list)).toEqual(["A", "B"]);

        input.suggestions = ["A", "B", "C"];
        await flush();

        expect(get_shown(list)).toEqual(["A", "B", "C"]);

        input.suggestions = [];
        await flush();

        expect(list._is_popover_open).toBe(false);
        expect(input.hasAttribute("has-suggestions")).toBe(false);
    });

    test("close_floating_content closes the list, for a collapse closing around it", async () => {
        let {input, field, list} = await create_input();

        field.click();
        input.close_floating_content();

        expect(list._is_popover_open).toBe(false);
    });

    test("an editable table's combo-box column edits its cells with combo boxes", async () => {
        let table = document.createElement("galaxy-editable-table");

        table.columns = [{key: "format", label: "Format", type: "combo-box", suggestions: FORMATS}];
        table.rows = [{format: "YYYY-MM-DD"}];
        document.body.appendChild(table);
        await flush();
        await flush();

        let editor = table.shadowRoot.querySelector("galaxy-combo-box");

        expect(editor.value).toBe("YYYY-MM-DD");

        expect(editor.has_suggestions).toBe(true);
        expect(editor.shadowRoot.querySelector(".suggestion-list")).not.toBeNull();
    });
});
