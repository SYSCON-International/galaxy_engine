/**
 * @file GalaxyDatePicker.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyDatetimePickerBase} from "./GalaxyDatetimePickerBase.js";

/**
 * @class
 * @description
 *     A date-only picker component.
 * @extends GalaxyDatetimePickerBase
 */
export class GalaxyDatePicker extends GalaxyDatetimePickerBase {
    /**
     * @constructor
     */
    constructor() {
        super("date");
    }
}

