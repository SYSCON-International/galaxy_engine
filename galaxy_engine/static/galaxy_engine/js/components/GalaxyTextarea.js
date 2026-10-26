/**
 * @file GalaxyTextarea.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyInputBase} from "./GalaxyInputBase.js";

const COMPONENT_TEMPLATE_HTML = `
    <textarea class="form-control"></textarea>
`;

const DEFAULT_ROWS = 3;

/**
 * @class
 * @description
 *     A multi-line text input - comments, notes, or a field samples are scanned into one per line. `rows` sets its visible height (the minimum height with `auto-grow`),
 *     `maxlength` caps its length, and `auto-grow` makes it grow to fit its content instead of scrolling. Everything else - `value`, `label`, `name`, `required`,
 *     `placeholder`, `property-name` binding, form submission - works as on any {@link GalaxyInputBase} input.
 * @extends GalaxyInputBase
 */
export class GalaxyTextarea extends GalaxyInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(COMPONENT_TEMPLATE_HTML);

        this.type = "textarea";
        this.resize_observer = null;
        this.observed_width = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["rows", "maxlength", "auto-grow"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.input_element) {
            return;
        }

        // value is observed by GalaxyInputBase, which has already put it in the textarea by the time this runs; refitting here covers values set from code or state.
        const attribute_lookup_table = {
            "value": this.update_auto_grow_height,
            "rows": this.handle_observed_rows,
            "maxlength": this.handle_observed_maxlength,
            "auto-grow": this.handle_observed_auto_grow,
        }

        attribute_lookup_table[name]?.(new_value);
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the number of visible rows.
     * @return {number} - The rows; defaults to 3, and falls back to it for a missing or invalid attribute.
     */
    get rows() {
        let rows = parseInt(this.getAttribute("rows"), 10);

        return Number.isInteger(rows) && rows > 0 ? rows : DEFAULT_ROWS;
    }

    /**
     * Sets the number of visible rows - the height, or the minimum height with {@link auto_grow}.
     * @param {number|null} value - The rows, or null for the default of 3.
     */
    set rows(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("rows");
        }
        else {
            this.setAttribute("rows", String(value));
        }
    }

    /**
     * Gets the maximum length.
     * @return {number|null} - The maximum number of characters, or null when unlimited (or the attribute is invalid).
     */
    get maxlength() {
        let maxlength = parseInt(this.getAttribute("maxlength"), 10);

        return Number.isInteger(maxlength) && maxlength >= 0 ? maxlength : null;
    }

    /**
     * Sets the maximum length. The browser stops the user typing past it; a longer value set from code is a validation error instead (see {@link get_validation_errors}).
     * @param {number|null} value - The maximum number of characters, or null for no limit.
     */
    set maxlength(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("maxlength");
        }
        else {
            this.setAttribute("maxlength", String(value));
        }
    }

    /**
     * Gets whether the textarea grows to fit its content.
     * @return {boolean} - True when it auto-grows.
     */
    get auto_grow() {return this.hasAttribute("auto-grow");}

    /**
     * Sets whether the textarea grows to fit its content, from a minimum of {@link rows}, instead of scrolling. The resize handle is hidden while it auto-grows.
     * @param {boolean} value - True to auto-grow.
     */
    set auto_grow(value) {
        if (value) {
            this.setAttribute("auto-grow", "");
        }
        else {
            this.removeAttribute("auto-grow");
        }
    }

    /***************  Attribute Observer Methods  ***************/

    /**
     * Applies {@link rows} to the textarea.
     */
    handle_observed_rows = () => {
        this.input_element.rows = this.rows;
        this.update_auto_grow_height();
    }

    /**
     * Applies {@link maxlength} to the textarea and revalidates, since the value may now be too long.
     */
    handle_observed_maxlength = () => {
        if (this.maxlength === null) {
            this.input_element.removeAttribute("maxlength");
        }
        else {
            this.input_element.maxLength = this.maxlength;
        }

        this.validate_if_instant();
    }

    /**
     * Turns auto-grow on or off, fitting the height to the content or clearing it back to {@link rows}.
     */
    handle_observed_auto_grow = () => {
        if (this.auto_grow) {
            this.start_watching_width();
            this.update_auto_grow_height();
        }
        else {
            this.stop_watching_width();
            this.input_element.style.height = "";
        }
    }

    /*******************************************************
     *                    Other Methods                    *
     *******************************************************/

    /**
     * Fits an auto-growing textarea's height to its content, never shorter than {@link rows}. Does nothing without {@link auto_grow}.
     */
    update_auto_grow_height = () => {
        if (!this.auto_grow || !this.input_element) {
            return;
        }

        // Collapsed to the rows height first, so the measured scroll height can shrink as well as grow.
        this.input_element.style.height = "auto";

        let border_height = this.input_element.offsetHeight - this.input_element.clientHeight;

        this.input_element.style.height = `${this.input_element.scrollHeight + border_height}px`;
    }

    /**
     * Refits an auto-growing textarea when its width changes, since narrower text wraps onto more lines. Uses a ResizeObserver where the browser has one.
     */
    start_watching_width = () => {
        if (this.resize_observer || typeof ResizeObserver !== "function") {
            return;
        }

        this.resize_observer = new ResizeObserver((entries) => {
            let width = entries[0]?.contentRect.width;

            // Height changes from the refit itself also reach the observer; only a width change needs a refit, which also stops it re-triggering itself.
            if (width !== this.observed_width) {
                this.observed_width = width;
                this.update_auto_grow_height();
            }
        });

        this.resize_observer.observe(this.input_element);
    }

    /**
     * Stops watching the textarea's width.
     */
    stop_watching_width = () => {
        this.resize_observer?.disconnect();
        this.resize_observer = null;
        this.observed_width = null;
    }

    /**
     * Validates when the textarea is required and its form uses instant validation.
     */
    validate_if_instant = () => {
        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /**
     * {@link GalaxyInputBase#get_validation_errors}
     * @note The browser enforces maxlength only while the user types, so a longer value set from code or state is reported here instead of being submitted silently -
     *     required or not, since GalaxyInputBase#validate checks every non-empty value.
     * @override
     */
    get_validation_errors = (value) => {
        let maxlength = this.maxlength;
        let is_too_long = maxlength !== null && String(value ?? "").length > maxlength;

        if (is_too_long) {
            return [`Please enter no more than ${maxlength} characters.`];
        }

        return [];
    }

    /**
     * Refits an auto-growing textarea as the user types.
     * @override
     * @param {Event} event - The input event.
     */
    on_input = (event) => {
        this.update_auto_grow_height();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.input_element.rows = this.rows;
        this.handle_observed_maxlength();
        this.handle_observed_auto_grow();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.stop_watching_width();
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            /* The input base styles only <input>; a textarea gets the same look */
            :host textarea {
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
                resize: vertical;
            }

            :host textarea:focus {
                outline: none;
                border-color: var(--blue);
                box-shadow: 0 0 0 0.2rem var(--focus-ring, rgba(0, 123, 255, 0.25));
            }

            :host([auto-grow]) textarea {
                overflow-y: hidden;
                resize: none;
            }

            :host(:invalid) textarea {
                border-color: var(--red);
                box-shadow: var(--invalid-ring, rgba(255, 0, 0, 0.25)) 0px 0px 0px 0.2rem;
            }

            :host([disabled]) textarea {
                color: lightgrey;
                pointer-events: none;
                resize: none;
            }

            /* The shared readonly style blocks pointer events, which would stop a long readonly comment being scrolled or selected */
            :host([readonly]) textarea {
                background-color: var(--input-readonly-background, #e9ecef);
                pointer-events: auto;
                resize: none;
            }
        `;
    }
}
