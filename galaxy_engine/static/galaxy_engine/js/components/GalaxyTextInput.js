/**
 * @file GalaxyTextInput.js
 * @framework GalaxyEngine
 * @version 0.0.0
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
     */
    constructor() {
        super(COMPONENT_TEMPLATE_HTML);

        this.type = "text";
    }
}

