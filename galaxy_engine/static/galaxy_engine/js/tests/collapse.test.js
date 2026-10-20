import { describe, expect, test, vi } from "vitest";
import { GalaxyCollapse } from "../components/GalaxyCollapse.js";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-collapse", GalaxyCollapse], ["galaxy-form", GalaxyForm], ["galaxy-text-input", GalaxyTextInput]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Parses markup into the document and waits for every create lifecycle to settle.
 * @param {string} markup - The markup.
 */
const render = async (markup) => {
    document.body.innerHTML = markup;

    await flush();
    await flush();
};

const get_heading_button = (collapse) => collapse.shadowRoot.querySelector(".heading");
const get_body = (collapse) => collapse.shadowRoot.querySelector(".body");

/**
 * Records every toggle event a collapse dispatches.
 * @param {HTMLElement} collapse - The collapse.
 * @return {boolean[]} - The detail.open of each event, in order.
 */
const record_toggles = (collapse) => {
    let open_states = [];

    collapse.addEventListener("toggle", (event) => open_states.push(event.detail.open));

    return open_states;
};

describe("slots", () => {
    test("the heading slot fills the heading, and every other child - any HTML - is the body", async () => {
        await render(`
            <galaxy-collapse>
                <span slot="heading">Machine Details</span>
                <p>Paragraph</p>
                <table><tr><td>Cell</td></tr></table>
                <galaxy-text-input label="Inside"></galaxy-text-input>
            </galaxy-collapse>
        `);

        let collapse = document.querySelector("galaxy-collapse");
        let heading_slot = collapse.shadowRoot.querySelector("slot[name='heading']");
        let body_slot = collapse.shadowRoot.querySelector(".body-content slot:not([name])");

        expect(heading_slot.assignedElements().map((element) => element.textContent)).toEqual(["Machine Details"]);
        expect(body_slot.assignedElements().map((element) => element.tagName)).toEqual(["P", "TABLE", "GALAXY-TEXT-INPUT"]);
        expect(collapse.querySelector("galaxy-text-input").is_initialized).toBe(true);
    });
});

describe("open state", () => {
    test("starts closed: aria-expanded false and the body inert", async () => {
        await render("<galaxy-collapse><span slot='heading'>Heading</span><p>Body</p></galaxy-collapse>");

        let collapse = document.querySelector("galaxy-collapse");

        expect(collapse.open).toBe(false);
        expect(get_heading_button(collapse).getAttribute("aria-expanded")).toBe("false");
        expect(get_body(collapse).hasAttribute("inert")).toBe(true);
    });

    test("an open attribute in markup starts it open, without a toggle event", async () => {
        let toggle_listener = vi.fn();

        document.addEventListener("toggle", toggle_listener);
        await render("<galaxy-collapse open><span slot='heading'>Heading</span><p>Body</p></galaxy-collapse>");

        let collapse = document.querySelector("galaxy-collapse");

        expect(get_heading_button(collapse).getAttribute("aria-expanded")).toBe("true");
        expect(get_body(collapse).hasAttribute("inert")).toBe(false);
        expect(toggle_listener).not.toHaveBeenCalled();

        document.removeEventListener("toggle", toggle_listener);
    });

    test("clicking the heading toggles it, dispatching toggle with detail.open each time", async () => {
        await render("<galaxy-collapse><span slot='heading'>Heading</span><p>Body</p></galaxy-collapse>");

        let collapse = document.querySelector("galaxy-collapse");
        let open_states = record_toggles(collapse);

        get_heading_button(collapse).click();

        // open changes at once; aria-expanded, inert, and the toggle event follow on the attribute-changed reaction, a microtask later.
        expect(collapse.open).toBe(true);
        await flush();
        expect(get_heading_button(collapse).getAttribute("aria-expanded")).toBe("true");
        expect(get_body(collapse).hasAttribute("inert")).toBe(false);

        get_heading_button(collapse).click();
        await flush();

        expect(collapse.open).toBe(false);
        expect(open_states).toEqual([true, false]);
    });

    test("expand, collapse, toggle, and the open property dispatch toggle too, but setting the same state does not", async () => {
        await render("<galaxy-collapse><span slot='heading'>Heading</span><p>Body</p></galaxy-collapse>");

        let collapse = document.querySelector("galaxy-collapse");
        let open_states = record_toggles(collapse);

        collapse.expand();
        collapse.expand();
        collapse.setAttribute("open", "");
        collapse.collapse();
        collapse.toggle();
        collapse.open = false;
        await flush();

        expect(open_states).toEqual([true, false, true, false]);
    });

    test("toggle bubbles, so a container can listen for any panel inside it", async () => {
        await render("<div id='container'><galaxy-collapse id='first'></galaxy-collapse><galaxy-collapse id='second'></galaxy-collapse></div>");

        let toggled_ids = [];

        document.getElementById("container").addEventListener("toggle", (event) => toggled_ids.push(event.target.id));
        document.getElementById("second").expand();
        document.getElementById("first").expand();
        await flush();

        expect(toggled_ids).toEqual(["second", "first"]);
    });

    test("nothing is stored: a new panel with the same markup starts closed again", async () => {
        await render("<galaxy-collapse id='panel'><span slot='heading'>Heading</span></galaxy-collapse>");

        document.getElementById("panel").expand();

        await render("<galaxy-collapse id='panel'><span slot='heading'>Heading</span></galaxy-collapse>");

        expect(document.getElementById("panel").open).toBe(false);
        expect(window.galaxy_state_manager.data).toEqual({});
    });
});

