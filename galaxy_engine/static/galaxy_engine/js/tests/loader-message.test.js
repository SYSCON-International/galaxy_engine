import { describe, expect, test } from "vitest";
import { create_loader, flush } from "./loader-test-helpers.js";

describe("message defaults and empty-string hiding (fix #3)", () => {
    test("defaults to 'Loading' with no message attribute", async () => {
        let loader = await create_loader();

        expect(loader.message).toBe("Loading");
        expect(loader.shadowRoot.querySelector(".message").textContent).toBe("Loading");
        expect(loader.shadowRoot.querySelector(".message").classList.contains("hide")).toBe(false);
    });

    test("setting message = '' via the property hides the message, matching setAttribute('message', '')", async () => {
        let loader = await create_loader();

        loader.message = "";
        await flush(); // update_message() runs from the async attribute-changed reaction, not synchronously

        expect(loader.message).toBe("");
        expect(loader.shadowRoot.querySelector(".message").textContent).toBe("");
        expect(loader.shadowRoot.querySelector(".message").classList.contains("hide")).toBe(true);
    });

    test("setting message = null (or undefined) clears the attribute, reverting to the 'Loading' default", async () => {
        let loader = await create_loader({message: "Custom"});

        expect(loader.message).toBe("Custom");

        loader.message = null;
        await flush();

        expect(loader.hasAttribute("message")).toBe(false);
        expect(loader.message).toBe("Loading");
    });

    test("a custom message string renders as-is", async () => {
        let loader = await create_loader();

        loader.message = "Fetching data...";
        await flush();

        expect(loader.shadowRoot.querySelector(".message").textContent).toBe("Fetching data...");
    });
});
