import { describe, expect, test } from "vitest";
import { create_select, GROUPED_OPTIONS } from "./test-helpers.js";

describe("searching a group's own name shows all of its children (fix #9)", () => {
    test("a query matching only the group label returns the group with every child, not just text-matching ones", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(GROUPED_OPTIONS)});

        let results = select.search_data("Berries", select.options);

        expect(results).toHaveLength(1);
        expect(results[0].value).toBe("berries");
        expect(results[0].children.map((c) => c.value)).toEqual(["blueberry", "blackberry"]);
    });

    test("a query matching a child's text still filters down to just that child", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(GROUPED_OPTIONS)});

        let results = select.search_data("Blueberry", select.options);

        expect(results).toHaveLength(1);
        expect(results[0].children.map((c) => c.value)).toEqual(["blueberry"]);
    });

    test("a non-matching query returns no results", async () => {
        let select = await create_select("select", {"options-data": JSON.stringify(GROUPED_OPTIONS)});

        expect(select.search_data("nonexistent", select.options)).toEqual([]);
    });
});
