/**
 * @file GalaxyTextInput.js
 * @framework GalaxyEngine
 * @author
 *  Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *  (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyInputBase } from './GalaxyInputBase.js';

const COMPONENT_TEMPLATE_HTML = `
    <input type="text" class="form-control" />
`;

/**
 * @class
 * @description
 *     A text input component.
 * @extends GalaxyInputBase
 */
export class GalaxyTextInput extends GalaxyInputBase {
    /**
     * @constructor
     * @param {string} component_template_html - The field's HTML template. Defaults to a text input; a subclass (e.g. GalaxyPasswordInput) passes its own.
     */
    constructor(component_template_html = COMPONENT_TEMPLATE_HTML) {
        super(component_template_html);

        this.type = "text";
    }
}

