import { describe, expect, test, vi } from "vitest";
import { GalaxyStateManager } from "../GalaxyStateManager.js";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyDatePicker } from "../components/GalaxyDatePicker.js";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush, SIMPLE_OPTIONS } from "./test-helpers.js";

const COMPONENTS = {
    "galaxy-text-input": GalaxyTextInput,
    "galaxy-checkbox": GalaxyCheckbox,
    "galaxy-date-picker": GalaxyDatePicker,
    "galaxy-duration-input": GalaxyDurationInput,
    "galaxy-form": GalaxyForm,
};

for (let [tag_name, component_class] of Object.entries(COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const state = () => window.galaxy_state_manager;

/**
 * Parses markup into the document and waits for every create lifecycle to settle.
 * @param {string} markup - The markup.
 */
const render = async (markup) => {
    document.body.innerHTML = markup;

    await flush();
    await flush();
};

/**
 * Simulates the user typing into a Galaxy text input.
 * @param {HTMLElement} text_input - The input.
 * @param {string} text - The text typed.
 */
const type_into = (text_input, text) => {
    let field = text_input.shadowRoot.querySelector("input");

    field.value = text;
    field.dispatchEvent(new window.Event("input", {bubbles: true, composed: true}));
};

describe("state to Galaxy inputs", () => {
    test("a script write updates a bound text input, without a change event", async () => {
        await render("<galaxy-text-input property-name='machine_name'></galaxy-text-input>");

        let text_input = document.querySelector("galaxy-text-input");
        let change_listener = vi.fn();

        text_input.addEventListener("change", change_listener);
        state().data.machine_name = "Press 1";
        await flush();

        expect(text_input.value).toBe("Press 1");
        expect(text_input.shadowRoot.querySelector("input").value).toBe("Press 1");
        expect(change_listener).not.toHaveBeenCalled();
    });

    test("null clears a text input rather than showing \"null\"", async () => {
        await render("<galaxy-text-input property-name='machine_name' value='Press 1'></galaxy-text-input>");

        state().data.machine_name = null;
        await flush();

        expect(document.querySelector("galaxy-text-input").shadowRoot.querySelector("input").value).toBe("");
    });

    test("a script write updates a select and multi-select with an array, and with a single value", async () => {
        let options_json = JSON.stringify(SIMPLE_OPTIONS);

        await render(`
            <galaxy-select property-name="fruit" options-data='${options_json}'></galaxy-select>
            <galaxy-multi-select property-name="fruits" options-data='${options_json}'></galaxy-multi-select>
        `);

        state().data.fruit = "banana";
        state().data.fruits = ["apple", "cherry"];
        await flush();

        expect(document.querySelector("galaxy-select").value).toEqual(["banana"]);
        expect(document.querySelector("galaxy-multi-select").value).toEqual(["apple", "cherry"]);
    });

    test("a script write updates a checkbox, including null for a tri-state checkbox", async () => {
        await render("<galaxy-checkbox property-name='is_enabled'></galaxy-checkbox><galaxy-checkbox property-name='override' tri-state></galaxy-checkbox>");

        let [checkbox, tri_state_checkbox] = document.querySelectorAll("galaxy-checkbox");

        state().data.is_enabled = true;
        state().data.override = null;
        await flush();

        expect(checkbox.value).toBe(true);
        expect(checkbox.shadowRoot.querySelector("input").checked).toBe(true);
        expect(tri_state_checkbox.value).toBe(null);
        expect(tri_state_checkbox.shadowRoot.querySelector("input").indeterminate).toBe(true);
    });

    test("a script write updates a date picker exactly as setting its value would", async () => {
        await render("<galaxy-date-picker property-name='start_date'></galaxy-date-picker><galaxy-date-picker id='reference'></galaxy-date-picker>");

        let [bound_picker, reference_picker] = document.querySelectorAll("galaxy-date-picker");

        state().data.start_date = "2026-10-20";
        reference_picker.value = "2026-10-20";
        await flush();

        expect(bound_picker.value).toEqual(reference_picker.value);
        expect(bound_picker.shadowRoot.querySelector("input").value).toBe(reference_picker.shadowRoot.querySelector("input").value);
    });

    test("a script write updates a duration input", async () => {
        await render("<galaxy-duration-input property-name='cycle_time' unit='seconds'></galaxy-duration-input>");

        state().data.cycle_time = 90;
        await flush();

        expect(document.querySelector("galaxy-duration-input").value).toBe(90);
    });
});

describe("two-way between inputs", () => {
    test("two inputs sharing a property-name stay in step both ways, and the typing input is not written back to", async () => {
        await render("<galaxy-text-input id='first' property-name='machine_name'></galaxy-text-input><galaxy-text-input id='second' property-name='machine_name'></galaxy-text-input>");

        let first_input = document.getElementById("first");
        let second_input = document.getElementById("second");
        let first_apply_spy = vi.spyOn(first_input, "apply_state_value");

        type_into(first_input, "Press 7");
        await flush();

        expect(state().data.machine_name).toBe("Press 7");
        expect(second_input.value).toBe("Press 7");
        expect(first_apply_spy).not.toHaveBeenCalled();

        type_into(second_input, "Lathe 2");
        await flush();

        expect(first_input.value).toBe("Lathe 2");
    });

    test("two selects sharing a property-name settle instead of re-applying to each other", async () => {
        let options_json = JSON.stringify(SIMPLE_OPTIONS);

        await render(`
            <galaxy-multi-select id="first" property-name="fruits" options-data='${options_json}'></galaxy-multi-select>
            <galaxy-multi-select id="second" property-name="fruits" options-data='${options_json}'></galaxy-multi-select>
        `);

        let subscriber = vi.fn();

        state().subscribe("fruits", subscriber);
        document.getElementById("first").value = JSON.stringify(["apple"]);

        for (let flush_index = 0; flush_index < 5; flush_index++) {
            await flush();
        }

        expect(document.getElementById("second").value).toEqual(["apple"]);
        expect(subscriber).toHaveBeenCalledTimes(1);
    });
});

describe("connecting", () => {
    test("state wins: an input connecting to an existing property adopts its value", async () => {
        state().data.machine_name = "From State";

        await render("<galaxy-text-input property-name='machine_name' value='From Markup'></galaxy-text-input>");

        expect(document.querySelector("galaxy-text-input").value).toBe("From State");
        expect(state().data.machine_name).toBe("From State");
    });

    test("a checkbox connecting to an existing property adopts it, rather than reporting its own markup state", async () => {
        state().data.is_enabled = false;

        await render("<galaxy-checkbox property-name='is_enabled' checked></galaxy-checkbox>");
        await flush();

        expect(document.querySelector("galaxy-checkbox").value).toBe(false);
        expect(state().data.is_enabled).toBe(false);
    });

    test("an input seeds the state with its own value when the property does not exist", async () => {
        await render("<galaxy-text-input property-name='machine_name' value='Press 1'></galaxy-text-input><galaxy-checkbox property-name='is_enabled' checked></galaxy-checkbox>");

        expect(state().data.machine_name).toBe("Press 1");
        expect(state().data.is_enabled).toBe(true);
    });

    test("a removed input is unbound, and rebinds on reconnect", async () => {
        await render("<galaxy-text-input property-name='machine_name'></galaxy-text-input>");

        let text_input = document.querySelector("galaxy-text-input");

        text_input.remove();
        await flush();
        state().data.machine_name = "While Away";

        expect(state().bound_components_by_property.has("machine_name")).toBe(false);

        document.body.appendChild(text_input);
        await flush();
        await flush();

        expect(text_input.value).toBe("While Away");

        state().data.machine_name = "After Return";
        await flush();

        expect(text_input.value).toBe("After Return");
    });
});

describe("plain data-property elements", () => {
    test("a div gets text, a native field gets its value, and null shows as empty", async () => {
        await render("<div data-property='machine_name'></div><input id='native' data-property='machine_name' />");

        state().data.machine_name = "Press 1";

        expect(document.querySelector("div").textContent).toBe("Press 1");
        expect(document.getElementById("native").value).toBe("Press 1");

        state().data.machine_name = null;

        expect(document.querySelector("div").textContent).toBe("");
    });

    test("a native checkbox gets checked, driven by a Galaxy checkbox", async () => {
        await render("<galaxy-checkbox property-name='is_enabled'></galaxy-checkbox><input id='native' type='checkbox' data-property='is_enabled' />");

        document.querySelector("galaxy-checkbox").shadowRoot.querySelector("input").click();
        await flush();

        expect(document.getElementById("native").checked).toBe(true);
    });

    test("a data-property element inside a galaxy-form still updates", async () => {
        await render("<galaxy-form><galaxy-text-input property-name='machine_name'></galaxy-text-input><span data-property='machine_name'></span></galaxy-form>");

        let form = document.querySelector("galaxy-form");

        type_into(form.shadowRoot.querySelector("galaxy-text-input"), "Inside Form");
        await flush();

        expect(form.shadowRoot.querySelector("span").textContent).toBe("Inside Form");
    });

    test("a property name with a quote or backslash is escaped, not a broken selector", async () => {
        await render("<div data-property='odd \"name\\'></div>");

        state().data["odd \"name\\"] = "Escaped";

        expect(document.querySelector("div").textContent).toBe("Escaped");
    });

    test("values are written as text, never markup", async () => {
        await render("<div data-property='machine_name'></div>");

        state().data.machine_name = "<img src=x onerror=alert(1)>";

        expect(document.querySelector("img")).toBeNull();
    });
});

describe("subscribe", () => {
    test("a subscriber to one property, and to \"*\", is called with the new and old values, and stops after unsubscribing", () => {
        let state_manager = new GalaxyStateManager();
        let machine_name_calls = [];
        let all_calls = [];

        let unsubscribe = state_manager.subscribe("machine_name", (...args) => machine_name_calls.push(args));
        state_manager.subscribe("*", (...args) => all_calls.push(args));

        state_manager.data.machine_name = "Press 1";
        state_manager.data.count = 0;
        unsubscribe();
        state_manager.data.machine_name = "Press 2";

        expect(machine_name_calls).toEqual([["machine_name", "Press 1", undefined]]);
        expect(all_calls).toEqual([["machine_name", "Press 1", undefined], ["count", 0, undefined], ["machine_name", "Press 2", "Press 1"]]);
    });

    test("an unchanged value notifies nobody, and a throwing subscriber does not stop the rest", () => {
        let error_spy = vi.spyOn(console, "error").mockImplementation(() => {});
        let state_manager = new GalaxyStateManager({count: 1});
        let subscriber = vi.fn();

        state_manager.subscribe("count", () => {
            throw new Error("broken subscriber");
        });
        state_manager.subscribe("count", subscriber);

        state_manager.data.count = 1;
        state_manager.data.count = 2;

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(error_spy).toHaveBeenCalled();

        error_spy.mockRestore();
    });
});

describe("retired data-property on a Galaxy input", () => {
    test("warns and is not forwarded to the inner field", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await render("<galaxy-text-input data-property='machine_name'></galaxy-text-input>");

        let text_input = document.querySelector("galaxy-text-input");

        expect(warn_spy.mock.calls.some((call) => String(call[0]).includes("property-name=\"machine_name\""))).toBe(true);
        expect(text_input.shadowRoot.querySelector("input").hasAttribute("data-property")).toBe(false);

        state().data.machine_name = "Ignored";

        expect(text_input.textContent).toBe("");

        warn_spy.mockRestore();
    });
});
