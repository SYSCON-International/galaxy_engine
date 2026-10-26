import { describe, expect, test, vi } from "vitest";
import "../GalaxyEngine.js";
import { flush_all } from "./modal-test-helpers.js";

// GalaxyEngine.js registers every component, so a form can hold any field. jsdom does not navigate, so a native submission is observed through the internal or native
// <form>'s submit event: whether it was dispatched, and whether the form left it uncancelled.

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
 * Records every submission a form starts. Registered after the galaxy-form's own handler, so it sees that handler's decision; it then cancels the submission, which jsdom
 * cannot carry out.
 * @param {HTMLFormElement} form_element - A native <form>, or a galaxy-form's internal one.
 * @return {{count: number, was_allowed: boolean|null}} - How many submissions started, and whether the last one was left to post.
 */
const watch_submissions = (form_element) => {
    let record = {count: 0, was_allowed: null};

    form_element.addEventListener("submit", (event) => {
        record.count++;
        record.was_allowed = !event.defaultPrevented;
        event.preventDefault();
    });

    return record;
};

/**
 * Presses Enter in a field, as the user does.
 * @param {Element} field - The inner field the key is pressed in.
 * @return {KeyboardEvent}
 */
const press_enter = (field) => {
    let enter_event = new window.KeyboardEvent("keydown", {key: "Enter", bubbles: true, composed: true, cancelable: true});

    field.dispatchEvent(enter_event);

    return enter_event;
};

/**
 * Gets the galaxy-form in the document and the element with the given selector inside it.
 * @param {string} selector
 * @return {{form: HTMLElement, element: HTMLElement}}
 */
const get_in_form = (selector) => {
    let form = document.querySelector("galaxy-form");

    return {form, element: form.shadowRoot.querySelector(selector)};
};

