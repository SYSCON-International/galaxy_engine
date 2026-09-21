/**
 * @file GalaxyLoaderManager.js
 * @framework GalaxyLoaderManager
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * @class GalaxyLoaderManager
 * @description
 *      A class for managing loading indicators shown in the UI, either fullscreen or scoped to an individual element. Callers are tracked with tokens (returned by `show_fullscreen`/
 *      `show_element`) so that a loader triggered by multiple concurrent callers is only removed once every caller has released it via the matching `hide_*` method -- this prevents
 *      one caller's `hide_*` call from removing a loader that another caller is still relying on.
 */
export class GalaxyLoaderManager {
    /**
     * @constructor
     */
    constructor() {
        this._next_token_id = 0;

        this.fullscreen_loader = null;
        this.fullscreen_tokens = new Set();

        // WeakMap, not Map: keyed by the caller's target element, which this manager doesn't otherwise own.
        // A caller that discards target_element without calling hide_element() first (a re-render, an SPA
        // navigating away, ...) must not keep it (plus its loader and tokens) alive forever as a result.
        this.element_loader_entries = new WeakMap();
    }

    /**
     * Generates a unique token to hand back to a `show_*` caller. The token must be passed to the matching `hide_*` method to release this caller's claim on the loader.
     * @return {string} - A unique token.
     */
    generate_token = () => `galaxy-loader-token-${++this._next_token_id}`;

    /**
     * Applies the look-and-feel options (image, message, custom CSS) to a newly created loader. Only called once, when a loader is first shown -- per project convention, the first
     * caller's options determine the loader's look for as long as it is displayed, so that a later concurrent caller with different options can't cause the loader to change
     * appearance (or flicker) out from under the first caller.
     * @param {GalaxyLoader} loader - The loader instance to configure.
     * @param {{image_url: string, message: string, custom_style: string}} options - The look-and-feel options.
     */
    apply_loader_options = (loader, options = {}) => {
        if (options.image_url) {
            loader.image_url = options.image_url;
        }

        if (options.message) {
            loader.message = options.message;
        }

        if (options.custom_style) {
            loader.custom_style = options.custom_style;
        }
    }

    /**
     * Shows the fullscreen loader, creating it if it is not already visible. Returns a token that must be passed to {@link hide_fullscreen} to release this caller's claim.
     * @param {{image_url: string, message: string, custom_style: string}} [options] - Look-and-feel options. Ignored if the fullscreen loader is already showing -- see
     * {@link apply_loader_options}.
     * @return {string} - The token for this caller's claim on the fullscreen loader.
     */
    show_fullscreen = (options = {}) => {
        if (!this.fullscreen_loader) {
            this.fullscreen_loader = document.createElement("galaxy-loader");
            this.fullscreen_loader.fullscreen = true;

            this.apply_loader_options(this.fullscreen_loader, options);

            document.body.appendChild(this.fullscreen_loader);
        }

        let token = this.generate_token();
        this.fullscreen_tokens.add(token);

        return token;
    }

    /**
     * Releases a caller's claim on the fullscreen loader. The loader is only removed from the DOM once every caller that showed it has released their token.
     * @param {string} token - The token returned by {@link show_fullscreen}.
     */
    hide_fullscreen = (token) => {
        if (!this.fullscreen_tokens.has(token)) {
            console.warn(`GalaxyLoaderManager: unknown fullscreen loader token "${token}".`);
            return;
        }

        this.fullscreen_tokens.delete(token);

        if (this.fullscreen_tokens.size === 0 && this.fullscreen_loader) {
            this.fullscreen_loader.remove();
            this.fullscreen_loader = null;
        }
    }

    /**
     * Checks whether the fullscreen loader is currently being shown by any caller.
     * @return {boolean} - True if the fullscreen loader is showing.
     */
    is_loading_fullscreen = () => this.fullscreen_tokens.size > 0;

    /**
     * Shows a loader scoped to the given element, creating it if the element doesn't already have one. If the element's computed position is `static`, it is temporarily switched to
     * `relative` (restored when the loader is fully released) so the loader can be positioned to fill it. Returns a token that must be passed to {@link hide_element} to release this
     * caller's claim.
     * @param {HTMLElement} target_element - The element to scope the loader to.
     * @param {{image_url: string, message: string, custom_style: string}} [options] - Look-and-feel options. Ignored if the element already has a loader showing -- see
     * {@link apply_loader_options}.
     * @return {string|null} - The token for this caller's claim on the element's loader, or null if no target element was provided.
     */
    show_element = (target_element, options = {}) => {
        if (!target_element) {
            console.warn("GalaxyLoaderManager: show_element() requires a target element.");
            return null;
        }

        let entry = this.element_loader_entries.get(target_element);

        if (!entry) {
            let loader = document.createElement("galaxy-loader");

            this.apply_loader_options(loader, options);

            let position_was_overridden = window.getComputedStyle(target_element).position === "static";

            entry = {
                loader: loader,
                tokens: new Set(),
                original_position: target_element.style.position,
                position_was_overridden: position_was_overridden,
            }

            if (position_was_overridden) {
                target_element.style.position = "relative";
            }

            target_element.appendChild(loader);
            this.element_loader_entries.set(target_element, entry);
        }

        let token = this.generate_token();
        entry.tokens.add(token);

        return token;
    }

    /**
     * Releases a caller's claim on an element's loader. The loader is only removed from the DOM (and the element's position style restored, if it was overridden) once every caller
     * that showed it has released their token.
     * @param {HTMLElement} target_element - The element the loader is scoped to.
     * @param {string} token - The token returned by {@link show_element}.
     */
    hide_element = (target_element, token) => {
        let entry = this.element_loader_entries.get(target_element);

        if (!entry || !entry.tokens.has(token)) {
            console.warn(`GalaxyLoaderManager: unknown element loader token "${token}".`);
            return;
        }

        entry.tokens.delete(token);

        if (entry.tokens.size === 0) {
            entry.loader.remove();

            if (entry.position_was_overridden) {
                target_element.style.position = entry.original_position;
            }

            this.element_loader_entries.delete(target_element);
        }
    }

    /**
     * Checks whether the given element currently has a loader being shown by any caller.
     * @param {HTMLElement} target_element - The element to check.
     * @return {boolean} - True if the element has a loader showing.
     */
    is_loading_element = (target_element) => {
        let entry = this.element_loader_entries.get(target_element);

        return !!entry && entry.tokens.size > 0;
    }
}
