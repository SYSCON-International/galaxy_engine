/**
 * @file GalaxyDatetimePicker.js
 * @framework GalaxyEngine
 * @version 0.0.0
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
 *     A combined date and time picker component.
 * @extends GalaxyDatetimePickerBase
 */
export class GalaxyDatetimePicker extends GalaxyDatetimePickerBase {
    /**
     * @constructor
     */
    constructor() {
        super("datetime");
    }
}

