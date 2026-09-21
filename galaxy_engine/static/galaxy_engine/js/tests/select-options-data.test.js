import { describe, expect, test, vi } from "vitest";
import { create_select, SIMPLE_OPTIONS } from "./test-helpers.js";

describe("options-data handling (fix #1, #8)", () => {
    test("options declared via the options-data attribute render, not the old hardcoded fixture data", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
        });

        expect(select.options).toEqual(SIMPLE_OPTIONS);
        expect(select.flat_data.map((o) => o.value)).toEqual(["apple", "banana", "cherry"]);
    });

    test("a select with no options-data attribute starts empty rather than showing fixture data", async () => {
        let select = await create_select("select");

        expect(select.options).toEqual([]);
        expect(select.flat_data).toEqual([]);
    });

    test("invalid JSON in options-data is rejected with a console error, not silently accepted", async () => {
        let error_spy = vi.spyOn(console, "error").mockImplementation(() => {});

        let select = await create_select("select", {"options-data": "{not valid json"});

        expect(select.options).toEqual([]);
        expect(error_spy).toHaveBeenCalled();

        error_spy.mockRestore();
    });

    test("a leaf option with no node_type is treated as a plain Option, not silently dropped", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify([{text: "No Type", value: "no_type"}]),
        });

        expect(select.options).toEqual([{text: "No Type", value: "no_type", node_type: "Option"}]);
    });

    test("an option with an unrecognized node_type is dropped with a console error", async () => {
        let error_spy = vi.spyOn(console, "error").mockImplementation(() => {});

        let select = await create_select("select", {
            "options-data": JSON.stringify([
                {text: "Good", value: "good", node_type: "Option"},
                {text: "Bad", value: "bad", node_type: "Something Else"},
            ]),
        });

        expect(select.options).toEqual([{text: "Good", value: "good", node_type: "Option"}]);
        expect(error_spy).toHaveBeenCalled();

        error_spy.mockRestore();
    });

    test("setting .options programmatically after connecting still works", async () => {
        let select = await create_select("select");

        select.options = SIMPLE_OPTIONS;

        expect(select.options).toEqual(SIMPLE_OPTIONS);
    });
});
