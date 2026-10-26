import { describe, expect, test } from "vitest";
import { create_modal, flush_all } from "./modal-test-helpers.js";

// A nested modal covers the whole window with its own backdrop, over its parent; the parent keeps its size and is dimmed behind it. (It used to shrink
// the parent to the nested modal's size, because a transform on the parent's dialog trapped the nested modal inside it.)
describe("a nested modal leaves its parent as it is", () => {
    const create_nested = async (parent_attributes) => {
        let parent_modal = await create_modal(parent_attributes);
        let nested_modal = document.createElement("galaxy-modal");

        nested_modal.setAttribute("size", "1");
        parent_modal.appendChild(nested_modal);
        await flush_all();

        return {parent_modal, nested_modal};
    };

    test("a parent with the default size keeps it while the nested modal is open", async () => {
        let {parent_modal, nested_modal} = await create_nested();

        parent_modal.open_modal();
        nested_modal.open_modal();

        expect(parent_modal.size).toBe(2);
        expect(parent_modal.hasAttribute("size")).toBe(false);
        expect(parent_modal.dialogue_element.style.height).toBe("");

        nested_modal.close_modal();

        expect(parent_modal.size).toBe(2);
        expect(parent_modal.open).toBe(true);
    });

    test("a parent with an explicit size keeps it", async () => {
        let {parent_modal, nested_modal} = await create_nested({size: "3"});

        nested_modal.open_modal();
        expect(parent_modal.size).toBe(3);
        expect(parent_modal.dialogue_element.style.height).toBe("");

        nested_modal.close_modal();
        expect(parent_modal.size).toBe(3);
    });

    test("a top-level modal opens and closes", async () => {
        let modal = await create_modal();

        expect(() => modal.open_modal()).not.toThrow();
        expect(modal.open).toBe(true);

        expect(() => modal.close_modal()).not.toThrow();
        expect(modal.open).toBe(false);
    });
});
