import { describe, expect, test } from "vitest";
import { create_select, SIMPLE_OPTIONS } from "./test-helpers.js";

describe("GalaxySelect smoke test", () => {
    test("connects, builds its DOM, and renders declaratively-provided options", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
        });

        expect(select.input_element).toBeTruthy();
        expect(select.scroll_container).toBeTruthy();
        expect(select.options).toEqual(SIMPLE_OPTIONS.map((o) => ({...o})));
    });
});
