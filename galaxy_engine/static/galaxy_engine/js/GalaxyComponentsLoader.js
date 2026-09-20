/**
 * @file GalaxyComponentsLoader.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

// Import all components
import { GalaxyForm } from './components/GalaxyForm.js';
import { GalaxyTextInput } from './components/GalaxyTextInput.js';
import { GalaxyIntegerInput } from './components/GalaxyIntegerInput.js';
import { GalaxyFloatInput } from './components/GalaxyFloatInput.js';
import { GalaxySelect } from './components/GalaxySelect.js';
import { GalaxyMultiSelect } from './components/GalaxyMultiSelect.js';
import { GalaxyModal } from './components/GalaxyModal.js';
import { GalaxyButton } from './components/GalaxyButton.js';
import { GalaxyNavbar } from './components/GalaxyNavbar.js';
import { GalaxySidebar } from './components/GalaxySidebar.js';
import { GalaxyDatetimePicker } from './components/GalaxyDatetimePicker.js';
import { GalaxyDatePicker } from './components/GalaxyDatePicker.js';
import { GalaxyTimePicker } from './components/GalaxyTimePicker.js';
import { GalaxyDatetimeRangePickerBase } from './components/GalaxyDatetimeRangePickerBase.js';
import { GalaxyNotification } from './components/GalaxyNotification.js';
import { GalaxyMessage } from './components/GalaxyMessage.js';
import { GalaxyLoader } from './components/GalaxyLoader.js';
import { GalaxyDurationInput } from './components/GalaxyDurationInput.js';
import { GalaxyDurationDisplay } from './components/GalaxyDurationDisplay.js';

/**
 * @class
 * @description
 *     Registers all Galaxy custom elements. Centralizing registration here keeps
 *     component files side-effect-free and makes it easy to see which tags are active.
 */
export class GalaxyComponentsLoader {
    /**
     * @constructor
     */
    constructor() {
        customElements.define('galaxy-form', GalaxyForm);
        customElements.define('galaxy-text-input', GalaxyTextInput);
        customElements.define('galaxy-integer-input', GalaxyIntegerInput);
        customElements.define('galaxy-float-input', GalaxyFloatInput);
        customElements.define('galaxy-select', GalaxySelect);
        customElements.define('galaxy-multi-select', GalaxyMultiSelect);
        customElements.define('galaxy-modal', GalaxyModal);
        customElements.define('galaxy-button', GalaxyButton);
        customElements.define('galaxy-navbar', GalaxyNavbar);
        customElements.define('galaxy-sidebar', GalaxySidebar);
        customElements.define('galaxy-datetime-picker', GalaxyDatetimePicker);
        customElements.define('galaxy-date-picker', GalaxyDatePicker);
        customElements.define('galaxy-time-picker', GalaxyTimePicker);
        customElements.define('galaxy-datetime-range', GalaxyDatetimeRangePickerBase);
        customElements.define('galaxy-notification', GalaxyNotification);
        customElements.define('galaxy-message', GalaxyMessage);
        customElements.define('galaxy-loader', GalaxyLoader);
        customElements.define('galaxy-duration-input', GalaxyDurationInput);
        customElements.define('galaxy-duration-display', GalaxyDurationDisplay);
    }
}