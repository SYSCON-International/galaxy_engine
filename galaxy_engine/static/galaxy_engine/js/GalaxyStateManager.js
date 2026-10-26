/**
 * @file GalaxyStateManager.js
 * @framework GalaxyEngine
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

const ALL_PROPERTIES = "*";

/**
 * @class GalaxyStateManager
 * @description
 *      Manages two-way binding for application state. Three kinds of thing are kept in step with a property:
 *      - Galaxy inputs with a `property-name`, which register themselves through {@link bind}; a change from anywhere else is applied to them through their own
 *        `apply_state_value()`, so each input sets its value in its own type (a checkbox's boolean, a select's array).
 *      - Plain elements with a `data-property` attribute, found by query in the document and any root added with {@link add_root}: a native checkbox or radio gets
 *        `.checked`, another native field `.value`, anything else `.textContent`.
 *      - Callbacks registered with {@link subscribe}.
 * @example
 *      window.galaxy_state_manager.data.count = 5; // updates every input, element, and subscriber bound to "count"
 */
export class GalaxyStateManager {
    /**
     * @constructor
     * @param   {object}    initial_data    The initial state object. Defaults to an empty object.
     */
    constructor(initial_data = {}) {
        this.raw_data = initial_data;
        this.bound_components_by_property = new Map();
        this.subscribers_by_property = new Map();
        this.extra_roots = new Set();
        this.properties_being_applied = new Set();

        this.data = this.create_proxy(this.raw_data);
    }

    /**
     * Creates a Proxy around the given object, routing every write through {@link set} and every `delete` through {@link delete_property}, so that
     * `data.property = value` and `delete data.property` from any script update everything bound to it.
     *
     * @param   {object}   object  The raw state object.
     * @returns {Proxy}            The proxied state object.
     */
    create_proxy = (object) => {
        const self = this;

        return new Proxy(object, {
            get(target, property) {
                return target[property];
            },

            set(target, property, value) {
                self.set(property, value);

                return true;
            },

            deleteProperty(target, property) {
                self.delete_property(property);

                return true;
            }
        });
    }

    /**
     * Writes a property and, if its value changed, updates every bound component except `source`, every bound plain element, and every subscriber. Writing back the
     * same array or plain object a property already holds counts as a change: it is how a script announces that it changed that value in place
     * (`data.items.push(item); data.items = data.items;`), since the content can no longer be compared with what it was. A different but equal array is not a change.
     * @param   {string}    property    The property name.
     * @param   {*}         value       The new value.
     * @param   {HTMLElement|null} source - The bound component the change came from, which is not written back to (so an input being typed in keeps its caret), or null.
     */
    set = (property, value, source = null) => {
        // A component re-reporting a value while this property is being applied to it is an echo of this same change, not a new one.
        if (source !== null && this.properties_being_applied.has(property)) {
            return;
        }

        let old_value = this.raw_data[property];
        let is_same_structured_value = old_value === value && this.is_structured(value);
        let has_changed = is_same_structured_value || !this.values_are_equal(old_value, value) || !Object.prototype.hasOwnProperty.call(this.raw_data, property);

        this.raw_data[property] = value;

        if (has_changed) {
            this.apply_to_bound_components(property, value, source);
            this.trigger_dom_update(property, value);
            this.notify_subscribers(property, value, old_value);
        }
    }

    /**
     * Removes a property and, if it existed, clears everything bound to it: bound components and plain elements are given null (shown empty), and subscribers are
     * called with `undefined` as the value, since the property is gone. Deleting a property that does not exist does nothing.
     * @param   {string}    property    The property name.
     */
    delete_property = (property) => {
        if (!this.has_property(property)) {
            return;
        }

        let old_value = this.raw_data[property];

        delete this.raw_data[property];

        this.apply_to_bound_components(property, null);
        this.trigger_dom_update(property, null);
        this.notify_subscribers(property, undefined, old_value);
    }

