import { describe, expect, test, vi } from "vitest";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-text-input")) {
    customElements.define("galaxy-text-input", GalaxyTextInput);
}

const state = () => window.galaxy_state_manager;

describe("A8.2: in-place changes and deletions reach everything bound", () => {
    test("re-assigning an array changed in place notifies subscribers and updates plain elements", () => {
        document.body.innerHTML = "<span data-property=\"items\"></span>";
        state().data.items = ["a"];

        let subscriber = vi.fn();

        state().subscribe("items", subscriber);
        state().data.items.push("b");
        state().data.items = state().data.items;

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(subscriber.mock.calls[0][1]).toEqual(["a", "b"]);
        expect(document.querySelector("span").textContent).toBe("a,b");
    });

    test("an equal but freshly built array is still not a change", () => {
        state().data.items = ["a"];

        let subscriber = vi.fn();

        state().subscribe("items", subscriber);
        state().data.items = ["a"];

        expect(subscriber).not.toHaveBeenCalled();
    });

    test("deleting a property clears bound inputs and plain elements and notifies subscribers", async () => {
        document.body.innerHTML = "<galaxy-text-input property-name=\"machine_name\"></galaxy-text-input><span data-property=\"machine_name\"></span>";
        await flush();

        let text_input = document.querySelector("galaxy-text-input");
        let subscriber = vi.fn();

        state().data.machine_name = "Press 1";
        state().subscribe("machine_name", subscriber);

        delete state().data.machine_name;

        expect(state().has_property("machine_name")).toBe(false);
        expect(text_input.value).toBe("");
        expect(document.querySelector("span").textContent).toBe("");
        expect(subscriber).toHaveBeenCalledWith("machine_name", undefined, "Press 1");
    });

    test("remove_property does the same, and deleting a missing property notifies nobody", () => {
        state().data.count = 3;

        let subscriber = vi.fn();

        state().subscribe("*", subscriber);
        state().remove_property("count");
        delete state().data.never_set;

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(subscriber).toHaveBeenCalledWith("count", undefined, 3);
    });
});
