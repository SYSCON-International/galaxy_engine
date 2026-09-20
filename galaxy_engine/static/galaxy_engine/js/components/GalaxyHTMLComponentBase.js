/**
 * @file GalaxyHTMLComponentBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
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

        this.shadow = this.attachShadow({mode: "open"});
        this.shadowRoot.innerHTML = `<style>${this.base_css}${this.pre_component_css}${this.component_css}${this.post_component_css}</style>`;

        this.is_initialized = false;
        this.parent_form = this.closest("galaxy-form");
    }

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
        // If part of a form, the form will handle initialization of Galaxy children to avoid double initialization.
        if (!this.parent_form || this.parent_form === this) {
            await this.pre_on_create();
            await this.on_create();
            await this.post_on_create();

            this.is_initialized = true;
        }
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
        // To avoid double destruction, only destroy if the component has been initialized.
        if (this.is_initialized) {
            await this.pre_on_destroy();
            await this.on_destroy();
            await this.post_on_destroy();

            this.is_initialized = false;
        }
    }

    /**
     * Creates a new instance of the html template passed in and returns it.
     * If no template is provided, it uses the component's template HTML.
     *
     * @param {string|null} template_html - The template HTML to use.
     * @return {Promise<DocumentFragment>}
     */
    get_template = async (template_html = null) => {
        let template_html_to_use = template_html ? template_html : this.component_html;
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