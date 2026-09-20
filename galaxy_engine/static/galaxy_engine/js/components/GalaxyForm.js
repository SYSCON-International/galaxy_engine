/**
 * @file GalaxyForm.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

const FORM_HTML_TEMPLATE = `
    <form></form>
`;

/**
 * @class
 * @description
 *     A form component
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyForm extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(FORM_HTML_TEMPLATE);
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ['action', 'method', 'enctype', 'novalidate', 'target']
    }

    /**
     * Initializes the form by performing the following steps:
     * 1) Set the form's action, method, enctype, novalidate, and target attributes
     * 2) Move all direct child nodes of <galaxy-form> into the <form>.
     *   This ensures they become official children of the real form for native validation.
     * 3) Run pre_on_create, on_create, and post_on_create for all Galaxy children.
     *   This is done after moving the children to prevent the children from running these methods twice.
     *   Once when they are created and once when the form is created and the children are moved to the form.
     * @return {Promise<void>}
     */
    initialize = async () => {
        // 1: attribute_changed_callback no-ops until this.form_element exists (see below), so any of these
        // attributes already present in markup at upgrade time need to be applied once, manually, here.
        if (this.action) {
            this.handle_observed_action(this.action);
        }
        if (this.method) {
            this.handle_observed_method(this.method);
        }
        if (this.enctype) {
            this.handle_observed_enctype(this.enctype);
        }
        if (this.novalidate) {
            this.handle_observed_novalidate(this.novalidate);
        }
        if (this.target) {
            this.handle_observed_target(this.target);
        }

        // 2
        while (this.firstChild) {
            this.form_element.appendChild(this.firstChild);
        }

        // 3
        let selector_string = Object.values(window.galaxy_engine.GALAXY_COMPONENT_TAG_NAMES).join(", ");

        let galaxy_components = this.shadow.querySelectorAll(`${selector_string}`);

        for (let galaxy_component of galaxy_components) {
            await this.initialize_galaxy_component(galaxy_component);
        }
    }

    /**
     * Runs the create lifecycle for a single Galaxy component. Used both by initialize() and by add_field().
     * @param {HTMLElement} galaxy_component - The Galaxy component to initialize.
     * @return {Promise<void>}
     */
    initialize_galaxy_component = async (galaxy_component) => {
        await galaxy_component.pre_on_create();
        await galaxy_component.on_create();
        await galaxy_component.post_on_create();

        galaxy_component.is_initialized = true;
    }

    /**
     * Adds a field (or a wrapper element containing one or more fields) to the form after it has already initialized.
     * @note initialize() only moves and initializes children once, at creation -- anything appended later (e.g. a
     * repeatable "add another row" field) is otherwise never moved into the real <form> or initialized. Use this instead
     * of a plain appendChild() for any field added after the form has finished its initial setup.
     * @param {HTMLElement} element - The field, or a wrapper element containing one or more Galaxy fields, to add.
     * @return {Promise<void>}
     */
    add_field = async (element) => {
        this.form_element.appendChild(element);

        let selector_string = Object.values(window.galaxy_engine.GALAXY_COMPONENT_TAG_NAMES).join(", ");
        let galaxy_components = element.matches?.(selector_string) ? [element, ...element.querySelectorAll(selector_string)] : element.querySelectorAll(selector_string);

        for (let galaxy_component of galaxy_components) {
            if (!galaxy_component.is_initialized) {
                await this.initialize_galaxy_component(galaxy_component);
            }
        }
    }

    /**
     * Gets the action attribute of the Galaxy form.
     * @return {string} - The action value of the form.
     */
    get action() {return this.getAttribute("action")}

    /**
     * Sets the action attribute of the Galaxy form.
     * @param {string} value - The action value of the form.
     */
    set action(value) {
        if (value) {
            this.setAttribute("action", value.toString());
        }
    }

    /**
     * Gets the method attribute of the Galaxy form.
     * @return {string} - The method value of the form.
     */
    get method() {return this.getAttribute("method")}

    /**
     * Sets the method attribute of the Galaxy form.
     * @param {string} value - The method value of the form.
     */
    set method(value) {
        if (value) {
            this.setAttribute("method", value.toString());
        }
    }

    /**
     * Gets the enctype attribute of the Galaxy form.
     * @return {string} - The enctype value of the form.
     */
    get enctype() {return this.getAttribute("enctype")}

    /**
     * Sets the enctype attribute of the Galaxy form.
     * @param {string} value - The enctype value of the form.
     */
    set enctype(value) {
        if (value) {
            this.setAttribute("enctype", value.toString());
        }
    }

    /**
     * Gets the novalidate attribute of the Galaxy form.
     * @return {boolean} - The novalidate value of the form.
     */
    get novalidate() {return this.hasAttribute("novalidate")}

    /**
     * Sets the novalidate attribute of the Galaxy form.
     * @param {string|boolean} value - The novalidate value of the form.
     */
    set novalidate(value) {
        if (value || value === "true") {
            this.setAttribute("novalidate", "");
        }
        else {
            this.removeAttribute("novalidate");
        }
    }

    /**
     * Gets the target attribute of the Galaxy form.
     * @return {string} - The target value of the form.
     */
    get target() {return this.getAttribute("target")}

    /**
     * Sets the target attribute of the Galaxy form.
     * @param {string} value - The target value of the form.
     */
    set target(value) {
        if (value) {
            this.setAttribute("target", value.toString());
        }
    }

    /**
     * Gets the instant validation attribute of the Galaxy form.
     * @return {boolean} - The instant validation value of the form.
     */
    get instant_validation() {return this.hasAttribute("instant-validation")}

    /**
     * Sets the instant validation attribute of the Galaxy form.
     * @param {boolean} value - The instant validation value of the form.
     */
    set instant_validation(value) {
        if (value || value === "true") {
            this.setAttribute("instant-validation", "");
        }
        else {
            this.removeAttribute("instant-validation");
        }
    }

    /**
     * Handles the observed action attribute by setting it on the form element
     * @param {string} new_value - The new value of the action attribute.
     */
    handle_observed_action = (new_value) => {
        this.form_element.action = new_value;
    }

    /**
     * Handles the observed method attribute by setting it on the form element.
     * @param {string} new_value - The new value of the method attribute.
     */
    handle_observed_method = (new_value) => {
        this.form_element.method = new_value;
    }

    /**
     * Handles the observed enctype attribute by setting it on the form element.
     * @param {string} new_value - The new value of the enctype attribute
     */
    handle_observed_enctype = (new_value) => {
        this.form_element.enctype = new_value;
    }

    /**
     * Handles the observed novalidate attribute by setting it on the form element.
     * @param {string|boolean} new_value - The new value of the novalidate attribute.
     */
    handle_observed_novalidate = (new_value) => {
        // Boolean attribute: attributeChangedCallback passes null when removed, and the (possibly empty) attribute string otherwise.
        if (new_value !== null) {
            this.form_element.setAttribute("novalidate", "");
        }
        else {
            this.form_element.removeAttribute("novalidate");
        }
    }

    /**
     * Handles the observed target attribute by setting it on the form element.
     * @param {string} new_value - The new value of the target attribute.
     */
    handle_observed_target = (new_value) => {
        this.form_element.target = new_value;
    }

    /**
     * {@link GalaxyInputBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.form_element) {
            return;
        }

        const attribute_lookup_table = {
            'action': this.handle_observed_action,
            'method': this.handle_observed_method,
            'enctype': this.handle_observed_enctype,
            'novalidate': this.handle_observed_novalidate,
            'target': this.handle_observed_target
        }

        attribute_lookup_table[name]?.(new_value);
    }

    /**
     * Handles the form submission event.
     * @param {Event} event - The form submission event.
     */
    on_form_submit = (event) => {
        event.preventDefault();

        let is_valid = this.validate();

        if (is_valid) {
            this.dispatchEvent(new CustomEvent('submit', {bubbles: true, composed: true}));
        }
    }

    /**
     * Validates the form and all of its galaxy children. Will also scroll to the first invalid galaxy child.
     * @param {boolean} scroll_to_first_invalid - Whether to scroll to the first invalid galaxy child.
     * @return {boolean} - A boolean indicating whether the form is valid.
     */
    validate = (scroll_to_first_invalid = true) => {
        let galaxy_children_are_valid = true;

        // get all galaxy children
        let selector_string = Object.values(window.galaxy_engine.GALAXY_COMPONENT_TAG_NAMES).join(", ");

        let galaxy_components = this.form_element.querySelectorAll(selector_string);

        for (let galaxy_component of galaxy_components) {
            if (typeof galaxy_component.validate === 'function' && !galaxy_component.validate()) {
                galaxy_children_are_valid = false;
            }
        }

        // check validity and galaxy children validity and scroll to the first invalid element
        if (!this.form_element.checkValidity() || !galaxy_children_are_valid) {
            if (scroll_to_first_invalid) {
                let first_invalid_element = this.form_element.querySelector(':invalid');

                if (first_invalid_element) {
                    first_invalid_element.scrollIntoView({behavior: 'smooth'});
                }
            }

            return false;
        }

        return true;
    }

    /**
     * Gets a field by its `name` attribute.
     * @note Fields move into the form's own shadow root once it initializes, so document.getElementById/querySelector
     * from outside can no longer find them; this reaches them through the real, natively-populated form.elements collection instead.
     * @param {string} name - The `name` attribute of the field to retrieve.
     * @return {Element|RadioNodeList|null} - The matching field, a RadioNodeList if multiple share the name (e.g. radio buttons), or null if not found.
     */
    get_field = (name) => this.form_element.elements.namedItem(name);

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.form_element = await this.get_template();

        this.shadow.appendChild(this.form_element);

        await this.initialize();

        this.form_element.addEventListener('submit', this.on_form_submit);
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.form_element.removeEventListener('submit', this.on_form_submit);
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     */
    get component_html() {
        return FORM_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     */
    get component_css() {
        return `
            :host {
                display: block;
            }
        `;
    }
}

