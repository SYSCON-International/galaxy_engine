/**
 * @file GalaxySelect.js
 * @framework GalaxyEngine
 * @version 0.0.0
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
 *     A single select component with searchy
 * @extends GalaxySelectBase
 */
export class GalaxySelect extends GalaxySelectBase {
    /**
     * @constructor
     */
    constructor() {
        super();

        this.type = this.SELECT_TYPES.SELECT;
    }

    /**
     * Gets the anchor dropdown state of the select.
     * @return {boolean}
     */
    get anchor_dropdown() { return this.hasAttribute("anchor-dropdown"); }

    /**
     * Sets the anchor dropdown state of the select.
     * @param {boolean} value - The anchor dropdown state of the select.
     */
    set anchor_dropdown(value) {
        if (value) {
            this.setAttribute("anchor-dropdown", "");
        }
        else {
            this.removeAttribute("anchor-dropdown");
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get post_observed_attributes() {
        return ["anchor-dropdown"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_attribute_changed_callback}
     * @override
     */
    post_attribute_changed_callback = async (name, old_value, new_value) => {
        let attribute_lookup_table = {
            "anchor-dropdown": this.handle_observed_anchor_dropdown
        };

        attribute_lookup_table[name]?.(new_value);
    }

    /**
     * Handles the `anchor-dropdown` attribute.
     * @param {string} value - The value of the `anchor-dropdown` attribute.
     */
    handle_observed_anchor_dropdown = (value) => {
        if (this.anchor_dropdown) {
            this.update_visible_rows();
            this.position_options();
        }
    }

    /**
     * {@link GalaxySelectBase#input_on_click}
     * @override
     */
    input_on_click = () => {
        let is_dropdown_anchored = this.hasAttribute("anchor-dropdown");

        this.open = !this.open;

        if (this.open && !is_dropdown_anchored) {
            if (this.search_enabled) {
                this.input_element.value = "";
            }
        }
        else {
            this.input_element.value = this.selected_options.length > 0 ? this.selected_options[0].text : "";

            this.search_clear_button.style.display = "none";
            this.select_down_arrow.style.display = null;


            if (!is_dropdown_anchored) {
                this.input_element.blur();
            }
        }
    }

    /**
     * {@link GalaxySelectBase#option_on_click}
     * @override
     */
    option_on_click = (option_element, option_icons_container_element, option_data) => {
        if (option_data.node_type === this.OPTION_NODE_TYPES.OPTION) {
            this.selected_options = [{
                text: option_data.text,
                value: option_data.value,
            }];

            this.value = JSON.stringify(this.selected_options.map((option => option.value)));

            if (!this.anchor_dropdown) {
                this.close_options();
            }
            else {
                // Reset the search box so the full list is browsable again, without wiping the value we
                // just set - search_clear_button.click() would also route through on_input, which sets
                // this.value from the (now-empty) input text and would immediately undo the line above.
                this.reset_search_display();
            }

            this.input_element.value = option_data.text;
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_component_css}
     * @override
     */
    get post_component_css() {
        return `
            :host([anchor-dropdown]) .col-12 > div {
                height: 210px; /* Shows 7 rows */
                display: block;
                position: relative;
                box-shadow: unset;
            }

            :host([open]) .col-12 {
                z-index: 5000;
                height: 210px;
                overflow: clip;

                > div {
                    display: block;
                    max-height: 210px; /* Shows 7 rows */
                }
            }
        `;
    }
}

