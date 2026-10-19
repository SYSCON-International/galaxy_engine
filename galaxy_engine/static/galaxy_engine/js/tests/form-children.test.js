import { describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyHTMLComponentBase } from "../components/GalaxyHTMLComponentBase.js";
import { GalaxyLoader } from "../components/GalaxyLoader.js";
import { GalaxyTable } from "../components/GalaxyTable.js";
import { flush } from "./test-helpers.js";

/**
 * A Galaxy component that is deliberately in no tag-name list, counting its create lifecycle runs - stands in for any component the form must not need to be told about.
 */
class GalaxyTestCounter extends GalaxyHTMLComponentBase {
    on_create = async () => {
        this.create_count = (this.create_count || 0) + 1;

        this.shadow.appendChild(document.createElement("span"));
    }

    validate = () => {
        return !this.hasAttribute("invalid");
    }
}

for (let [tag_name, component_class] of [["galaxy-form", GalaxyForm], ["galaxy-loader", GalaxyLoader], ["galaxy-table", GalaxyTable], ["galaxy-test-counter", GalaxyTestCounter]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

/**
 * Parses markup into the document (so custom elements upgrade on connection, in tree order, the way a real page's do) and waits for every create lifecycle to settle.
 * @param {string} markup - The markup to parse.
 * @return {Promise<HTMLElement>} - The <galaxy-form>.
 */
const create_form = async (markup) => {
    document.body.innerHTML = markup;

    await flush();
    await flush();

    return document.querySelector("galaxy-form");
};

/**
 * Finds an element moved into the form's internal <form>.
 * @param {HTMLElement} form - The <galaxy-form>.
 * @param {string} selector - The selector to find.
 * @return {HTMLElement|null}
 */
const find_in_form = (form, selector) => {
    return form.shadowRoot.querySelector(`form ${selector}`);
};

describe("Galaxy children of a galaxy-form", () => {
    test("a component that is not in GALAXY_COMPONENT_TAG_NAMES still initializes, exactly once", async () => {
        let form = await create_form("<galaxy-form><galaxy-test-counter></galaxy-test-counter></galaxy-form>");
        let counter = find_in_form(form, "galaxy-test-counter");

        expect(counter.create_count).toBe(1);
        expect(counter.is_initialized).toBe(true);
    });

    test("a component nested inside a plain wrapper initializes", async () => {
        let form = await create_form("<galaxy-form><div><section><galaxy-test-counter></galaxy-test-counter></section></div></galaxy-form>");

        expect(find_in_form(form, "galaxy-test-counter").create_count).toBe(1);
    });

    test("galaxy-loader and galaxy-table render inside a form", async () => {
        let form = await create_form(`
            <galaxy-form>
                <galaxy-loader message="Saving"></galaxy-loader>
                <galaxy-table columns='[{"key": "name", "label": "Name"}]' rows='[{"name": "Press 1"}]'></galaxy-table>
            </galaxy-form>
        `);

        expect(find_in_form(form, "galaxy-loader").shadowRoot.querySelector(".message").textContent).toBe("Saving");
        expect(find_in_form(form, "galaxy-table").shadowRoot.querySelectorAll("tr.data-row")).toHaveLength(1);
    });

    test("does not depend on window.galaxy_engine at all", async () => {
        window.galaxy_engine = undefined;

        let form = await create_form("<galaxy-form><galaxy-test-counter></galaxy-test-counter></galaxy-form>");

        expect(find_in_form(form, "galaxy-test-counter").create_count).toBe(1);
        expect(form.validate(false)).toBe(true);
    });

    test("a nested galaxy-form initializes its own children, and the outer form does not initialize them again", async () => {
        let outer_form = await create_form("<galaxy-form id='outer'><galaxy-form id='inner'><galaxy-test-counter></galaxy-test-counter></galaxy-form></galaxy-form>");
        let inner_form = find_in_form(outer_form, "#inner");
        let counter = find_in_form(inner_form, "galaxy-test-counter");

        expect(counter.create_count).toBe(1);
        expect(counter.parent_form).toBe(inner_form);
    });
});

describe("add_field", () => {
    test("runs a created-then-added component's create lifecycle exactly once and gives it the form as parent_form", async () => {
        let form = await create_form("<galaxy-form></galaxy-form>");
        let counter = document.createElement("galaxy-test-counter");

        await form.add_field(counter);
        await flush();

        expect(counter.create_count).toBe(1);
        expect(counter.parent_form).toBe(form);
    });

    test("initializes components inside an added wrapper", async () => {
        let form = await create_form("<galaxy-form></galaxy-form>");
        let wrapper = document.createElement("div");

        wrapper.innerHTML = "<galaxy-test-counter></galaxy-test-counter><galaxy-test-counter></galaxy-test-counter>";

        await form.add_field(wrapper);
        await flush();

        let counters = form.shadowRoot.querySelectorAll("form galaxy-test-counter");

        expect(Array.from(counters).map((counter) => counter.create_count)).toEqual([1, 1]);
    });
});

describe("validate", () => {
    test("validates components that are not in GALAXY_COMPONENT_TAG_NAMES", async () => {
        let form = await create_form("<galaxy-form><galaxy-test-counter invalid></galaxy-test-counter></galaxy-form>");

        expect(form.validate(false)).toBe(false);

        find_in_form(form, "galaxy-test-counter").removeAttribute("invalid");

        expect(form.validate(false)).toBe(true);
    });
});

describe("lifecycle after initialization", () => {
    test("removing and re-adding an initialized child re-runs its lifecycle once", async () => {
        let form = await create_form("<galaxy-form><galaxy-test-counter></galaxy-test-counter></galaxy-form>");
        let counter = find_in_form(form, "galaxy-test-counter");
        let parent = counter.parentNode;

        counter.remove();
        await flush();
        parent.appendChild(counter);
        await flush();

        expect(counter.create_count).toBe(2);
        expect(counter.is_initialized).toBe(true);
    });

    test("moving the form itself keeps one internal <form>, its fields, and working submit validation", async () => {
        let form = await create_form("<div id='first'><galaxy-form><galaxy-test-counter></galaxy-test-counter></galaxy-form></div><div id='second'></div>");

        document.getElementById("second").appendChild(form);
        await flush();
        await flush();

        let counter = find_in_form(form, "galaxy-test-counter");

        expect(form.shadowRoot.querySelectorAll("form")).toHaveLength(1);
        expect(counter.is_initialized).toBe(true);
        expect(counter.create_count).toBe(2);

        counter.setAttribute("invalid", "");

        let submit_listener = vi.fn();

        form.addEventListener("submit", submit_listener);
        form.form_element.dispatchEvent(new window.Event("submit", {cancelable: true}));

        expect(submit_listener).not.toHaveBeenCalled();
    });

    test("an initialization error in one child does not stop its siblings", async () => {
        let error_spy = vi.spyOn(console, "error").mockImplementation(() => {});

        class GalaxyTestBroken extends GalaxyHTMLComponentBase {
            on_create = async () => {
                throw new Error("broken child");
            }
        }

        if (!customElements.get("galaxy-test-broken")) {
            customElements.define("galaxy-test-broken", GalaxyTestBroken);
        }

        let form = await create_form("<galaxy-form><galaxy-test-broken></galaxy-test-broken><galaxy-test-counter></galaxy-test-counter></galaxy-form>");

        expect(find_in_form(form, "galaxy-test-counter").create_count).toBe(1);

        error_spy.mockRestore();
    });
});
