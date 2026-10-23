import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { GalaxyNotificationManager } from "../GalaxyNotificationManager.js";
import { GalaxyComboBox } from "../components/GalaxyComboBox.js";
import { GalaxyTextInput } from "../components/GalaxyTextInput.js";
import { create_picker, flush } from "./datetime-test-helpers.js";
import { create_select } from "./test-helpers.js";
import "./notification-test-helpers.js";

for (let [tag_name, component_class] of [["galaxy-text-input", GalaxyTextInput], ["galaxy-combo-box", GalaxyComboBox]]) {
    if (!customElements.get(tag_name)) {
        customElements.define(tag_name, component_class);
    }
}

// Read as text: importing GalaxyEngine.js would self-instantiate a full engine as a side effect (see setup.js).
const ENGINE_SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../GalaxyEngine.js"), "utf8");

const get_shadow_style_text = (element) => Array.from(element.shadowRoot.querySelectorAll("style")).map((style) => style.textContent).join("\n");

const create_connected = async (tag_name) => {
    let element = document.createElement(tag_name);

    document.body.appendChild(element);
    await flush();
    await flush();

    return element;
};

/**
 * Removes the CSS literals that sit inside a var() as its fallback, so what is left is only the colors used directly.
 * @param {string} css
 * @return {string}
 */
const strip_var_fallbacks = (css) => css.replace(/var\(--[a-z0-9-]+,\s*[^)]*\)\)?/g, "var()");

describe("the engine palette has the dropdown and notification variables", () => {
    test("engine_css declares them", () => {
        for (let variable_name of [
            "--dropdown-background", "--dropdown-shadow", "--dropdown-option-hover", "--dropdown-option-highlight", "--notifications-top", "--notifications-right",
        ]) {
            expect(ENGINE_SOURCE, variable_name).toMatch(new RegExp(`${variable_name}:`));
        }
    });
});

describe("the datetime popup is styled by the engine", () => {
    const open_popup = async (picker) => {
        picker.input_element.dispatchEvent(new window.Event("focus"));
        picker.input_element.dispatchEvent(new window.Event("click"));
        await flush();
    };

    test("opening a popup injects its styles once, at the start of the head, so a page stylesheet can override them", async () => {
        let page_style = document.createElement("style");

        page_style.id = "page-stylesheet";
        document.head.appendChild(page_style);

        await open_popup(await create_picker("date"));
        await open_popup(await create_picker("datetime"));

        let popup_styles = document.head.querySelectorAll("style#galaxy-datetime-popup-css");

        expect(popup_styles).toHaveLength(1);
        expect(popup_styles[0].textContent).toContain(".galaxy-datetime-popup");

        let head_children = Array.from(document.head.children);

        expect(head_children.indexOf(popup_styles[0])).toBeLessThan(head_children.indexOf(page_style));

        page_style.remove();
    });

    test("its colors come from the palette", async () => {
        await open_popup(await create_picker("date"));

        let popup_css = document.getElementById("galaxy-datetime-popup-css").textContent;

        expect(popup_css).toContain("var(--dropdown-background");
        expect(popup_css).toContain("var(--blue");
        expect(strip_var_fallbacks(popup_css)).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    });
});

// Each component's own CSS only: the field rules they inherit from the input base (its readonly and plain backgrounds) are not dropdown colors.
describe("select and combo-box colors come from the palette", () => {
    test("galaxy-select", async () => {
        let select = await create_select("select");
        let style_text = `${select.component_css}\n${select.post_component_css}`;

        expect(style_text).toContain("var(--dropdown-option-hover, #f8f9fa)");
        expect(style_text).toContain("var(--dropdown-option-highlight, #e9ecef)");
        expect(style_text).toContain("var(--dropdown-shadow");
        expect(style_text).toContain("var(--dropdown-background");
        expect(strip_var_fallbacks(style_text)).not.toMatch(/#f8f9fa|#e9ecef|rgba\(0, 0, 0, 0\.15\)|:\s*white;|color:\s*red;/);
    });

    test("galaxy-combo-box", async () => {
        let combo_box = await create_connected("galaxy-combo-box");
        let style_text = `${combo_box.component_css}\n${combo_box.post_component_css}`;

        expect(style_text).toContain("var(--dropdown-option-hover, #f8f9fa)");
        expect(style_text).toContain("var(--dropdown-option-highlight, #e9ecef)");
        expect(strip_var_fallbacks(style_text)).not.toMatch(/#f8f9fa|#e9ecef|#ffffff|rgba\(0, 0, 0, 0\.15\)/);
    });
});

describe("inputs use the page font and show a focus ring", () => {
    test("the input base's field inherits the font and has a focus rule", async () => {
        let style_text = get_shadow_style_text(await create_connected("galaxy-text-input"));

        expect(style_text).toMatch(/font-family:\s*inherit;/);
        expect(style_text).toMatch(/&:not\(\[type="checkbox"\]\):focus\s*\{[^}]*border-color:\s*var\(--blue\)/);
    });
});

describe("the notification container can be positioned from a stylesheet", () => {
    test("it has a class and no inline position", () => {
        let manager = new GalaxyNotificationManager();
        let container = manager.notifications_container;

        expect(container.classList.contains("galaxy-notifications")).toBe(true);
        expect(container.style.top).toBe("");
        expect(container.style.right).toBe("");
        expect(container.style.position).toBe("");
    });

    test("its default rule is injected once, at the start of the head, using the position variables", () => {
        new GalaxyNotificationManager();
        new GalaxyNotificationManager();

        let notification_styles = document.head.querySelectorAll("style#galaxy-notifications-css");

        expect(notification_styles).toHaveLength(1);
        expect(document.head.firstElementChild.id === "galaxy-notifications-css" || document.head.firstElementChild.id === "galaxy-datetime-popup-css").toBe(true);
        expect(notification_styles[0].textContent).toMatch(/top:\s*var\(--notifications-top, 10px\)/);
        expect(notification_styles[0].textContent).toMatch(/right:\s*var\(--notifications-right, 10px\)/);
    });
});
