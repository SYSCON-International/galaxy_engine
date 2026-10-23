import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { click_button, flush } from "./modal-test-helpers.js";

// Every test here waits with flush() alone - one macrotask - and never for an animation frame, so anything that only works after a frame fails.

/**
 * Creates and connects a <galaxy-modal> and waits for its create lifecycle, but not for an animation frame.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
const create_modal_without_frame = async (attributes = {}) => {
    let modal = document.createElement("galaxy-modal");

    for (let [name, value] of Object.entries(attributes)) {
        modal.setAttribute(name, value);
    }

    document.body.appendChild(modal);
    await flush();

    return modal;
};

describe("a galaxy-modal is usable as soon as it is created", () => {
    test("set_title works without waiting for a frame", async () => {
        let modal = await create_modal_without_frame();

        modal.set_title("Edit Machine");

        expect(modal.shadowRoot.querySelector(".header h3").textContent).toBe("Edit Machine");
    });

    test("the close button, Cancel and OK respond without waiting for a frame", async () => {
        let modal = await create_modal_without_frame();
        let confirm_callback = vi.fn();
        let cancel_callback = vi.fn();

        modal.confirm_callback = confirm_callback;
        modal.cancel_callback = cancel_callback;

        modal.open_modal();
        modal.shadowRoot.querySelector(".header button").click();
        expect(modal.open).toBe(false);

        modal.open_modal();
        click_button(modal.cancel_button);
        expect(modal.open).toBe(false);
        expect(cancel_callback).toHaveBeenCalledTimes(1);

        click_button(modal.ok_button);
        expect(confirm_callback).toHaveBeenCalledTimes(1);
    });

    test("Escape closes a quick-close modal without waiting for a frame", async () => {
        let modal = await create_modal_without_frame({"quick-close": ""});

        modal.open_modal();
        document.dispatchEvent(new window.KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));

        expect(modal.open).toBe(false);
    });
});

describe("a galaxy-modal says when it is ready", () => {
    test("dispatches ready once, when it is wired", async () => {
        let modal = document.createElement("galaxy-modal");
        let ready_listener = vi.fn(() => {
            // By the time ready fires, the modal is fully usable.
            modal.set_title("Ready");
        });

        modal.addEventListener("ready", ready_listener);
        document.body.appendChild(modal);
        await flush();

        expect(ready_listener).toHaveBeenCalledTimes(1);
        expect(modal.shadowRoot.querySelector(".header h3").textContent).toBe("Ready");
    });

    test("the ready promise resolves once it is wired, and again after a reconnect", async () => {
        let modal = document.createElement("galaxy-modal");
        let first_ready = modal.ready;

        document.body.appendChild(modal);
        await first_ready;

        expect(modal.modal_title).toBeTruthy();

        modal.remove();
        await flush();

        let second_ready = modal.ready;

        expect(second_ready).not.toBe(first_ready);

        document.body.appendChild(modal);
        await second_ready;

        expect(modal.modal_title).toBeTruthy();
    });
});

describe("a galaxy-modal removed right after it is created", () => {
    let unhandled_rejections = [];
    let record_rejection = (reason) => {
        unhandled_rejections.push(reason);
    };

    beforeEach(() => {
        unhandled_rejections = [];
        process.on("unhandledRejection", record_rejection);
    });

    afterEach(() => {
        process.off("unhandledRejection", record_rejection);
    });

    test("tears down without an error", async () => {
        let modal = await create_modal_without_frame();

        modal.remove();
        await flush();

        expect(unhandled_rejections).toEqual([]);
        expect(modal.is_initialized).toBe(false);
    });
});
