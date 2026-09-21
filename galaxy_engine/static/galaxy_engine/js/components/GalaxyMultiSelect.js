/**
 * @file GalaxyMultiSelect.js
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
 *     A multi select component with searchy
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
     * {@link GalaxySelectBase#option_on_click}
     * @override
     */
    option_on_click = (option_element, option_icons_container_element, option_data) => {
        if (option_data.node_type === this.OPTION_NODE_TYPES.OPTION) {
            let is_now_selected;

            if (this.selected_options.some((option => option.value === option_data.value))) {
                this.selected_options = this.selected_options.filter((option) => option.value !== option_data.value);
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
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_component_css}
     * @override
     */
    get post_component_css() {
        return `
            :host(:not([search-enabled])) .input-container > div {
                display: none;
            }

            .col-12 > div {
                height: 210px; /* Shows 7 rows */
                display: block;
                position: relative;
                box-shadow: unset;
            }
        `;
    }
}

