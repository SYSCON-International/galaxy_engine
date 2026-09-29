import { describe, expect, test } from "vitest";
import { create_modal, flush_all } from "./modal-test-helpers.js";

describe("nested modal parent-size restoration (fix #1)", () => {
    test("closing a nested modal restores the parent's size/height, even when the parent used the default size", async () => {
        let parent_modal = await create_modal(); // no explicit size attribute -> default (2)

        expect(parent_modal.size).toBe(2);
        expect(parent_modal.hasAttribute("size")).toBe(false); // confirms this is genuinely the unset/default case

        let nested_modal = document.createElement("galaxy-modal");
        nested_modal.setAttribute("size", "1");
        parent_modal.appendChild(nested_modal);
        await flush_all();

        nested_modal.open_modal();

        expect(parent_modal.size).toBe(1); // temporarily overridden to match the nested modal
        expect(parent_modal.dialogue_element.style.height).not.toBe("");

        nested_modal.close_modal();

        expect(parent_modal.size).toBe(2); // restored
        expect(parent_modal.dialogue_element.style.height).toBe("");
    });

    test("still restores correctly when the parent did have an explicit size", async () => {
        let parent_modal = await create_modal({size: "3"});

        let nested_modal = document.createElement("galaxy-modal");
        nested_modal.setAttribute("size", "1");
        parent_modal.appendChild(nested_modal);
        await flush_all();

        nested_modal.open_modal();
        expect(parent_modal.size).toBe(1);

        nested_modal.close_modal();
        expect(parent_modal.size).toBe(3);
    });

    test("a top-level modal (no parent) opens/closes without touching any parent_modal state", async () => {
        let modal = await create_modal();

        expect(() => modal.open_modal()).not.toThrow();
        expect(modal.open).toBe(true);

        expect(() => modal.close_modal()).not.toThrow();
        expect(modal.open).toBe(false);
    });
});
