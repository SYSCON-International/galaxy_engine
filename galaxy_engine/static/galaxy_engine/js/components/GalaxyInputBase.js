/**
 * @file GalaxyInputBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyHTMLComponentBase } from "./GalaxyHTMLComponentBase.js";

const BASE_INPUT_HTML_TEMPLATE = `
    <div>
        <div>
            <label></label>
        </div>
        <div></div>
    </div>
`;

/**
 * @class
 * @description
 *     A parent class for all input types including select, input (text, number, float, etc..), and textarea.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyInputBase extends GalaxyHTMLComponentBase {
    static formAssociated = true;
    static is_galaxy_input_wrapper = true;

    /**
     * @constructor
     * @param {string} input_html_template - The HTML template for the input element.
     */
    constructor(input_html_template) {
        super(BASE_INPUT_HTML_TEMPLATE);

        this.input_html_template = input_html_template;

        this._value = "";
        this._internals = this.attachInternals();

        this.property_name = "";
        this.type = "text";
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_observed_attributes}
     * @override
     */
    static get pre_observed_attributes() {
        return [
            "disabled",
            "label",
            "name",
            "readonly",
            "required",
            "value"
        ];
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_attribute_changed_callback}
     * @override
     */
    pre_attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.input_element) {
            return;
        }

        const attribute_lookup_table = {
            "disabled": this.handle_observed_disabled,
            "label": this.handle_observed_label,
            "name": this.handle_observed_name,
            "readonly": this.handle_observed_readonly,
            "required": this.handle_observed_required,
            "value": this.handle_observed_value
        }

        attribute_lookup_table[name]?.(new_value);
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_on_create}
     * @override
     */
    pre_on_create = async () => {
        // Setting this in the constructor would set the tabindex attribute synchronously during construction, which
        // violates the custom element constructor invariant (no attributes may be gained) and breaks document.createElement().
        this.tabIndex = 0;

        let base_input_template = await this.get_template();
        let input_element_container = base_input_template.querySelector("div > div:last-child");

        // Stored so subclasses can append additional shadow-rendered markup (e.g. a select's options dropdown) as a sibling of the label/input rows.
        this.input_wrapper_element = base_input_template;

        this.label_element = base_input_template.querySelector("label");
        this.input_element = await this.get_template(this.input_html_template);

        input_element_container.appendChild(this.input_element);

        this.property_name = this.getAttribute("property-name") || null;

        // Check if a data-property attribute has been set on the Galaxy element
        if (this.hasAttribute("data-property")) {
            this.input_element.dataset.property = this.getAttribute("data-property");
        }

        // Check if a value has been set on the custom element and set it on the input element.
        if (this.hasAttribute("value")) {
            this.value = this.getAttribute("value");
        }

        // Check if a placeholder has been set on the custom element and set it on the input element.
        if (this.hasAttribute("placeholder")) {
            this.input_element.placeholder = this.getAttribute("placeholder");
        }

        // Check if a name has been set on the custom element
        if (this.hasAttribute("label")) {
            this.label = this.getAttribute("label");
        }
        else {
            this.hide_label();
        }

        if (this.property_name) {
            // does it exist in the state_manager?
            if (!window.galaxy_state_manager.data.hasOwnProperty(this.property_name)) {
                window.galaxy_state_manager.data[this.property_name] = this.input_element.value;
            }

            // TODO: Do we need to set the value here if it's already set in the state_manager?
            // this.input_element.value = window.galaxy_state_manager.data[this.property_name];
        }

        // Attach event listener for user input.
        this.input_element.addEventListener("input", this.on_input_event);
        this.input_element.addEventListener("change", this.on_input_event);

        if (this.input_element) {
            this.handle_observed_disabled(this.getAttribute("disabled"));
            this.handle_observed_readonly(this.getAttribute("readonly"));
            this.handle_observed_required(this.getAttribute("required"));
        }

        this.shadow.appendChild(base_input_template);

        // Check for errors on the input element.
        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_on_destroy}
     * @override
     */
    pre_on_destroy = async () => {
        // Remove the event listener to avoid memory leaks.
        if (this.input_element) {
            this.input_element.removeEventListener("input", this.on_input_event);
            this.input_element.removeEventListener("change", this.on_input_event);
        }
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the disabled attribute of the Galaxy input.
     * @return {boolean} - True if the input is disabled, false otherwise.
     */
    get disabled() { return this.hasAttribute("disabled"); }

    /**
     * Sets the disabled attribute of the Galaxy input.
     * @param {boolean} value - True to disable the input, false otherwise.
     */
    set disabled(value) {
        if (value) {
            this.setAttribute("disabled", "");
        }
        else {
            this.removeAttribute("disabled");
        }
    }

    /**
     * Gets the label attribute of the Galaxy input.
     * @return {string} - The label of the input element.
     */
    get label() { return this.getAttribute("label"); }

    /**
     * Sets the label attribute of the Galaxy input.
     * @param {string|number} value - The label of the input element.
     */
    set label(value) { this.setAttribute("label", value.toString()); }

    /**
     * Gets the name attribute of the Galaxy input.
     * @return {string} - The name of the input element.
     */
    get name() { return this.getAttribute("name"); }

    /**
     * Sets the name attribute of the Galaxy input.
     * @param {string} value - The name of the input element.
     */
    set name(value) { this.setAttribute("name", value.toString()); }

    /**
     * Gets the readonly attribute of the Galaxy input.
     * @return {boolean} - True if the input is readonly, false otherwise.
     */
    get readonly() { return this.hasAttribute("readonly"); }

    /**
     * Sets the readonly attribute of the Galaxy input.
     * @param {boolean} value - True to make the input readonly, false otherwise.
     */
    set readonly(value) {
        if (value) {
            this.setAttribute("readonly", "");
        }
        else {
            this.removeAttribute("readonly");
        }
    }

    /**
     * Gets the required attribute of the Galaxy input.
     * @return {boolean} - True if the input is required, false otherwise.
     */
    get required() { return this.hasAttribute("required"); }

    /**
     * Sets the required attribute of the Galaxy input.
     * @param {boolean} value - True to make the input required, false otherwise.
     */
    set required(value) {
        if (value) {
            this.setAttribute("required", "");
        }
        else {
            this.removeAttribute("required");
        }
    }

    /**
     * Gets the value of the input element.
     * @return {*}
     */
    get value() { return this._value; }

    /**
     * Sets the value of the input element.
     * @param value
     */
    set value(value) {
        this.setAttribute("value", value);
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * Handles the disabled attribute on the input element.
     * @param {string|null} new_value - The new value of the disabled attribute.
     */
    handle_observed_disabled = (new_value) => {
        if (!this.input_element) {
            return;
        }

        let is_disabled = typeof new_value === "string";

        if (is_disabled) {
            this.input_element.setAttribute("disabled", "");
        }
        else {
            this.input_element.removeAttribute("disabled");
        }
    }

    /**
     * Handles the label attribute on the input element.
     * @param {string} new_value - The new value of the label attribute.
     */
    handle_observed_label = (new_value) => {
        if (new_value) {
            this.label_element.textContent = new_value;
            this.show_label();
        }
        else {
            this.hide_label();
        }
    }

    /**
     * Handles the name attribute on the input element.
     */
    handle_observed_name = () => this.handle_observed_value(this.value);

    /**
     * Handles the readonly attribute on the input element.
     * @param {string} new_value - The new value of the readonly attribute.
     */
    handle_observed_readonly = (new_value) => {
        if (new_value) {
            this.input_element.setAttribute("readonly", "");
        }
        else {
            this.input_element.removeAttribute("readonly");
        }
    }

    /**
     * Handles the required attribute on the input element.
     * @param {string} new_value - The new value of the required attribute.
     */
    handle_observed_required = (new_value) => {
        if (new_value) {
            this.validate();
        }
    }

    /**
     * Handles the value attribute on the input element.
     * @param {string|number} new_value - The new value of the value attribute.
     */
    handle_observed_value = (new_value) => {
        let form_name = this.getAttribute("name");

        this.input_element.value = new_value;
        this._value = new_value;
        this._internals.setFormValue(new_value.toString(), form_name);

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /*******************************************************
     *                    Event Methods                    *
     *******************************************************/

    /**
     * Event handler for user typing.
     * 1) This will set the value of the galaxy element, the state_manager property if it exists, and the form value.
     * 2) It will also validate the input if it is required and instant validation is enabled on the parent Galaxy form.
     * 3) Additionally, it will call the on_input method for child classes to implement.
     * @param {Event} event - The event object.
    */
    on_input_event = (event) => {
        if (window.galaxy_state_manager && this.property_name) {
            window.galaxy_state_manager.data[this.property_name] = event.target.value;
        }

        this._internals.setFormValue(event.target.value);

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            // Check for errors on the input element.
            this.validate();
        }

        // Call the on_input for child classes to implement.
        this.on_input(event);
    }

    /**
      * Event handler for user changing the input.
      * 1) This will set the value of the galaxy element, the state_manager property if it exists, and the form value.
      * 2) It will also validate the input if it is required and instant validation is enabled on the parent Galaxy form.
      * 3) Additionally, it will call the on_change method for child classes to implement.
      * @param {Event} event - The event object.
     */
    on_change_event = (event) => {
        if (window.galaxy_state_manager && this.property_name) {
            window.galaxy_state_manager.data[this.property_name] = event.target.value;
        }

        this._internals.setFormValue(event.target.value);

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            // Check for errors on the input element.
            this.validate();
        }

        // Call the on_change for child classes to implement.
        this.on_change(event);
    }

    /*******************************************************
     *                    Other Methods                    *
     *******************************************************/

    /**
     * Shows the label element.
     */
    show_label = () => {
        this.label_element.style.display = "block";
    }

    /**
     * Hides the label element.
     */
    hide_label = () => {
        this.label_element.style.display = "none";
    }

    /**
     * Checks if there are any errors on the input element and will set the validity of the input element.
     */
    validate = () => {
        if (this.hasAttribute("required") && !this.hasAttribute("disabled")) {
            let error_messages = this.get_validation_errors(this.value);

            if (this.value === "") {
                error_messages.unshift("Please enter a value.");
            }

            if (error_messages.length > 0) {
                this._internals.setValidity({customError: true}, error_messages.join("\n"), this.input_element);

                return false;
            }
            else {
                this._internals.setValidity({});
            }

            return true;
        }
    }

    /*******************************************************
     *       Overridable methods for child classes.        *
     *******************************************************/

    /**
     * Checks if there are any errors on the input element and will return a list of error messages.
     *
     * @param {string|number} value
     * @return {string[]} - An array of error messages.
     */
    get_validation_errors = (value) => [];

    /**
     * Event handler for user typing. Called at the end of the {@link on_input_event} method.
     * @param {Event} event - The event object.
     * @override
     */
    on_input = (event) => {}

    /**
     * Event handler for user changing the input element. Called at the end of the {@link on_change_event} method.
     * @param {Event} event - The event object.
     * @override
     */
    on_change = (event) => {}

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     */
    get component_html() {
        return `
            <div class="galaxy-input-container">
                <div class="label-container">
                    <label></label>
                </div>
                <div class="input-container"></div>
            </div>
        `;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     */
    get pre_component_css() {
        return `
            :host {
                input {
                    display: block;
                    width: 100%;
                    padding: 0.375rem 0.75rem;
                    font-size: 1rem;
                    font-weight: 400;
                    line-height: 1.5;
                    color: var(--text-grey);
                    background-color: #fff;
                    background-clip: padding-box;
                    border: 1px solid var(--lightgrey);
                    border-radius: 0.25rem;
                    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
                }
                
                .galaxy-input-container {
                    display: -ms-flexbox;
                    display: flex;
                    -ms-flex-wrap: wrap;
                    flex-wrap: wrap;
                    margin-right: -15px;
                    margin-left: -15px;
            
                    .label-container, .input-container {
                        -ms-flex: 0 0 100%;
                        flex: 0 0 100%;
                        max-width: 100%;
                        position: relative;
                        width: 100%;
                        padding-right: 15px;
                        padding-left: 15px;
                    }
                }
                
                /* Handles the invalid state for the input and select elements */
                &:invalid {
                    input, select {
                        border-color: var(--red);
                        box-shadow: rgba(255, 0, 0, 0.25) 0px 0px 0px 0.2rem;
                    }
                }
                
                *, ::before, ::after {
                    box-sizing: border-box;
                }
            }
            
            /* Handles the disabled state for the input and select elements */
            :host([disabled]) {
                pointer-events: none;
                color: lightgrey;
                opacity: 1;
                cursor: default !important;
        
                input, select {
                    pointer-events: none;
                    color: lightgrey;
                    opacity: 1;
                    cursor: default !important;
                }
        
                label {
                    color: grey;
                    opacity: 1;
                }
            }
            
            /* Handles the readonly state for the input and select elements */
            :host([readonly]) {
                input, select {
                    pointer-events: none;
                    background-color: #e9ecef !important;
                    appearance: none;
                    padding-left: 1rem;
        
                    &:focus {
                        border: 0 !important;
                        box-shadow: none !important;
                    }
                }
            }
            
            /* Handles the required state for the input and select elements. Both horizontal and vertical layouts are supported */
            :host([required]:not([label-layout="horizontal"])) .galaxy-input-container .label-container label::after {
                color: #d00;
                content: "*";
                padding-left: 4px;
            }
        
            :host([required][label-layout=horizontal]) .galaxy-input-container .label-container label::after {
                color: #d00;
                content: "*";
                position: absolute;
                padding-left: 4px;
                top: 50%;
                transform: translateY(-50%);
            }
            
            /* Handles the horizontal label layout state for the input and select elements */
            :host([label-layout=horizontal]) {
                /* This will cause the the horizontal layout to center the label and input so it can be used in combination with elements that use the vertical layout */
                .galaxy-input-container {
                    height: 100%;
        
                    .label-container {
                        align-self: center;
                        -ms-flex: 0 0 var(--col-3);
                        flex: 0 0 var(--col-3);
                        max-width: var(--col-3);
                    }
    
                    .input-container {
                        align-self: center;
                        -ms-flex: 0 0 var(--col-9);
                        flex: 0 0 var(--col-9);
                        max-width: var(--col-9);
                    }
                }
        
                label {
                    position: absolute;
                    top: 50%;
                    right: 19px;
                    transform: translateY(-50%);
                }
            }
        
            :host([label-layout=horizontal][label-size="1"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-1);
                    flex: 0 0 var(--col-1);
                    max-width: var(--col-1);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-11);
                    flex: 0 0 var(--col-11);
                    max-width: var(--col-11);
                }
            }
    
            :host([label-layout=horizontal][label-size="2"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-2);
                    flex: 0 0 var(--col-2);
                    max-width: var(--col-2);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-10);
                    flex: 0 0 var(--col-10);
                    max-width: var(--col-10);
                }
            }
    
            :host([label-layout=horizontal][label-size="3"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-3);
                    flex: 0 0 var(--col-3);
                    max-width: var(--col-3);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-9);
                    flex: 0 0 var(--col-9);
                    max-width: var(--col-9);
                }
            }
    
            :host([label-layout=horizontal][label-size="4"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-4);
                    flex: 0 0 var(--col-4);
                    max-width: var(--col-4);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-8);
                    flex: 0 0 var(--col-8);
                    max-width: var(--col-8);
                }
            }
    
            :host([label-layout=horizontal][label-size="5"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-5);
                    flex: 0 0 var(--col-5);
                    max-width: var(--col-5);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-7);
                    flex: 0 0 var(--col-7);
                    max-width: var(--col-7);
                }
            }
    
            :host([label-layout=horizontal][label-size="6"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-6);
                    flex: 0 0 var(--col-6);
                    max-width: var(--col-6);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-6);
                    flex: 0 0 var(--col-6);
                    max-width: var(--col-6);
                }
            }
    
            :host([label-layout=horizontal][label-size="7"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-7);
                    flex: 0 0 var(--col-7);
                    max-width: var(--col-7);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-5);
                    flex: 0 0 var(--col-5);
                    max-width: var(--col-5);
                }
            }
    
            :host([label-layout=horizontal][label-size="8"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-8);
                    flex: 0 0 var(--col-8);
                    max-width: var(--col-8);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-4);
                    flex: 0 0 var(--col-4);
                    max-width: var(--col-4);
                }
            }
    
            :host([label-layout=horizontal][label-size="9"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-9);
                    flex: 0 0 var(--col-9);
                    max-width: var(--col-9);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-3);
                    flex: 0 0 var(--col-3);
                    max-width: var(--col-3);
                }
            }
    
            :host([label-layout=horizontal][label-size="10"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-10);
                    flex: 0 0 var(--col-10);
                    max-width: var(--col-10);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-2);
                    flex: 0 0 var(--col-2);
                    max-width: var(--col-2);
                }
            }
    
            :host([label-layout=horizontal][label-size="11"]) {
                .label-container {
                    -ms-flex: 0 0 var(--col-11);
                    flex: 0 0 var(--col-11);
                    max-width: var(--col-11);
                }
                .input-container {
                    -ms-flex: 0 0 var(--col-1);
                    flex: 0 0 var(--col-1);
                    max-width: var(--col-1);
                }
            }
            
            /* Removes the up and down arrows from number inputs */
            :host(:not([has-controls="true"])) {
               &::-webkit-outer-spin-button, &::-webkit-inner-spin-button, input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
                   -webkit-appearance: none;
                   margin: 0;
               }
    
               &[type=number], input[type=number] {
                   -moz-appearance: textfield;
               }
           }
        `;
    }
}