/**
 * @file GalaxySelectBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

const dummy_data = [
    {
        text: "Option 1 z",
        value: "option_1",
        node_type: "Option",
        left_icons: ["fa-solid fa-house", "fa-solid fa-car"],
        right_icons: ["fa-solid fa-ghost", "fa-solid fa-thumbs-up"],
    },
    {
        text: "Option z",
        value: "option_z",
        node_type: "Option",
        left_icons: ["fa-solid fa-house"],
        right_icons: ["fa-solid fa-thumbs-up"],
    },
    {
        text: "Option Group 1",
        value: "option_group_1",
        node_type: "Option Group",
        children: [
            {
                text: "Option 2 x",
                value: "option_2",
                node_type: "Option",
            },
            {
                text: "Option 3",
                value: "option_3",
                node_type: "Option",
            },
            {
                text: "Option Group 2",
                value: "option_group_2",
                node_type: "Option Group",
                children: [
                    {
                        text: "Option 4",
                        value: "option_4",
                        node_type: "Option",
                    },
                    {
                        text: "Option 5",
                        value: "option_5",
                        node_type: "Option",
                    },
                    {
                        text: "Option Group 3",
                        value: "option_group_3",
                        node_type: "Option Group",
                        children: [
                            {
                                text: "Option 6",
                                value: "option_6",
                                node_type: "Option",
                            },
                            {
                                text: "Option 7",
                                value: "option_7",
                                node_type: "Option",
                            },
                            {
                                text: "Option 8",
                                value: "option_8",
                                node_type: "Option",
                            },
                            {
                                text: "Option Group 4",
                                value: "option_group_4",
                                node_type: "Option Group",
                                children: [
                                    {
                                        text: "Option y 9",
                                        value: "option_9",
                                        node_type: "Option",
                                    },
                                    {
                                        text: "Option 10",
                                        value: "option_10",
                                        node_type: "Option",
                                    },
                                    {
                                        text: "Option 11",
                                        value: "option_11",
                                        node_type: "Option",
                                    },
                                    {
                                        text: "Option Group 5",
                                        value: "option_group_5",
                                        node_type: "Option Group",
                                        children: [
                                            {
                                                text: "Option 12 Option 12 Option 12",
                                                value: "option_12",
                                                node_type: "Option",
                                                left_icons: ["fa-solid fa-house", "fa-solid fa-car"],
                                                right_icons: ["fa-solid fa-ghost", "fa-solid fa-thumbs-up"],
                                            },
                                            {
                                                text: "Option 13 Option 13 Option 13",
                                                value: "option_13",
                                                node_type: "Option",
                                                left_icons: ["fa-solid fa-house", "fa-solid fa-car"],
                                                right_icons: ["fa-solid fa-ghost", "fa-solid fa-thumbs-up"],
                                            },
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }
];

const COMPONENT_TEMPLATE_HTML = `
    <input type="text" class="form-control" />
`;

const OPTIONS_ELEMENT_HTML = `
    <!-- Options Element -->
    <div class="col-12"> 
        <!-- Scroll Container -->
        <div> 
            <!-- Spacer -->
            <div></div> 
            <!-- Option Icons Layer -->
            <div></div> 
            <!-- Options Layer -->
            <div></div> 
        </div>
    </div>
`;

const INPUT_PLACEHOLDER = "Select an option";
const INPUT_SEARCH_PLACEHOLDER = "Search...";

import { GalaxyInputBase } from "./GalaxyInputBase.js";

/**
 * @class
 * @description
 *    The base class for GalaxySingleSelect and GalaxyMultiSelect. It handles:
 *   - Observing and parsing the `options-data` attribute.
 *   - A shared search/filter system (if search is enabled).
 *   - The `open` attribute, toggling dropdown logic.
 *   - Closing other open galaxy selects.
 *   - Basic form association + validation stubs.
 * @extends GalaxyInputBase
 */
export class GalaxySelectBase extends GalaxyInputBase {
    /**
     * @constructor
     */
    constructor() {
        super(COMPONENT_TEMPLATE_HTML);

        this.SELECT_TYPES = {
            SELECT: "select",
            MULTI_SELECT: "multi-select"
        }

        this.OPTION_NODE_TYPES = {
            OPTION: "Option",
            OPTION_GROUP: "Option Group"
        }

        this.type = null;

        this.options_data = [];

        // Virtualization
        this.option_height = 30;                // Height of each option element
        this.scroll_container = null;
        this.options_spacer = null;
        this.option_icons_layer = null;
        this.options_layer = null;
        this.flat_data = [];

        this.selected_options = null;           // Array of selected options

        this.search_clear_button = null;        // Clear button for the search input
        this.select_down_arrow = null;          // Down arrow for the select input

        // DOM recycling
        this.option_elements_pool = [];         // Array of reusable option elements
        this.option_icons_elements_pool = [];   // Array of reusable option icons elements
        this.max_visible_options = 0;           // How many option elements we have in the pool
    }

