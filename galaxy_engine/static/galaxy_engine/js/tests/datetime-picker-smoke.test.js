import { describe, expect, test } from "vitest";
import { create_picker } from "./datetime-test-helpers.js";

describe("datetime picker smoke test", () => {
    test("a date picker connects and builds its input", async () => {
        let picker = await create_picker("date");

        expect(picker.input_element).toBeTruthy();
    });
});
