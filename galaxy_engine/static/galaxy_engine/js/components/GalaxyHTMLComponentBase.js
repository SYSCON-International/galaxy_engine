/**
 * @file GalaxyHTMLComponentBase.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * @class
 * @description
 *     A base class for all custom elements in the application.
 * @extends HTMLElement
 */
export class GalaxyHTMLComponentBase extends HTMLElement {
    /**
     * @constructor
     */
    constructor(component_template_html) {
        super();

        this.component_template_html = component_template_html;

        this.shadow = this.attachShadow({mode: "open", ...this.constructor.shadow_root_options});
        this.shadowRoot.innerHTML = `<style>${this.base_css}${this.pre_component_css}${this.component_css}${this.post_component_css}</style>`;

        this.is_initialized = false;
        this.initialization_promise = null;
        this.destruction_promise = null;
        this.parent_form = this.find_parent_form();
    }

    /**
     * Finds the `<galaxy-form>` this element belongs to: the nearest one around it, or, for a field already moved into a form's internal `<form>`, the form whose shadow
     * root holds it (closest() stops at that shadow boundary). Searched from the parent, since closest() includes the element itself, which would make a `<galaxy-form>`
     * nested in another its own parent_form.
     * @return {HTMLElement|null} - The form, or null when the element is in none.
     */
    find_parent_form = () => {
        let closest_form = this.parentElement ? this.parentElement.closest("galaxy-form") : null;

        if (closest_form) {
            return closest_form;
        }

        let root_host = this.getRootNode().host;

        if (root_host?.localName === "galaxy-form") {
            return root_host;
        }

        return null;
    }

    /**
     * Extra options for the component's shadow root, merged over `{mode: "open"}` - e.g. `{delegatesFocus: true}`.
     * @return {Object} - The shadow root options.
     */
    static get shadow_root_options() {return {}};

    /**
     * Observed attributes that will trigger the {@link attributeChangedCallback}.
     * @note These attributes will be added to the observedAttributes array before the {@link observed_attributes}
     * @return {string[]} - The observed attributes.
     */
    static get pre_observed_attributes() {return []};

    /**
     * Observed attributes that will trigger the {@link attributeChangedCallback}.
     * @note These attributes will be added to the observedAttributes array after the {@link pre_observed_attributes} and before the {@link post_observed_attributes}.
     * @return {string[]} - The observed attributes.
     */
    static get observed_attributes() {return []};

    /**
     * Observed attributes that will trigger the {@link attributeChangedCallback}.
     * @note These attributes will be added to the observedAttributes array after the {@link observed_attributes}.
     * @return {string[]} - The observed attributes.
     */
    static get post_observed_attributes() {return []};

