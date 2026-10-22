/**
 * @file GalaxyComboBox.js
 * @framework GalaxyEngine
 * @author
 *  Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *  (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyTextInput } from './GalaxyTextInput.js';

// The suggestion list's tallest height, matching a select's floating dropdown, and the height of one suggestion.
const SUGGESTION_LIST_MAX_HEIGHT = 210;
const SUGGESTION_HEIGHT = 26;

/**
 * @class
 * @description
 *     A combo box: a free-text field with suggestions - a format field where a common pattern can be picked or one's own typed. The typed text is always the value.
 *
 *     `suggestions` is a JSON array of strings, or of `{value, text}` objects whose `text` is shown in the list and whose `value` is put in the field. The list looks like
 *     a select's floating dropdown. Typing shows the suggestions containing the typed text; a click in the field, the down arrow, or ArrowDown shows them all. ArrowUp and
 *     ArrowDown move through the list, Enter or a click picks one, and Escape closes it. Picking a suggestion puts its value in the field as if it had been typed -
 *     `input` and `change` fire. Everything else is a {@link GalaxyTextInput}'s.
 * @extends GalaxyTextInput
 */
export class GalaxyComboBox extends GalaxyTextInput {
    static next_suggestion_list_number = 0;

    /**
     * @constructor
     */
    constructor() {
        super();

        this._suggestions = [];
        this.suggestion_list_element = null;
        this.suggestion_toggle_element = null;
        this.shown_suggestions = [];
        this.shown_suggestions_are_filtered = false;
        this.highlighted_suggestion_index = -1;
        this.is_suggestion_list_open = false;
        this.suggestion_listeners_controller = null;
        this.open_listeners_controller = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["suggestions"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (name === "suggestions") {
            this.apply_suggestions(new_value);
        }
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the suggestions, normalized.
     * @return {{value: string, text: string}[]} - Copies of the suggestions.
     */
    get suggestions() {
        return this._suggestions.map((suggestion) => ({...suggestion}));
    }

    /**
     * Sets the suggestions.
     * @param {Array<string|{value: string, text: string}>|string|null} value - The suggestions, or a JSON string of them; null or [] for none, which hides the down
     *     arrow and leaves the field as free text.
     */
    set suggestions(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("suggestions");
        }
        else {
            this.setAttribute("suggestions", typeof value === "string" ? value : JSON.stringify(value));
        }
    }

    /**
     * Gets whether the field has suggestions to offer.
     * @return {boolean} - True when it has at least one.
     */
    get has_suggestions() {
        return this._suggestions.length > 0;
    }

    /**
     * Gets whether the field can show its suggestions now: it has some, and it is neither disabled nor read-only.
     * @return {boolean} - True when the list may open.
     */
    get can_show_suggestions() {
        return this.has_suggestions && !this.hasAttribute("disabled") && !this.hasAttribute("readonly");
    }

    /***************  Suggestions  ***************/

    /**
     * Parses and normalizes the suggestions, and brings an open list up to date with them.
     * @param {string|null} value - The `suggestions` attribute.
     */
    apply_suggestions = (value) => {
        let parsed_suggestions = [];

        if (value) {
            try {
                parsed_suggestions = JSON.parse(value);
            }
            catch (error) {
                console.warn(`${this.constructor.name}: suggestions must be a JSON array; ignoring them.`, error);
            }
        }

        if (!Array.isArray(parsed_suggestions)) {
            console.warn(`${this.constructor.name}: suggestions must be a JSON array; ignoring them.`);
            parsed_suggestions = [];
        }

        this._suggestions = parsed_suggestions.map(this.normalize_suggestion).filter((suggestion) => suggestion !== null);

        this.update_suggestion_mode();
    }

    /**
     * Normalizes one suggestion to `{value, text}`.
     * @param {string|number|{value: string, text: string}} suggestion - The suggestion.
     * @return {{value: string, text: string}|null} - The suggestion, or null when it has no value.
     */
    normalize_suggestion = (suggestion) => {
        if (typeof suggestion === "string" || typeof suggestion === "number") {
            return {value: String(suggestion), text: String(suggestion)};
        }

        let has_value = Boolean(suggestion) && typeof suggestion === "object" && suggestion.value !== undefined && suggestion.value !== null;

        if (!has_value) {
            console.warn(`${this.constructor.name}: A suggestion has no value; ignoring it.`, suggestion);
            return null;
        }

        let text = suggestion.text !== undefined && suggestion.text !== null ? String(suggestion.text) : String(suggestion.value);

        return {value: String(suggestion.value), text: text};
    }

    /**
     * Shows the down arrow only when there are suggestions, and refreshes an open list - closing it when nothing is left to show.
     */
    update_suggestion_mode = () => {
        this.toggleAttribute("has-suggestions", this.has_suggestions);

        if (!this.suggestion_list_element) {
            return;
        }

        if (this.is_suggestion_list_open) {
            this.open_suggestions(this.shown_suggestions_are_filtered ? this.get_filtered_suggestions() : this._suggestions, this.shown_suggestions_are_filtered);
        }
    }

    /**
     * Builds the suggestion list - a manual popover in the top layer, like a select's floating dropdown - and the down-arrow toggle, and marks the field as a combo box.
     */
    build_suggestion_list = () => {
        GalaxyComboBox.next_suggestion_list_number += 1;

        this.suggestion_list_element = document.createElement("div");
        this.suggestion_list_element.className = "suggestion-list";
        this.suggestion_list_element.id = `galaxy-suggestions-${GalaxyComboBox.next_suggestion_list_number}`;
        this.suggestion_list_element.setAttribute("role", "listbox");
        this.suggestion_list_element.setAttribute("popover", "manual");

        this.suggestion_toggle_element = document.createElement("button");
        this.suggestion_toggle_element.className = "suggestion-toggle";
        this.suggestion_toggle_element.type = "button";
        this.suggestion_toggle_element.tabIndex = -1;
        this.suggestion_toggle_element.setAttribute("aria-label", "Show suggestions");

        let field_wrapper = document.createElement("div");
        field_wrapper.className = "suggestion-field";

        this.input_element.before(field_wrapper);
        field_wrapper.append(this.input_element, this.suggestion_toggle_element);
        this.input_wrapper_element.appendChild(this.suggestion_list_element);

        this.input_element.setAttribute("role", "combobox");
        this.input_element.setAttribute("aria-autocomplete", "list");
        this.input_element.setAttribute("aria-expanded", "false");
        this.input_element.setAttribute("aria-controls", this.suggestion_list_element.id);
        this.input_element.setAttribute("autocomplete", "off");

        this.suggestion_listeners_controller = new AbortController();

        let options = {signal: this.suggestion_listeners_controller.signal};

        this.input_element.addEventListener("input", this.on_suggestion_input, options);
        this.input_element.addEventListener("keydown", this.on_suggestion_keydown, options);
        this.input_element.addEventListener("click", this.on_suggestion_field_click, options);
        this.input_element.addEventListener("blur", this.on_suggestion_blur, options);
        this.suggestion_toggle_element.addEventListener("click", this.on_suggestion_toggle_click, options);

        // Pressing a suggestion or the arrow would otherwise move focus off the field before its click arrives.
        this.suggestion_list_element.addEventListener("pointerdown", this.keep_field_focus, options);
        this.suggestion_toggle_element.addEventListener("pointerdown", this.keep_field_focus, options);
        this.suggestion_list_element.addEventListener("click", this.on_suggestion_click, options);
    }

    /**
     * Gets the suggestions whose text or value contains the typed text, ignoring case.
     * @return {{value: string, text: string}[]} - The matching suggestions, or all of them when nothing is typed.
     */
    get_filtered_suggestions = () => {
        let typed_text = this.input_element.value.trim().toLowerCase();

        if (typed_text === "") {
            return this._suggestions;
        }

        return this._suggestions.filter((suggestion) => {
            return suggestion.text.toLowerCase().includes(typed_text) || suggestion.value.toLowerCase().includes(typed_text);
        });
    }

    /**
     * Opens the list showing some suggestions, or closes it when there are none to show.
     * @param {{value: string, text: string}[]} suggestions - The suggestions to show.
     * @param {boolean} is_filtered - Whether they are filtered by the typed text, so a change to the suggestions re-filters them.
     */
    open_suggestions = (suggestions, is_filtered) => {
        if (!this.can_show_suggestions || suggestions.length === 0) {
            this.close_suggestions();
            return;
        }

        this.shown_suggestions_are_filtered = is_filtered;
        this.render_suggestions(suggestions);

        if (!this.is_suggestion_list_open) {
            try {
                this.suggestion_list_element.showPopover();
            }
            catch (error) {
                console.warn(`${this.constructor.name}: The suggestions could not be shown as a popover.`, error);
                return;
            }

            this.is_suggestion_list_open = true;
            this.input_element.setAttribute("aria-expanded", "true");
            this.add_open_listeners();
        }

        this.position_suggestions();
    }

    /**
     * Closes the list.
     */
    close_suggestions = () => {
        this.highlighted_suggestion_index = -1;
        this.input_element?.removeAttribute("aria-activedescendant");

        if (!this.is_suggestion_list_open) {
            return;
        }

        this.is_suggestion_list_open = false;
        this.input_element.setAttribute("aria-expanded", "false");
        this.open_listeners_controller?.abort();
        this.open_listeners_controller = null;

        try {
            this.suggestion_list_element.hidePopover();
        }
        catch (error) {
            // Already hidden - the browser hides a popover itself when it leaves the document.
        }
    }

    /**
     * Closes the list. The shared hook a container calls when it hides this input - a galaxy-collapse closing, for one - since the floating list is not clipped by it.
     */
    close_floating_content = () => {
        this.close_suggestions();
    }

    /**
     * Rebuilds the list's options, marking the one that matches the field's value.
     * @param {{value: string, text: string}[]} suggestions - The suggestions to show.
     */
    render_suggestions = (suggestions) => {
        let typed_value = this.input_element.value;

        this.shown_suggestions = suggestions;
        this.highlighted_suggestion_index = -1;
        this.input_element.removeAttribute("aria-activedescendant");

        let option_elements = suggestions.map((suggestion, index) => {
            let option_element = document.createElement("div");
            option_element.className = "suggestion";
            option_element.id = `${this.suggestion_list_element.id}-option-${index}`;
            option_element.dataset.index = String(index);
            option_element.setAttribute("role", "option");
            option_element.setAttribute("aria-selected", "false");
            option_element.textContent = suggestion.text;
            option_element.toggleAttribute("current", suggestion.value === typed_value);

            return option_element;
        });

        this.suggestion_list_element.replaceChildren(...option_elements);
    }

    /**
     * Highlights a suggestion, scrolling it into view and pointing the field's `aria-activedescendant` at it.
     * @param {number} index - The suggestion's index among those shown, or -1 for none.
     */
    highlight_suggestion = (index) => {
        let option_elements = Array.from(this.suggestion_list_element.children);

        this.highlighted_suggestion_index = index;

        for (let [option_index, option_element] of option_elements.entries()) {
            let is_highlighted = option_index === index;

            option_element.toggleAttribute("highlighted", is_highlighted);
            option_element.setAttribute("aria-selected", String(is_highlighted));
        }

        let highlighted_element = option_elements[index];

        if (highlighted_element) {
            this.input_element.setAttribute("aria-activedescendant", highlighted_element.id);
            highlighted_element.scrollIntoView({block: "nearest"});
        }
        else {
            this.input_element.removeAttribute("aria-activedescendant");
        }
    }

    /**
     * Puts a suggestion's value in the field as if it had been typed - `input` and `change` fire, so the value, the form value, and any bound state follow - and closes the
     * list, keeping focus in the field.
     * @param {{value: string, text: string}} suggestion - The suggestion.
     */
    pick_suggestion = (suggestion) => {
        this.close_suggestions();

        if (this.input_element.value === suggestion.value) {
            return;
        }

        this.input_element.value = suggestion.value;

        // The field's own input listener would reopen the list as filtered by the picked value; it is closed again once the event has run.
        this.input_element.dispatchEvent(new Event("input", {bubbles: true, composed: true}));
        this.input_element.dispatchEvent(new Event("change", {bubbles: true}));
        this.close_suggestions();
    }

    /**
     * Places the list under the field in viewport coordinates, or above it when there is not room below and there is more above, as a select's floating dropdown is.
     */
    position_suggestions = () => {
        if (!this.is_suggestion_list_open) {
            return;
        }

        let field_rect = this.input_element.getBoundingClientRect();
        let list_height = Math.min(this.shown_suggestions.length * SUGGESTION_HEIGHT + 2, SUGGESTION_LIST_MAX_HEIGHT);
        let space_below = window.innerHeight - field_rect.bottom;
        let should_place_above = space_below < list_height && field_rect.top > space_below;

        this.suggestion_list_element.style.top = `${should_place_above ? field_rect.top - list_height : field_rect.bottom}px`;
        this.suggestion_list_element.style.left = `${field_rect.left}px`;
        this.suggestion_list_element.style.width = `${field_rect.width}px`;
        this.suggestion_list_element.style.maxHeight = `${list_height}px`;
    }

    /**
     * Listens, while the list is open, for what moves or closes it: scrolling and resizing reposition it, and a press outside the field and the list closes it.
     */
    add_open_listeners = () => {
        this.open_listeners_controller = new AbortController();

        let options = {capture: true, signal: this.open_listeners_controller.signal};

        window.addEventListener("scroll", this.on_open_scroll, {...options, passive: true});
        window.addEventListener("resize", this.position_suggestions, options);
        window.addEventListener("pointerdown", this.on_open_pointerdown, options);
    }

    /**
     * Repositions the list when the page scrolls, unless the scroll was the list's own.
     * @param {Event} event - The scroll event.
     */
    on_open_scroll = (event) => {
        if (event.composedPath?.()[0] !== this.suggestion_list_element) {
            this.position_suggestions();
        }
    }

    /**
     * Closes the list on a press outside the field and the list.
     * @param {PointerEvent} event - The pointerdown event.
     */
    on_open_pointerdown = (event) => {
        if (!event.composedPath?.().includes(this)) {
            this.close_suggestions();
        }
    }

    /***************  Suggestion Events  ***************/

    /**
     * Keeps focus in the field when the list or the arrow is pressed.
     * @param {PointerEvent} event - The pointerdown event.
     */
    keep_field_focus = (event) => {
        event.preventDefault();
    }

    /**
     * Shows the suggestions containing the typed text as the user types.
     */
    on_suggestion_input = () => {
        this.open_suggestions(this.get_filtered_suggestions(), true);
    }

    /**
     * Shows every suggestion on a click in the field. An open list stays open, so a click to move the caret does not close it.
     */
    on_suggestion_field_click = () => {
        if (!this.is_suggestion_list_open) {
            this.open_suggestions(this._suggestions, false);
        }
    }

    /**
     * Toggles the list from the down arrow, showing every suggestion, and keeps focus in the field.
     */
    on_suggestion_toggle_click = () => {
        this.input_element.focus();

        if (this.is_suggestion_list_open) {
            this.close_suggestions();
        }
        else {
            this.open_suggestions(this._suggestions, false);
        }
    }

    /**
     * Picks the clicked suggestion.
     * @param {MouseEvent} event - The click event.
     */
    on_suggestion_click = (event) => {
        let option_element = event.target.closest?.(".suggestion");
        let suggestion = option_element ? this.shown_suggestions[Number(option_element.dataset.index)] : null;

        if (suggestion) {
            this.pick_suggestion(suggestion);
        }
    }

    /**
     * Moves through, picks from, and closes the list from the keyboard. A key the list uses stops propagating, so a page's document-level key handling does not act
     * on it too; keys the list does not use are left to the field.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_suggestion_keydown = (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            event.stopPropagation();
            this.move_suggestion_highlight(event.key === "ArrowDown" ? 1 : -1);
        }
        else if (event.key === "Enter") {
            let highlighted_suggestion = this.shown_suggestions[this.highlighted_suggestion_index];

            // Only a highlighted suggestion is picked; otherwise Enter does what it always does in a field, such as submitting its form.
            if (this.is_suggestion_list_open && highlighted_suggestion) {
                event.preventDefault();
                event.stopPropagation();
                this.pick_suggestion(highlighted_suggestion);
            }
        }
        else if (event.key === "Escape") {
            if (this.is_suggestion_list_open) {
                event.preventDefault();
                event.stopPropagation();
                this.close_suggestions();
            }
        }
        else if (event.key === "Tab") {
            this.close_suggestions();
        }
    }

    /**
     * Moves the highlight down or up the list, wrapping at the ends, and opens the list showing every suggestion when it is closed.
     * @param {number} offset - 1 to move down, -1 to move up.
     */
    move_suggestion_highlight = (offset) => {
        if (!this.is_suggestion_list_open) {
            this.open_suggestions(this._suggestions, false);

            if (this.is_suggestion_list_open) {
                this.highlight_suggestion(offset === 1 ? 0 : this.shown_suggestions.length - 1);
            }

            return;
        }

        let suggestion_count = this.shown_suggestions.length;
        let next_index = (this.highlighted_suggestion_index + offset + suggestion_count) % suggestion_count;

        if (this.highlighted_suggestion_index === -1 && offset === -1) {
            next_index = suggestion_count - 1;
        }

        this.highlight_suggestion(next_index);
    }

    /**
     * Closes the list when focus leaves the field.
     */
    on_suggestion_blur = () => {
        this.close_suggestions();
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.build_suggestion_list();

        // A suggestions attribute in markup was reacted to before the field existed.
        this.apply_suggestions(this.getAttribute("suggestions"));
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     * @note GalaxyInputBase#post_on_destroy removes the field's markup, the list with it.
     */
    on_destroy = async () => {
        this.close_suggestions();

        this.suggestion_listeners_controller?.abort();
        this.suggestion_listeners_controller = null;
        this.suggestion_list_element = null;
        this.suggestion_toggle_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_component_css}
     * @override
     */
    get post_component_css() {
        return `
            .suggestion-field {
                position: relative;
            }

            :host([has-suggestions]) .suggestion-field > input {
                padding-right: 2rem;
            }

            :host(:not([has-suggestions])) .suggestion-toggle {
                display: none;
            }

            /* A down arrow like a select's, hidden on a plain field until it is hovered or focused */
            .suggestion-toggle {
                position: absolute;
                top: 0;
                right: 0;
                width: 2rem;
                height: 100%;
                padding: 0;
                border: none;
                background: none;
                cursor: pointer;
            }

            .suggestion-toggle::after {
                position: absolute;
                top: 40%;
                left: 50%;
                padding: 3px;
                border: solid var(--text-grey);
                border-width: 0 1px 1px 0;
                content: "";
                transform: translate(-50%, -50%) rotate(45deg);
            }

            :host([plain]:not(:hover):not(:focus-within)) .suggestion-toggle,
            :host([disabled]) .suggestion-toggle,
            :host([readonly]) .suggestion-toggle {
                visibility: hidden;
            }

            /* The list, styled as a select's floating dropdown: a manual popover in the top layer, placed by position_suggestions() */
            .suggestion-list {
                position: fixed;
                inset: auto;
                margin: 0;
                padding: 0;
                overflow-y: auto;
                font-size: 1rem;
                color: var(--text-dark);
                background-color: #ffffff;
                border: 1px solid var(--lightgrey);
                border-radius: 0.25rem;
                box-shadow: 0 0.05rem 0.25rem rgba(0, 0, 0, 0.15);
                cursor: default;
            }

            .suggestion {
                height: ${SUGGESTION_HEIGHT}px;
                padding: 0 0.5rem;
                overflow: hidden;
                line-height: ${SUGGESTION_HEIGHT}px;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .suggestion:hover {
                background-color: #f8f9fa;
            }

            .suggestion[current] {
                font-weight: bold;
            }

            .suggestion[highlighted] {
                background-color: #e9ecef;
            }
        `;
    }
}
