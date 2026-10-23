/**
 * @file GalaxyForm.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {GalaxyUtils} from "../GalaxyUtils.js";

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
        await this.initialize_galaxy_components(this.get_galaxy_components(this.form_element));

        // From here on, a Galaxy child connected to this form initializes itself - see GalaxyHTMLComponentBase#connectedCallback.
        this.has_initialized_children = true;
    }

    /**
     * Gets the Galaxy components that belong to this form, within (and including) the given element. A Galaxy component is any upgraded element extending
     * {@link GalaxyHTMLComponentBase}, so a new component needs no registration here. A component inside a nested `<galaxy-form>` belongs to that form instead and is skipped;
     * the nested form itself is included, and initializing it initializes its own children.
     * @param {Element} root_element - The element to search, itself included.
     * @return {GalaxyHTMLComponentBase[]} - The Galaxy components, in document order.
     */
    get_galaxy_components = (root_element) => {
        let candidate_elements = [root_element, ...root_element.querySelectorAll("*")];

        return candidate_elements.filter((element) => {
            let is_galaxy_component = element instanceof GalaxyHTMLComponentBase && element !== this;
            // Inside this form's shadow root, closest() stops at the shadow boundary, so a null result means no nested form sits between the element and this form.
            let belongs_to_this_form = element.parentElement === null || element.parentElement.closest("galaxy-form") === null;

            return is_galaxy_component && belongs_to_this_form;
        });
    }

    /**
     * Runs the create lifecycle for each given Galaxy component that has not already run it, and records this form as each one's `parent_form`. Components initialize in order,
     * and one that throws is logged and skipped, so it cannot leave its siblings uninitialized. Used both by initialize() and by add_field().
     * @param {GalaxyHTMLComponentBase[]} galaxy_components - The Galaxy components to initialize.
     * @return {Promise<void>}
     */
    initialize_galaxy_components = async (galaxy_components) => {
        for (let galaxy_component of galaxy_components) {
            // A component created outside the form (e.g. with document.createElement, then add_field()) found no form when it was constructed.
            galaxy_component.parent_form = this;

            try {
                await galaxy_component.initialize_component();
            }
            catch (error) {
                console.error(`${this.constructor.name}: A ${galaxy_component.tagName.toLowerCase()} child failed to initialize.`, error);
            }
        }
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

        // The append above has usually started each component's own initialization already; initialize_component() joins it rather than running the lifecycle twice.
        await this.initialize_galaxy_components(this.get_galaxy_components(element));
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
     * Gets whether a valid form submits natively, posting to its `action` as a plain form does, instead of only dispatching its own `submit` event.
     * @return {boolean} - True when the native-submit attribute is set.
     */
    get native_submit() {return this.hasAttribute("native-submit");}

    /**
     * Sets whether a valid form submits natively.
     * @param {boolean} value - Whether it submits natively.
     */
    set native_submit(value) {
        this.toggleAttribute("native-submit", Boolean(value));
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
     * Handles the form submission event. An invalid form is cancelled. A valid one dispatches its own `submit` event, which a script may cancel; without
     * {@link native_submit} the native submission is then always cancelled, and with it the native submission goes ahead unless that `submit` was cancelled.
     * @param {Event} event - The form submission event.
     */
    on_form_submit = (event) => {
        let is_valid;

        // The native submission is only cancelled once validation is known, so a validation error must cancel it too, or an unvalidated form would post.
        try {
            is_valid = this.validate();
        }
        catch (error) {
            event.preventDefault();
            throw error;
        }

        if (!is_valid) {
            event.preventDefault();
            return;
        }

        let was_submit_allowed = this.dispatchEvent(new CustomEvent('submit', {bubbles: true, composed: true, cancelable: true}));

        if (!this.native_submit || !was_submit_allowed) {
            event.preventDefault();
        }
    }

    /**
     * Validates the form and all of its galaxy children. Will also scroll to the first invalid galaxy child.
     * @param {boolean} scroll_to_first_invalid - Whether to scroll to the first invalid galaxy child.
     * @return {boolean} - A boolean indicating whether the form is valid.
     */
    validate = (scroll_to_first_invalid = true) => {
        let galaxy_children_are_valid = true;
        let first_invalid_galaxy_component = null;

        let galaxy_components = this.get_galaxy_components(this.form_element);

        for (let galaxy_component of galaxy_components) {
            if (typeof galaxy_component.validate === 'function' && !galaxy_component.validate()) {
                galaxy_children_are_valid = false;
                first_invalid_galaxy_component ??= galaxy_component;
            }
        }

        // check validity and galaxy children validity and scroll to the first invalid element
        if (!this.form_element.checkValidity() || !galaxy_children_are_valid) {
            if (scroll_to_first_invalid) {
                let first_invalid_element = this.get_first_in_document_order(first_invalid_galaxy_component, this.form_element.querySelector(':invalid'));

                if (first_invalid_element) {
                    this.reveal_element(first_invalid_element);
                    first_invalid_element.scrollIntoView({behavior: 'smooth'});

                    // A field made of several fields (a galaxy-editable-table) moves focus to its own first invalid part.
                    first_invalid_element.focus_first_invalid?.();
                }
            }

            return false;
        }

        return true;
    }

    /**
     * Gets whichever of two elements comes first in the document - here, the first invalid Galaxy field (known from its own validate()) and the first native element
     * matching :invalid, so the form scrolls to the true first problem whichever kind it is.
     * @param {Element|null} first_element - An element, or null.
     * @param {Element|null} second_element - Another element, or null.
     * @return {Element|null} - The earlier of the two, the only one given, or null.
     */
    get_first_in_document_order = (first_element, second_element) => {
        if (!first_element || !second_element) {
            return first_element || second_element;
        }

        let is_second_after_first = Boolean(first_element.compareDocumentPosition(second_element) & Node.DOCUMENT_POSITION_FOLLOWING);

        return is_second_after_first ? first_element : second_element;
    }

    /**
     * Makes an element visible by calling `reveal()` on every ancestor that has one, through shadow roots - e.g. opening the galaxy-collapse panels around an invalid
     * field, which could not otherwise be seen or scrolled to.
     * @param {Element} element - The element to reveal.
     */
    reveal_element = (element) => {
        for (let ancestor of GalaxyUtils.get_ancestors_through_shadow_roots(element)) {
            if (typeof ancestor.reveal === "function") {
                ancestor.reveal();
            }
        }
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
        // On a reconnect the internal <form> and its children are still in the shadow root, and the children initialize themselves as they reconnect. Building and initializing
        // again would append a second, empty <form> while the fields stayed in the first.
        if (!this.form_element) {
            this.form_element = await this.get_template();

            this.shadow.appendChild(this.form_element);

            await this.initialize();
        }

        this.form_element.addEventListener('submit', this.on_form_submit);

        // Anything appended straight into this element after its children were collected would sit in the light DOM, unrendered and outside the real <form>.
        this.light_dom_child_observer ??= new MutationObserver(this.adopt_appended_children);
        this.light_dom_child_observer.observe(this, {childList: true});

        // The fields moved into this shadow root are out of reach of a document query, so plain data-property elements among them would never update.
        window.galaxy_state_manager?.add_root?.(this.shadow);
    }

    /**
     * Moves children appended straight into this element - with appendChild() rather than {@link add_field} - into the internal <form>, as add_field would, so they
     * render, are submitted, and are validated.
     * @param {MutationRecord[]} mutation_records - The child-list changes.
     */
    adopt_appended_children = async (mutation_records) => {
        for (let mutation_record of mutation_records) {
            for (let added_node of mutation_record.addedNodes) {
                // Already moved, or removed again, since the change was recorded.
                if (added_node.parentNode !== this) {
                    continue;
                }

                if (added_node.nodeType === Node.ELEMENT_NODE) {
                    await this.add_field(added_node);
                }
                else {
                    this.form_element.appendChild(added_node);
                }
            }
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.form_element.removeEventListener('submit', this.on_form_submit);
        this.light_dom_child_observer?.disconnect();

        window.galaxy_state_manager?.remove_root?.(this.shadow);
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

