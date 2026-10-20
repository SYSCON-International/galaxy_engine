import { describe, expect, test, vi } from "vitest";
import { GalaxyCheckbox } from "../components/GalaxyCheckbox.js";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-checkbox", GalaxyCheckbox], ["galaxy-form", GalaxyForm]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Creates and connects a <galaxy-checkbox>, setting attributes before connecting, and waits for its create lifecycle.
 * @param {Object<string, string>} attributes - Attribute name/value pairs to set before connecting.
 * @return {Promise<HTMLElement>}
 */
const create_checkbox = async (attributes = {}) => {
    let element = document.createElement("galaxy-checkbox");

    for (let [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }

    document.body.appendChild(element);

    await flush();

    return element;
};

const get_box = (checkbox) => {
    return checkbox.shadowRoot.querySelector("input[type=checkbox]");
};

describe("value and form value", () => {
    test("starts unchecked, with value false and form value \"false\"", async () => {
        let checkbox = await create_checkbox();

        expect(checkbox.checked).toBe(false);
        expect(checkbox.value).toBe(false);
        expect(get_box(checkbox).checked).toBe(false);
        expect(checkbox._internals._form_value).toBe("false");
    });

    test("the checked attribute sets value true and form value \"true\"", async () => {
        let checkbox = await create_checkbox({checked: ""});

        expect(checkbox.value).toBe(true);
        expect(get_box(checkbox).checked).toBe(true);
        expect(checkbox._internals._form_value).toBe("true");
    });

    test("value accepts booleans and boolean-like strings, and drives checked", async () => {
        let checkbox = await create_checkbox();

        for (let [input_value, expected_value] of [[true, true], [false, false], ["true", true], ["FALSE", false], ["on", true], ["1", true], ["0", false], ["", false], [null, false]]) {
            checkbox.value = input_value;
            await flush();

            expect(checkbox.value).toBe(expected_value);
            expect(checkbox.hasAttribute("checked")).toBe(expected_value);
            expect(checkbox._internals._form_value).toBe(String(expected_value));
        }
    });

    test("a value attribute in markup sets the checked state", async () => {
        let checkbox = await create_checkbox({value: "true"});

        expect(checkbox.checked).toBe(true);
    });

    test("setting checked from code does not dispatch change", async () => {
        let checkbox = await create_checkbox();
        let listener = vi.fn();

        checkbox.addEventListener("change", listener);
        checkbox.checked = true;
        await flush();

        expect(listener).not.toHaveBeenCalled();
    });
});

describe("user toggling", () => {
    test("a click toggles checked, updates the form value, and dispatches one change", async () => {
        let checkbox = await create_checkbox();
        let values = [];

        checkbox.addEventListener("change", () => values.push(checkbox.value));

        get_box(checkbox).click();
        await flush();

        expect(checkbox.checked).toBe(true);
        expect(checkbox._internals._form_value).toBe("true");

        get_box(checkbox).click();
        await flush();

        expect(values).toEqual([true, false]);
        expect(checkbox._internals._form_value).toBe("false");
    });

    test("clicking the label toggles the box", async () => {
        let checkbox = await create_checkbox({label: "Is Enabled"});

        checkbox.shadowRoot.querySelector("label").click();
        await flush();

        expect(checkbox.checked).toBe(true);
    });

    test("readonly blocks toggling and keeps the value", async () => {
        let checkbox = await create_checkbox({checked: "", readonly: ""});
        let listener = vi.fn();

        checkbox.addEventListener("change", listener);
        get_box(checkbox).click();
        checkbox.shadowRoot.querySelector("label").click();
        await flush();

        expect(checkbox.checked).toBe(true);
        expect(get_box(checkbox).checked).toBe(true);
        expect(listener).not.toHaveBeenCalled();
    });

    test("disabled disables the inner box", async () => {
        let checkbox = await create_checkbox({disabled: ""});

        expect(get_box(checkbox).disabled).toBe(true);
    });

    test("the host is not a second tab stop", async () => {
        let checkbox = await create_checkbox();

        expect(checkbox.hasAttribute("tabindex")).toBe(false);
    });
});

describe("indeterminate and switch", () => {
    test("indeterminate shows the mixed state, keeps value as checked, and clears on a user toggle", async () => {
        let checkbox = await create_checkbox({indeterminate: ""});

        expect(get_box(checkbox).indeterminate).toBe(true);
        expect(checkbox.value).toBe(false);

        get_box(checkbox).click();
        await flush();

        expect(checkbox.indeterminate).toBe(false);
        expect(get_box(checkbox).indeterminate).toBe(false);
        expect(checkbox.checked).toBe(true);
    });

    test("switch gives the box role=switch, and removing it restores a checkbox", async () => {
        let checkbox = await create_checkbox({switch: ""});

        expect(get_box(checkbox).getAttribute("role")).toBe("switch");

        checkbox.switch = false;
        await flush();

        expect(get_box(checkbox).hasAttribute("role")).toBe(false);
    });
});

describe("label", () => {
    test("the label is tied to the box and hidden when absent", async () => {
        let labelled_checkbox = await create_checkbox({label: "Is Enabled"});
        let unlabelled_checkbox = await create_checkbox();

        expect(labelled_checkbox.shadowRoot.querySelector("label").htmlFor).toBe("galaxy_checkbox_input");
        expect(labelled_checkbox.shadowRoot.querySelector("label").textContent).toBe("Is Enabled");
        expect(unlabelled_checkbox.shadowRoot.querySelector("label").style.display).toBe("none");
    });
});

describe("validation and forms", () => {
    test("required is invalid until checked", async () => {
        let checkbox = await create_checkbox({required: ""});

        expect(checkbox.validate()).toBe(false);
        expect(checkbox._internals.validationMessage).toBe("Please check this box.");

        checkbox.checked = true;
        await flush();

        expect(checkbox.validate()).toBe(true);
    });

    test("inside a galaxy-form with instant validation, toggling revalidates", async () => {
        document.body.innerHTML = "<galaxy-form instant-validation><galaxy-checkbox name='accept' required></galaxy-checkbox></galaxy-form>";
        await flush();
        await flush();

        let form = document.querySelector("galaxy-form");
        let checkbox = form.shadowRoot.querySelector("galaxy-checkbox");

        expect(checkbox.is_initialized).toBe(true);
        expect(checkbox._internals.checkValidity()).toBe(false);

        get_box(checkbox).click();
        await flush();

        expect(checkbox._internals.checkValidity()).toBe(true);
        expect(form.validate(false)).toBe(true);
    });

    test("form reset restores the initial checked state", async () => {
        let checkbox = await create_checkbox({checked: ""});

        checkbox.checked = false;
        checkbox.formResetCallback();
        await flush();

        expect(checkbox.checked).toBe(true);
    });

    test("form state restore accepts the submitted string", async () => {
        let checkbox = await create_checkbox();

        checkbox.formStateRestoreCallback("true");
        await flush();

        expect(checkbox.checked).toBe(true);
    });

    test("property-name mirrors the value to the state manager as a boolean", async () => {
        let checkbox = await create_checkbox({"property-name": "is_enabled"});

        expect(window.galaxy_state_manager.data.is_enabled).toBe(false);

        get_box(checkbox).click();
        await flush();

        expect(window.galaxy_state_manager.data.is_enabled).toBe(true);
    });
});

describe("lifecycle", () => {
    test("reconnecting renders one box, not two", async () => {
        let checkbox = await create_checkbox({checked: ""});

        checkbox.remove();
        await flush();
        document.body.appendChild(checkbox);
        await flush();

        expect(checkbox.shadowRoot.querySelectorAll("input[type=checkbox]")).toHaveLength(1);
        expect(get_box(checkbox).checked).toBe(true);
    });
});

describe("tri-state", () => {
    const get_state = (checkbox) => {
        return {value: checkbox.value, form_value: checkbox._internals._form_value, box_checked: get_box(checkbox).checked, box_indeterminate: get_box(checkbox).indeterminate};
    };

    test("clicks cycle unchecked -> indeterminate -> checked -> unchecked, three clicks returning to indeterminate", async () => {
        let checkbox = await create_checkbox({"tri-state": "", indeterminate: ""});
        let values = [];

        checkbox.addEventListener("change", () => values.push(checkbox.value));

        expect(get_state(checkbox)).toEqual({value: null, form_value: "", box_checked: false, box_indeterminate: true});

        for (let click_index = 0; click_index < 3; click_index++) {
            get_box(checkbox).click();
            await flush();
        }

        expect(values).toEqual([true, false, null]);
        expect(get_state(checkbox)).toEqual({value: null, form_value: "", box_checked: false, box_indeterminate: true});
    });

    test("from unchecked, the first click goes to indeterminate, with each state's form value", async () => {
        let checkbox = await create_checkbox({"tri-state": ""});

        get_box(checkbox).click();
        await flush();
        expect(get_state(checkbox)).toEqual({value: null, form_value: "", box_checked: false, box_indeterminate: true});

        get_box(checkbox).click();
        await flush();
        expect(get_state(checkbox)).toEqual({value: true, form_value: "true", box_checked: true, box_indeterminate: false});

        get_box(checkbox).click();
        await flush();
        expect(get_state(checkbox)).toEqual({value: false, form_value: "false", box_checked: false, box_indeterminate: false});
    });

    test("the cycle also runs through the label and through a switch", async () => {
        let checkbox = await create_checkbox({"tri-state": "", switch: "", label: "Override"});

        checkbox.shadowRoot.querySelector("label").click();
        await flush();

        expect(checkbox.value).toBe(null);
        expect(checkbox.indeterminate).toBe(true);
        expect(checkbox.checked).toBe(false);
    });

    test("value accepts null-like values for indeterminate and clears it for booleans", async () => {
        let checkbox = await create_checkbox({"tri-state": ""});

        for (let [input_value, expected_value] of [[null, null], [true, true], ["mixed", null], ["false", false], [undefined, null], ["on", true], ["", null], [0, false]]) {
            checkbox.value = input_value;
            await flush();

            expect(checkbox.value).toBe(expected_value);
            expect(checkbox.indeterminate).toBe(expected_value === null);
            expect(checkbox.checked).toBe(expected_value === true);
        }
    });

    test("a value=\"null\" attribute in markup starts indeterminate", async () => {
        let checkbox = await create_checkbox({"tri-state": "", value: "null"});

        expect(checkbox.value).toBe(null);
        expect(get_box(checkbox).indeterminate).toBe(true);
    });

    test("required treats indeterminate as empty", async () => {
        let checkbox = await create_checkbox({"tri-state": "", indeterminate: "", required: ""});

        expect(checkbox.validate()).toBe(false);

        checkbox.value = true;
        await flush();

        expect(checkbox.validate()).toBe(true);
    });

    test("form reset restores the initial indeterminate state, and state restore accepts \"\"", async () => {
        let checkbox = await create_checkbox({"tri-state": "", indeterminate: ""});

        checkbox.value = true;
        await flush();
        checkbox.formResetCallback();
        await flush();

        expect(checkbox.value).toBe(null);

        checkbox.value = false;
        checkbox.formStateRestoreCallback("");
        await flush();

        expect(checkbox.value).toBe(null);
    });

    test("property-name mirrors null to the state manager while indeterminate", async () => {
        let checkbox = await create_checkbox({"tri-state": "", "property-name": "override_enabled"});

        get_box(checkbox).click();
        await flush();

        expect(window.galaxy_state_manager.data.override_enabled).toBe(null);
    });

    test("readonly blocks the cycle", async () => {
        let checkbox = await create_checkbox({"tri-state": "", indeterminate: "", readonly: ""});

        get_box(checkbox).click();
        await flush();

        expect(checkbox.value).toBe(null);
        expect(get_box(checkbox).indeterminate).toBe(true);
    });

    test("without tri-state, indeterminate stays visual and is never returned to", async () => {
        let checkbox = await create_checkbox({indeterminate: ""});
        let values = [];

        checkbox.addEventListener("change", () => values.push(checkbox.value));

        expect(checkbox.value).toBe(false);
        expect(checkbox._internals._form_value).toBe("false");

        for (let click_index = 0; click_index < 3; click_index++) {
            get_box(checkbox).click();
            await flush();
        }

        expect(values).toEqual([true, false, true]);
        expect(checkbox.indeterminate).toBe(false);
    });

    test("turning tri-state on while indeterminate switches the value to null and re-submits", async () => {
        let checkbox = await create_checkbox({indeterminate: ""});

        checkbox.tri_state = true;
        await flush();

        expect(checkbox.value).toBe(null);
        expect(checkbox._internals._form_value).toBe("");
    });
});