    /**
     * Gets the open state of the select.
     * @return {boolean} - The open state of the select.
     */
    get open() { return this.hasAttribute("open"); }

    /**
     * Sets the open state of the select.
     * @param {boolean} value - The open state of the select.
     */
    set open(value) {
        if (value) {
            this.setAttribute("open", "");
        }
        else {
            this.removeAttribute("open");
        }
    }

    /**
     * Gets the options data.
     * @return {[]} - The options data.
     */
    get options () { return this.options_data; }

    /**
     * Sets the options data.
     * @param {Array|string} value - The options data.
     */
    set options (value) {
        let options_data = [];

        if (typeof value === "string") {
            try {
                this.options_data = JSON.parse(value);
            }
            catch (error) {
                console.error("Invalid JSON for options-data", {"Select": this, "Value": value, "Error": error});
                options_data = [];
            }
        }
        else if (Array.isArray(value)) {
            options_data = value
        }
        else {
            console.error("Invalid options data", {"Select": this, "Value": value});
            options_data = [];
        }

        this.options_data = this.normalize_option_data(options_data);

        this.render_options();
    }

    /**
     * Gets the search enabled state of the select.
     * @return {boolean} - The search enabled state of the select.
     */
    get search_enabled() { return this.hasAttribute("search-enabled"); }

    /**
     * Sets the search enabled state of the select.
     * @param {boolean} value - The search enabled state of the select.
     */
    set search_enabled(value) {
        if (value) {
            this.setAttribute("search-enabled", "");
        }
        else {
            this.removeAttribute("search-enabled");
        }
    }

    /**
     * Gets the placeholder text of the select.
     * @return {string}
     */
    get placeholder() { return this.getAttribute("placeholder"); }

