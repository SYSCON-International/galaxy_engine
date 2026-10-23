import { describe, expect, test, vi } from "vitest";
import { GalaxyDurationInput } from "../components/GalaxyDurationInput.js";
import { flush } from "./test-helpers.js";

if (!customElements.get("galaxy-duration-input")) {
    customElements.define("galaxy-duration-input", GalaxyDurationInput);
}

const create_duration_input = async (attributes = {}) => {
    let duration_input = document.createElement("galaxy-duration-input");

    for (let [name, value] of Object.entries(attributes)) {
        duration_input.setAttribute(name, value);
    }

    document.body.appendChild(duration_input);
    await flush();
    await flush();

    return duration_input;
};

describe("a duration input's value attribute reaches its fields", () => {
    test("setting the attribute after creation updates the value, the fields and the form value", async () => {
        let duration_input = await create_duration_input({name: "duration", value: "60"});

        duration_input.setAttribute("value", "120");
        await flush();
        await flush();

        expect(duration_input.value).toBe(120);
        expect(duration_input.field_inputs.minutes.value).toBe("02");
        expect(duration_input._internals._form_value).toBe("120");
    });

    test("removing the attribute makes the duration 0, in the fields and the form value", async () => {
        let duration_input = await create_duration_input({name: "duration", value: "60"});

        duration_input.removeAttribute("value");
        await flush();
        await flush();

        expect(duration_input.value).toBe(0);
        expect(duration_input.field_inputs.minutes.value).toBe("00");
        expect(duration_input._internals._form_value).toBe("0");
    });
});

describe("a duration input fires change like every Galaxy field", () => {
    test("typing fires no change; committing a field fires one bubbling change on the element", async () => {
        let duration_input = await create_duration_input({value: "0"});
        let change_listener = vi.fn();
        let minutes_field = duration_input.field_inputs.minutes;

        duration_input.addEventListener("change", change_listener);

        minutes_field.value = "1";
        minutes_field.dispatchEvent(new Event("input", {bubbles: true}));
        minutes_field.value = "12";
        minutes_field.dispatchEvent(new Event("input", {bubbles: true}));

        expect(change_listener).not.toHaveBeenCalled();

        minutes_field.dispatchEvent(new Event("change", {bubbles: true}));

        expect(change_listener).toHaveBeenCalledTimes(1);
        expect(change_listener.mock.calls[0][0].bubbles).toBe(true);
        expect(duration_input.value).toBe(720);
    });
});
