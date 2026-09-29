import { describe, expect, test } from "vitest";
import { create_duration } from "./duration-test-helpers.js";

describe("field labels are built via safe DOM APIs, not HTML string interpolation (fix #2)", () => {
    test("a malicious unit label renders as literal text, not injected markup", async () => {
        let malicious_label = `</label><img src=x onerror="window.__pwned = true">`;

        let input = await create_duration("input", {
            "visible-units": JSON.stringify(["minutes"]),
            "unit-labels": JSON.stringify({minutes: malicious_label}),
        });

        let label = input.fields_element.querySelector(".duration-input-label");

        expect(label.textContent).toBe(malicious_label);
        expect(input.fields_element.querySelectorAll("img")).toHaveLength(0);
        expect(window.__pwned).toBeUndefined();
    });

    test("a malicious aria-label (hide-labels mode) is inert too", async () => {
        let malicious_label = `"><img src=x onerror="window.__pwned2 = true">`;

        let input = await create_duration("input", {
            "hide-labels": "",
            "visible-units": JSON.stringify(["minutes"]),
            "unit-labels": JSON.stringify({minutes: malicious_label}),
        });

        let field_input = input.field_inputs.minutes;

        expect(field_input.getAttribute("aria-label")).toBe(malicious_label);
        expect(input.fields_element.querySelectorAll("img")).toHaveLength(0);
        expect(window.__pwned2).toBeUndefined();
    });

    test("a malicious label-less-separator renders as literal text", async () => {
        let malicious_separator = `<script>window.__pwned3 = true</script>`;

        let input = await create_duration("input", {
            "hide-labels": "",
            "visible-units": JSON.stringify(["hours", "minutes"]),
            "label-less-separator": malicious_separator,
        });

        let separator = input.fields_element.querySelector(".duration-input-separator");

        expect(separator.textContent).toBe(malicious_separator);
        expect(input.fields_element.querySelectorAll("script")).toHaveLength(0);
        expect(window.__pwned3).toBeUndefined();
    });

    test("normal labels still render correctly", async () => {
        let input = await create_duration("input", {
            "visible-units": JSON.stringify(["hours", "minutes"]),
        });

        let labels = [...input.fields_element.querySelectorAll(".duration-input-label")].map((el) => el.textContent);

        expect(labels).toEqual(["Hours", "Minutes"]);
    });
});
