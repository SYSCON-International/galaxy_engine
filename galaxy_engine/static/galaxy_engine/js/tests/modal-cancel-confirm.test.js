import { afterEach, describe, expect, test, vi } from "vitest";
import { create_modal, click_button, flush_all } from "./modal-test-helpers.js";

afterEach(() => {
    document.body.innerHTML = "";
});

describe("has-cancel-confirm: Cancel asks first, and only a confirmed cancel cancels", () => {
    test("Cancel opens the confirmation and leaves the modal open", async () => {
        let modal = await create_modal({"has-cancel-confirm": ""});
        let cancel_callback = vi.fn();

        modal.cancel_callback = cancel_callback;
        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();

        expect(modal.open).toBe(true);
        expect(modal.cancel_button.confirm_modal.open).toBe(true);
        expect(cancel_callback).not.toHaveBeenCalled();
    });

    test("confirming runs the cancel callback once and closes the modal", async () => {
        let modal = await create_modal({"has-cancel-confirm": ""});
        let cancel_callback = vi.fn();

        modal.cancel_callback = cancel_callback;
        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();
        click_button(modal.cancel_button.confirm_modal.ok_button);
        await flush_all();

        expect(cancel_callback).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(false);
        expect(modal.cancel_button.confirm_modal.open).toBe(false);
    });

    test("declining keeps the modal open and runs no callback", async () => {
        let modal = await create_modal({"has-cancel-confirm": ""});
        let cancel_callback = vi.fn();

        modal.cancel_callback = cancel_callback;
        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();
        click_button(modal.cancel_button.confirm_modal.cancel_button);
        await flush_all();

        expect(cancel_callback).not.toHaveBeenCalled();
        expect(modal.open).toBe(true);
        expect(modal.cancel_button.confirm_modal.open).toBe(false);
    });

    test("a callback set before the modal is created is the one a confirmed cancel runs", async () => {
        let modal = document.createElement("galaxy-modal");
        let cancel_callback = vi.fn();

        modal.setAttribute("has-cancel-confirm", "");
        modal.cancel_callback = cancel_callback;
        document.body.appendChild(modal);
        await flush_all();
        await flush_all();

        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();
        click_button(modal.cancel_button.confirm_modal.ok_button);
        await flush_all();

        expect(cancel_callback).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(false);
    });

    test("turning has-cancel-confirm off makes Cancel cancel at once again", async () => {
        let modal = await create_modal({"has-cancel-confirm": ""});
        let cancel_callback = vi.fn();

        modal.cancel_callback = cancel_callback;
        modal.removeAttribute("has-cancel-confirm");
        await flush_all();
        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();

        expect(cancel_callback).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(false);
    });

    test("without has-cancel-confirm, Cancel runs the callback once and closes", async () => {
        let modal = await create_modal();
        let cancel_callback = vi.fn();

        modal.cancel_callback = cancel_callback;
        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();

        expect(cancel_callback).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(false);
    });
});

describe("has-ok-confirm: clicks inside the confirmation do not reach the modal's OK handling", () => {
    test("confirming OK runs the confirm callback once", async () => {
        let modal = await create_modal({"has-ok-confirm": ""});
        let confirm_callback = vi.fn();

        modal.confirm_callback = confirm_callback;
        modal.open_modal();
        click_button(modal.ok_button);
        await flush_all();
        click_button(modal.ok_button.confirm_modal.ok_button);
        await flush_all();

        expect(confirm_callback).toHaveBeenCalledTimes(1);
    });
});

describe("a has-confirm button's confirmation is rendered", () => {
    test("the confirmation is assigned to a slot in the button, outside its native button", async () => {
        let modal = await create_modal({"has-cancel-confirm": ""});
        let confirm_modal = modal.cancel_button.confirm_modal;
        let native_button = modal.cancel_button.shadowRoot.querySelector("button");

        expect(confirm_modal.assignedSlot).not.toBeNull();
        expect(native_button.contains(confirm_modal.assignedSlot)).toBe(false);
    });
});
