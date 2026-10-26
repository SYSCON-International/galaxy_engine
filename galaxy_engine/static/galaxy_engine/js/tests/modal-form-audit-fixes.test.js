import { describe, expect, test, vi } from "vitest";
import "../GalaxyEngine.js";
import { flush_all } from "./modal-test-helpers.js";
import { flush } from "./test-helpers.js";

// GalaxyEngine.js registers every component and attaches the engine's body click listener, which A3.5 is about. setup.js then swaps window.galaxy_engine for a
// stub before each test; the listener keeps its own engine.

/**
 * Parses markup into the document and waits for every component in it to be created.
 * @param {string} markup
 */
const render = async (markup) => {
    document.body.innerHTML = markup;

    await flush_all();
    await flush_all();
};

const press_escape = () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));
};

describe("A3.1: a modal keeps callbacks set before it is created, and across a move", () => {
    test("callbacks set before the modal is connected reach a confirming OK and Cancel", async () => {
        let modal = document.createElement("galaxy-modal");
        let confirm_callback = vi.fn();
        let cancel_callback = vi.fn();

        modal.setAttribute("has-ok-confirm", "");
        modal.setAttribute("has-cancel-confirm", "");
        modal.confirm_callback = confirm_callback;
        modal.cancel_callback = cancel_callback;
        document.body.appendChild(modal);
        await flush_all();
        await flush_all();

        expect(modal.ok_button.confirm_callback).toBe(confirm_callback);
        expect(modal.cancel_button.cancel_callback).toBe(cancel_callback);
    });

    test("the callbacks survive the modal being moved", async () => {
        let modal = document.createElement("galaxy-modal");
        let confirm_callback = vi.fn();

        modal.setAttribute("has-ok-confirm", "");
        document.body.appendChild(modal);
        await flush_all();
        modal.confirm_callback = confirm_callback;

        let wrapper = document.createElement("div");

        document.body.appendChild(wrapper);
        wrapper.appendChild(modal);
        await flush_all();
        await flush_all();

        expect(modal.ok_button.confirm_callback).toBe(confirm_callback);
    });
});

describe("A3.2: a nested galaxy-form's submit stays its own", () => {
    test("submitting the inner form neither validates nor submits the outer one", async () => {
        await render("<galaxy-form class=\"outer\"><galaxy-text-input required></galaxy-text-input><galaxy-form class=\"inner\" native-submit></galaxy-form></galaxy-form>");

        let outer_form = document.querySelector("galaxy-form.outer");
        let inner_form = outer_form.shadowRoot.querySelector("galaxy-form.inner");
        let outer_validate_spy = vi.spyOn(outer_form, "validate");
        let outer_submit_listener = vi.fn();
        let inner_submit_listener = vi.fn();

        outer_form.addEventListener("submit", outer_submit_listener);
        inner_form.addEventListener("submit", inner_submit_listener);

        let native_submit_event = new window.Event("submit", {bubbles: true, cancelable: true});

        inner_form.form_element.dispatchEvent(native_submit_event);

        expect(inner_submit_listener).toHaveBeenCalledTimes(1);
        expect(outer_validate_spy).not.toHaveBeenCalled();
        expect(outer_submit_listener).not.toHaveBeenCalled();
        // The inner form has native-submit and nothing vetoed it, so its native submission goes ahead.
        expect(native_submit_event.defaultPrevented).toBe(false);
    });
});

describe("A3.4: Escape closes only the topmost quick-close modal", () => {
    test("one Escape closes the inner modal; the next closes the outer", async () => {
        await render("<galaxy-modal id=\"outer\" quick-close></galaxy-modal><galaxy-modal id=\"inner\" quick-close></galaxy-modal>");

        let outer_modal = document.getElementById("outer");
        let inner_modal = document.getElementById("inner");

        outer_modal.open_modal();
        inner_modal.open_modal();

        press_escape();
        expect(inner_modal.open).toBe(false);
        expect(outer_modal.open).toBe(true);

        press_escape();
        expect(outer_modal.open).toBe(false);
    });

    test("a modal opened with open = true counts as the topmost", async () => {
        await render("<galaxy-modal id=\"outer\" quick-close></galaxy-modal><galaxy-modal id=\"inner\" quick-close></galaxy-modal>");

        let outer_modal = document.getElementById("outer");
        let inner_modal = document.getElementById("inner");

        outer_modal.open = true;
        await flush();
        inner_modal.open = true;
        await flush();

        press_escape();

        expect(inner_modal.open).toBe(false);
        expect(outer_modal.open).toBe(true);
    });
});

describe("A3.5: galaxy-modal-id triggers", () => {
    test("a trigger inside a galaxy-form opens a modal inside the same form", async () => {
        await render("<galaxy-form><button type=\"button\" galaxy-modal-id=\"edit_modal\">Edit</button><galaxy-modal id=\"edit_modal\"></galaxy-modal></galaxy-form>");

        let form = document.querySelector("galaxy-form");
        let trigger = form.shadowRoot.querySelector("[galaxy-modal-id]");
        let modal = form.shadowRoot.querySelector("galaxy-modal");

        trigger.click();

        expect(modal.open).toBe(true);
    });

    test("a modal id that is not a valid CSS identifier still opens, without an error", async () => {
        await render("<button type=\"button\" galaxy-modal-id=\"1st:modal\">Open</button><galaxy-modal id=\"1st:modal\"></galaxy-modal>");

        let error_spy = vi.spyOn(console, "error").mockImplementation(() => {});

        document.querySelector("button").click();

        expect(document.getElementById("1st:modal").open).toBe(true);

        error_spy.mockRestore();
    });
});

describe("A3.6: a nested modal always gives its parent its size back", () => {
    const render_nested = async () => {
        await render("<galaxy-modal id=\"parent\"></galaxy-modal>");

        let parent_modal = document.getElementById("parent");
        let nested_modal = document.createElement("galaxy-modal");

        nested_modal.setAttribute("size", "1");
        parent_modal.appendChild(nested_modal);
        await flush_all();
        await flush_all();

        return {parent_modal, nested_modal};
    };

    test("closing it with open = false", async () => {
        let {parent_modal, nested_modal} = await render_nested();

        nested_modal.open = true;
        await flush();
        expect(parent_modal.size).toBe(1);

        nested_modal.open = false;
        await flush();

        expect(parent_modal.size).toBe(2);
        expect(parent_modal.dialogue_element.style.height).toBe("");
    });

    test("removing it while open", async () => {
        let {parent_modal, nested_modal} = await render_nested();

        nested_modal.open_modal();
        expect(parent_modal.size).toBe(1);

        nested_modal.remove();
        await flush_all();

        expect(parent_modal.size).toBe(2);
        expect(parent_modal.dialogue_element.style.height).toBe("");
    });
});
