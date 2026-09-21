import { describe, expect, test } from "vitest";
import { create_nav, flush } from "./nav-test-helpers.js";

describe("brand block is built safely, not via HTML string interpolation (fix #3)", () => {
    test("a malicious brand name renders as literal text, not injected markup", async () => {
        let malicious_name = `</span><img src=x onerror="window.__pwned = true">`;

        let nav = await create_nav("navbar", {
            config: JSON.stringify({
                brand: {name: malicious_name, logo_url: "", link: "/", tagline: "", should_show: true},
                navigation: [],
            }),
        });

        let brand = nav.shadowRoot.querySelector(".brand");
        let name_span = brand.querySelector("a > span");

        expect(name_span.textContent).toBe(malicious_name);
        // No injected <img> beyond the (absent, since logo_url is empty) legitimate logo - i.e. the
        // "onerror" payload never became a real element that could fire.
        expect(brand.querySelectorAll("img")).toHaveLength(0);
        expect(window.__pwned).toBeUndefined();
    });

    test("a malicious tagline and logo_url are also rendered as inert text/attribute values", async () => {
        let nav = await create_nav("navbar", {
            config: JSON.stringify({
                brand: {
                    name: "Acme",
                    logo_url: `x" onerror="window.__pwned = true`,
                    link: `javascript:void(0)" onclick="window.__pwned2 = true`,
                    tagline: `<script>window.__pwned3 = true</script>`,
                    should_show: true,
                },
                navigation: [],
            }),
        });

        await flush();

        let brand = nav.shadowRoot.querySelector(".brand");
        let tagline = brand.querySelector("p");

        expect(tagline.textContent).toBe("<script>window.__pwned3 = true</script>");
        expect(brand.querySelectorAll("script")).toHaveLength(0);
        expect(window.__pwned).toBeUndefined();
        expect(window.__pwned2).toBeUndefined();
        expect(window.__pwned3).toBeUndefined();
    });

    test("a normal brand config still renders logo, name, and tagline correctly", async () => {
        let nav = await create_nav("navbar", {
            config: JSON.stringify({
                brand: {name: "Acme", logo_url: "/logo.svg", link: "/home", tagline: "Great products", should_show: true},
                navigation: [],
            }),
        });

        let brand = nav.shadowRoot.querySelector(".brand");

        expect(brand.querySelector("a").getAttribute("href")).toBe("/home");
        expect(brand.querySelector("img").getAttribute("src")).toBe("/logo.svg");
        expect(brand.querySelector("span").textContent).toBe("Acme");
        expect(brand.querySelector("p").textContent).toBe("Great products");
    });

    test("brand.should_show: false renders no brand block at all", async () => {
        let nav = await create_nav("navbar", {
            config: JSON.stringify({brand: {name: "Acme", should_show: false}, navigation: []}),
        });

        expect(nav.shadowRoot.querySelector(".brand")).toBeNull();
    });
});
