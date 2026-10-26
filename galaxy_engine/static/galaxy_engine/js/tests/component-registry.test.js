import { describe, expect, test } from "vitest";
import "../GalaxyEngine.js";
import { GalaxyHTMLComponentBase } from "../components/GalaxyHTMLComponentBase.js";
import { flush_all } from "./modal-test-helpers.js";

/**
 * Parses markup into the document and waits for every component in it to be created.
 * @param {string} markup
 */
const render = async (markup) => {
    document.body.innerHTML = markup;

    await flush_all();
    await flush_all();
};

describe("A11: the component registry", () => {
    test("a connected component is registered by tag, and found by id inside a galaxy-form's shadow root", async () => {
        await render("<galaxy-form id=\"outer\"><galaxy-text-input id=\"name\"></galaxy-text-input><galaxy-modal id=\"1st:modal\"></galaxy-modal></galaxy-form>");

        let form = document.querySelector("galaxy-form");
        let text_input = form.shadowRoot.querySelector("galaxy-text-input");

        expect(GalaxyHTMLComponentBase.get_components("galaxy-form")).toEqual([form]);
        expect(GalaxyHTMLComponentBase.find_component("galaxy-text-input", "name")).toBe(text_input);
        expect(GalaxyHTMLComponentBase.find_component("GALAXY-MODAL", "1st:modal")).toBe(form.shadowRoot.querySelector("galaxy-modal"));
        expect(GalaxyHTMLComponentBase.find_component("galaxy-modal", "missing")).toBe(null);
    });

    test("a removed component leaves the registry, and a moved one is listed once", async () => {
        await render("<galaxy-button id=\"save\"></galaxy-button><div></div>");

        let button = document.querySelector("galaxy-button");

        document.querySelector("div").appendChild(button);
        await flush_all();
        expect(GalaxyHTMLComponentBase.get_components("galaxy-button")).toEqual([button]);

        button.remove();
        await flush_all();
        expect(GalaxyHTMLComponentBase.get_components("galaxy-button")).toEqual([]);
        expect(GalaxyHTMLComponentBase.find_component("galaxy-button", "save")).toBe(null);
    });

    test("a component created but never connected is not registered", () => {
        let button = document.createElement("galaxy-button");

        button.id = "detached";

        expect(GalaxyHTMLComponentBase.find_component("galaxy-button", "detached")).toBe(null);
    });

    test("an id changed after connecting is found by its new value", async () => {
        await render("<galaxy-modal id=\"before\"></galaxy-modal>");

        let modal = document.querySelector("galaxy-modal");

        modal.id = "after";

        expect(GalaxyHTMLComponentBase.find_component("galaxy-modal", "after")).toBe(modal);
        expect(GalaxyHTMLComponentBase.find_component("galaxy-modal", "before")).toBe(null);
    });
});
