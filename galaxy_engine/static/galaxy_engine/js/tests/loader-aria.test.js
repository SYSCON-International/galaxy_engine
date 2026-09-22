import { describe, expect, test } from "vitest";
import { create_loader } from "./loader-test-helpers.js";

describe("loader accessibility (minor note)", () => {
    test("the content region is announced as a status live region", async () => {
        let loader = await create_loader();

        let content = loader.shadowRoot.querySelector(".galaxy-loader-content");

        expect(content.getAttribute("role")).toBe("status");
        expect(content.getAttribute("aria-live")).toBe("polite");
    });

    test("the decorative spinner dots are hidden from assistive tech", async () => {
        let loader = await create_loader();

        expect(loader.shadowRoot.querySelector(".loader-drip").getAttribute("aria-hidden")).toBe("true");
    });

    test("the custom image keeps a descriptive alt text", async () => {
        let loader = await create_loader({"image-url": "/spinner.gif"});

        expect(loader.shadowRoot.querySelector(".custom-image").getAttribute("alt")).toBe("Loading");
    });
});