describe("A10.1: GalaxyForm.request_submit() and reset()", () => {
    test("request_submit validates, dispatches the form's submit, and posts with native-submit", async () => {
        await render("<galaxy-form native-submit><galaxy-text-input name=\"name\" value=\"Press 1\" required></galaxy-text-input></galaxy-form>");

        let form = document.querySelector("galaxy-form");
        let submissions = watch_submissions(form.form_element);
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        form.request_submit();

        expect(submissions.count).toBe(1);
        expect(submissions.was_allowed).toBe(true);
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("an invalid form is not submitted", async () => {
        await render("<galaxy-form native-submit><galaxy-text-input name=\"name\" required></galaxy-text-input></galaxy-form>");

        let form = document.querySelector("galaxy-form");
        let submissions = watch_submissions(form.form_element);
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        form.request_submit();

        expect(submissions.was_allowed).toBe(false);
        expect(submit_listener).not.toHaveBeenCalled();
    });

    test("reset resets the internal form", async () => {
        await render("<galaxy-form></galaxy-form>");

        let form = document.querySelector("galaxy-form");
        let reset_listener = vi.fn();

        form.form_element.addEventListener("reset", reset_listener);
        form.reset();

        expect(reset_listener).toHaveBeenCalledTimes(1);
    });
});

describe("A10.2: a galaxy-button with submit or reset", () => {
    test("a submit button in a galaxy-form submits it", async () => {
        await render("<galaxy-form><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input><galaxy-button submit>Save</galaxy-button></galaxy-form>");

        let {form, element: button} = get_in_form("galaxy-button");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        button.button.click();

        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("a submit button in a native form submits it", async () => {
        await render("<form><galaxy-text-input name=\"name\"></galaxy-text-input><galaxy-button submit>Save</galaxy-button></form>");

        let submissions = watch_submissions(document.querySelector("form"));

        document.querySelector("galaxy-button").button.click();

        expect(submissions.count).toBe(1);
    });

    test("a reset button resets its form", async () => {
        await render("<form><galaxy-button reset>Clear</galaxy-button></form>");

        let reset_listener = vi.fn();

        document.querySelector("form").addEventListener("reset", reset_listener);
        document.querySelector("galaxy-button").button.click();

        expect(reset_listener).toHaveBeenCalledTimes(1);
    });

    test("a disabled submit button, and a button with neither attribute, do nothing", async () => {
        await render("<form><galaxy-button submit disabled>Save</galaxy-button><galaxy-button>Other</galaxy-button></form>");

        let submissions = watch_submissions(document.querySelector("form"));

        for (let button of document.querySelectorAll("galaxy-button")) {
            button.activate();
        }

        expect(submissions.count).toBe(0);
    });

    test("with has-confirm, the form is submitted only once the user confirms", async () => {
        await render("<form><galaxy-button submit has-confirm>Save</galaxy-button></form>");

        let button = document.querySelector("galaxy-button");
        let submissions = watch_submissions(document.querySelector("form"));

        button.button.click();
        expect(submissions.count).toBe(0);

        button.confirm_modal.ok_button.click();
        expect(submissions.count).toBe(1);
    });
});

describe("A10.4: a has-confirm galaxy-button inside a galaxy-form", () => {
    test("its confirmation modal is initialized, so a click opens it and OK submits the form", async () => {
        await render("<galaxy-form><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input><galaxy-button submit has-confirm>Save</galaxy-button></galaxy-form>");

        let {form, element: button} = get_in_form("galaxy-button");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(button.confirm_modal.is_initialized).toBe(true);

        button.button.click();
        expect(button.confirm_modal.open).toBe(true);

        button.confirm_modal.ok_button.click();
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });
});

describe("A10.2: a galaxy-button with form=\"id\"", () => {
    test("a button outside a galaxy-form submits it by id, even with the form inside another component's shadow root", async () => {
        await render(
            "<galaxy-form id=\"outer\"><galaxy-form id=\"inner_form\"><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input></galaxy-form></galaxy-form>" +
            "<galaxy-button submit form=\"inner_form\">Save</galaxy-button>"
        );

        let inner_form = document.querySelector("galaxy-form").shadowRoot.querySelector("galaxy-form");
        let submit_listener = vi.fn();

        inner_form.addEventListener("submit", submit_listener);
        document.querySelector("galaxy-button").button.click();

        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("a button outside a native form submits it by id", async () => {
        await render("<form id=\"native\"></form><galaxy-button submit form=\"native\">Save</galaxy-button>");

        let submissions = watch_submissions(document.querySelector("form"));

        document.querySelector("galaxy-button").button.click();

        expect(submissions.count).toBe(1);
    });

    test("form=\"id\" wins over the form around the button, and an unknown id gives no form", async () => {
        await render(
            "<form id=\"first\"><galaxy-button submit form=\"second\">Save</galaxy-button><galaxy-button submit form=\"missing\">Nowhere</galaxy-button></form>" +
            "<form id=\"second\"></form>"
        );

        let first_submissions = watch_submissions(document.getElementById("first"));
        let second_submissions = watch_submissions(document.getElementById("second"));
        let [linked_button, unlinked_button] = document.querySelectorAll("galaxy-button");

        expect(unlinked_button.form).toBe(null);

        linked_button.button.click();
        unlinked_button.button.click();

        expect(first_submissions.count).toBe(0);
        expect(second_submissions.count).toBe(1);
    });
});

describe("A10.3: Enter in a single-line Galaxy field submits its form when the form has submit-on-enter", () => {
    test("without submit-on-enter, Enter does nothing, even with a submit button", async () => {
        await render("<galaxy-form><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input><galaxy-button submit>Save</galaxy-button></galaxy-form>");

        let {form, element: input} = get_in_form("galaxy-text-input");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(form.submit_on_enter).toBe(false);
        expect(press_enter(input.input_element).defaultPrevented).toBe(false);
        expect(submit_listener).not.toHaveBeenCalled();
    });

    test("with no submit button, Enter submits through request_submit", async () => {
        await render("<galaxy-form submit-on-enter><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input></galaxy-form>");

        let {form, element: input} = get_in_form("galaxy-text-input");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(press_enter(input.input_element).defaultPrevented).toBe(true);
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("with a has-confirm default button, Enter asks first", async () => {
        await render("<galaxy-form submit-on-enter><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input><galaxy-button submit has-confirm>Save</galaxy-button></galaxy-form>");

        let {form, element: input} = get_in_form("galaxy-text-input");
        let button = form.shadowRoot.querySelector("galaxy-button");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        press_enter(input.input_element);

        expect(submit_listener).not.toHaveBeenCalled();
        expect(button.confirm_modal.open).toBe(true);

        button.confirm_modal.ok_button.click();
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("in a galaxy-form with a galaxy-button submit", async () => {
        await render("<galaxy-form submit-on-enter><galaxy-text-input name=\"name\" value=\"Press 1\"></galaxy-text-input><galaxy-button submit>Save</galaxy-button></galaxy-form>");

        let {form, element: input} = get_in_form("galaxy-text-input");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);

        expect(press_enter(input.input_element).defaultPrevented).toBe(true);
        expect(submit_listener).toHaveBeenCalledTimes(1);
    });

    test("in a native form with a <button> of no type", async () => {
        await render("<form submit-on-enter><galaxy-integer-input name=\"count\"></galaxy-integer-input><button>Go</button></form>");

        let submissions = watch_submissions(document.querySelector("form"));

        press_enter(document.querySelector("galaxy-integer-input").input_element);

        expect(submissions.count).toBe(1);
    });

    test("in a duration input's unit field and a date picker", async () => {
        await render("<form submit-on-enter><galaxy-duration-input name=\"duration\"></galaxy-duration-input><galaxy-date-picker name=\"date\"></galaxy-date-picker><button>Go</button></form>");

        let submissions = watch_submissions(document.querySelector("form"));
        let duration_input = document.querySelector("galaxy-duration-input");
        let first_unit_field = Object.values(duration_input.field_inputs)[0];

        press_enter(first_unit_field);
        press_enter(document.querySelector("galaxy-date-picker").input_element);

        expect(submissions.count).toBe(2);
    });

    test("a submit button inside the form that names another form is not its default button", async () => {
        await render(
            "<form id=\"first\" submit-on-enter><galaxy-text-input name=\"name\"></galaxy-text-input><galaxy-button submit form=\"second\">Other</galaxy-button></form>" +
            "<form id=\"second\"></form>"
        );

        let first_submissions = watch_submissions(document.getElementById("first"));
        let second_submissions = watch_submissions(document.getElementById("second"));

        press_enter(document.querySelector("galaxy-text-input").input_element);

        expect(first_submissions.count).toBe(1);
        expect(second_submissions.count).toBe(0);
    });

    test("a disabled default button blocks it", async () => {
        await render("<form submit-on-enter><galaxy-text-input name=\"name\"></galaxy-text-input><button disabled>Go</button><galaxy-button submit>Save</galaxy-button></form>");

        let submissions = watch_submissions(document.querySelector("form"));

        press_enter(document.querySelector("galaxy-text-input").input_element);

        expect(submissions.count).toBe(0);
    });

    test("an invalid galaxy-form is validated, not submitted", async () => {
        await render("<galaxy-form submit-on-enter><galaxy-text-input name=\"name\" required></galaxy-text-input><galaxy-button submit>Save</galaxy-button></galaxy-form>");

        let {form, element: input} = get_in_form("galaxy-text-input");
        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        press_enter(input.input_element);

        expect(submit_listener).not.toHaveBeenCalled();
        expect(input.validate()).toBe(false);
    });

    test("the textarea and the select do not submit", async () => {
        await render("<form submit-on-enter><galaxy-textarea name=\"notes\"></galaxy-textarea><galaxy-select name=\"pick\"></galaxy-select><button>Go</button></form>");

        let submissions = watch_submissions(document.querySelector("form"));

        press_enter(document.querySelector("galaxy-textarea").input_element);
        press_enter(document.querySelector("galaxy-select").input_element);

        expect(submissions.count).toBe(0);
    });

    test("a combo box submits on Enter, except when Enter picks a highlighted suggestion", async () => {
        await render("<form submit-on-enter><galaxy-combo-box name=\"format\" suggestions='[\"YYYY\", \"MM\"]'></galaxy-combo-box><button>Go</button></form>");

        let submissions = watch_submissions(document.querySelector("form"));
        let field = document.querySelector("galaxy-combo-box").input_element;

        field.dispatchEvent(new window.KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, composed: true, cancelable: true}));
        press_enter(field);
        expect(submissions.count).toBe(0);
        expect(field.value).toBe("YYYY");

        press_enter(field);
        expect(submissions.count).toBe(1);
    });
});
