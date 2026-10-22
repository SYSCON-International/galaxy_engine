import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { create_select, flush, SIMPLE_OPTIONS } from "./test-helpers.js";

describe("option text is shown as text, never parsed as markup", () => {
    afterEach(() => {
        delete window.__galaxy_select_injection;
    });

    for (let kind of ["select", "multi-select"]) {
        test(`a ${kind} option whose text contains markup creates no elements and runs no handlers`, async () => {
            let markup_text = "<img src=\"x\" onerror=\"window.__galaxy_select_injection = 1\">";
            let select = await create_select(kind, {
                "options-data": JSON.stringify([{text: markup_text, value: "injected", node_type: "Option"}]),
            });

            select.open = true;
            await flush();

            let option_element = select.options_layer.querySelector("[value=\"injected\"]");

            expect(option_element).not.toBeNull();
            expect(option_element.querySelector("img")).toBeNull();
            expect(option_element.textContent).toBe(markup_text);
            expect(window.__galaxy_select_injection).toBeUndefined();
        });
    }
});

describe("attributes written in markup take effect", () => {
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

    test("a placeholder attribute in markup does not fail before the select is created", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "search-enabled": "",
            "placeholder": "Pick a fruit",
        });

        await flush();

        expect(unhandled_rejections).toEqual([]);

        select.open = true;
        await flush();

        expect(select.input_element.placeholder).toBe("Pick a fruit");
    });

    test("a value in markup is shown in a closed select's field without opening it", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "value": "banana",
        });

        expect(select.input_element.value).toBe("Banana");
    });

    test("options-size in markup caps a dropdown's list height", async () => {
        let select = await create_select("select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "options-size": "3",
        });

        expect(select.scroll_container.style.maxHeight).toBe(`${3 * select.option_height}px`);
    });

    test("options-size in markup sets an inline multi-select's list height", async () => {
        let select = await create_select("multi-select", {
            "options-data": JSON.stringify(SIMPLE_OPTIONS),
            "options-size": "2",
        });

        expect(select.scroll_container.style.height).toBe(`${2 * select.option_height}px`);
    });
});
