import { describe, expect, test } from "vitest";
import { create_nav, flush, get_theme_property } from "./nav-test-helpers.js";

describe("theme isolation between nav instances (fix #2)", () => {
    test("two navs with different themes keep their own colors instead of one clobbering the other", async () => {
        let light_nav = await create_nav("navbar", {theme: "light"});
        let dark_nav = await create_nav("navbar", {theme: "dark"});

        expect(get_theme_property(light_nav, "--nav-bg")).toBe("#ffffff");
        expect(get_theme_property(dark_nav, "--nav-bg")).toBe("#0f172a");

        // Re-theming one must not affect the other.
        light_nav.theme = "dark";

        expect(get_theme_property(light_nav, "--nav-bg")).toBe("#0f172a");
        expect(get_theme_property(dark_nav, "--nav-bg")).toBe("#0f172a");

        dark_nav.theme = "light";
        expect(get_theme_property(dark_nav, "--nav-bg")).toBe("#ffffff");
        expect(get_theme_property(light_nav, "--nav-bg")).toBe("#0f172a");
    });

    test("a navbar and a sidebar together on the same page don't fight over theme", async () => {
        let navbar = await create_nav("navbar", {theme: "light"});
        let sidebar = await create_nav("sidebar", {theme: "dark"});

        expect(get_theme_property(navbar, "--nav-bg")).toBe("#ffffff");
        expect(get_theme_property(sidebar, "--nav-bg")).toBe("#0f172a");

        // No global :root stylesheet should exist for this anymore - theme is host-scoped now.
        expect(document.getElementById("nav_style")).toBeNull();
    });

    test("removing the theme attribute falls back to the default theme instead of throwing", async () => {
        let nav = await create_nav("navbar", {theme: "dark"});

        nav.removeAttribute("theme");
        await flush(); // the attribute reaction is async, unlike the `theme` property setter's truthy-value path

        expect(get_theme_property(nav, "--nav-bg")).toBe("#ffffff"); // light, the default
    });

    test("an invalid theme attribute falls back to the default theme instead of throwing", async () => {
        let nav = await create_nav("navbar", {theme: "not-a-real-theme-or-json"});

        expect(get_theme_property(nav, "--nav-bg")).toBe("#ffffff");
    });
});