    /**
     * Observed attributes that will trigger the {@link attributeChangedCallback}.
     * @return {string[]} - The observed attributes.
     */
    static get observedAttributes() {
        return [...this.pre_observed_attributes, ...this.observed_attributes, ...this.post_observed_attributes];
    }

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link attributeChangedCallback} when an observed attribute changes.
     * @note This method is called before {@link attribute_changed_callback}.
     * @async
     * @param {string} name - The name of the attribute that changed.
     * @param {string} old_value - The old value of the attribute.
     * @param {string} new_value - The new value of the attribute.
     * @return {Promise<void>}
     */
    pre_attribute_changed_callback = async (name, old_value, new_value) => {}

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link attributeChangedCallback} when an observed attribute changes.
     * @note This method is called after {@link pre_attribute_changed_callback} and before {@link post_attribute_changed_callback}.
     * @async
     * @param {string} name - The name of the attribute that changed.
     * @param {string} old_value - The old value of the attribute.
     * @param {string} new_value - The new value of the attribute.
     * @return {Promise<void>}
     */
    attribute_changed_callback = async (name, old_value, new_value) => {}

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link attributeChangedCallback} when an observed attribute changes.
     * @note This method is called after {@link attribute_changed_callback}.
     * @async
     * @param {string} name - The name of the attribute that changed.
     * @param {string} old_value - The old value of the attribute.
     * @param {string} new_value - The new value of the attribute.
     * @return {Promise<void>}
     */
    post_attribute_changed_callback = async (name, old_value, new_value) => {}

    /**
     * Web Components API - Lifecycle hook: called when an observed attribute changes.
     * @async
     * @param {string} name - The name of the attribute that changed.
     * @param {string} old_value - The old value of the attribute.
     * @param {string} new_value - The new value of the attribute.
     * @return {Promise<void>}
     */
    async attributeChangedCallback(name, old_value, new_value) {
        await this.pre_attribute_changed_callback(name, old_value, new_value);
        await this.attribute_changed_callback(name, old_value, new_value);
        await this.post_attribute_changed_callback(name, old_value, new_value);
    }

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link connectedCallback} when the element is added to the DOM.
     * @note This method is called before {@link on_create}.
     * @async
     * @return {Promise<void>}
     */
    pre_on_create = async () => {}

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link connectedCallback} when the element is added to the DOM.
     * @note This method is called after {@link pre_on_create} and before {@link post_on_create}.
     * @async
     * @return {Promise<void>}
     */
    on_create = async () => {}

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link connectedCallback} when an observed attribute changes.
     * @note This method is called after {@link on_create}.
     * @async
     * @return {Promise<void>}
     */
    post_on_create = async () => {}

    /**
     * Web Components API - Lifecycle hook: called when the element is added to the DOM.
     * @async
     * @return {Promise<void>}
     */
    async connectedCallback() {
        // Found again on every connect, since the element may have been created outside the form, added to a wrapper inside it, or moved out of it since construction.
        this.parent_form = this.find_parent_form();

        // A form that has not yet collected its children will move this element into its internal <form> and initialize it then; initializing here as well would run the
        // create lifecycle before and after the move. Once the form has collected its children, nothing else will initialize this element, so it initializes itself.
        let is_awaiting_parent_form = this.parent_form && this.parent_form !== this && !this.parent_form.has_initialized_children;

        if (!is_awaiting_parent_form) {
            await this.initialize_component();
        }
    }

    /**
     * Runs the create lifecycle ({@link pre_on_create}, {@link on_create}, {@link post_on_create}) once. Safe to call from more than one place - a call made while the
     * lifecycle is already running, or after it has finished, returns the same promise rather than running it again. {@link disconnectedCallback} resets it, so a reconnect
     * runs it afresh.
     * @async
     * @return {Promise<void>}
     */
    initialize_component = () => {
        if (!this.initialization_promise) {
            this.initialization_promise = this.run_create_lifecycle();
        }

        return this.initialization_promise;
    }

    /**
     * Runs the create lifecycle and marks the component initialized. Called only through {@link initialize_component}.
     * @async
     * @return {Promise<void>}
     */
    run_create_lifecycle = async () => {
        // A reconnect right after a disconnect (a move) must not build on top of a teardown still in progress.
        if (this.destruction_promise) {
            await this.destruction_promise;
        }

        await this.pre_on_create();
        await this.on_create();
        await this.post_on_create();

        this.is_initialized = true;
    }

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link disconnectedCallback} when the element is removed from the DOM.
     * @note This method is called before {@link on_destroy}.
     * @async
     * @return {Promise<void>}
     */
    pre_on_destroy = async () => {}

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link disconnectedCallback} when the element is removed from the DOM.
     * @note This method is called after {@link pre_on_destroy} and before {@link post_on_destroy}.
     * @async
     * @return {Promise<void>}
     */
    on_destroy = async () => {};

    /**
     * Web Components API - Lifecycle hook: called as a part of {@link disconnectedCallback} when the element is removed from the DOM.
     * @note This method is called after {@link on_destroy}.
     * @async
     * @return {Promise<void>}
     */
    post_on_destroy = async () => {}

    /**
     * Web Components API - Lifecycle hook: method called when the element is removed from the DOM.
     * @async
     * @return {Promise<void>}
     */
    async disconnectedCallback() {
        // Nothing to destroy if the create lifecycle never started.
        if (!this.initialization_promise) {
            return;
        }

        // Cleared synchronously: moving an element disconnects and reconnects it in the same task, before an async destroy could finish, and the reconnect must start a fresh
        // create lifecycle rather than reuse this one. That new lifecycle waits for this destruction first - see run_create_lifecycle.
        let pending_initialization = this.initialization_promise;
        this.initialization_promise = null;
        this.destruction_promise = this.run_destroy_lifecycle(pending_initialization);

        await this.destruction_promise;
    }

    /**
     * Runs the destroy lifecycle ({@link pre_on_destroy}, {@link on_destroy}, {@link post_on_destroy}) once the create lifecycle it undoes has finished, so a component removed
     * mid-creation is still cleaned up, and never destroyed half-built. Called only through {@link disconnectedCallback}.
     * @async
     * @param {Promise<void>} pending_initialization - The create lifecycle being undone.
     * @return {Promise<void>}
     */
    run_destroy_lifecycle = async (pending_initialization) => {
        try {
            await pending_initialization;
        }
        catch (error) {
            // A failed creation was already reported where it failed; there is still whatever it built to clean up.
        }

        // To avoid double destruction, only destroy if the component finished initializing.
        if (!this.is_initialized) {
            return;
        }

        await this.pre_on_destroy();
        await this.on_destroy();
        await this.post_on_destroy();

        this.is_initialized = false;
    }

    /**
     * Creates a new instance of the html template passed in and returns it.
     * If no template is provided, it uses the component's template HTML: its {@link component_html} getter, or, when that is empty, the template passed to the constructor.
     *
     * @param {string|null} template_html - The template HTML to use.
     * @return {Promise<DocumentFragment>}
     */
    get_template = async (template_html = null) => {
        let template_html_to_use = template_html ? template_html : (this.component_html || this.component_template_html || "");
        let template = document.createElement('template');

        template.innerHTML = template_html_to_use.trim();

        return template.content.children.length > 1 ? template.content : template.content.children[0];
    }

    /**
     * Base CSS styles for all components.
     * @note These CSS styles will be added before {@link pre_component_css}, {@link component_css}, and {@link post_component_css}.
     * @returns {string} - The base CSS styles for all components.
     */
    get base_css() {
        return `
            :host, :host *, :host *::before, :host *::after {
                box-sizing: border-box;
            }
        `;
    }

    /**
     * HTML template for the component. This can be overridden by child classes to provide specific HTML for the component.
     * @returns {string} - The HTML template for the component.
     */
    get component_html() {
        return ``;
    }

    /**
     * CSS styles for the component. This can be overridden by child classes to provide specific styles for the component.
     * @note This CSS will be added before {@link component_css}
     * @returns {string} - The CSS styles for the component.
     */
    get pre_component_css() {
        return ``;
    }

    /**
     * CSS styles for the component. This can be overridden by child classes to provide specific styles for the component.
     * @note This CSS will be added after {@link pre_component_css} and after {@link post_component_css}
     * @returns {string} - The CSS styles for the component.
     */
    get component_css() {
        return ``
    }

    /**
     * CSS styles for the component. This can be overridden by child classes to provide specific styles for the component.
     * @note This CSS will be added after {@link component_css}
     * @returns {string} - The CSS styles for the component.
     */
    get post_component_css() {
        return ``
    }

    /**
     * Adds CSS styles to the component's shadow DOM by creating a new style element and appending it to the shadow root. This allows for dynamic styling of the component based on
     * certain conditions or properties.
     * @param {string} css_string - The CSS string to be added to the shadow DOM.
     */
    add_shadow_css = (css_string) => {
        let style = new CSSStyleSheet;
        style.replaceSync(css_string);

        this.shadowRoot.adoptedStyleSheets.push(style);
    }

    /**
     * Adds global CSS to the document by creating or replacing a style element with the given ID.
     * If a style element with the specified ID already exists, it will be removed and replaced with a new one.
     * This is useful for dynamically adding or updating global styles in the application.
     * @param {string} css_string - The CSS string to be added to the document.
     * @param {string} style_id - The ID of the style element to be created or replaced.
     */
    add_global_css = (css_string, style_id) => {
        let head, style;
        head = document.getElementsByTagName("head")[0];

        let existing_style = document.getElementById(style_id);

        if (existing_style) {
            existing_style.remove();
        }

        if (head) {
          style = document.createElement("style");
          style.id = style_id;
          style.innerHTML = css_string;
          head.appendChild(style);
        }


    }
}