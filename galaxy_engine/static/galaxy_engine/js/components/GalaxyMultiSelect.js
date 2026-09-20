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
            if (this.selected_options.some((option => option.value === option_data.value))) {
                this.selected_options = this.selected_options.filter((option) => option.value !== option_data.value);
            }
            else {
                this.selected_options.push({
                    text: option_data.text,
                    value: option_data.value,
                });
            }

            this.value = JSON.stringify(this.selected_options.map((option => option.value)));

            if (option_element.hasAttribute("selected")) {
                option_element.removeAttribute("selected");
                option_icons_container_element.removeAttribute("selected");
            }
            else {
                option_element.setAttribute("selected", "");
                option_icons_container_element.setAttribute("selected", "");
            }
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

