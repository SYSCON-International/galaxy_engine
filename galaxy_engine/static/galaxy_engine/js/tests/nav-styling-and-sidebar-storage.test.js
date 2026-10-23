import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { create_nav, flush, get_theme_property, SIMPLE_NAV_CONFIG } from "./nav-test-helpers.js";

const get_style_text = (element) => Array.from(element.shadowRoot.querySelectorAll("style")).map((style) => style.textContent).join("\n");

/**
 * Removes the CSS literals that sit inside a var() as its fallback, so what is left is only the colors used directly.
 * @param {string} css
 * @return {string}
 */
const strip_var_fallbacks = (css) => css.replace(/var\(--[a-z0-9-]+,\s*[^)]*\)/g, "var()");

describe("the navbar's theme can be overridden from a page stylesheet", () => {
    test("theme values are written into a :host rule in the shadow root, not inline on the element", async () => {
        let nav = await create_nav("navbar", {theme: "dark"});

        expect(nav.style.getPropertyValue("--nav-bg")).toBe("");
        expect(nav.theme_style_element.parentNode).toBe(nav.shadowRoot);
        expect(nav.theme_style_element.textContent).toMatch(/^\s*:host\s*\{/);
        expect(get_theme_property(nav, "--nav-bg")).toBe("#0f172a");
    });

    test("re-theming rewrites the same rule rather than adding another", async () => {
        let nav = await create_nav("navbar", {theme: "dark"});

        nav.theme = "light";
        await flush();

        expect(nav.shadowRoot.querySelectorAll("style.galaxy-nav-theme")).toHaveLength(1);
        expect(get_theme_property(nav, "--nav-bg")).toBe("#ffffff");
    });

    test("a custom theme value that could break out of the rule is replaced with the default", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
        let nav = await create_nav("navbar", {theme: JSON.stringify({nav_bg: "red; } * { display: none", nav_text: "#123456"})});

        expect(get_theme_property(nav, "--nav-bg")).toBe("#ffffff");
        expect(get_theme_property(nav, "--nav-text")).toBe("#123456");
        expect(nav.theme_style_element.textContent).not.toContain("display: none");
        expect(warn_spy).toHaveBeenCalled();

        warn_spy.mockRestore();
    });

    test("the theme's font family is used", async () => {
        let nav = await create_nav("navbar");

        expect(get_style_text(nav)).toMatch(/font-family:\s*var\(--font-family/);
    });

    test("a closed dropdown's background comes from the theme, not a literal", async () => {
        let nav = await create_nav("navbar");

        expect(strip_var_fallbacks(nav.component_css)).not.toMatch(/#1e293b/);
    });
});

describe("button items in the nav are styled", () => {
    const BUTTON_CONFIG = {...SIMPLE_NAV_CONFIG, navigation: [...SIMPLE_NAV_CONFIG.navigation, {type: "button", label: "Log Out"}]};

    test("a button item renders with a rule that styles it like a link", async () => {
        let nav = await create_nav("navbar", {config: JSON.stringify(BUTTON_CONFIG)});

        expect(nav.shadowRoot.querySelector(".galaxy-nav-button")).not.toBeNull();
        expect(get_style_text(nav)).toMatch(/\.galaxy-nav-button\s*\{[^}]*font:\s*inherit;/);
    });

    test("a collapsed sidebar hides a button item's label, as it does a link's", async () => {
        let sidebar = await create_nav("sidebar", {config: JSON.stringify(BUTTON_CONFIG)});

        expect(get_style_text(sidebar)).toMatch(/\.galaxy-nav-button\s*\{\s*justify-content:\s*center;\s*\.nav-label\s*\{\s*display:\s*none;/);
    });
});

describe("where a sidebar remembers that it is collapsed", () => {
    beforeEach(() => {
        window.localStorage.clear();
        delete window.galaxy_session_store;
    });

    afterEach(() => {
        window.localStorage.clear();
        delete window.galaxy_session_store;
    });

    test("by default it keeps using localStorage", async () => {
        let sidebar = await create_nav("sidebar", {id: "main_sidebar"});

        sidebar.collapsed = true;
        await flush();

        expect(window.localStorage.getItem("galaxy_sidebar_collapsed_main_sidebar")).toBe("true");

        sidebar.remove();
        await flush();

        let restored_sidebar = await create_nav("sidebar", {id: "main_sidebar"});

        expect(restored_sidebar.collapsed).toBe(true);
    });

    test("remember=\"none\" touches no storage", async () => {
        let set_item_spy = vi.spyOn(Storage.prototype, "setItem");
        let get_item_spy = vi.spyOn(Storage.prototype, "getItem");

        let sidebar = await create_nav("sidebar", {id: "main_sidebar", remember: "none"});

        sidebar.collapsed = true;
        await flush();

        expect(set_item_spy).not.toHaveBeenCalled();
        expect(get_item_spy).not.toHaveBeenCalled();

        set_item_spy.mockRestore();
        get_item_spy.mockRestore();
    });

    test("remember=\"session\" keeps it in the app's session store", async () => {
        let session_values = {"galaxy_sidebar_collapsed_main_sidebar": "true"};

        window.galaxy_session_store = {
            get: vi.fn(async (key) => session_values[key] ?? null),
            set: vi.fn((key, value) => {
                session_values[key] = value;
            }),
        };

        let sidebar = await create_nav("sidebar", {id: "main_sidebar", remember: "session"});

        await flush();

        expect(window.galaxy_session_store.get).toHaveBeenCalledWith("galaxy_sidebar_collapsed_main_sidebar");
        expect(sidebar.collapsed).toBe(true);
        expect(window.localStorage.getItem("galaxy_sidebar_collapsed_main_sidebar")).toBeNull();

        sidebar.collapsed = false;
        await flush();

        expect(session_values["galaxy_sidebar_collapsed_main_sidebar"]).toBe("false");
        expect(window.localStorage.getItem("galaxy_sidebar_collapsed_main_sidebar")).toBeNull();
    });

    test("a user's toggle made while the session store answers is not overwritten by the stored state", async () => {
        let resolve_get;

        window.galaxy_session_store = {
            get: vi.fn(() => new Promise((resolve) => {
                resolve_get = resolve;
            })),
            set: vi.fn(),
        };

        let sidebar = await create_nav("sidebar", {id: "main_sidebar", remember: "session"});

        sidebar.collapsed = true;
        await flush();

        resolve_get("false");
        await flush();

        expect(sidebar.collapsed).toBe(true);
    });

    test("remember=\"session\" without a registered store warns and keeps nothing", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});

        let sidebar = await create_nav("sidebar", {id: "main_sidebar", remember: "session"});

        sidebar.collapsed = true;
        await flush();

        expect(warn_spy).toHaveBeenCalled();
        expect(window.localStorage.getItem("galaxy_sidebar_collapsed_main_sidebar")).toBeNull();

        warn_spy.mockRestore();
    });
});