describe("nesting and forms", () => {
    test("a nested panel toggles independently, and its toggle is distinguishable by target", async () => {
        await render(`
            <galaxy-collapse id="outer">
                <span slot="heading">Outer</span>
                <galaxy-collapse id="inner"><span slot="heading">Inner</span><p>Inner body</p></galaxy-collapse>
            </galaxy-collapse>
        `);

        let outer = document.getElementById("outer");
        let inner = document.getElementById("inner");
        let outer_targets = [];

        outer.addEventListener("toggle", (event) => outer_targets.push(event.target.id));
        get_heading_button(inner).click();
        await flush();

        expect(inner.open).toBe(true);
        expect(outer.open).toBe(false);
        expect(outer_targets).toEqual(["inner"]);
    });

    test("fields inside a panel in a galaxy-form are initialized and submitted", async () => {
        await render(`
            <galaxy-form>
                <galaxy-collapse>
                    <span slot="heading">Advanced</span>
                    <galaxy-text-input name="note" value="Inside the panel"></galaxy-text-input>
                </galaxy-collapse>
            </galaxy-form>
        `);

        let text_input = document.querySelector("galaxy-form").shadowRoot.querySelector("galaxy-text-input");

        expect(text_input.is_initialized).toBe(true);
        expect(text_input._internals._form_value).toBe("Inside the panel");
    });
});

describe("lifecycle", () => {
    test("reconnecting renders one panel, keeping its open state", async () => {
        await render("<galaxy-collapse open><span slot='heading'>Heading</span></galaxy-collapse>");

        let collapse = document.querySelector("galaxy-collapse");

        collapse.remove();
        await flush();
        document.body.appendChild(collapse);
        await flush();

        expect(collapse.shadowRoot.querySelectorAll(".galaxy-collapse")).toHaveLength(1);
        expect(get_heading_button(collapse).getAttribute("aria-expanded")).toBe("true");

        get_heading_button(collapse).click();
        await flush();

        expect(collapse.open).toBe(false);
    });
});