    /**
     * Sets the placeholder text of the select.
     * @param {string} value - The placeholder text of the select.
     */
    set placeholder(value) {
        if (value) {
            this.setAttribute("placeholder", value);
        }
        else {
            this.removeAttribute("placeholder");
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["options-data", "open", "search-enabled", "collapsible-groups", "placeholder", "options-size"];
    }

    /**
     * Normalizes the option data.
     * @param {Array} option_data - The option data to normalize.
     * @return {*[]} - The normalized option data.
     */
    normalize_option_data = (option_data) => {
        let normalized_option_data = [];

        if (!Array.isArray(option_data)) {
            return [];
        }

        for (let option of option_data) {
            if (option.node_type === this.OPTION_NODE_TYPES.OPTION_GROUP) {
                let normalized_option = {
                    ...option,
                    children: this.normalize_option_data(option.children)
                }

                if ("is_collapsed" in option) {
                    normalized_option.is_collapsed = option.is_collapsed;
                }
                else {
                    normalized_option.is_collapsed = false;
                }

                normalized_option_data.push(normalized_option);
            }
            else if (option.node_type === this.OPTION_NODE_TYPES.OPTION) {
                normalized_option_data.push(option);
            }
        }

        return normalized_option_data;
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        let attribute_lookup_table = {
            "options-data": this.handle_observed_options_data,
            "open": this.handle_observed_open,
            "search-enabled": this.handle_observed_search_enabled,
            "collapsible-groups": this.handle_observed_collapsible_groups,
            "placeholder": this.set_input_placeholder,
            "options-size": this.handle_observed_options_size,
        };

        attribute_lookup_table[name]?.(new_value);
    }

    /**
     * Handles the `options-data` attribute.
     * @param {string} value - The value of the `options-data` attribute.
     */
    handle_observed_options_data = (value) => {
        this.options = value;
    }

    /**
     * Handles the `open` attribute.
     * @param {string} value - The value of the `open` attribute.
     */
    handle_observed_open = (value) => {
        if (this.open) {
            this.open_options();
        }
        else {
            this.close_options();
        }
    }

    /**
     * Handles the `search-enabled` attribute.
     * @param {string} value - The value of the `search-enabled` attribute.
     */
    handle_observed_search_enabled = (value) => {
        if (!this.input_element) {
            return;
        }

        if (this.search_enabled) {
            this.input_element.removeAttribute("readonly");
        }
        else {
            this.input_element.setAttribute("readonly", "");
        }

        this.set_input_placeholder();
    }

    /**
     * {@link GalaxyInputBase#handle_observed_value}
     * @override
     */
    handle_observed_value = (new_value) => {
        let form_name = this.getAttribute("name");
        let value;

        // Try to parse the new value as JSON
        // If it fails, treat it as a string
        // If it is an empty string, treat it as an empty array
        // If it is a string, wrap it in an array
        // If it is an array, use it as is
        try {
            value = JSON.parse(new_value);

            if (!Array.isArray(value)) {
                value = [new_value];
            }
        }
        catch (error) {
            value = new_value === "" ? [] : [new_value];
        }

        this._value = value; // Store the value in the private variable

        // Clear the form value
        this._internals.setFormValue("", form_name);

        // Set the form value for each selected value
        for (let selected_value of this.value) {
            this._internals.setFormValue(selected_value.toString(), form_name);
        }

        // Unlike a plain <input>, a selection here is never a native "input"/"change" event on
        // input_element (that field is just the read-only search/display box) - option_on_click sets
        // .value directly, and this is the single path every value change (including that one) funnels
        // through, so the state manager write belongs here rather than in an input/change listener.
        if (window.galaxy_state_manager && this.property_name) {
            window.galaxy_state_manager.data[this.property_name] = value;
        }

        if (this.hasAttribute("required") && this.parent_form && this.parent_form.hasAttribute("instant-validation")) {
            this.validate();
        }
    }

    /**
     * Handles the `collapsible-groups` attribute.
     * @param {string} value - The value of the `collapsible-groups` attribute.
     */
    handle_observed_collapsible_groups = (value) => { this.render_options(); }

    /**
     * Handles the `options-size` attribute. The new height will be value (number of options) * option_height.
     * @param value
     */
    handle_observed_options_size = (value) => {
        if (!this.scroll_container || !this.option_height || !value) {
            return;
        }

        let new_height = Number(value) * this.option_height;

        if (this.type === this.SELECT_TYPES.MULTI_SELECT) {
            this.scroll_container.style.height = `${new_height}px`;
        }
        else {
            this.scroll_container.style.maxHeight = `${new_height}px`;
        }

        this.update_visible_rows();
    }

    /**
     * If the document is clicked outside of the select this will close the dropdown.
     * @param {Event} event - The event object.
     */
    handle_document_click = (event) => {
        if (!this.open) {
            return;
        }

        // event.target is unreliable here: a composed event crossing a shadow boundary gets retargeted
        // to the enclosing shadow host, and this component sits inside a second shadow root whenever
        // it's used inside <galaxy-form> (which moves its children into a <form> in its own shadow
        // root) - so event.target would appear as <galaxy-form> itself for every click, even clicks on
        // this select's own input/options. composedPath() gives the real, un-retargeted path regardless
        // of how many shadow boundaries were crossed.
        if (!event.composedPath().includes(this)) {
            this.close_options();
        }
    }

    /**
     * If the window is scrolled or resized this will handle repositioning the dropdown.
     * @param {Event} event - The event object.
     */
    handle_window_scroll_or_resize = (event) => {
        if (!this.open) {
            return;
        }

        this.position_options();
    }

    /**
     * Will initialize the selected options based on the value.
     */
    initialize_selected_options = () => {
        if (this.value && Array.isArray(this.value)) {
            this.selected_options = this.value.map((value) => {
                let option = this.find_option(value);

                if (option) {
                    return {
                        text: option.text,
                        value: option.value,
                    };
                }
            });
        }
        else {
            this.selected_options = [];
        }

        this.update_visible_rows();
    }

    /**
     * Will close the dropdowns of all other galaxy selects.
     */
    close_other_selects = () => {
        let galaxy_selects = document.querySelectorAll(`${window.galaxy_engine.GALAXY_COMPONENT_TAG_NAMES.SELECT}, ${window.galaxy_engine.GALAXY_COMPONENT_TAG_NAMES.MULTI_SELECT}`);

        for (let galaxy_select of galaxy_selects) {
            if (galaxy_select !== this && galaxy_select.open) {
                galaxy_select.open = false;
            }
        }
    }

    /**
     * Will open the dropdown and handle smart positioning.
     */
    open_options = () => {
        this.close_other_selects();
        this.render_options();
        this.set_input_placeholder();
    }

    /**
     * Will close the dropdown.
     */
    close_options = () => {
        this.open = false;

        if (this.scroll_container) {
            this.scroll_container.scrollTop = 0;
        }

        if (this.value) {
            this.input_element.value = this.selected_options.length > 0 ? this.selected_options[0].text : "";

            this.search_clear_button.style.display = "none";
        }

        if (this.type === this.SELECT_TYPES.SELECT) {
            this.select_down_arrow.style.display = "block";
        }

        this.set_input_placeholder();
    }

    /**
     * Will position the dropdown and handle smart positioning.
     */
    position_options = () => {
        if (!this.anchor_dropdown && this.type === this.SELECT_TYPES.SELECT) {
            let input_element_rect = this.input_element.getBoundingClientRect();
            let scroll_container_rect = this.scroll_container.getBoundingClientRect();

            let dropdown_top = 0;
            let dropdown_left = input_element_rect.left;
            let dropdown_width = input_element_rect.width;
            let dropdown_height = scroll_container_rect.height;

            if (input_element_rect.bottom + dropdown_height > window.innerHeight) {
                // not enough space below, place above
                dropdown_top = dropdown_top - input_element_rect.height - dropdown_height;
            }

            // conditionally set the drop down styles to prevent unnecessary reflows
            if (this.scroll_container.style.top !== `${dropdown_top}px`) {
                this.scroll_container.style.top = `${dropdown_top}px`;
            }

            if (this.scroll_container.style.left !== `${dropdown_left}px`) {
                this.scroll_container.style.left = `${dropdown_left}px`;
            }

            if (this.scroll_container.style.width !== `${dropdown_width}px`) {
                this.scroll_container.style.width = `${dropdown_width}px`;
            }

            if (this.scroll_container.style.height !== `${this.option_height * this.max_visible_options + 24}px`) {
                this.scroll_container.style.height = `${this.option_height * this.max_visible_options + 24}px`;
            }
        }
        else if (this.scroll_container && (this.scroll_container.style.top !== "" && this.scroll_container.style.top !== "" && this.scroll_container.style.width !== "")) {
            // If the dropdown is anchored, reset the position
            this.scroll_container.style.top = "";
            this.scroll_container.style.left = "";
            this.scroll_container.style.width = "";
        }
    }

    /**
     * Will handle the input click event.
     */
    input_on_click = () => {}

    /**
     * Builds a flat data structure for the options to be used in the virtualized list.
     * @param {Array} options - The options to build the flat data structure from.
     * @param {number} indent - The indent level.
     * @return {*[]} - The flat data structure.
     */
    build_flat_data = (options, indent = 0) => {
        let flat_data = [];

        for (let option of options) {
            if (!option.node_type || option.node_type === this.OPTION_NODE_TYPES.OPTION) {
                flat_data.push({
                    ...option,
                    indent: indent
                });
            }
            else if (option.node_type === this.OPTION_NODE_TYPES.OPTION_GROUP) {
                flat_data.push({
                    ...option,
                    indent: indent
                });

                if (!option.is_collapsed || !this.hasAttribute("collapsible-groups")) {
                    flat_data.push(...this.build_flat_data(option.children, indent + 1));
                }
            }
        }

        return flat_data;
    }

    /**
    * Creates or adjusts the option_elements_pool to match the needed row elements
     * @param {number} count - The number of row elements needed.
    */
    create_or_resize_option_elements_pool = (count) => {
        this.max_visible_options = count;

        // Remove extras if we have too many
        while (this.option_elements_pool.length > count) {
            let option_element = this.option_elements_pool.pop();
            let option_icons_element = this.option_icons_elements_pool.pop();

            if (option_element.parentNode) {
                option_element.parentNode.removeChild(option_element);

                option_element.onclick = null;
            }

            if (option_icons_element.parentNode) {
                option_icons_element.parentNode.removeChild(option_icons_element);
            }
        }

        // Add new ones if we have too few
        while (this.option_elements_pool.length < count) {
            let option_element = document.createElement("div");
            let option_icons_element = document.createElement("div");

            option_element.style.left = "0";
            option_element.style.right = "0";

            option_icons_element.style.left = "0";
            option_icons_element.style.right = "0";

            this.option_elements_pool.push(option_element);
            this.option_icons_elements_pool.push(option_icons_element);
        }
    }

    /**
     * Will render the dropdown options.
     * @param {Array} options - The options to render.
     */
    render_options = (options = null) => {
        if (!this.options_spacer || !this.scroll_container) {
            return;
        }

        if (!options || !Array.isArray(options)) {
            options = this.options;
        }

        this.flat_data = this.build_flat_data(options);

        let total_rows = this.flat_data.length;

        this.options_spacer.style.height = `${total_rows * this.option_height}px`;

        // Compute how many rows might be visible at once
        let container_height = this.scroll_container.clientHeight;

        // Add a small buffer to reduce flicker
        let buffer = 2;
        let visible_count = Math.ceil(container_height / this.option_height) + buffer;

        // Create or resize the row pool
        if (visible_count !== this.max_visible_options) {
            this.create_or_resize_option_elements_pool(this.flat_data.length);
        }

        // Render the visible options
        this.update_visible_rows();
    }

    /**
     * This method will update the visible rows in the virtualized list.
     */
    update_visible_rows = () => {
        if (!this.scroll_container || !this.flat_data) {
            return;
        }

        let scroll_top = this.scroll_container.scrollTop;
        let container_height = this.scroll_container.parentElement.clientHeight;
        let total_options = this.flat_data.length;

        let start_index = Math.floor(scroll_top / this.option_height);
        let visible_count = Math.ceil(container_height / this.option_height) + 2;
        let end_index = Math.min(start_index + visible_count, total_options);

        // Remove all rows from the options_layer
        while (this.options_layer.firstChild) {
            this.options_layer.removeChild(this.options_layer.firstChild);
        }

        // Remove all rows from the option_icons_layer
        while (this.option_icons_layer.firstChild) {
            this.option_icons_layer.removeChild(this.option_icons_layer.firstChild);
        }

        // Render the visible rows in the options_layer using the option_elements_pool
        for (let i = start_index; i < end_index; i++) {
            let pool_index = i - start_index
            if (pool_index >= this.option_elements_pool.length) break; // safety check

            let option_element = this.option_elements_pool[pool_index];
            let option_icons_container_element = this.option_icons_elements_pool[pool_index];
            let option_data = this.flat_data[i];

            // Update the row element content to match row_data
            this.update_option_element(option_element, option_icons_container_element, option_data);

            // Update the icons element
            this.update_icons_element(option_icons_container_element, option_data);

            // Position it
            let top_px = i * this.option_height
            option_element.style.top = `${top_px}px`;
            option_icons_container_element.style.top = `calc(${top_px - scroll_top}px + 0.34rem)`;

            // Append to item_layer
            this.options_layer.appendChild(option_element);
            this.option_icons_layer.appendChild(option_icons_container_element);
        }

        // Update the width of the option elements
        this.update_option_element_width();

        // Update the right icon spacing
        this.update_right_icon_spacing();

        // If single select reposition options
        if (this.type === this.SELECT_TYPES.SELECT) {
            this.position_options();
        }
    }

    /**
     * Rewrites the content of a row_el to match row_data, re-binding any events.
     * @param {HTMLElement} option_element - The option element to update.
     * @param {HTMLElement} option_icons_container_element - The option icons container element to update.
     * @param {Object} option_data - The option data to update the option element with.
     */
    update_option_element(option_element, option_icons_container_element, option_data) {
        option_element.innerHTML = `
            <div>${option_data.text}</div>
        `;

        option_element.removeAttribute("selected");

        if (option_data.node_type === this.OPTION_NODE_TYPES.OPTION_GROUP) {
            option_element.setAttribute("option-group", "");
            option_element.setAttribute("value", option_data.value);

            if (!option_data.is_collapsed || !this.hasAttribute("collapsible-groups")) {
                option_element.setAttribute("open", "");
            }
            else {
                option_element.removeAttribute("open");
            }

            option_element.onclick = (event) => {
                event.stopPropagation();
                if (this.hasAttribute("collapsible-groups")) {
                    this.toggle_group(option_data);
                }
            }
        }
        else {
            option_element.removeAttribute("option-group");
            option_element.setAttribute("value", option_data.value);
            option_element.removeAttribute("open");

            if (this.selected_options && this.selected_options.some((option => option.value === option_data.value))) {
                option_element.setAttribute("selected", "");
            }

            option_element.onclick = (event) => {
                event.stopPropagation();
                this.option_on_click(option_element, option_icons_container_element, option_data);
            }
        }

        let padding_left = option_data.indent * 36 + 36;

        option_element.style.width = `calc(100% + ${padding_left + 8}px)`;
        option_element.style.paddingLeft = `calc(${padding_left}px + 0.5rem)`;
    }

    /**
     * Will update the icons element with the left and right icons
     * @param {HTMLElement} icons_element - The icons element to update.
     * @param {Object} option_data - The option data to update the icons element with.
     */
    update_icons_element = (icons_element, option_data) => {
        icons_element.innerHTML = `
                <div></div>
                <div></div>
        `;

        icons_element.removeAttribute("selected");

        let left_icons_container = icons_element.querySelector(":first-child");
        let right_icons_container = icons_element.querySelector(":last-child");

        // Add left icons
        if (option_data.left_icons) {
            left_icons_container.style.display = null;

            for (let icon of option_data.left_icons) {
                let icon_element = document.createElement("i");
                icon_element.className = icon;
                left_icons_container.appendChild(icon_element);
            }
        }
        else {
            left_icons_container.style.display = "none";
        }

        // Add right icons
        if (option_data.right_icons) {
            right_icons_container.style.display = null;
            // right_icons_container.style.right = is_scroll_container_overflowing ? null : 0;

            for (let icon of option_data.right_icons) {
                let icon_element = document.createElement("i");
                icon_element.className = icon;
                right_icons_container.appendChild(icon_element);
            }
        }
        else {
            right_icons_container.style.display = "none";
        }

        if (this.selected_options && this.selected_options.some((option => option.value === option_data.value))) {
            icons_element.setAttribute("selected", "");
        }
    }

    /**
     * Will update the width of the option elements to match the widest element.
     * This is used to ensure that all option elements are the same width, so that they align properly and look nice when hovering and highlighting.
     */
    update_option_element_width = () => {
        let option_elements = this.options_layer.querySelectorAll("& > div");

        let widest_width = 0;
        let max_width = "100%";

        for (let option_element of option_elements) {
            let option_element_rect = option_element.getBoundingClientRect();
            let option_element_width = option_element_rect.width;

            if (option_element_width > widest_width) {
                widest_width = option_element_width;
            }
        }

        // If the widest width is greater than the scroll container width, set the max width to the widest width
        // Otherwise, set the max width to 100%
        let scroll_container_rect = this.scroll_container.parentElement.getBoundingClientRect();
        let scroll_container_width = scroll_container_rect.width;
        if (widest_width - 36 > scroll_container_width) {
            max_width = `${widest_width}px`;
        }

        for (let option_element of option_elements) {
            if (option_element.style.width !== widest_width.toString()) {
                option_element.style.width = max_width;
            }
        }
    }

    /**
     * Will update the right icon spacing based on the scroll container overflow to prevent the icons from overlapping the scrollbar.
     */
    update_right_icon_spacing = () => {
        let is_scroll_container_overflowing = this.scroll_container.scrollHeight > this.scroll_container.clientHeight;

        for (let option_icons_element of this.option_icons_layer.children) {
            let right_icons_container = option_icons_element.querySelector("div:last-child");

            if (is_scroll_container_overflowing) {
                right_icons_container.style.right = null;
            }
            else {
                right_icons_container.style.right = 0;
            }
        }
    }

    /**
     * Will toggle a group.
     * @param {Object} option_data - The option/group data to toggle.
     */
    toggle_group = (option_data) => {
        let group_data = this.find_group(option_data.value);

        group_data.is_collapsed = !group_data.is_collapsed;

        this.render_options();
    }

    /**
     * Will find a group in the data array.
     * @param {string} value - The value to find.
     * @param {Array} options_data - The options data to search.
     * @return {*} - The group data.
     */
    find_group = (value, options_data = null) => {
        if (!options_data) {
            options_data = this.options;
        }

        for (let item of options_data) {
            if (item.value === value) {
                return item;
            }
            else if (item.children) {
                let  result = this.find_group(value, item.children);

                if (result) {
                    return result;
                }
            }
        }
    }

    /**
     * Will find an option in the data array.
     * @param {string} value - The value to find.
     * @param {Array} options_data - The options data to search.
     * @return {any|*}
     */
    find_option = (value, options_data = null) => {
        if (!options_data) {
            options_data = this.options;
        }

        for (let item of options_data) {
            if (item.value === value) {
                return item;
            }
            else if (item.children) {
                let  result = this.find_option(value, item.children);

                if (result) {
                    return result;
                }
            }
        }
    }

    /**
     * Will search the data array for a query and return the results.
     * @param {string} query - The query to search for.
     * @param {Array} data_array - The data array to search.
     * @return {any|*[]}
     */
    search_data = (query, data_array) => {
        let trimmed_query = query.trim().toLowerCase();

        // If the query is empty, we typically want to return the original data unfiltered or a deep clone.
        if (!trimmed_query) {
            // Return a deep clone so original isn't mutated
            return structuredClone ? structuredClone(data_array) : JSON.parse(JSON.stringify(data_array));
        }

        let result = [];

        for (let item of data_array) {
            // If it"s a group
            if (item.children) {
                let group_label_lower = item.text.toLowerCase();
                let group_matches_label = group_label_lower.includes(trimmed_query);

                let matched_children = [];

                if (Array.isArray(item.children) && !item.is_collapsed) {
                    // Recursively filter children
                    matched_children = this.search_data(query, item.children);
                }
                else if (Array.isArray(item.children) && item.is_collapsed) {
                    matched_children = item.children;
                }

                if (group_matches_label || matched_children.length > 0) {
                    result.push({
                        ...item,
                        // Only keep children if the group is expanded or the user wants to keep them
                        children: matched_children
                    });
                }
            }
            else {
                // It's an option
                let text_lower = item.text.toLowerCase();
                let matches = text_lower.includes(trimmed_query);

                if (matches) {
                    // Keep this option
                    result.push({ ...item })
                }
            }
        }

        return result
    }

    /**
     * Will add a clear button to the search input and a down arrow to the select.
     */
    add_search_clear_button_and_down_arrow = () => {
        if (this.input_element) {
            let input_wrapper = document.createElement("div");

            this.search_clear_button = document.createElement("button");
            this.search_clear_button.textContent = "x";

            this.search_clear_button.addEventListener("click", this.clear_search);

            this.input_element.parentNode.insertBefore(input_wrapper, this.input_element);

            input_wrapper.appendChild(this.input_element);
            input_wrapper.appendChild(this.search_clear_button);

            if (this.type === this.SELECT_TYPES.SELECT) {
                this.select_down_arrow = document.createElement("div");
                input_wrapper.appendChild(this.select_down_arrow);
            }
        }
    }

    /**
     * Will clear the search input.
     * @param {Event} event - The event object.
     */
    clear_search = (event) => {
        event.stopPropagation();

        this.input_element.value = "";

        this.on_input_event(event);
    }

    /**
     * Will set the input placeholder based on the search-enabled attribute.
     */
    set_input_placeholder = () => {
        if (this.open && this.hasAttribute("search-enabled")) {
            this.input_element.placeholder = this.hasAttribute("placeholder") ? this.getAttribute("placeholder") : INPUT_SEARCH_PLACEHOLDER;
        }
        else {
            this.input_element.placeholder = INPUT_PLACEHOLDER;
        }
    }

    /**
     * Will handle what happens when an option is clicked.
     * @param {HTMLElement} option_element - The option element.
     * @param {HTMLElement} option_icons_container_element - The option icons container element.
     * @param {Object} option_data - The event object.
     * @param {string} option_data.value - The value of the option.
     * @param {string} option_data.text - The text of the option.
     * @param {string} option_data.node_type - The node type of the option.
     */
    option_on_click = (option_element, option_icons_container_element, option_data) => {console.error("option_on_click not implemented", option_element, option_data);}

    /**
     * Will handle the input event.
     * @param {Event} event - The event object.
     * @return on_input - The on_input method.
     * @override
     */
    on_input_event = (event) => this.on_input(event);

    /**
     * {@link GalaxyInputBase#on_input}
     * @override
     */
    on_input = (event) => {
        this.value = this.input_element.value;
        
        if (this.input_element.value === "") {
            this.search_clear_button.style.display = null;

            if (this.type === this.SELECT_TYPES.SELECT) {
                this.select_down_arrow.style.display = null;
            }
        }
        else {
            this.search_clear_button.style.display = "block";

            if (this.type === this.SELECT_TYPES.SELECT) {
                this.select_down_arrow.style.display = "none";
            }
        }
        
        this.render_options(this.search_data(this.input_element.value, this.options));
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     * @override
     */
    on_create = async () => {
        document.addEventListener("click", this.handle_document_click);
        window.addEventListener("scroll", this.handle_window_scroll_or_resize, true);
        window.addEventListener("resize", this.handle_window_scroll_or_resize);

        if (this.hasAttribute("search-enabled")) {
            this.input_element.removeAttribute("readonly");
        }
        else {
            this.input_element.setAttribute("readonly", "");
        }

        this.add_search_clear_button_and_down_arrow();
        this.set_input_placeholder();

        this.input_element.addEventListener("click", this.input_on_click);

        this.options_element = await this.get_template(OPTIONS_ELEMENT_HTML);

        this.scroll_container = this.options_element.firstElementChild;
        this.scroll_container.addEventListener("scroll", this.update_visible_rows);

        this.options_spacer = this.scroll_container.firstElementChild;
        this.option_icons_layer = this.scroll_container.children[1];
        this.options_layer = this.scroll_container.lastElementChild;

        this.input_wrapper_element.appendChild(this.options_element);

        this.options = dummy_data;

        this.initialize_selected_options();

        if (this.open) {
          this.open_options();
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     * @override
     */
    on_destroy = async () => {
        document.removeEventListener("click", this.handle_document_click);
        window.removeEventListener("scroll", this.handle_window_scroll_or_resize, true);
        window.removeEventListener("resize", this.handle_window_scroll_or_resize);
        this.input_element.removeEventListener("click", this.input_on_click);

        this.scroll_container.removeEventListener("scroll", this.update_visible_rows);

        for (let option_element of this.option_elements_pool) {
            option_element.onclick = null;
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            .input-container > div {
                position: relative;
                display: inline-flex;
                width: 100%;

                > input {
                    width: 100%;
                    padding-right: 2rem;

                    &:hover {
                        cursor: default;
                    }

                    &[readonly] {
                        cursor: default;
                        background-color: unset !important;
                    }
                }

                /* Down arrow icon */
                > div {
                    position: absolute;
                    right: 0.5rem;
                    top: 40%;
                    border: solid var(--text-grey);
                    border-width: 0 1px 1px 0;
                    padding: 3px;
                    transform: rotate(45deg) translateY(-40%);
                    -webkit-transform: rotate(45deg) translateY(-40%);
                }

                /* Clear button */
                > button {
                    position: absolute;
                    right: 0.5rem;
                    top: 50%;
                    transform: translateY(-50%);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 1.3rem;
                    font-weight: bold;
                    line-height: 1;
                    color: red;
                    display: none; /* hidden by default, show only if there's text */
                }
            }

            /* Galaxy Select Options element */
            .col-12 {
                /* Was previously a Bootstrap grid class relying on the global stylesheet; that can't reach in through the shadow boundary, so the sizing is now declared directly. */
                flex: 0 0 100%;
                max-width: 100%;
                transform: translate(0, 0);

                /* scrollable container */
                > div {
                    display: none;
                    background-color: white;
                    border: 1px solid var(--lightgrey);
                    border-radius: 0.25rem;
                    box-shadow: 0 0.05rem 0.25rem rgba(0, 0, 0, 0.15);
                    list-style-type: none;
                    margin: 0;
                    overflow: auto;
                    padding: 0;
                    position: absolute;
                    width: 100%;
                    z-index: 5;
                    cursor: default;

                    /* Spacer */
                    > div:first-child {
                        position: relative;
                        z-index: 10;
                        pointer-events: none;
                    }

                    /* Option icons layer */
                    > div:nth-child(2) {
                        position: fixed;
                        height: 100%;
                        width: calc(100% - 2rem);
                        top: 0;
                        overflow: clip;
                        pointer-events: none;
                        z-index: 3;

                        > div {
                            position: absolute;
                            display: inline-flex;
                            top: 0.25rem;
                            left: 1rem;
                            right: 1rem;
                            height: 26px;

                            /* Font Awesome icons, left and right */
                            > div {
                                position: absolute;
                                width: 48px;
                                height: 26px;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                                text-align: left;
                                z-index: 1;
                                background-color: white;

                                > i {
                                    padding: 0.15rem 0.15rem;
                                    width: 22px;
                                    text-align: start;
                                    height: 100%;
                                }
                            }

                            > div:first-child {
                                left: 0;
                            }

                            > div:last-child {
                                right: 0.9rem;
                            }

                            &[selected] {
                                div {
                                    background-color: var(--blue);
                                    color: white;
                                }
                            }
                        }
                    }

                    /* options layer */
                    > div:last-child {
                        position: absolute;
                        width: 100%;
                        top: 0.25rem;
                        z-index: 1;

                        /* options */
                        > div {
                            position: absolute;
                            display: inline-flex;
                            width: 100%;
                            height: 26px;

                            > div {
                               flex-shrink: 0;
                            }

                            &:hover {
                                background-color: #f8f9fa;
                            }

                            &[selected] {
                                background-color: var(--blue);
                                color: white;
                            }

                            &:not([option-group]) {
                                /* Option text */
                                > div {
                                    position: absolute;
                                    padding-left: 0.25rem;
                                }
                            }
                        }
                    }
                }
            }

            :host([collapsible-groups]) .col-12 > div > div:last-child > div[option-group] {
                font-weight: bold;

                &:before {
                    display: inline-block;
                    content: "▼";
                    transform: rotateZ(-90deg);
                    margin-right: 0.5rem;
                }

                &[open] {
                    &:before {
                        transform: rotateZ(0deg);
                        margin-right: 0.5rem;
                    }

                    div {
                        display: inline-block;
                    }
                }
            }
        `;
    }
}