    /**
     * Compares two state values: arrays and plain objects by content, so a select that reports an equal but freshly built array is not a change; anything else by identity.
     * @param   {*}     first_value     The first value.
     * @param   {*}     second_value    The second value.
     * @return  {boolean}               True when the values are equal.
     */
    values_are_equal = (first_value, second_value) => {
        if (first_value === second_value) {
            return true;
        }

        let both_are_structured = this.is_structured(first_value) && this.is_structured(second_value);

        if (both_are_structured) {
            return JSON.stringify(first_value) === JSON.stringify(second_value);
        }

        return false;
    }

    /**
     * Whether a value is an array or a plain object.
     * @param   {*}     value   The value.
     * @return  {boolean}       True for an array or a plain object.
     */
    is_structured = (value) => {
        return Array.isArray(value) || (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype);
    }

    /**
     * Registers a Galaxy input as bound to a property. Called by GalaxyInputBase when an input with a `property-name` is created.
     * @param   {string}        property    The property name.
     * @param   {HTMLElement}   component   The component, which must define `apply_state_value(value)`.
     */
    bind = (property, component) => {
        if (!this.bound_components_by_property.has(property)) {
            this.bound_components_by_property.set(property, new Set());
        }

        this.bound_components_by_property.get(property).add(component);
    }

    /**
     * Unregisters a Galaxy input from a property. Called by GalaxyInputBase when the input is destroyed.
     * @param   {string}        property    The property name.
     * @param   {HTMLElement}   component   The component.
     */
    unbind = (property, component) => {
        let bound_components = this.bound_components_by_property.get(property);

        if (!bound_components) {
            return;
        }

        bound_components.delete(component);

        if (bound_components.size === 0) {
            this.bound_components_by_property.delete(property);
        }
    }

    /**
     * Applies a property's value to every component bound to it except `source`. A component that throws is reported and skipped, so the components bound after it
     * are still updated.
     * @param   {string}    property    The property name.
     * @param   {*}         value       The value.
     * @param   {HTMLElement|null} source - The component not to write back to.
     */
    apply_to_bound_components = (property, value, source = null) => {
        let bound_components = this.bound_components_by_property.get(property);

        if (!bound_components) {
            return;
        }

        this.properties_being_applied.add(property);

        try {
            for (let component of bound_components) {
                if (component === source) {
                    continue;
                }

                try {
                    component.apply_state_value(value);
                }
                catch (error) {
                    console.error(`GalaxyStateManager: A component bound to "${property}" could not take its value.`, error);
                }
            }
        }
        finally {
            this.properties_being_applied.delete(property);
        }
    }

    /**
     * Adds a root, besides the document, to search for plain `data-property` elements - for a component that moves light-DOM content into its own shadow root
     * (GalaxyForm), where a document query cannot find it.
     * @param   {ShadowRoot|Element}    root    The root to search.
     */
    add_root = (root) => {
        this.extra_roots.add(root);
    }

    /**
     * Removes a root added with {@link add_root}.
     * @param   {ShadowRoot|Element}    root    The root.
     */
    remove_root = (root) => {
        this.extra_roots.delete(root);
    }

    /**
     * Updates every plain element bound to a property with `data-property`.
     *
     * @param   {string}    property    The property name that changed.
     * @param   {*}         value       The new value.
     */
    trigger_dom_update = (property, value) => {
        let selector = `[data-property="${this.escape_attribute_value(property)}"]`;

        for (let root of [document, ...this.extra_roots]) {
            for (let element of root.querySelectorAll(selector)) {
                this.apply_to_plain_element(element, value);
            }
        }
    }

