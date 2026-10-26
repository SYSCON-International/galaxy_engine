/**
 * @file GalaxyUtils.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * @class GalaxyUtils
 * @description
 *    A utility class for various helper functions.
 */
export class GalaxyUtils {
    /**
     * @constructor
     */
    constructor() {}

    /**
     * Get the width of a given text string in pixels.
     * @param {string} text - The text string to measure.
     * @param {string|null} font - The font string to use for measurement (optional). Will use the body's font if not provided.
     * @return {number} - The width of the text in pixels.
     */
    static get_text_width = (text, font = null) => {
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");

        if (!font) {
            let font_weight = window.getComputedStyle(document.body).fontWeight || "normal";
            let font_size = window.getComputedStyle(document.body).fontSize || "16px";
            let font_family = window.getComputedStyle(document.body).fontFamily || "Arial";

            font = `${font_weight} ${font_size} ${font_family}`;
        }

        context.font = font;

        let metrics = context.measureText(text);

        return metrics.width;
    }

    /**
     * Creates and returns a debounced function that will only be called after the delay has passed since the last time it was called.
     * If immediate is true, the function will be called immediately and then debounced.
     * @param {function} callback - The function to debounce
     * @param {number} delay - The delay in milliseconds
     * @param {boolean} immediate - Whether to call the function immediately
     * @returns {(function(...[*]): void)|*}
     */
    static debounce = (callback, delay, immediate = false) => {
        let timer;

        return function(...args) {
            let context = this; // preserve calling context
            let call_now = immediate && !timer;

            clearTimeout(timer);

            timer = setTimeout(() => {
                timer = null;

                if (!immediate) {
                    callback.apply(context, args);
                }

            }, delay);

            if (call_now) {
                callback.apply(context, args);
            }
        };
    }

    /**
     * Same as Element.closest(), but continues the search across shadow root boundaries by jumping from a shadow root to its host element.
     * This is needed because a shadow-rendered element's ancestor chain stops at its shadow root — it does not naturally continue into the host element's own ancestor tree.
     * @param {Element|null} element - The element to start searching from (inclusive).
     * @param {string} selector - The CSS selector to match.
     * @return {Element|null} - The closest matching element, or null if none is found.
     */
    static closest_through_shadow_roots = (element, selector) => {
        let current = element;

        while (current) {
            let match = current.closest?.(selector);

            if (match) {
                return match;
            }

            let root = current.getRootNode?.();

            current = root instanceof ShadowRoot ? root.host : null;
        }

        return null;
    }

    /**
     * Gets the element whose attributes configure a form: the `<galaxy-form>` for a galaxy-form's internal `<form>`, and the form itself for a native one.
     * @param {HTMLFormElement} form - The form.
     * @return {HTMLElement} - The `<galaxy-form>`, or the native form.
     */
    static get_form_owner_element = (form) => {
        let root_host = form.getRootNode().host;
        let is_galaxy_form_element = root_host?.localName === "galaxy-form" && root_host.form_element === form;

        return is_galaxy_form_element ? root_host : form;
    }

    /**
     * Gets a form's default button: its first submit control in tree order that submits this form - a native submit button (a `<button>` with no `type` included) or a
     * `galaxy-button` with `submit`. A control inside the form that names another form with `form="…"` is skipped. A control outside the form that names it is not
     * found, and controls inside a nested `galaxy-form` belong to that form.
     * @param {HTMLFormElement} form - The form.
     * @return {Element|null} - The default button, or null when the form has none.
     */
    static get_default_submit_control = (form) => {
        let submit_controls = form.querySelectorAll('button:not([type]), button[type="submit" i], input[type="submit" i], input[type="image" i], galaxy-button[submit]');

        for (let submit_control of submit_controls) {
            if (submit_control.form === form) {
                return submit_control;
            }
        }

        return null;
    }

    /**
     * Submits a form as Enter in one of its fields does, when the form allows it with `submit-on-enter` (on a `<galaxy-form>`, or on a native form). It activates the
     * form's default button, so the button's own handling (a confirmation, a native submitter's name and value) runs as for a click; a disabled default button blocks
     * it, as in a browser. A form with no default button is submitted with requestSubmit(), so it is still validated first.
     * @param {HTMLFormElement} form - The form.
     * @return {boolean} - True when the form was submitted, or its default button activated.
     */
    static submit_form_implicitly = (form) => {
        if (!GalaxyUtils.get_form_owner_element(form).hasAttribute("submit-on-enter")) {
            return false;
        }

        let default_submit_control = GalaxyUtils.get_default_submit_control(form);

        if (!default_submit_control) {
            form.requestSubmit();

            return true;
        }

        if (default_submit_control.disabled) {
            return false;
        }

        // A galaxy-button's own click handling is on its inner button, which a click on the element itself does not reach.
        if (typeof default_submit_control.activate === "function") {
            default_submit_control.activate();
        }
        else {
            default_submit_control.click();
        }

        return true;
    }

    /**
     * Gets every ancestor of an element, nearest first, continuing across shadow root boundaries from each shadow root to its host - the upward counterpart of
     * {@link get_descendants_through_shadow_roots}.
     * @param {Element|null} element - The element to start from (not included).
     * @return {Element[]} - The ancestors, nearest first.
     */
    static get_ancestors_through_shadow_roots = (element) => {
        let ancestors = [];
        let current = element;

        while (current) {
            let parent = current.parentElement;

            if (!parent) {
                let root = current.getRootNode?.();

                parent = root instanceof ShadowRoot ? root.host : null;
            }

            if (parent) {
                ancestors.push(parent);
            }

            current = parent;
        }

        return ancestors;
    }

    /**
     * Gets every element inside an element's light DOM, continuing into the open shadow root of each one found - so a component nested inside another component's
     * shadow DOM (e.g. a field a galaxy-form has moved into its own) is included. The element's own shadow root is not searched.
     * @param {Element} element - The element whose contents to search.
     * @return {Element[]} - The descendants, in document order.
     */
    static get_descendants_through_shadow_roots = (element) => {
        let descendants = [];

        let collect = (parent) => {
            for (let child of parent.children) {
                descendants.push(child);

                if (child.shadowRoot) {
                    collect(child.shadowRoot);
                }

                collect(child);
            }
        };

        collect(element);

        return descendants;
    }

    /**
     * Adds default CSS for something an engine component draws outside its shadow root, such as a popup appended to the body. It is added once, as the first child of the
     * document head, so a consuming app's own stylesheets come later in document order and override it at equal specificity - the same placement as the engine's palette.
     * @param {string} css_string - The CSS to add.
     * @param {string} style_id - The id of the `<style>` element; a second call with the same id adds nothing.
     */
    static add_default_css = (css_string, style_id) => {
        if (document.getElementById(style_id)) {
            return;
        }

        let style = document.createElement("style");

        style.id = style_id;
        style.textContent = css_string;

        document.head.insertBefore(style, document.head.firstChild);
    }
}
