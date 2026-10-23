import { describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-form", GalaxyForm], ["galaxy-text-input", GalaxyTextInput]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Parses a form into the document and waits for it and its fields to be created.
 * @param {string} form_attributes - Attributes for the <galaxy-form>, as markup.
 * @param {string} field_value - The required field's value; "" leaves the form invalid.
 * @return {Promise<HTMLElement>} - The <galaxy-form>.
 */
const create_form = async (form_attributes, field_value) => {
    document.body.innerHTML = `<galaxy-form action="/save" method="post" ${form_attributes}><galaxy-text-input name="machine_name" value="${field_value}" required></galaxy-text-input></galaxy-form>`;

    await flush();
    await flush();

    return document.querySelector("galaxy-form");
};

/**
 * Submits the internal <form> the way the browser starts a submission, and returns the event, whose defaultPrevented says whether the native submission was cancelled.
 * jsdom does not navigate, so cancellation is what these tests can observe.
 * @param {HTMLElement} form - The <galaxy-form>.
 * @return {Event}
 */
const submit = (form) => {
    let submit_event = new window.Event("submit", {bubbles: true, cancelable: true});

    form.form_element.dispatchEvent(submit_event);

    return submit_event;
};

describe("a galaxy-form without native-submit", () => {
    test("never submits natively, and dispatches its own submit when valid", async () => {
        let form = await create_form("", "Press 1");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(submit(form).defaultPrevented).toBe(true);
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });
});

describe("a galaxy-form with native-submit", () => {
    test("a valid form submits natively, after dispatching its own submit", async () => {
        let form = await create_form("native-submit", "Press 1");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(form.native_submit).toBe(true);
        expect(submit(form).defaultPrevented).toBe(false);
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("an invalid form is still cancelled, and dispatches nothing", async () => {
        let form = await create_form("native-submit", "");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(submit(form).defaultPrevented).toBe(true);
        expect(submit_listener).not.toHaveBeenCalled();
    });

    test("a script can veto the native submission by cancelling the form's own submit", async () => {
        let form = await create_form("native-submit", "Press 1");

        form.addEventListener("submit", (event) => event.preventDefault());

        expect(submit(form).defaultPrevented).toBe(true);
    });

    test("an error while validating still cancels the native submission", async () => {
        let form = await create_form("native-submit", "Press 1");
        let submit_event = new window.Event("submit", {bubbles: true, cancelable: true});

        form.validate = () => {
            throw new Error("Validation broke");
        };

        expect(() => form.on_form_submit(submit_event)).toThrow("Validation broke");
        expect(submit_event.defaultPrevented).toBe(true);
    });

    test("the native_submit property sets and removes the attribute", async () => {
        let form = await create_form("", "Press 1");

        form.native_submit = true;
        expect(form.hasAttribute("native-submit")).toBe(true);

        form.native_submit = false;
        expect(form.hasAttribute("native-submit")).toBe(false);
    });
});
