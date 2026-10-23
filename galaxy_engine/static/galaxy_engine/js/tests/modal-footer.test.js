import { describe, expect, test } from "vitest";
import { create_modal, flush_all } from "./modal-test-helpers.js";

/**
 * The button's label: its own text, without any confirmation modal it holds.
 * @param {HTMLElement} galaxy_button
 * @return {string}
 */
const get_label = (galaxy_button) => Array.from(galaxy_button.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("");

const get_style_text = (element) => Array.from(element.shadowRoot.querySelectorAll("style")).map((style) => style.textContent).join("\n");

describe("the modal footer's defaults", () => {
    test("OK is a green success button and Cancel a red danger button", async () => {
        let modal = await create_modal();

        expect(get_label(modal.ok_button)).toBe("OK");
        expect(modal.ok_button.getAttribute("type")).toBe("success");
        expect(get_label(modal.cancel_button)).toBe("Cancel");
        expect(modal.cancel_button.getAttribute("type")).toBe("danger");
        expect(modal.ok_button.hasAttribute("icon")).toBe(false);
        expect(modal.cancel_button.hidden).toBe(false);
    });
});

describe("the modal footer is configured in markup", () => {
    test("text, type and icon for each button", async () => {
        let modal = await create_modal({
            "ok-button-text": "Save",
            "ok-button-type": "warning",
            "ok-button-icon": "save",
            "cancel-button-text": "Close",
            "cancel-button-type": "secondary",
            "cancel-button-icon": "cancel",
        });

        expect(get_label(modal.ok_button)).toBe("Save");
        expect(modal.ok_button.getAttribute("type")).toBe("warning");
        expect(modal.ok_button.getAttribute("icon")).toBe("save");
        expect(get_label(modal.cancel_button)).toBe("Close");
        expect(modal.cancel_button.getAttribute("type")).toBe("secondary");
        expect(modal.cancel_button.getAttribute("icon")).toBe("cancel");
    });

    test("changing an attribute later updates the button, and removing it restores the default", async () => {
        let modal = await create_modal();

        modal.setAttribute("ok-button-text", "Apply");
        modal.setAttribute("ok-button-type", "light");
        modal.setAttribute("ok-button-icon", "confirm");
        await flush_all();

        expect(get_label(modal.ok_button)).toBe("Apply");
        expect(modal.ok_button.getAttribute("type")).toBe("light");
        expect(modal.ok_button.getAttribute("icon")).toBe("confirm");

        modal.removeAttribute("ok-button-text");
        modal.removeAttribute("ok-button-type");
        modal.removeAttribute("ok-button-icon");
        await flush_all();

        expect(get_label(modal.ok_button)).toBe("OK");
        expect(modal.ok_button.getAttribute("type")).toBe("success");
        expect(modal.ok_button.hasAttribute("icon")).toBe(false);
    });

    test("hide-cancel hides the Cancel button, and removing it shows it again", async () => {
        let modal = await create_modal({"hide-cancel": ""});

        expect(modal.cancel_button.hidden).toBe(true);
        expect(get_style_text(modal)).toMatch(/galaxy-button\[hidden\]\s*\{\s*display:\s*none;/);

        modal.removeAttribute("hide-cancel");
        await flush_all();

        expect(modal.cancel_button.hidden).toBe(false);
    });

    test("button text containing markup stays text", async () => {
        let modal = await create_modal({"ok-button-text": "<img src=\"x\" onerror=\"window.__modal_injection = 1\">"});

        expect(modal.ok_button.querySelector("img")).toBeNull();
        expect(get_label(modal.ok_button)).toBe("<img src=\"x\" onerror=\"window.__modal_injection = 1\">");
        expect(window.__modal_injection).toBeUndefined();
    });

    test("relabeling a button that asks for confirmation keeps its confirmation modal", async () => {
        let modal = await create_modal({"has-ok-confirm": "", "ok-button-text": "Delete"});

        let confirm_modal = modal.ok_button.confirm_modal;

        expect(confirm_modal).toBeTruthy();

        modal.setAttribute("ok-button-text", "Remove");
        await flush_all();

        expect(get_label(modal.ok_button)).toBe("Remove");
        expect(modal.ok_button.contains(confirm_modal)).toBe(true);
    });
});
