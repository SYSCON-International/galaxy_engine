import { afterEach, describe, expect, test, vi } from "vitest";
import { GalaxyForm } from "../components/GalaxyForm.js";
import { GalaxyTab } from "../components/GalaxyTab.js";
import { GalaxyTabs } from "../components/GalaxyTabs.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { flush } from "./test-helpers.js";

const COMPONENTS = {"galaxy-tabs": GalaxyTabs, "galaxy-tab": GalaxyTab, "galaxy-form": GalaxyForm, "galaxy-text-input": GalaxyTextInput};

for (let [tag_name, component_class] of Object.entries(COMPONENTS)) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

const STANDARD_TABS_HTML = `
    <galaxy-tabs id="machine_tabs" label="Machine">
        <galaxy-tab label="Overview" name="overview"><p>Overview content</p></galaxy-tab>
        <galaxy-tab label="Settings" name="settings"><p>Settings content</p></galaxy-tab>
        <galaxy-tab label="History" name="history" disabled><p>History content</p></galaxy-tab>
        <galaxy-tab label="Alerts" name="alerts" badge="3"><p>Alerts content</p></galaxy-tab>
    </galaxy-tabs>
`;

afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
    delete window.galaxy_session_store;
    GalaxyTabs.has_warned_about_missing_session_store = false;
});

/**
 * Renders markup into the page and waits for its components to finish creating.
 * @param {string} html - The markup.
 * @return {Promise<HTMLElement>} - The first galaxy-tabs.
 */
const render = async (html = STANDARD_TABS_HTML) => {
    document.body.innerHTML = html;

    await flush();
    await flush();

    return document.querySelector("galaxy-tabs");
};

const get_buttons = (tabs) => Array.from(tabs.shadowRoot.querySelectorAll("button.tab"));
const get_button = (tabs, name) => tabs.shadowRoot.querySelector(`button.tab[data-tab-name="${name}"]`);
const get_shown_names = (tabs) => tabs.tabs.filter((tab) => !tab.hidden).map((tab) => tab.getAttribute("name"));

/**
 * Records every tab_change the tabs dispatch.
 * @param {HTMLElement} tabs - The tabs.
 * @return {Object[]} - Each event's detail, in order.
 */
const record_tab_changes = (tabs) => {
    let details = [];

    tabs.addEventListener("tab_change", (event) => details.push(event.detail));

    return details;
};

const press = (element, key) => {
    element.dispatchEvent(new window.KeyboardEvent("keydown", {key: key, bubbles: true, composed: true, cancelable: true}));
};

describe("the tab bar", () => {
    test("is built from the galaxy-tab children, with the first tab selected and only its panel shown", async () => {
        let tabs = await render();
        let buttons = get_buttons(tabs);

        expect(buttons.map((button) => button.querySelector(".tab-label").textContent)).toEqual(["Overview", "Settings", "History", "Alerts"]);
        expect(tabs.shadowRoot.querySelector("[role='tablist']").getAttribute("aria-label")).toBe("Machine");
        expect(tabs.selected).toBe("overview");
        expect(get_shown_names(tabs)).toEqual(["overview"]);
        expect(buttons[0].getAttribute("aria-selected")).toBe("true");
        expect(buttons[0].tabIndex).toBe(0);
        expect(buttons[1].tabIndex).toBe(-1);
        expect(buttons[2].disabled).toBe(true);
        expect(buttons[3].querySelector(".tab-badge").textContent).toBe("3");
        expect(tabs.tabs[0].getAttribute("role")).toBe("tabpanel");
        expect(tabs.tabs[0].getAttribute("aria-label")).toBe("Overview");
    });

    test("adding, removing, relabeling, badging, and disabling tabs updates the bar", async () => {
        let tabs = await render();
        let new_tab = document.createElement("galaxy-tab");

        new_tab.setAttribute("label", "Notes");
        new_tab.setAttribute("name", "notes");
        tabs.appendChild(new_tab);
        tabs.tabs[1].label = "Setup";
        tabs.tabs[3].badge_variant = "danger";
        await flush();

        expect(get_buttons(tabs).map((button) => button.dataset.tabName)).toEqual(["overview", "settings", "history", "alerts", "notes"]);
        expect(get_button(tabs, "settings").textContent).toBe("Setup");
        expect(get_button(tabs, "alerts").querySelector(".tab-badge").classList.contains("danger")).toBe(true);
        expect(new_tab.hidden).toBe(true);

        tabs.tabs[0].remove();
        await flush();

        // The selected tab was removed, so the first enabled one is selected.
        expect(tabs.selected).toBe("settings");

        tabs.tabs[0].disabled = true;
        await flush();

        expect(tabs.selected).toBe("alerts");
    });

    test("a tab without a name is known by its position", async () => {
        let tabs = await render(`<galaxy-tabs><galaxy-tab label="One"></galaxy-tab><galaxy-tab label="Two"></galaxy-tab></galaxy-tabs>`);

        expect(tabs.selected).toBe("tab_0");
        expect(tabs.tabs[1].name).toBe("tab_1");
    });

    test("a selected tab that is disabled falls to the first enabled one", async () => {
        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" selected="history"'));

        expect(tabs.selected).toBe("overview");
    });
});

