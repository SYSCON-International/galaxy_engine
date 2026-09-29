import { describe, expect, test } from "vitest";
import { create_duration } from "./duration-test-helpers.js";

describe("duration components smoke test", () => {
    test("a duration input connects and builds its fields", async () => {
        let input = await create_duration("input", {value: "90061", unit: "seconds"});

        expect(input.field_inputs.days).toBeTruthy();
        expect(input.field_inputs.hours).toBeTruthy();
        expect(input.field_inputs.minutes).toBeTruthy();
        expect(input.field_inputs.seconds).toBeTruthy();
    });

    test("a duration display connects and renders formatted text", async () => {
        let display = await create_duration("display", {value: "90061", unit: "seconds"});

        expect(display.shadowRoot.querySelector(".duration-display").textContent).toBe("1d 1h 1m 1s");
    });
});