    /**
     * Escapes a value for use inside a double-quoted attribute selector.
     * @param   {string}    value   The value.
     * @return  {string}            The escaped value.
     */
    escape_attribute_value = (value) => {
        return String(value).replace(/["\\]/g, "\\$&");
    }

    /**
     * Writes a value to one plain element: `.checked` for a native checkbox or radio, `.value` for another native field (dispatching `change` so its own listeners react),
     * and `.textContent` for anything else. `null` and `undefined` are written as empty.
     * @param   {HTMLElement}   element     The element.
     * @param   {*}             value       The value.
     */
    apply_to_plain_element = (element, value) => {
        // A Galaxy input binds through property-name instead; one carrying data-property has already warned about it.
        if (element.constructor?.is_galaxy_input_wrapper) {
            return;
        }

        let value_string = value === null || value === undefined ? "" : String(value);
        let is_checkable = element.tagName === "INPUT" && (element.type === "checkbox" || element.type === "radio");
        let is_native_field = element.tagName === "INPUT" || element.tagName === "SELECT" || element.tagName === "TEXTAREA";

        if (is_checkable) {
            element.checked = Boolean(value);
            element.dispatchEvent(new Event("change"));
        }
        else if (is_native_field) {
            element.value = value_string;
            element.dispatchEvent(new Event("change"));
        }
        else {
            element.textContent = value_string;
        }
    }

    /**
     * Calls a callback whenever a property changes.
     * @param   {string}    property    The property name, or "*" for every property.
     * @param   {function(string, *, *): void} callback - Called with `(property, value, old_value)`.
     * @return  {function(): void}      Unsubscribes the callback.
     */
    subscribe = (property, callback) => {
        if (!this.subscribers_by_property.has(property)) {
            this.subscribers_by_property.set(property, new Set());
        }

        this.subscribers_by_property.get(property).add(callback);

        return () => {
            this.subscribers_by_property.get(property)?.delete(callback);
        };
    }

    /**
     * Calls the subscribers to a property and to "*". A subscriber that throws is logged and skipped, so it cannot stop the others.
     * @param   {string}    property    The property name.
     * @param   {*}         value       The new value.
     * @param   {*}         old_value   The previous value.
     */
    notify_subscribers = (property, value, old_value) => {
        let callbacks = [...(this.subscribers_by_property.get(property) || []), ...(this.subscribers_by_property.get(ALL_PROPERTIES) || [])];

        for (let callback of callbacks) {
            try {
                callback(property, value, old_value);
            }
            catch (error) {
                console.error(`GalaxyStateManager: A subscriber to "${property}" threw.`, error);
            }
        }
    }

    /**
     * Whether a property exists in the state.
     * @param   {string}    property    The property name.
     * @return  {boolean}               True when the property exists.
     */
    has_property = (property) => {
        return Object.prototype.hasOwnProperty.call(this.raw_data, property);
    }

    /**
     * Adds a new property to the state object.
     *
     * @param   {string}    property  The property name.
     * @param   {*}         value     The property value. Defaults to null.
     */
    add_property = (property, value) => {
        this.data[property] = value !== undefined ? value : null;
    }

    /**
     * Removes a property from the state object, clearing everything bound to it (see {@link delete_property}).
     *
     * @param   {string}    property    The property name.
     */
    remove_property = (property) => {
        delete this.data[property];
    }

    /**
     * Updates a property value.
     *
     * @param   {string}                        property    The property name.
     * @param   {Object|string|number|null}     value       The new property value.
     */
    update_property = (property, value) => {
        if (!this.has_property(property)) {
            console.error(`Property "${property}" does not exist in the state object.`);

            return;
        }

        if (value === undefined) {
            console.error(`New value for property "${property}" cannot be undefined.`);

            return;
        }

        this.data[property] = value;
    }

    /**
     * Re-applies every current state value to everything bound to it.
     */
    update_all_bound_elements = () => {
        for (let property of Object.keys(this.raw_data)) {
            this.apply_to_bound_components(property, this.raw_data[property]);
            this.trigger_dom_update(property, this.raw_data[property]);
        }
    }
}