describe("selecting tabs", () => {
    test("a click selects a tab and dispatches tab_change; selecting from code dispatches nothing", async () => {
        let tabs = await render();
        let changes = record_tab_changes(tabs);

        get_button(tabs, "alerts").click();

        expect(tabs.selected).toBe("alerts");
        expect(get_shown_names(tabs)).toEqual(["alerts"]);
        expect(changes).toEqual([{name: "alerts", previous_name: "overview", index: 3}]);

        get_button(tabs, "history").click();
        tabs.selected = "settings";
        tabs.select_tab("overview");

        expect(tabs.selected).toBe("overview");
        expect(changes).toHaveLength(1);
    });

    test("the arrow keys, Home, and End move through the tabs, skipping disabled ones and wrapping", async () => {
        let tabs = await render();
        let changes = record_tab_changes(tabs);

        press(get_button(tabs, "overview"), "ArrowRight");
        press(get_button(tabs, "settings"), "ArrowRight");

        expect(tabs.selected).toBe("alerts");
        expect(tabs.shadowRoot.activeElement).toBe(get_button(tabs, "alerts"));

        press(get_button(tabs, "alerts"), "ArrowRight");
        expect(tabs.selected).toBe("overview");

        press(get_button(tabs, "overview"), "End");
        expect(tabs.selected).toBe("alerts");

        press(get_button(tabs, "alerts"), "Home");
        expect(tabs.selected).toBe("overview");

        expect(changes.map((detail) => detail.name)).toEqual(["settings", "alerts", "overview", "alerts", "overview"]);
    });

    test("a vertical tab set uses the up and down arrows", async () => {
        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" orientation="vertical"'));

        expect(tabs.shadowRoot.querySelector("[role='tablist']").getAttribute("aria-orientation")).toBe("vertical");

        press(get_button(tabs, "overview"), "ArrowRight");
        expect(tabs.selected).toBe("overview");

        press(get_button(tabs, "overview"), "ArrowDown");
        expect(tabs.selected).toBe("settings");
    });

    test("hiding a tab closes anything floating from inside it", async () => {
        let tabs = await render();
        let floating_element = document.createElement("div");

        floating_element.close_floating_content = vi.fn();
        tabs.tabs[0].appendChild(floating_element);

        get_button(tabs, "settings").click();

        expect(floating_element.close_floating_content).toHaveBeenCalledTimes(1);
    });
});

describe("error marks and galaxy-form", () => {
    test("a failed submit switches to the tab holding the first invalid field and marks it", async () => {
        window.HTMLElement.prototype.scrollIntoView = vi.fn();

        await render(`
            <galaxy-form id="form">
                <galaxy-tabs id="form_tabs">
                    <galaxy-tab label="General" name="general"><galaxy-text-input name="machine_name" value="Press 1"></galaxy-text-input></galaxy-tab>
                    <galaxy-tab label="Limits" name="limits"><galaxy-text-input name="maximum" required></galaxy-text-input></galaxy-tab>
                </galaxy-tabs>
            </galaxy-form>
        `);

        let form = document.getElementById("form");
        let tabs = form.shadowRoot.querySelector("#form_tabs");

        expect(form.validate()).toBe(false);
        await flush();

        expect(tabs.selected).toBe("limits");
        expect(get_button(tabs, "limits").querySelector(".tab-error-mark")).not.toBeNull();
        expect(get_button(tabs, "limits").getAttribute("aria-description")).toBe("Has errors");
        expect(get_button(tabs, "general").querySelector(".tab-error-mark")).toBeNull();

        delete window.HTMLElement.prototype.scrollIntoView;
    });
});

