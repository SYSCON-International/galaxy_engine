import { describe, expect, test } from "vitest";
import { create_modal } from "./modal-test-helpers.js";

describe("modal smoke test", () => {
    test("a modal connects and builds its structure", async () => {
        let modal = await create_modal();

        expect(modal.dialogue_element).toBeTruthy();
        expect(modal.ok_button).toBeTruthy();
        expect(modal.cancel_button).toBeTruthy();
        expect(modal.is_initialized).toBe(true);
    });
});
