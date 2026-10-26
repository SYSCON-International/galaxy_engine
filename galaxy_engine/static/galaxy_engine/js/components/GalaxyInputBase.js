/**
 * @file GalaxyInputBase.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyHTMLComponentBase } from "./GalaxyHTMLComponentBase.js";
import { GalaxyUtils } from "../GalaxyUtils.js";

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
     * Whether Enter in this input submits its form, when the form has `submit-on-enter` - see {@link on_host_keydown}. Set by the single-line inputs; a field where Enter
     * means something else (a textarea's newline, a select's pick) leaves it false.
     * @type {boolean}
     */
    static submits_form_on_enter = false;

    /**
     * @constructor
     * @param {string} input_html_template - The HTML template for the input element.
     */
    constructor(input_html_template) {
        super();

        this.input_html_template = input_html_template;

        this._value = "";
        this._internals = this.attachInternals();

        this.property_name = "";
        this.is_state_bound = false;
        this.type = "text";
    }

    /**
     * {@link GalaxyHTMLComponentBase#shadow_root_options}
     * @note Delegating focus makes the inner field the element's only tab stop, while `element.focus()` and clicks on non-focusable parts of the element still move focus
     *     into the field.
     * @override
     */
    static get shadow_root_options() {
        return {delegatesFocus: true};
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
        let base_input_template = await this.get_template();
        let input_element_container = base_input_template.querySelector("div > div:last-child");

        // Stored so subclasses can append additional shadow-rendered markup (e.g. a select's options dropdown) as a sibling of the label/input rows.
        this.input_wrapper_element = base_input_template;

        this.label_element = base_input_template.querySelector("label");
        this.input_element = await this.get_template(this.input_html_template);
        // Named for ::part() styling from a page stylesheet.
        this.input_element.setAttribute("part", "input");

        input_element_container.appendChild(this.input_element);

        this.property_name = this.getAttribute("property-name") || null;

        // data-property is the binding for plain elements; a Galaxy input binds two-way through property-name instead (see connect_state_binding).
        if (this.hasAttribute("data-property")) {
            console.warn(`${this.constructor.name}: data-property is not supported on a Galaxy input; use property-name="${this.getAttribute("data-property")}" to bind it to state.`);
        }

        if (this.has_completed_create) {
            // A reconnect (a move): the value is whatever it became - typed by the user, or set since - not the markup's value attribute, which typing never updates.
            this.restore_value_after_reconnect();
        }
        else {
            // Captured once, before anything can change it, so formResetCallback can restore the value the
            // element had when it was created (mirrors a native <input>'s "default value").
            this.default_value = this.hasAttribute("value") ? this.getAttribute("value") : "";

            // Check if a value has been set on the custom element and set it on the input element.
            if (this.hasAttribute("value")) {
                this.value = this.getAttribute("value");
            }
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

        // Attach event listener for user input.
        this.input_element.addEventListener("input", this.on_input_event);
        this.input_element.addEventListener("change", this.on_change_event);
        // On the element itself, so Enter in any of its fields is heard - a duration input's unit fields as well as its main one.
        this.addEventListener("keydown", this.on_host_keydown);

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
            this.input_element.removeEventListener("change", this.on_change_event);
        }

        this.removeEventListener("keydown", this.on_host_keydown);
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_on_create}
     * @note Runs after the subclass's on_create, so the input's own value is fully established before state is synced.
     * @override
     */
    post_on_create = async () => {
        this.connect_state_binding();

        // From here on a create is a reconnect - see pre_on_create.
        this.has_completed_create = true;
    }

    /**
     * Puts the current value back into the newly built field on a reconnect (a move). The form value lives on the element and survives the move. A subclass whose field
     * is not a plain text field - a checkbox, a select, a picker - overrides this.
     */
    restore_value_after_reconnect = () => {
        this.input_element.value = this._value ?? "";
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_on_destroy}
     * @note Runs after the subclass's on_destroy, so subclass cleanup still finds its elements in place. pre_on_create builds the label/input markup afresh on every create,
     *     and subclasses insert theirs inside it (a select's options, a duration input's fields, a range picker's row), so removing it here is what keeps a reconnect from
     *     showing a second copy of the field.
     * @override
     */
    post_on_destroy = async () => {
        if (this.property_name && window.galaxy_state_manager?.unbind) {
            window.galaxy_state_manager.unbind(this.property_name, this);
        }

        this.is_state_bound = false;

        this.input_wrapper_element?.remove();
        this.input_wrapper_element = null;
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets whether the input is drawn compact.
     * @return {boolean} - True when compact.
     */
    get compact() { return this.hasAttribute("compact"); }

    /**
     * Sets whether the input is drawn compact: a smaller field with no label row and no grid gutters, for tight spaces such as galaxy-editable-table cells.
     * @param {boolean} value - True to draw it compact.
     */
    set compact(value) {
        if (value) {
            this.setAttribute("compact", "");
        }
        else {
            this.removeAttribute("compact");
        }
    }

    /**
     * Gets whether the input is drawn plain.
     * @return {boolean} - True when plain.
     */
    get plain() { return this.hasAttribute("plain"); }

    /**
     * Sets whether the input is drawn plain: no border or background until it is hovered or focused, so its value reads as ordinary text - as in a
     * galaxy-editable-table cell. An invalid plain input still shows its error border.
     * @param {boolean} value - True to draw it plain.
     */
    set plain(value) {
        if (value) {
            this.setAttribute("plain", "");
        }
        else {
            this.removeAttribute("plain");
        }
    }

    /**
     * Gets the disabled attribute of the Galaxy input.
     * @return {boolean} - True if the input is disabled, false otherwise.
     */
    get disabled() { return this.hasAttribute("disabled"); }

    /**
     * Gets whether the input is disabled for any reason: its own `disabled` attribute, or an ancestor `<fieldset disabled>` (see formDisabledCallback). Unlike
     * {@link disabled}, which is only the element's own attribute.
     * @return {boolean}
     */
    get is_disabled() { return this.disabled || Boolean(this.is_disabled_by_fieldset); }

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
        // null/undefined clear the field rather than showing the text "null".
        this.setAttribute("value", value === null || value === undefined ? "" : value);
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * Handles the disabled attribute on the input element.
     * @param {string|null} new_value - The new value of the disabled attribute.
     */
    handle_observed_disabled = () => {
        if (!this.input_element) {
            return;
        }

        // Its own attribute or a disabled fieldset - see is_disabled.
        this.input_element.disabled = this.is_disabled;
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
        // Any string, including the "" of a bare `readonly` attribute, means present.
        let is_readonly = typeof new_value === "string";

        if (is_readonly) {
            this.input_element.setAttribute("readonly", "");
        }
        else {
            this.input_element.removeAttribute("readonly");
        }
    }

    /**
     * Handles the required attribute on the input element. Revalidates when the form validates instantly, or when `required` is removed so a stale "please enter a value"
     * error clears; otherwise a required field is not shown as invalid until the form validates it on submit.
     * @param {string|null} new_value - The new value of the required attribute.
     */
    handle_observed_required = (new_value) => {
        // pre_on_create also calls this, before a subclass's on_create has built what its value getter reads; creation runs its own instant-validation check at the end.
        if (!this.is_initialized) {
            return;
        }

        let is_required = typeof new_value === "string";
        let is_instant_validation = Boolean(this.parent_form?.hasAttribute("instant-validation"));

        if (is_instant_validation || !is_required) {
            this.validate();
        }
    }

    /**
     * Handles the value attribute on the input element.
     * @param {string|number} new_value - The new value of the value attribute.
     */
    handle_observed_value = (new_value) => {
        this.apply_observed_value(new_value);
    }

    /**
     * Applies a value attribute to the field, the element's value and its form value. Kept apart from {@link handle_observed_value} so a subclass that overrides that
     * handler can still run this.
     * @param {string|number|null} new_value - The new value of the value attribute.
     */
    apply_observed_value = (new_value) => {
        // A removed value attribute arrives as null; the field is then empty, as a native input's is.
        let value = new_value ?? "";

        this.input_element.value = value;
        this._value = value;
        // One argument: the restore state then defaults to the value. (A second argument is the restore state, never the field's name.)
        this._internals.setFormValue(value.toString());

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
        this._value = event.target.value;
        this.write_state_value(event.target.value);

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
      * 4) Finally, it dispatches change on this element (see dispatch_host_change).
      * @param {Event} event - The event object.
     */
    on_change_event = (event) => {
        this._value = event.target.value;
        this.write_state_value(event.target.value);

        this._internals.setFormValue(event.target.value);

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            // Check for errors on the input element.
            this.validate();
        }

        // Call the on_change for child classes to implement.
        this.on_change(event);

        this.dispatch_host_change();
    }

    /**
     * Submits the input's form on Enter when the form has `submit-on-enter` (see {@link GalaxyUtils.submit_form_implicitly}). The inner field sits in this element's
     * shadow root with no form of its own, so the browser never does this itself. Only for an input with {@link submits_form_on_enter}. An Enter the field has already
     * handled - a combo box picking a suggestion - or one ending a composition is ignored.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_host_keydown = (event) => {
        let is_plain_enter = event.key === "Enter" && !event.isComposing && !event.defaultPrevented;

        if (!is_plain_enter || !this.constructor.submits_form_on_enter) {
            return;
        }

        // ElementInternals.form is the form owner, so a form="…" attribute is honored; closest() covers a browser without it.
        let form = this._internals.form ?? this.closest("form");

        if (form && GalaxyUtils.submit_form_implicitly(form)) {
            event.preventDefault();
        }
    }

    /**
     * Dispatches change on this element. The field's own change event does not cross the shadow boundary, so without this a change listener on the element never
     * hears that the user committed an edit. Only user commits call this; a value set from code dispatches nothing, as on a native input.
     */
    dispatch_host_change = () => {
        this.dispatchEvent(new Event("change", {bubbles: true}));
    }

    /*******************************************************
     *                    Other Methods                    *
     *******************************************************/

    /**
     * Binds this input to its `property-name` in the state manager. When the state already holds the property, the input adopts that value (state wins); otherwise it
     * seeds the state with its own. Undone in post_on_destroy, and redone on reconnect.
     */
    connect_state_binding = () => {
        let state_manager = window.galaxy_state_manager;

        if (!this.property_name || !state_manager?.bind) {
            return;
        }

        if (state_manager.has_property(this.property_name)) {
            this.apply_state_value(state_manager.data[this.property_name]);
        }
        else {
            state_manager.set(this.property_name, this.value, this);
        }

        state_manager.bind(this.property_name, this);
        this.is_state_bound = true;
    }

    /**
     * Writes a value to this input's `property-name` in the state manager, which updates everything else bound to it. The single path every subclass reports a value
     * change through; this input itself is not written back to.
     * @note Does nothing until {@link connect_state_binding} has run: values an input reports while it is still being created would otherwise overwrite a state value it is
     *     about to adopt.
     * @param {*} value - The value to write.
     */
    write_state_value = (value) => {
        if (this.is_state_bound && window.galaxy_state_manager?.set && this.property_name) {
            window.galaxy_state_manager.set(this.property_name, value, this);
        }
    }

    /**
     * Applies a state value written by something else bound to the same `property-name`. Sets {@link value}, so each subclass's own setter interprets the value in its own
     * type. Like setting `value` from code, it dispatches no `change` event. Override when a subclass's setter cannot take the state's value as-is.
     * @param {*} value - The state value.
     */
    apply_state_value = (value) => {
        this.value = value;
    }

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
     * Checks if there are any errors on the input element and will set the validity of the input element. A disabled input is valid; a required one must have a value; and
     * any value present is checked by {@link get_validation_errors}, whether the input is required or not.
     * @return {boolean} - True when the input is valid. Always a boolean, since GalaxyForm treats any falsy result as invalid.
     */
    validate = () => {
        // A disabled field - by its own attribute or a fieldset - is not validated, as a native one is not.
        if (this.is_disabled) {
            this._internals.setValidity({});

            return true;
        }

        let value = this.value;
        let is_empty = this.is_value_empty(value);
        let error_messages = [];

        if (is_empty && this.hasAttribute("required")) {
            error_messages.push(this.required_error_message);
        }

        // An empty optional field is valid; any value that is there is checked, required or not.
        if (!is_empty) {
            error_messages.push(...this.get_validation_errors(value));
        }

        if (error_messages.length > 0) {
            this._internals.setValidity({customError: true}, error_messages.join("\n"), this.input_element);

            return false;
        }

        this._internals.setValidity({});

        return true;
    }

    /**
     * Web Components API - Form-associated custom element lifecycle hook: called when the owning form is
     * reset. Restores the value the element had when it was created (its initial `value` attribute, or empty).
     */
    formResetCallback() {
        this.value = this.default_value;
    }

    /**
     * Web Components API - Form-associated custom element lifecycle hook: called when the element becomes
     * disabled or enabled as a result of an ancestor `<fieldset>` being disabled, rather than its own
     * `disabled` attribute. Keeps the element's own disabled state in sync.
     * @param {boolean} is_disabled - Whether the element is now disabled.
     */
    formDisabledCallback(is_disabled) {
        // Kept apart from the element's own disabled attribute, which belongs to the page: writing it here would leave the field disabled after the fieldset was
        // re-enabled, and would remove an author's own disabled when it was.
        this.is_disabled_by_fieldset = Boolean(is_disabled);
        this.handle_observed_disabled();
        this.on_disabled_state_change();
    }

    /**
     * Called when a fieldset disables or re-enables the input, for a subclass with controls of its own to follow {@link is_disabled}.
     */
    on_disabled_state_change = () => {}

    /**
     * Web Components API - Form-associated custom element lifecycle hook: called when the browser restores
     * previously submitted state (e.g. after a reload or back/forward navigation).
     * @param {string|File|FormData|null} state - The state previously passed to `_internals.setFormValue`.
     */
    formStateRestoreCallback(state) {
        if (typeof state === "string") {
            this.value = state;
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
     * Whether `value` counts as "no value entered" for required-field validation. Override this for value
     * types other than a plain string (e.g. a select's value, which is always an array).
     * @param {*} value
     * @return {boolean}
     */
    is_value_empty = (value) => value === "";

    /**
     * Message shown when a required field is empty. Override for a more specific message.
     * @type {string}
     */
    required_error_message = "Please enter a value.";

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
                    <label part="label"></label>
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
                display: block;
            }

            :host {
                input {
                    display: block;
                    width: 100%;
                    padding: 0.375rem 0.75rem;
                    font-family: inherit;
                    font-size: 1rem;
                    font-weight: 400;
                    line-height: 1.5;
                    color: var(--text-grey);
                    background-color: var(--input-background, #ffffff);
                    background-clip: padding-box;
                    border: 1px solid var(--lightgrey);
                    border-radius: 0.25rem;
                    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;

                    /* A checkbox draws its own focus ring; the readonly, plain and invalid states below override this one */
                    &:not([type="checkbox"]):focus {
                        outline: none;
                        border-color: var(--blue);
                        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
                    }
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
            
            /* Handles the disabled state for the input and select elements - by its own attribute, or a disabled fieldset, which :disabled also matches */
            :host([disabled]), :host(:disabled) {
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
                    background-color: var(--input-readonly-background, #e9ecef) !important;
                    appearance: none;
                    padding-left: 1rem;
        
                    &:focus {
                        border: 0 !important;
                        box-shadow: none !important;
                    }
                }
            }
            
            /* Compact: a smaller field with no label row and no grid gutters, for tight spaces such as galaxy-editable-table cells */
            :host([compact]) {
                .galaxy-input-container {
                    margin-right: 0;
                    margin-left: 0;

                    .label-container, .input-container {
                        padding-right: 0;
                        padding-left: 0;
                    }

                    .label-container {
                        display: none;
                    }
                }

                input, textarea {
                    padding: 0.2rem 0.4rem;
                    font-size: 0.9rem;
                    line-height: 1.4;
                }
            }

            /* Plain: reads as ordinary text until hovered or focused. Checkboxes are left alone (a switch's track is its background), and an invalid field keeps its error border */
            :host([plain]:not(:invalid)) {
                input:not([type="checkbox"]), textarea {
                    border-color: transparent;
                    background-color: transparent;
                    box-shadow: none;
                }
            }

            :host([plain]:not(:invalid):not([disabled]):hover) {
                input:not([type="checkbox"]), textarea {
                    border-color: var(--lightgrey);
                }
            }

            :host([plain]:not(:invalid)) {
                input:not([type="checkbox"]):focus, textarea:focus {
                    border-color: var(--lightgrey);
                    background-color: var(--input-background, #ffffff);
                }
            }

            /* A disabled plain field - a locked editable-table row - stays readable rather than greyed out */
            :host([plain][disabled]) {
                input:not([type="checkbox"]), textarea {
                    color: var(--text-grey);
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