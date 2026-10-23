import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { create_nav, flush } from "./nav-test-helpers.js";

describe("nav heading labels are text", () => {
    for (let kind of ["navbar", "sidebar"]) {
        test(`${kind}: markup in a heading label creates no elements and runs nothing`, async () => {
            let label = "<img src=\"x\" onerror=\"window.__nav_heading_injection = 1\"><b class=\"injected\">x</b>";
            let nav = await create_nav(kind, {config: JSON.stringify({navigation: [{is_heading: true, label: label}]})});
            let heading = nav.shadowRoot.querySelector(".nav-heading");

            expect(heading).not.toBeNull();
            expect(heading.querySelector("img, b")).toBeNull();
            expect(heading.querySelector(".nav-label").textContent).toBe(label);
            expect(window.__nav_heading_injection).toBeUndefined();
        });
    }
});

describe("a moved nav keeps closing its dropdowns", () => {
    test("an outside click still closes an open dropdown after the navbar is moved", async () => {
        let config = {navigation: [{label: "Reports", children: [{label: "Daily", link: "/daily"}]}]};
        let nav = await create_nav("navbar", {config: JSON.stringify(config)});
        let wrapper = document.createElement("div");

        document.body.appendChild(wrapper);
        wrapper.appendChild(nav);
        await flush();
        await flush();

        let dropdown_item = nav.shadowRoot.querySelector(".galaxy-nav > ul > li");

        nav.open_dropdown(dropdown_item);
        expect(dropdown_item.hasAttribute("open")).toBe(true);

        document.body.click();

        expect(dropdown_item.hasAttribute("open")).toBe(false);
    });
});

describe("a sidebar authored collapsed keeps the user's remembered state", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    test("a remembered expanded state wins over collapsed in the markup, and is not overwritten", async () => {
        window.localStorage.setItem("galaxy_sidebar_collapsed_main_sidebar", "false");

        let sidebar = await create_nav("sidebar", {id: "main_sidebar", collapsed: ""});

        await flush();

        expect(sidebar.collapsed).toBe(false);
        expect(window.localStorage.getItem("galaxy_sidebar_collapsed_main_sidebar")).toBe("false");
    });

    test("with nothing remembered, the markup's collapsed state stands, and a later toggle is remembered", async () => {
        let sidebar = await create_nav("sidebar", {id: "main_sidebar", collapsed: ""});

        await flush();

        expect(sidebar.collapsed).toBe(true);

        sidebar.collapsed = false;
        await flush();

        expect(window.localStorage.getItem("galaxy_sidebar_collapsed_main_sidebar")).toBe("false");
    });
});
