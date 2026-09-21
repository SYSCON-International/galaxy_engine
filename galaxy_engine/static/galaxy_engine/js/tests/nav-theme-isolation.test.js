import { describe, expect, test } from "vitest";
import { create_nav, flush } from "./nav-test-helpers.js";

describe("theme isolation between nav instances (fix #2)", () => {
    test("two navs with different themes keep their own colors instead of one clobbering the other", async () => {
        let light_nav = await create_nav("navbar", {theme: "light"});
        let dark_nav = await create_nav("navbar", {theme: "dark"});

        expect(light_nav.style.getPropertyValue("--nav-bg")).toBe("#ffffff");
        expect(dark_nav.style.getPropertyValue("--nav-bg")).toBe("#0f172a");

        // Re-theming one must not affect the other.
        light_nav.theme = "dark";

        expect(light_nav.style.getPropertyValue("--nav-bg")).toBe("#0f172a");
        expect(dark_nav.style.getPropertyValue("--nav-bg")).toBe("#0f172a");

        dark_nav.theme = "light";
        expect(dark_nav.style.getPropertyValue("--nav-bg")).toBe("#ffffff");
        expect(light_nav.style.getPropertyValue("--nav-bg")).toBe("#0f172a");
    });

    test("a navbar and a sidebar together on the same page don't fight over theme", async () => {
        let navbar = await create_nav("navbar", {theme: "light"});
        let sidebar = await create_nav("sidebar", {theme: "dark"});

        expect(navbar.style.getPropertyValue("--nav-bg")).toBe("#ffffff");
        expect(sidebar.style.getPropertyValue("--nav-bg")).toBe("#0f172a");

        // No global :root stylesheet should exist for this anymore - theme is host-scoped now.
        expect(document.getElementById("nav_style")).toBeNull();
    });

    test("removing the theme attribute falls back to the default theme instead of throwing", async () => {
        let nav = await create_nav("navbar", {theme: "dark"});

        nav.removeAttribute("theme");
        await flush(); // the attribute reaction is async, unlike the `theme` property setter's truthy-value path

        expect(nav.style.getPropertyValue("--nav-bg")).toBe("#ffffff"); // light, the default
    });

    test("an invalid theme attribute falls back to the default theme instead of throwing", async () => {
        let nav = await create_nav("navbar", {theme: "not-a-real-theme-or-json"});

        expect(nav.style.getPropertyValue("--nav-bg")).toBe("#ffffff");
    });
});
