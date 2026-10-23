import { describe, expect, test, vi } from "vitest";
import { click_button, create_button, flush_all } from "./button-test-helpers.js";

const get_inner_button = (galaxy_button) => galaxy_button.shadowRoot.querySelector("button");

const get_style_text = (galaxy_button) => Array.from(galaxy_button.shadowRoot.querySelectorAll("style")).map((style) => style.textContent).join("\n");

describe("galaxy-button disabled state", () => {
    test("a disabled attribute in markup disables the inner button", async () => {
        let galaxy_button = await create_button({"disabled": ""});

        expect(galaxy_button.disabled).toBe(true);
        expect(get_inner_button(galaxy_button).disabled).toBe(true);
    });

    test("a disabled button's click reaches no listener on the element", async () => {
        let galaxy_button = await create_button({"disabled": ""});
        let click_listener = vi.fn();

        galaxy_button.addEventListener("click", click_listener);

        click_button(galaxy_button);
        galaxy_button.click();

        expect(click_listener).not.toHaveBeenCalled();
    });

    test("a disabled button with has-confirm does not open its confirmation", async () => {
        let galaxy_button = await create_button({"disabled": "", "has-confirm": ""});

        click_button(galaxy_button);
        await flush_all();

        expect(galaxy_button.confirm_modal.open).toBe(false);
    });

    test("toggling disabled from code enables and disables it", async () => {
        let galaxy_button = await create_button();
        let click_listener = vi.fn();

        galaxy_button.addEventListener("click", click_listener);

        galaxy_button.disabled = true;
        await flush_all();

        expect(galaxy_button.hasAttribute("disabled")).toBe(true);
        expect(get_inner_button(galaxy_button).disabled).toBe(true);

        galaxy_button.click();
        expect(click_listener).not.toHaveBeenCalled();

        galaxy_button.disabled = false;
        await flush_all();

        expect(galaxy_button.hasAttribute("disabled")).toBe(false);
        expect(get_inner_button(galaxy_button).disabled).toBe(false);

        click_button(galaxy_button);
        expect(click_listener).toHaveBeenCalledTimes(1);
    });

    test("an enabled button with has-confirm still opens its confirmation", async () => {
        let galaxy_button = await create_button({"has-confirm": ""});

        click_button(galaxy_button);
        await flush_all();

        expect(galaxy_button.confirm_modal.open).toBe(true);
    });

    test("the disabled state is styled", async () => {
        let galaxy_button = await create_button();

        expect(get_style_text(galaxy_button)).toMatch(/:host\(\[disabled\]\) button\s*\{/);
        // Hover colors apply only to an enabled button.
        expect(get_style_text(galaxy_button)).not.toMatch(/&:hover\s*\{/);
    });
});

describe("galaxy-button styling", () => {
    test("the inner button inherits the page font and has a keyboard focus ring", async () => {
        let style_text = get_style_text(await create_button());

        expect(style_text).toMatch(/font-family:\s*inherit;/);
        expect(style_text).toMatch(/&:focus-visible\s*\{\s*outline:\s*2px solid var\(--blue\);/);
    });

    test("the icon sits in a centered flex row with the label", async () => {
        let style_text = get_style_text(await create_button({"icon": "save"}));

        expect(style_text).toMatch(/display:\s*inline-flex;/);
        expect(style_text).toMatch(/align-items:\s*center;/);
        expect(style_text).not.toMatch(/vertical-align:\s*text-top;/);
    });
});

describe("galaxy-button variants", () => {
    test("two extra sizes", async () => {
        let style_text = get_style_text(await create_button({"size": "sm"}));

        expect(style_text).toMatch(/:host\(\[size="sm"\]\) button\s*\{[^}]*padding:\s*0\.25rem 0\.5rem;[^}]*font-size:\s*0\.875rem;/);
        expect(style_text).toMatch(/:host\(\[size="lg"\]\) button\s*\{[^}]*padding:\s*0\.5rem 1rem;[^}]*font-size:\s*1\.25rem;/);
    });

    test("a block button fills its container", async () => {
        let style_text = get_style_text(await create_button({"block": ""}));

        expect(style_text).toMatch(/:host\(\[block\]\)\s*\{\s*display:\s*block;/);
        expect(style_text).toMatch(/:host\(\[block\]\) button\s*\{\s*width:\s*100%;/);
    });

    test("secondary and light types, with hover colors only when enabled", async () => {
        let style_text = get_style_text(await create_button({"type": "secondary"}));

        expect(style_text).toMatch(/:host\(\[type="secondary"\]\) button\s*\{[^}]*background-color:\s*var\(--grey/);
        expect(style_text).toMatch(/:host\(\[type="light"\]\) button\s*\{[^}]*background-color:\s*var\(--dropdown-option-hover/);
        expect(style_text).not.toMatch(/&:hover\s*\{/);
    });
});
