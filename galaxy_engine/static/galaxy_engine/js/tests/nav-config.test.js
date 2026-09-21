import { describe, expect, test, vi } from "vitest";
import { create_nav, flush, SIMPLE_NAV_CONFIG } from "./nav-test-helpers.js";

describe("nav config handling (fix #1)", () => {
    test("an unconfigured navbar connects cleanly with the default (empty) config, no thrown/unhandled error", async () => {
        let nav = await create_nav("navbar");

        expect(nav.nav_menu).toBeTruthy();
        expect(nav._config.navigation).toEqual([]);
        expect(nav.shadowRoot.querySelector(".brand")).toBeNull();
    });

    test("a config declared via the config attribute renders, not a hardcoded fixture", async () => {
        let nav = await create_nav("navbar", {config: JSON.stringify(SIMPLE_NAV_CONFIG)});

        let links = [...nav.shadowRoot.querySelectorAll(".nav-left a")].map((a) => a.querySelector(".nav-label").textContent.trim());

        expect(links).toEqual(["Home", "About"]);
        expect(nav.shadowRoot.querySelector(".brand")).toBeTruthy();
    });

    test("setting .config programmatically after connecting still works", async () => {
        let nav = await create_nav("navbar");

        nav.config = SIMPLE_NAV_CONFIG;
        await flush();

        let links = [...nav.shadowRoot.querySelectorAll(".nav-left a")].map((a) => a.querySelector(".nav-label").textContent.trim());
        expect(links).toEqual(["Home", "About"]);
    });

    test("setting the config attribute directly (not via the property) also rebuilds the nav", async () => {
        let nav = await create_nav("navbar");

        nav.setAttribute("config", JSON.stringify(SIMPLE_NAV_CONFIG));
        await flush();

        let links = [...nav.shadowRoot.querySelectorAll(".nav-left a")].map((a) => a.querySelector(".nav-label").textContent.trim());
        expect(links).toEqual(["Home", "About"]);
    });

    test("invalid JSON in the config attribute falls back to the default config with a warning", async () => {
        let warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});

        let nav = await create_nav("navbar", {config: "{not valid json"});

        expect(nav._config.navigation).toEqual([]);
        expect(warn_spy).toHaveBeenCalled();

        warn_spy.mockRestore();
    });

    test("a sidebar with no config also connects cleanly and defaults to collapsible", async () => {
        let sidebar = await create_nav("sidebar");

        expect(sidebar.nav_menu).toBeTruthy();
        expect(sidebar._config.collapsible).toBe(true);
    });
});
