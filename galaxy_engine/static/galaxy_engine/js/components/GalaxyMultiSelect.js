/**
 * @file GalaxyMultiSelect.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxySelectBase } from './GalaxySelectBase.js';

/**
 * @class
 * @description
 *     A multi-select component with search. Its options show in the page, or, with `dropdown`, in a floating dropdown opened from the field.
 * @extends GalaxySelectBase
 */
export class GalaxyMultiSelect extends GalaxySelectBase {
    /**
     * @constructor
     */
    constructor() {
        super();

        this.type = this.SELECT_TYPES.MULTI_SELECT;
    }

    /**
     * Gets the dropdown state of the multi-select.
     * @return {boolean} - True when the options open in a dropdown from the field instead of always showing in the page.
     */
    get dropdown() { return this.hasAttribute("dropdown"); }

    /**
     * Sets the dropdown state of the multi-select.
     * @param {boolean} value - The dropdown state of the multi-select.
     */
    set dropdown(value) {
        if (value) {
            this.setAttribute("dropdown", "");
        }
        else {
            this.removeAttribute("dropdown");
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get post_observed_attributes() {
        return ["dropdown"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_attribute_changed_callback}
     * @override
     */
    post_attribute_changed_callback = async (name, old_value, new_value) => {
        let attribute_lookup_table = {
            "dropdown": this.handle_observed_dropdown
        };

        attribute_lookup_table[name]?.(new_value);
    }

    /**
     * Handles the `dropdown` attribute: switches the options between an always-shown list and a floating dropdown.
     * @param {string} value - The value of the `dropdown` attribute.
     */
    handle_observed_dropdown = (value) => {
        // Reacted to before on_create when the attribute is in markup; on_create sets the mode itself.
        if (!this.scroll_container) {
            return;
        }

        if (this.open) {
            this.open = false;
        }

        this.update_dropdown_popover_mode();
        this.update_dropdown_aria();
        this.scroll_container.style.height = "";
        this.scroll_container.style.maxHeight = "";
        this.handle_observed_options_size(this.getAttribute("options-size"));
        this.input_element.value = this.dropdown ? this.get_display_text() : "";
        this.render_options();
    }

    /**
     * {@link GalaxySelectBase#input_on_click}
     * @override
     */
    input_on_click = () => {
        if (!this.dropdown) {
            return;
        }

        this.open = !this.open;

        // Opening clears the field so it can be searched; closing restores the display text (see close_options).
        if (this.open && this.search_enabled) {
            this.input_element.value = "";
        }
    }

    /**
     * {@link GalaxySelectBase#option_on_click}
     * @override
     */
    option_on_click = (option_element, option_icons_container_element, option_data) => {
        if (option_data.node_type === this.OPTION_NODE_TYPES.OPTION) {
            let previous_value = this.value;
            let is_now_selected;

            if (this.selected_options.some((option => this.is_same_value(option.value, option_data.value)))) {
                this.selected_options = this.selected_options.filter((option) => !this.is_same_value(option.value, option_data.value));
                is_now_selected = false;
            }
            else {
                this.selected_options.push({
                    text: option_data.text,
                    value: option_data.value,
                });
                is_now_selected = true;
            }

            // Setting .value triggers GalaxySelectBase's value resync, which re-renders every visible row
            // (including this one) from the freshly recomputed selected_options - so option_element already
            // reflects is_now_selected by the time this call returns. Applying is_now_selected directly
            // (rather than toggling off of the DOM's current state, read after that re-render already ran)
            // avoids reading stale state and undoing what the resync just set.
            this.value = JSON.stringify(this.selected_options.map((option => option.value)));

            option_element?.toggleAttribute("selected", is_now_selected);
            option_icons_container_element?.toggleAttribute("selected", is_now_selected);

            this.dispatch_change_if_value_changed(previous_value);
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_component_css}
     * @override
     */
    get post_component_css() {
        return `
            /* Inline: the field is only a search box, and the list always shows in the page */
            :host(:not([search-enabled]):not([dropdown])) .input-container > div {
                display: none;
            }

            :host(:not([dropdown])) .input-container > div > div {
                display: none;
            }

            :host(:not([dropdown])) .col-12 > div {
                height: 210px; /* Shows 7 rows */
                display: block;
                position: relative;
                box-shadow: unset;
            }

            /* Dropdown: the closed field shows the selected options' texts, cut off with an ellipsis when they do not fit */
            :host([dropdown]) .input-container > div > input {
                text-overflow: ellipsis;
            }
        `;
    }
}

