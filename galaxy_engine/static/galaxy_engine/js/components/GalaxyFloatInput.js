/**
 * @file GalaxyFloatInput.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyNumberInputBase} from "./GalaxyNumberInputBase.js";

const COMPONENT_TEMPLATE_HTML = `
    <input type="number" class="form-control" />
`;

/**
 * @class
 * @description
 *     A float input component with decimal support and validation
 * @extends GalaxyNumberInputBase
 */
export class GalaxyFloatInput extends GalaxyNumberInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(COMPONENT_TEMPLATE_HTML);

        this.type = "float";
    }
}

