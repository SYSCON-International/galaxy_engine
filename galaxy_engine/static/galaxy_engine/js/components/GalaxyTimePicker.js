/**
 * @file GalaxyTimePicker.js
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
 *     A time-only picker component.
 * @extends GalaxyDatetimePickerBase
 */
export class GalaxyTimePicker extends GalaxyDatetimePickerBase {
    /**
     * @constructor
     */
    constructor() {
        super("time");
    }
}

