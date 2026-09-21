import { describe, expect, test } from "vitest";
import { create_select } from "./test-helpers.js";

describe("the option element pool is sized to visible rows, not total rows (fix #7)", () => {
    test("a large option list does not grow the DOM pool to match the total option count", async () => {
        let many_options = Array.from({length: 500}, (_, i) => ({
            text: `Option ${i}`,
            value: `option_${i}`,
            node_type: "Option",
        }));

        let select = await create_select("select", {"options-data": JSON.stringify(many_options)});

        expect(select.flat_data).toHaveLength(500);
        // jsdom reports 0 for clientHeight (no real layout engine), so the "how many rows fit on screen"
        // calculation always lands on the same small buffer count - the bug being tested for is a pool
        // that instead grows to flat_data.length (500). Either way, the pool must stay far below the total.
        expect(select.option_elements_pool.length).toBeLessThan(20);
        expect(select.max_visible_options).toBe(select.option_elements_pool.length);
    });

    test("create_or_resize_option_elements_pool never allocates more elements than requested", async () => {
        let select = await create_select("select");

        select.create_or_resize_option_elements_pool(5);
        expect(select.option_elements_pool).toHaveLength(5);

        select.create_or_resize_option_elements_pool(2);
        expect(select.option_elements_pool).toHaveLength(2);

        select.create_or_resize_option_elements_pool(8);
        expect(select.option_elements_pool).toHaveLength(8);
    });

    test("pooled option elements get stable, unique ids for aria-activedescendant", async () => {
        let select = await create_select("select");

        select.create_or_resize_option_elements_pool(3);

        let ids = select.option_elements_pool.map((el) => el.id);
        expect(new Set(ids).size).toBe(3);
        expect(ids.every((id) => id.length > 0)).toBe(true);
    });
});
