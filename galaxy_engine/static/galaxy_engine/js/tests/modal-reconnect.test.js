import { describe, expect, test } from "vitest";
import { create_modal, flush, flush_all } from "./modal-test-helpers.js";

describe("reconnecting a modal does not duplicate its DOM (fix #2)", () => {
    test("disconnecting then reconnecting rebuilds a single, fresh modal tree", async () => {
        let modal = await create_modal();
        let first_modal_dom = modal.modal;

        modal.remove();
        await flush(); // disconnectedCallback/on_destroy is async

        expect(modal.is_initialized).toBe(false);
        expect(modal.modal).toBeNull();

        document.body.appendChild(modal);
        await flush_all();

        expect(modal.shadowRoot.querySelectorAll(".galaxy-modal")).toHaveLength(1);
        expect(modal.modal).not.toBe(first_modal_dom);
        expect(modal.is_initialized).toBe(true);
    });

    test("the reconnected modal is still fully functional (open/close, OK/Cancel buttons present)", async () => {
        let modal = await create_modal();

        modal.remove();
        document.body.appendChild(modal);
        await flush_all();

        expect(modal.ok_button).toBeTruthy();
        expect(modal.cancel_button).toBeTruthy();

        modal.open_modal();
        expect(modal.open).toBe(true);

        modal.close_modal();
        expect(modal.open).toBe(false);
    });
});