describe("overflow", () => {
    test("the scroll arrows show only while there is more of the bar to scroll to", async () => {
        let tabs = await render();
        let tab_list = tabs.shadowRoot.querySelector(".tab-list");
        let previous_button = tabs.shadowRoot.querySelector(".scroll-previous");
        let next_button = tabs.shadowRoot.querySelector(".scroll-next");

        Object.defineProperty(tab_list, "clientWidth", {configurable: true, value: 200});
        Object.defineProperty(tab_list, "scrollWidth", {configurable: true, value: 600});

        tabs.update_scroll_buttons();

        expect(previous_button.hidden).toBe(true);
        expect(next_button.hidden).toBe(false);

        tab_list.scrollLeft = 400;
        tabs.update_scroll_buttons();

        expect(previous_button.hidden).toBe(false);
        expect(next_button.hidden).toBe(true);
    });
});

describe("remembering the selection", () => {
    test("remember=\"url\" reads the tab from the URL, writes the user's choice to it, and follows back and forward", async () => {
        window.history.replaceState(null, "", "/?machine_tabs=settings");

        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" remember="url"'));

        expect(tabs.selected).toBe("settings");

        get_button(tabs, "alerts").click();

        expect(new URLSearchParams(window.location.search).get("machine_tabs")).toBe("alerts");

        window.history.replaceState(null, "", "/?machine_tabs=overview");
        window.dispatchEvent(new window.PopStateEvent("popstate"));

        expect(tabs.selected).toBe("overview");
    });

    test("remember=\"session\" reads the tab from the registered store and writes the user's choice to it", async () => {
        let session_values = {setup_tabs: "alerts"};

        window.galaxy_session_store = {
            get: vi.fn(async (key) => session_values[key] ?? null),
            set: vi.fn((key, value) => {
                session_values[key] = value;
            }),
        };

        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" remember="session" remember-key="setup_tabs"'));

        expect(window.galaxy_session_store.get).toHaveBeenCalledWith("setup_tabs");
        expect(tabs.selected).toBe("alerts");

        get_button(tabs, "settings").click();

        expect(window.galaxy_session_store.set).toHaveBeenCalledWith("setup_tabs", "settings");
    });

    test("a user's choice made before the session store answers is kept", async () => {
        let resolve_get = null;

        window.galaxy_session_store = {
            get: () => new Promise((resolve) => {
                resolve_get = resolve;
            }),
            set: vi.fn(),
        };

        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" remember="session"'));

        get_button(tabs, "settings").click();
        resolve_get("alerts");
        await flush();

        expect(tabs.selected).toBe("settings");
    });

    test("remember=\"session\" without a registered store warns once and keeps working", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});

        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" remember="session"'));

        get_button(tabs, "settings").click();

        expect(tabs.selected).toBe("settings");
        expect(warn_spy.mock.calls.filter((call) => String(call[0]).includes("galaxy_session_store"))).toHaveLength(1);

        warn_spy.mockRestore();
    });
});

describe("state binding", () => {
    test("property-name binds the selected tab both ways", async () => {
        window.galaxy_state_manager.set("machine_tab", "alerts");

        let tabs = await render(STANDARD_TABS_HTML.replace('id="machine_tabs"', 'id="machine_tabs" property-name="machine_tab"'));
        let changes = record_tab_changes(tabs);

        expect(tabs.selected).toBe("alerts");

        get_button(tabs, "settings").click();

        expect(window.galaxy_state_manager.data.machine_tab).toBe("settings");

        window.galaxy_state_manager.set("machine_tab", "overview");

        expect(tabs.selected).toBe("overview");
        expect(changes).toHaveLength(1);
    });
});
