/**
 * @file GalaxyStateManager.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

/**
 * @class GalaxyStateManager
 * @description
 *      Manages proxy-based two-way binding for application state.
 * @example
 *      const state_manager = new State({ count: 0 });
 *
 *      state_manager.data.count = 5; // triggers DOM updates for bound elements
 */
export class GalaxyStateManager {
    /**
     * @constructor
     * @param   {object}    initial_data    The initial state object. Defaults to an empty object.
     */
    constructor(initial_data = {}) {
        this.data = this.create_proxy(initial_data);
    }

    /**
     * Creates a Proxy around the given object.
     *
     * @param   {object}   object  The raw state object.
     * @returns {Proxy}            The proxied state object.
     */
    create_proxy = (object) => {
        const self = this;

        return new Proxy(object, {
            get(target, property) {
                return target[property]
            },

            set(target, property, value) {
                const old_value = target[property]

                // Update the value
                target[property] = value

                // Trigger DOM updates or watchers if the value actually changed
                if (old_value !== value) {
                    self.trigger_dom_update(property, value);
                }

                let state_manager_debug = document.querySelector("#state_manager_debug_output");

                if (state_manager_debug) {
                    state_manager_debug.innerHTML = '';

                    for (let [key, value] of Object.entries(self.data)) {
                        state_manager_debug.innerHTML += `${key}: ${value || "Empty"}<br />`;
                    }
                }

                return true
            }
        })
    }

    /**
     * Called whenever a property changes.
     * Updates any DOM elements bound to this property.
     *
     * @param   {string}    property    The property name that changed.
     * @param   {*}         value       The new value.
     */
    trigger_dom_update = (property, value) => {
        const bound_elements = document.querySelectorAll(`[data-property="${property}"]`);

        for (let element of bound_elements) {
            // Skip Galaxy input wrappers — they forward data-property to their inner element
            if (element.constructor?.is_galaxy_input_wrapper) {
                continue;
            }

            if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                element.value = value

                // Trigger a change event so that any bound elements can update
                element.dispatchEvent(new Event('change'));
            }
            else {
                element.textContent = value
            }
        }
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
     * Removes a property from the state object.
     *
     * @param   {string}    property    The property name.
     */
    remove_property = (property) => {
        delete this.data[property]
    }

    /**
     * Updates a property value.
     *
     * @param   {string}                        property    The property name.
     * @param   {Object|string|number|null}     value       The new property value.
     */
    update_property = (property, value) => {
        if (!this.data.hasOwnProperty(property)) {
            console.error(`Property "${property}" does not exist in the state object.`)

            return;
        }

        if (value === undefined) {
            console.error(`New value for property "${property}" cannot be undefined.`)

            return;
        }

        this.data[property] = value
    }

    /**
     * Updates all bound elements with the current state values
     */
    update_all_bound_elements = () => {
        for (let property in this.data) {
            this.trigger_dom_update(property, this.data[property])
        }
    }
}