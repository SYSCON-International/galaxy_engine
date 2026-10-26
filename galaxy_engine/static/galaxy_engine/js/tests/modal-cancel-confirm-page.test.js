import { afterEach, describe, expect, test, vi } from "vitest";
import { GalaxyModal } from "../components/GalaxyModal.js";
import { click_button, flush_all } from "./modal-test-helpers.js";

afterEach(() => {
    document.body.innerHTML = "";
});

// Mirrors the plantstar_apu modals prototype page's has-cancel-confirm demo, which a browser showed doing nothing on the confirmation's Discard.
const build_page_modal = async () => {
    let modal = document.createElement("galaxy-modal");

    for (let [name, value] of Object.entries({
        "size": "2", "has-cancel-confirm": "", "ok-button-text": "Save", "ok-button-icon": "save", "cancel-button-text": "Discard", "cancel-button-type": "danger",
    })) {
        modal.setAttribute(name, value);
    }

    document.body.appendChild(modal);
    await modal.ready;

    let cancel_callback = vi.fn();
    let declined = vi.fn();

    modal.set_title("Edit Shift Notes");
    modal.set_body("Discard asks first.");
    modal.confirm_callback = () => modal.close_modal();
    modal.cancel_callback = cancel_callback;
    modal.cancel_button.setAttribute("confirm-title-text", "Discard Changes?");
    modal.cancel_button.setAttribute("confirm-body-text", "Your shift notes will be lost.");
    modal.cancel_button.setAttribute("confirm-button-text", "Discard");
    modal.cancel_button.setAttribute("confirm-button-type", "danger");
    modal.cancel_button.setAttribute("cancel-button-text", "Keep Editing");
    modal.cancel_button.cancel_callback = declined;
    await flush_all();

    return {modal, cancel_callback, declined};
};

describe("the prototype page's has-cancel-confirm modal", () => {
    test("Discard, then the confirmation's Discard, cancels and closes everything", async () => {
        let {modal, cancel_callback} = await build_page_modal();

        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();
        click_button(modal.cancel_button.confirm_modal.ok_button);
        await flush_all();

        expect(cancel_callback).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(false);
        expect(modal.cancel_button.confirm_modal.open).toBe(false);
        expect(GalaxyModal.open_modals.length).toBe(0);
    });

    test("Keep Editing, then Discard again, then the confirmation's Discard", async () => {
        let {modal, cancel_callback, declined} = await build_page_modal();

        modal.open_modal();
        click_button(modal.cancel_button);
        await flush_all();
        click_button(modal.cancel_button.confirm_modal.cancel_button);
        await flush_all();
        expect(declined).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(true);

        click_button(modal.cancel_button);
        await flush_all();
        click_button(modal.cancel_button.confirm_modal.ok_button);
        await flush_all();

        expect(cancel_callback).toHaveBeenCalledTimes(1);
        expect(modal.open).toBe(false);
        expect(GalaxyModal.open_modals.length).toBe(0);
    });

    test("cancelling twice in a row works both times", async () => {
        let {modal, cancel_callback} = await build_page_modal();

        for (let round = 1; round <= 2; round++) {
            modal.open_modal();
            click_button(modal.cancel_button);
            await flush_all();
            click_button(modal.cancel_button.confirm_modal.ok_button);
            await flush_all();

            expect(cancel_callback).toHaveBeenCalledTimes(round);
            expect(modal.open).toBe(false);
        }

        expect(GalaxyModal.open_modals.length).toBe(0);
    });
});
