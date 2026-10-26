import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { create_nav, flush } from "./nav-test-helpers.js";

/**
 * Gets the href attribute of every link in a nav, in order.
 * @param {HTMLElement} nav
 * @return {string[]}
 */
const get_hrefs = (nav) => [...nav.shadowRoot.querySelectorAll("a")].map((link) => link.getAttribute("href"));

/**
 * Gets the label of every top-level nav item, in order.
 * @param {HTMLElement} nav
 * @return {string[]}
 */
const get_top_level_labels = (nav) => [...nav.shadowRoot.querySelectorAll(".nav-left > li > a > .nav-label")].map((label) => label.textContent);

describe("A1.1: nav links only allow safe URLs", () => {
    let warn_spy;

    beforeEach(() => {
        warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warn_spy.mockRestore();
    });

    test("javascript: and data: links in items, children, columns and the brand become #", async () => {
        let nav = await create_nav("navbar", {
            config: JSON.stringify({
                brand: {name: "Acme", link: " JavaScript:alert(1)", should_show: true},
                navigation: [
                    {label: "Top", link: "javascript:alert(2)"},
                    {label: "Parent", link: "#", children: [{label: "Child", link: "data:text/html,<script>alert(3)</script>"}]},
                    {label: "Mega", link: "#", multi_column: true, columns: [{title: "A", items: [{label: "Sub", link: "java\tscript:alert(4)"}]}]},
                ],
            }),
        });

        expect(get_hrefs(nav)).toEqual(["#", "#", "#", "#", "#", "#"]);
        expect(warn_spy).toHaveBeenCalled();
    });

    test("relative, http, https, mailto and tel links are kept as written", async () => {
        let links = ["/reports", "reports/live", "?type=a", "#section", "https://example.com/a", "http://example.com/b", "mailto:help@example.com", "tel:+15555550100"];
        let nav = await create_nav("navbar", {
            config: JSON.stringify({navigation: links.map((link, index) => ({label: `Item ${index}`, link}))}),
        });

        expect(get_hrefs(nav)).toEqual(links);
        expect(warn_spy).not.toHaveBeenCalled();
    });
});

describe("A1.2: overlapping config changes build the nav once", () => {
    test("setting config twice in a row leaves only the second config's items", async () => {
        let nav = await create_nav("navbar");

        nav.config = {navigation: [{label: "A", link: "/a"}, {label: "B", link: "/b"}, {label: "C", link: "/c"}]};
        nav.config = {navigation: [{label: "D", link: "/d"}, {label: "E", link: "/e"}, {label: "F", link: "/f"}]};
        await flush();
        await flush();

        expect(get_top_level_labels(nav)).toEqual(["D", "E", "F"]);
    });

    test("a nested config set twice keeps one brand and one copy of each child", async () => {
        let nav = await create_nav("sidebar");
        let config = {
            brand: {name: "Acme", link: "/", should_show: true},
            navigation: [{label: "Team", link: "#", children: [{label: "Members", link: "/members"}, {label: "Invite", link: "/invite"}]}],
        };

        nav.config = config;
        nav.config = config;
        await flush();
        await flush();

        expect(nav.shadowRoot.querySelectorAll(".brand")).toHaveLength(1);
        expect(nav.shadowRoot.querySelectorAll("[dropdown] li")).toHaveLength(2);
    });
});

describe("A1.3: a partial nav config builds what it can", () => {
    let warn_spy;

    beforeEach(() => {
        warn_spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warn_spy.mockRestore();
    });

    test("a column without items, a non-array children, and null entries do not abort the build", async () => {
        let nav = await create_nav("navbar", {
            config: JSON.stringify({
                navigation: [
                    {label: "Mega", link: "#", multi_column: true, columns: [{title: "Empty"}, null, {title: "Full", items: [null, {label: "Sub", link: "/sub"}]}]},
                    null,
                    {label: "Odd", link: "/odd", children: "not a list"},
                    {label: "After", link: "/after"},
                ],
            }),
        });

        expect(get_top_level_labels(nav)).toEqual(["Mega", "Odd", "After"]);
        expect(get_hrefs(nav)).toContain("/sub");
    });

    test("a navigation that is not an array builds an empty nav rather than throwing", async () => {
        let nav = await create_nav("navbar", {config: JSON.stringify({navigation: {label: "Not a list"}})});

        expect(get_top_level_labels(nav)).toEqual([]);
        expect(nav.shadowRoot.querySelector(".nav-left")).not.toBe(null);
    });
});

describe("A1.4: the active link follows the query string and navigation", () => {
    afterEach(() => {
        window.history.replaceState(null, "", "/");
    });

    test("a link with a query is active only when the query matches too", async () => {
        window.history.replaceState(null, "", "/reports?type=b");

        let nav = await create_nav("navbar", {
            config: JSON.stringify({navigation: [{label: "A", link: "/reports?type=a"}, {label: "B", link: "/reports?type=b"}, {label: "All", link: "/reports"}]}),
        });
        let active_hrefs = [...nav.shadowRoot.querySelectorAll("a.active")].map((link) => link.getAttribute("href"));

        expect(active_hrefs).toEqual(["/reports?type=b", "/reports"]);
    });

    test("the active link updates on back/forward navigation, and on mark_active_navigation_items() after pushState", async () => {
        window.history.replaceState(null, "", "/a");

        let nav = await create_nav("navbar", {config: JSON.stringify({navigation: [{label: "A", link: "/a"}, {label: "B", link: "/b"}]})});
        let get_active_href = () => nav.shadowRoot.querySelector("a.active")?.getAttribute("href");

        expect(get_active_href()).toBe("/a");

        window.history.pushState(null, "", "/b");
        nav.mark_active_navigation_items();
        expect(get_active_href()).toBe("/b");

        window.history.replaceState(null, "", "/a");
        window.dispatchEvent(new window.PopStateEvent("popstate"));
        expect(get_active_href()).toBe("/a");
    });
});
