import { describe, expect, test, vi } from "vitest";
import { click_button, create_button, flush_all } from "./button-test-helpers.js";

describe("GalaxyButton confirm modal", () => {
    test("a plain button has no confirm modal and just runs the click handler with no error", async () => {
        let button = await create_button();

        expect(button.confirm_modal).toBeUndefined();
        expect(() => click_button(button)).not.toThrow();
    });

    test("clicking a has-confirm button opens the confirm modal", async () => {
        let button = await create_button({"has-confirm": ""});

        expect(button.confirm_modal).toBeTruthy();
        expect(button.confirm_modal.open).toBe(false);

        click_button(button);

        expect(button.confirm_modal.open).toBe(true);
    });

    test("clicking OK fires the confirm callback and actually closes the modal (fix #1)", async () => {
        let button = await create_button({"has-confirm": ""});
        let confirm_spy = vi.fn();
        button.confirm_callback = confirm_spy;

        click_button(button);
        expect(button.confirm_modal.open).toBe(true);

        expect(() => click_button(button.confirm_modal.ok_button)).not.toThrow();

        expect(confirm_spy).toHaveBeenCalledOnce();
        expect(button.confirm_modal.open).toBe(false);
    });

    test("clicking Cancel fires the cancel callback and actually closes the modal (fix #1)", async () => {
        let button = await create_button({"has-confirm": ""});
        let cancel_spy = vi.fn();
        button.cancel_callback = cancel_spy;

        click_button(button);
        expect(button.confirm_modal.open).toBe(true);

        expect(() => click_button(button.confirm_modal.cancel_button)).not.toThrow();

        expect(cancel_spy).toHaveBeenCalledOnce();
        expect(button.confirm_modal.open).toBe(false);
    });

    test("confirm text attributes populate the modal, with documented defaults when unset", async () => {
        let default_button = await create_button({"has-confirm": ""});
        click_button(default_button);

        expect(default_button.confirm_modal.modal_title.textContent).toBe("Confirm");
        expect(default_button.confirm_modal.body_element.textContent).toBe("Are you sure?");
        expect(default_button.confirm_modal.ok_button.textContent.trim()).toBe("OK");
        expect(default_button.confirm_modal.cancel_button.textContent.trim()).toBe("Cancel");

        let custom_button = await create_button({
            "has-confirm": "",
            "confirm-title-text": "Delete item?",
            "confirm-body-text": "This can't be undone.",
            "confirm-button-text": "Delete",
            "cancel-button-text": "Keep it",
        });
        click_button(custom_button);

        expect(custom_button.confirm_modal.modal_title.textContent).toBe("Delete item?");
        expect(custom_button.confirm_modal.body_element.textContent).toBe("This can't be undone.");
        expect(custom_button.confirm_modal.ok_button.textContent.trim()).toBe("Delete");
        expect(custom_button.confirm_modal.cancel_button.textContent.trim()).toBe("Keep it");
    });

    test("adding has-confirm after connection lazily creates the modal and makes the button responsive (fix #3)", async () => {
        let button = await create_button();

        expect(button.confirm_modal).toBeUndefined();

        button.has_confirm = true;
        await flush_all();

        expect(button.confirm_modal).toBeTruthy();

        click_button(button);
        expect(button.confirm_modal.open).toBe(true);
    });

    test("removing then re-adding has-confirm doesn't recreate the modal (it's only ever built once)", async () => {
        let button = await create_button({"has-confirm": ""});
        let first_modal = button.confirm_modal;

        button.has_confirm = false;
        await flush_all();
        button.has_confirm = true;
        await flush_all();

        expect(button.confirm_modal).toBe(first_modal);
    });
});
