import { describe, expect, test } from "vitest";
import { create_select, flush, SIMPLE_OPTIONS } from "./test-helpers.js";

const OPTIONS_JSON = JSON.stringify(SIMPLE_OPTIONS);

/**
 * Gets what the select currently submits under a name.
 * @param {HTMLElement} select - The select.
 * @param {string} name - The field name.
 * @return {string[]|null} - The submitted values, or null when nothing is submitted.
 */
const get_submitted_values = (select, name) => {
    let form_value = select._internals._form_value;

    if (form_value === null || form_value === undefined) {
        return null;
    }

    return form_value.getAll(name);
};

describe("select form value", () => {
    test("a multi-select submits every selected value, not just the last", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, name: "fruits", value: JSON.stringify(["apple", "banana", "cherry"])});

        expect(get_submitted_values(select, "fruits")).toEqual(["apple", "banana", "cherry"]);
    });

    test("changing the selection replaces what is submitted", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, name: "fruits", value: JSON.stringify(["apple", "banana"])});

        select.value = JSON.stringify(["cherry"]);
        await flush();

        expect(get_submitted_values(select, "fruits")).toEqual(["cherry"]);
    });

    test("a single select submits its one value", async () => {
        let select = await create_select("select", {"options-data": OPTIONS_JSON, name: "fruit", value: JSON.stringify(["banana"])});

        expect(get_submitted_values(select, "fruit")).toEqual(["banana"]);
    });

    test("nothing is submitted with no selection, or with no name", async () => {
        let unselected_select = await create_select("multi-select", {"options-data": OPTIONS_JSON, name: "fruits"});
        let unnamed_select = await create_select("multi-select", {"options-data": OPTIONS_JSON, value: JSON.stringify(["apple"])});

        expect(get_submitted_values(unselected_select, "fruits")).toBeNull();
        expect(get_submitted_values(unnamed_select, "")).toBeNull();
    });

    test("renaming re-submits under the new name and keeps the value intact", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, name: "fruits", value: JSON.stringify(["apple", "cherry"])});

        select.name = "chosen_fruits";
        await flush();

        expect(select.value).toEqual(["apple", "cherry"]);
        expect(get_submitted_values(select, "chosen_fruits")).toEqual(["apple", "cherry"]);
        expect(get_submitted_values(select, "fruits")).toEqual([]);
    });

    test("the restore state round-trips through formStateRestoreCallback", async () => {
        let select = await create_select("multi-select", {"options-data": OPTIONS_JSON, name: "fruits", value: JSON.stringify(["banana", "cherry"])});
        let restore_state = select._internals._form_state;
        let restored_select = await create_select("multi-select", {"options-data": OPTIONS_JSON, name: "fruits"});

        restored_select.formStateRestoreCallback(restore_state);
        await flush();

        expect(restore_state).toBe(JSON.stringify(["banana", "cherry"]));
        expect(restored_select.value).toEqual(["banana", "cherry"]);
        expect(get_submitted_values(restored_select, "fruits")).toEqual(["banana", "cherry"]);
    });
});
