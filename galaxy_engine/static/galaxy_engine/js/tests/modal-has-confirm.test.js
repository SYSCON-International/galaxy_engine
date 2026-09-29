import { describe, expect, test } from "vitest";
import { create_modal, flush_all } from "./modal-test-helpers.js";

// flush_all (not just flush) throughout: setting has_confirm to true on the OK/Cancel button cascades into
// that button's own async, requestAnimationFrame-deferred nested-confirm-modal build (see
// button-test-helpers.js's own comment on flush_all) - a plain microtask flush isn't enough to settle it,
// and leaving it dangling would bleed into later tests once it eventually does settle.

describe("has-ok-confirm / has-cancel-confirm reactivity (fix #3)", () => {
    test("has-ok-confirm present at creation builds the OK button with has-confirm", async () => {
        let modal = await create_modal({"has-ok-confirm": ""});

        expect(modal.ok_button.has_confirm).toBe(true);
    });

    test("has-cancel-confirm present at creation builds the Cancel button with has-confirm", async () => {
        let modal = await create_modal({"has-cancel-confirm": ""});

        expect(modal.cancel_button.has_confirm).toBe(true);
    });

    test("toggling has-ok-confirm on after creation updates the OK button", async () => {
        let modal = await create_modal();

        expect(modal.ok_button.has_confirm).toBe(false);

        modal.setAttribute("has-ok-confirm", "");
        await flush_all();

        expect(modal.ok_button.has_confirm).toBe(true);
    });

    test("toggling has-cancel-confirm on after creation updates the Cancel button", async () => {
        let modal = await create_modal();

        expect(modal.cancel_button.has_confirm).toBe(false);

        modal.setAttribute("has-cancel-confirm", "");
        await flush_all();

        expect(modal.cancel_button.has_confirm).toBe(true);
    });

    test("toggling has-ok-confirm back off updates the OK button too", async () => {
        let modal = await create_modal({"has-ok-confirm": ""});

        modal.removeAttribute("has-ok-confirm");
        await flush_all();

        expect(modal.ok_button.has_confirm).toBe(false);
    });
});