describe("edge cases with floating content and validation", () => {
    test("closing a panel from code closes an open select dropdown inside it, even one inside a form inside the panel", async () => {
        let { SIMPLE_OPTIONS } = await import("./test-helpers.js");
        let options_json = JSON.stringify(SIMPLE_OPTIONS);

        await render(`
            <galaxy-collapse id="panel" open>
                <span slot="heading">Panel</span>
                <galaxy-select id="direct_select" options-data='${options_json}'></galaxy-select>
                <galaxy-form><galaxy-select id="form_select" options-data='${options_json}'></galaxy-select></galaxy-form>
            </galaxy-collapse>
        `);

        let panel = document.getElementById("panel");
        let direct_select = document.getElementById("direct_select");
        let form_select = panel.querySelector("galaxy-form").shadowRoot.querySelector("#form_select");

        direct_select.open = true;
        form_select.open = true;
        await flush();

        panel.collapse();
        await flush();

        expect(direct_select.open).toBe(false);
        expect(form_select.open).toBe(false);
    });

    test("closing a panel closes an open date picker popup inside it", async () => {
        let { GalaxyDatePicker } = await import("../components/GalaxyDatePicker.js");

        if (!customElements.get("galaxy-date-picker")) {
            customElements.define("galaxy-date-picker", GalaxyDatePicker);
        }

        await render("<galaxy-collapse id='panel' open><span slot='heading'>Panel</span><galaxy-date-picker></galaxy-date-picker></galaxy-collapse>");

        let panel = document.getElementById("panel");
        let date_picker = panel.querySelector("galaxy-date-picker");

        await date_picker.show_popup(new window.Event("focus"));

        expect(date_picker.datetime_popup).not.toBeNull();

        panel.collapse();
        await flush();

        expect(date_picker.datetime_popup).toBeNull();
    });

    test("opening a panel leaves its floating content alone", async () => {
        let { SIMPLE_OPTIONS } = await import("./test-helpers.js");

        await render(`<galaxy-collapse id="panel"><span slot="heading">Panel</span><galaxy-select options-data='${JSON.stringify(SIMPLE_OPTIONS)}'></galaxy-select></galaxy-collapse>`);

        let panel = document.getElementById("panel");
        let close_spy = vi.spyOn(panel.querySelector("galaxy-select"), "close_floating_content");

        panel.expand();
        await flush();

        expect(close_spy).not.toHaveBeenCalled();
    });

    test("submitting a form whose first invalid field is in closed, nested panels opens every one of them", async () => {
        let scroll_spy = vi.fn();

        window.HTMLElement.prototype.scrollIntoView = scroll_spy;

        await render(`
            <galaxy-form id="form">
                <galaxy-text-input name="filled" value="Filled"></galaxy-text-input>
                <galaxy-collapse id="outer_panel">
                    <span slot="heading">Outer</span>
                    <galaxy-collapse id="inner_panel">
                        <span slot="heading">Inner</span>
                        <galaxy-text-input id="hidden_required" name="hidden_required" required></galaxy-text-input>
                    </galaxy-collapse>
                </galaxy-collapse>
                <galaxy-collapse id="unrelated_panel"><span slot="heading">Unrelated</span><p>Nothing invalid here</p></galaxy-collapse>
            </galaxy-form>
        `);

        let form = document.getElementById("form");
        let outer_panel = form.shadowRoot.querySelector("#outer_panel");
        let inner_panel = form.shadowRoot.querySelector("#inner_panel");
        let unrelated_panel = form.shadowRoot.querySelector("#unrelated_panel");

        expect(form.validate()).toBe(false);
        await flush();

        expect(outer_panel.open).toBe(true);
        expect(inner_panel.open).toBe(true);
        expect(unrelated_panel.open).toBe(false);
        expect(scroll_spy).toHaveBeenCalledTimes(1);
        expect(scroll_spy.mock.instances[0].id).toBe("hidden_required");

        delete window.HTMLElement.prototype.scrollIntoView;
    });

    test("validate(false), which does not scroll, does not open panels either", async () => {
        await render(`
            <galaxy-form id="form">
                <galaxy-collapse id="panel"><span slot="heading">Panel</span><galaxy-text-input name="hidden_required" required></galaxy-text-input></galaxy-collapse>
            </galaxy-form>
        `);

        let form = document.getElementById("form");

        expect(form.validate(false)).toBe(false);
        await flush();

        expect(form.shadowRoot.querySelector("#panel").open).toBe(false);
    });
});
