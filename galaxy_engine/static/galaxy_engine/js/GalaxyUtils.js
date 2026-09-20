/**
 * @file GalaxyUtils.js
 * @framework GalaxyEngine
 * @version 0.0.0
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
}