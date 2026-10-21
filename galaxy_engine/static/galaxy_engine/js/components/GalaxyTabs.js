/**
 * @file GalaxyTabs.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {GalaxyUtils} from "../GalaxyUtils.js";

const TABS_HTML_TEMPLATE = `
    <div class="galaxy-tabs">
        <div class="tab-bar">
            <button class="scroll-button scroll-previous" type="button" tabindex="-1" aria-hidden="true" hidden>
                <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"></path></svg>
            </button>
            <div class="tab-list" role="tablist"></div>
            <button class="scroll-button scroll-next" type="button" tabindex="-1" aria-hidden="true" hidden>
                <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"></path></svg>
            </button>
        </div>
        <div class="tab-panels"><slot></slot></div>
    </div>
`;

// A galaxy-tab's attributes the tab bar is built from.
const TAB_ATTRIBUTE_NAMES = ["label", "name", "disabled", "badge", "badge-variant"];

const REMEMBER_MODES = {
    URL: "url",
    SESSION: "session",
};

/**
 * @class
 * @description
 *     A tabbing system. Each `<galaxy-tab label="...">` inside it is one tab - its content is everything inside the galaxy-tab - and the tab bar is built from them, so
 *     a tab and its panel can never get out of step. Adding, removing, relabeling, or disabling a galaxy-tab updates the bar. Only the selected tab shows; one being
 *     hidden closes anything floating from inside it, such as an open select dropdown.
 *
 *     `selected` holds the selected tab's name. A click, or the arrow keys, Home, and End on the focused tab bar (Up and Down when `orientation="vertical"`), select a
 *     tab and dispatch a bubbling `tab_change` with `{name, previous_name, index}`; selecting from code dispatches nothing. Disabled tabs are skipped. When the tabs do
 *     not fit, the bar scrolls sideways with arrow buttons at its ends, and the selected tab is kept in view.
 *
 *     The selection can be remembered, through one `remember` attribute keyed by `remember-key` (or the element's id): `"url"` keeps it in the page's URL, so a reload,
 *     back and forward, and a shared link land on it; `"session"` keeps it in the app's session through `window.galaxy_session_store`, which the app registers. With
 *     `property-name`, the selected tab's name is also bound two ways to the Galaxy state manager, like any Galaxy input.
 *
 *     A tab holding an invalid field is marked in the bar, and a galaxy-form that finds its first invalid field inside a tab selects that tab.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyTabs extends GalaxyHTMLComponentBase {
    static next_tabs_number = 0;

    // Warned once per page, not once per tab set.
    static has_warned_about_missing_session_store = false;

    /**
     * @constructor
     */
    constructor() {
        super(TABS_HTML_TEMPLATE);

        GalaxyTabs.next_tabs_number += 1;

        this.tabs_id = `galaxy-tabs-${GalaxyTabs.next_tabs_number}`;
        this.tabs_container = null;
        this.tab_list = null;
        this.tab_observer = null;
        this.resize_observer = null;
        this.listeners_controller = null;
        this.selected_tab = null;
        this.has_user_chosen = false;
        this.is_state_bound = false;
        this.is_error_refresh_queued = false;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["selected", "orientation", "label"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.tab_list) {
            return;
        }

        if (name === "selected") {
            // A selection already applied - select_tab() applies at once - needs nothing more.
            if (this.selected_tab && this.find_tab(new_value) === this.selected_tab) {
                return;
            }

            this.apply_selection();
        }
        else {
            this.render_tab_bar();
        }
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the galaxy-tab children, in order.
     * @return {HTMLElement[]} - The tabs.
     */
    get tabs() {
        return Array.from(this.children).filter((child) => child.tagName === "GALAXY-TAB");
    }

    /**
     * Gets the selected tab's name.
     * @return {string|null} - The name, or null when there are no tabs to select.
     */
    get selected() {
        return this.selected_tab ? this.get_tab_name(this.selected_tab) : this.getAttribute("selected");
    }

    /**
     * Selects a tab by name, without dispatching `tab_change`. A disabled or missing tab selects the first enabled one instead.
     * @param {string} value - The tab's name.
     */
    set selected(value) {
        this.select_tab(value);
    }

    /**
     * Gets which way the tab bar runs.
     * @return {string} - "horizontal" (the default) or "vertical".
     */
    get orientation() {
        return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal";
    }

    /**
     * Sets which way the tab bar runs: across the top, or down the left side.
     * @param {string|null} value - "horizontal" or "vertical".
     */
    set orientation(value) {
        if (value) {
            this.setAttribute("orientation", value);
        }
        else {
            this.removeAttribute("orientation");
        }
    }

    /**
     * Gets where the selection is remembered.
     * @return {string|null} - "url", "session", or null when it is not.
     */
    get remember() {
        let remember = this.getAttribute("remember");

        return Object.values(REMEMBER_MODES).includes(remember) ? remember : null;
    }

    /**
     * Gets the key the selection is remembered under.
     * @return {string|null} - `remember-key`, or the element's id, or null.
     */
    get remember_key() {
        return this.getAttribute("remember-key") || this.id || null;
    }

    /**
     * Gets the state manager property the selected tab's name is bound to.
     * @return {string|null} - The property, or null.
     */
    get property_name() {
        return this.getAttribute("property-name") || null;
    }

    /**
     * Gets a tab's name: its `name`, or `tab_<index>` when it has none.
     * @param {HTMLElement} tab - The galaxy-tab.
     * @return {string} - The name.
     */
    get_tab_name = (tab) => {
        return tab.getAttribute("name") || `tab_${this.tabs.indexOf(tab)}`;
    }

    /**
     * Finds a tab by name.
     * @param {string|null} name - The name.
     * @return {HTMLElement|null} - The tab, or null.
     */
    find_tab = (name) => {
        if (name === null || name === undefined) {
            return null;
        }

        return this.tabs.find((tab) => this.get_tab_name(tab) === String(name)) ?? null;
    }

    /**
     * Gets whether a tab can be selected.
     * @param {HTMLElement|null} tab - The tab.
     * @return {boolean} - True when it exists and is not disabled.
     */
    is_tab_selectable = (tab) => {
        return Boolean(tab) && !tab.hasAttribute("disabled");
    }

    /***************  Selection  ***************/

    /**
     * Selects a tab by name from code, without dispatching `tab_change`. A disabled or missing tab selects the first enabled one instead.
     * @param {string} name - The tab's name.
     */
    select_tab = (name) => {
        this.setAttribute("selected", String(name));
        this.apply_selection();
    }

    /**
     * Selects a tab for a user's action: remembers it, writes it to state, and dispatches `tab_change`.
     * @param {HTMLElement} tab - The tab.
     */
    select_tab_for_user = (tab) => {
        if (!this.is_tab_selectable(tab) || tab === this.selected_tab) {
            return;
        }

        let previous_name = this.selected;

        this.has_user_chosen = true;
        this.select_tab(this.get_tab_name(tab));
        this.write_remembered_selection();
        this.write_state_value();

        let detail = {name: this.selected, previous_name: previous_name, index: this.tabs.indexOf(this.selected_tab)};

        this.dispatchEvent(new CustomEvent("tab_change", {bubbles: true, detail: detail}));
    }

    /**
     * Shows the tab `selected` names - or the first enabled tab when that one is disabled or missing - and hides the rest, closing anything floating from a tab being
     * hidden. Brings the tab bar up to date.
     */
    apply_selection = () => {
        let tabs = this.tabs;
        let requested_tab = this.find_tab(this.getAttribute("selected"));
        let next_tab = this.is_tab_selectable(requested_tab) ? requested_tab : tabs.find(this.is_tab_selectable) ?? null;

        for (let tab of tabs) {
            let should_hide = tab !== next_tab;
            let is_being_hidden = should_hide && !tab.hidden;

            tab.hidden = should_hide;

            if (is_being_hidden) {
                this.close_floating_content_in(tab);
            }
        }

        this.selected_tab = next_tab;

        // Keeps the attribute naming the tab actually shown; the reaction it causes finds nothing more to change.
        if (next_tab && this.getAttribute("selected") !== this.get_tab_name(next_tab)) {
            this.setAttribute("selected", this.get_tab_name(next_tab));
        }

        this.render_tab_bar();
    }

    /**
     * Closes everything floating from inside a tab - a select's dropdown, a date picker's popup - since it is not clipped by the tab and would stay on screen.
     * @param {HTMLElement} tab - The tab.
     */
    close_floating_content_in = (tab) => {
        for (let element of GalaxyUtils.get_descendants_through_shadow_roots(tab)) {
            if (typeof element.close_floating_content === "function") {
                element.close_floating_content();
            }
        }
    }

    /**
     * Selects a tab so its content can be seen, and refreshes the error marks. A galaxy-tab's reveal() calls it, as a galaxy-form does on the tabs around its first
     * invalid field.
     * @param {HTMLElement} tab - The tab.
     */
    reveal_tab = (tab) => {
        if (this.is_tab_selectable(tab)) {
            this.select_tab(this.get_tab_name(tab));
        }

        this.refresh_error_marks();
    }

    /***************  Tab Bar  ***************/

    /**
     * Rebuilds the tab bar from the galaxy-tab children, keeping focus on the focused tab.
     */
    render_tab_bar = () => {
        if (!this.tab_list) {
            return;
        }

        let focused_name = this.shadow.activeElement?.dataset?.tabName ?? null;
        let is_vertical = this.orientation === "vertical";
        let buttons = this.tabs.map((tab, index) => this.create_tab_button(tab, index));

        this.tab_list.replaceChildren(...buttons);
        this.tab_list.setAttribute("aria-orientation", is_vertical ? "vertical" : "horizontal");

        if (this.hasAttribute("label")) {
            this.tab_list.setAttribute("aria-label", this.getAttribute("label"));
        }
        else {
            this.tab_list.removeAttribute("aria-label");
        }

        if (focused_name !== null) {
            this.find_tab_button(focused_name)?.focus();
        }

        this.scroll_selected_tab_into_view();
        this.update_scroll_buttons();
    }

    /**
     * Creates a tab's button in the bar.
     * @param {HTMLElement} tab - The galaxy-tab.
     * @param {number} index - Its position.
     * @return {HTMLButtonElement} - The button.
     */
    create_tab_button = (tab, index) => {
        let name = this.get_tab_name(tab);
        let label = tab.getAttribute("label") || name;
        let is_selected = tab === this.selected_tab;

        let button = document.createElement("button");
        button.className = "tab";
        button.type = "button";
        button.id = `${this.tabs_id}-tab-${index}`;
        button.dataset.tabName = name;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(is_selected));
        button.tabIndex = is_selected ? 0 : -1;
        button.disabled = tab.hasAttribute("disabled");

        // An element reference may point from the shadow root out to the panel; an id reference cannot cross that boundary.
        if ("ariaControlsElements" in button) {
            button.ariaControlsElements = [tab];
        }

        let label_element = document.createElement("span");
        label_element.className = "tab-label";
        label_element.textContent = label;
        button.appendChild(label_element);

        let badge = tab.getAttribute("badge");

        if (badge) {
            let badge_element = document.createElement("span");
            badge_element.className = `tab-badge ${tab.getAttribute("badge-variant") === "danger" ? "danger" : "info"}`;
            badge_element.textContent = badge;
            button.appendChild(badge_element);
        }

        if (tab.hasAttribute("data-has-error")) {
            let error_mark = document.createElement("span");
            error_mark.className = "tab-error-mark";
            error_mark.setAttribute("aria-hidden", "true");
            button.appendChild(error_mark);
            button.setAttribute("aria-description", "Has errors");
        }

        // The panel cannot point into the shadow root at its button, so it is named directly.
        tab.setAttribute("aria-label", label);

        return button;
    }

    /**
     * Finds a tab's button in the bar.
     * @param {string} name - The tab's name.
     * @return {HTMLButtonElement|null} - The button, or null.
     */
    find_tab_button = (name) => {
        return Array.from(this.tab_list?.children ?? []).find((button) => button.dataset.tabName === name) ?? null;
    }

    /**
     * Scrolls the tab bar - and only the tab bar, never the page - so the selected tab is in view.
     */
    scroll_selected_tab_into_view = () => {
        let button = this.selected_tab ? this.find_tab_button(this.get_tab_name(this.selected_tab)) : null;

        if (!button) {
            return;
        }

        if (this.orientation === "vertical") {
            let button_bottom = button.offsetTop + button.offsetHeight;

            if (button.offsetTop < this.tab_list.scrollTop) {
                this.tab_list.scrollTop = button.offsetTop;
            }
            else if (button_bottom > this.tab_list.scrollTop + this.tab_list.clientHeight) {
                this.tab_list.scrollTop = button_bottom - this.tab_list.clientHeight;
            }

            return;
        }

        let button_right = button.offsetLeft + button.offsetWidth;

        if (button.offsetLeft < this.tab_list.scrollLeft) {
            this.tab_list.scrollLeft = button.offsetLeft;
        }
        else if (button_right > this.tab_list.scrollLeft + this.tab_list.clientWidth) {
            this.tab_list.scrollLeft = button_right - this.tab_list.clientWidth;
        }
    }

    /**
     * Shows each scroll arrow only while there is more of the horizontal tab bar to scroll to on its side.
     */
    update_scroll_buttons = () => {
        if (!this.tab_list) {
            return;
        }

        let is_horizontal = this.orientation === "horizontal";
        let can_scroll_back = is_horizontal && this.tab_list.scrollLeft > 0;
        let can_scroll_forward = is_horizontal && this.tab_list.scrollLeft + this.tab_list.clientWidth < this.tab_list.scrollWidth - 1;

        this.scroll_previous_button.hidden = !can_scroll_back;
        this.scroll_next_button.hidden = !can_scroll_forward;
    }

    /**
     * Scrolls the tab bar most of its width back or forward.
     * @param {number} direction - -1 for back, 1 for forward.
     */
    scroll_tab_bar = (direction) => {
        let distance = Math.max(this.tab_list.clientWidth * 0.8, 1);

        if (typeof this.tab_list.scrollBy === "function") {
            this.tab_list.scrollBy({left: distance * direction, behavior: "smooth"});
        }
        else {
            this.tab_list.scrollLeft += distance * direction;
        }
    }

    /***************  Error Marks  ***************/

    /**
     * Marks each tab that holds an invalid field, so the bar shows where the problems are.
     */
    refresh_error_marks = () => {
        let has_changed = false;

        for (let tab of this.tabs) {
            let has_error = GalaxyUtils.get_descendants_through_shadow_roots(tab).some(this.is_element_invalid);

            if (tab.hasAttribute("data-has-error") !== has_error) {
                tab.toggleAttribute("data-has-error", has_error);
                has_changed = true;
            }
        }

        if (has_changed) {
            this.render_tab_bar();
        }
    }

    /**
     * Gets whether an element is invalid: a native field matching `:invalid`, or a Galaxy field whose own validity says so.
     * @param {Element} element - The element.
     * @return {boolean} - True when invalid.
     */
    is_element_invalid = (element) => {
        let validity = element._internals?.validity;

        if (validity && typeof validity.valid === "boolean") {
            return !validity.valid;
        }

        let is_native_field = element.tagName === "INPUT" || element.tagName === "SELECT" || element.tagName === "TEXTAREA";

        return is_native_field && element.matches(":invalid");
    }

    /**
     * Refreshes the error marks once the current input or change has run its validation.
     */
    queue_error_mark_refresh = () => {
        if (this.is_error_refresh_queued) {
            return;
        }

        this.is_error_refresh_queued = true;

        setTimeout(() => {
            this.is_error_refresh_queued = false;
            this.refresh_error_marks();
        }, 0);
    }

    /***************  User Actions  ***************/

    /**
     * Selects the clicked tab.
     * @param {MouseEvent} event - The click event.
     */
    on_tab_list_click = (event) => {
        let button = event.target.closest?.("button.tab");

        if (button && !button.disabled) {
            this.select_tab_for_user(this.find_tab(button.dataset.tabName));
        }
    }

    /**
     * Moves through the tabs with the arrow keys, Home, and End, selecting each one reached and skipping disabled ones.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_tab_list_keydown = (event) => {
        let is_vertical = this.orientation === "vertical";
        let previous_key = is_vertical ? "ArrowUp" : "ArrowLeft";
        let next_key = is_vertical ? "ArrowDown" : "ArrowRight";
        let selectable_tabs = this.tabs.filter(this.is_tab_selectable);
        let current_button = event.target.closest?.("button.tab");
        let current_index = selectable_tabs.indexOf(this.find_tab(current_button?.dataset.tabName));
        let next_tab = null;

        if (selectable_tabs.length === 0) {
            return;
        }

        if (event.key === previous_key) {
            next_tab = selectable_tabs[(current_index - 1 + selectable_tabs.length) % selectable_tabs.length];
        }
        else if (event.key === next_key) {
            next_tab = selectable_tabs[(current_index + 1) % selectable_tabs.length];
        }
        else if (event.key === "Home") {
            next_tab = selectable_tabs[0];
        }
        else if (event.key === "End") {
            next_tab = selectable_tabs[selectable_tabs.length - 1];
        }
        else {
            return;
        }

        event.preventDefault();

        this.select_tab_for_user(next_tab);
        this.find_tab_button(this.get_tab_name(next_tab))?.focus();
    }

    /**
     * Rebuilds the bar when a galaxy-tab is added, removed, or has a bar attribute changed, keeping the selection on a tab that can still be selected.
     * @param {MutationRecord[]} mutations - The mutations.
     */
    on_tab_mutation = (mutations) => {
        let is_tab_change = mutations.some((mutation) => {
            if (mutation.type === "childList") {
                return mutation.target === this;
            }

            return mutation.target.parentElement === this && mutation.target.tagName === "GALAXY-TAB";
        });

        if (is_tab_change) {
            this.apply_selection();
        }
    }

    /***************  Remembering  ***************/

    /**
     * Reads the remembered selection: from the URL at once, or from the session store once it answers - unless the user has chosen a tab meanwhile.
     */
    read_remembered_selection = async () => {
        let mode = this.remember;
        let key = this.remember_key;

        if (!mode) {
            return;
        }

        if (!key) {
            console.warn(`${this.constructor.name}: remember="${mode}" needs a remember-key or an id to remember the selection under.`);
            return;
        }

        if (mode === REMEMBER_MODES.URL) {
            this.apply_remembered_name(new URLSearchParams(window.location.search).get(key));
        }
        else if (mode === REMEMBER_MODES.SESSION) {
            let session_store = window.galaxy_session_store;

            if (typeof session_store?.get !== "function") {
                this.warn_about_missing_session_store();
                return;
            }

            try {
                let name = await session_store.get(key);

                if (!this.has_user_chosen) {
                    this.apply_remembered_name(name);
                }
            }
            catch (error) {
                console.warn(`${this.constructor.name}: The remembered tab could not be read from the session.`, error);
            }
        }
        else {
            throw new Error(`Remember mode "${mode}" is not valid here.`);
        }
    }

    /**
     * Selects a remembered tab when it can still be selected, and writes it to state so bound controls follow.
     * @param {string|null} name - The remembered tab's name.
     */
    apply_remembered_name = (name) => {
        if (!this.is_tab_selectable(this.find_tab(name))) {
            return;
        }

        this.select_tab(name);
        this.write_state_value();
    }

    /**
     * Remembers the selected tab where `remember` says.
     */
    write_remembered_selection = () => {
        let mode = this.remember;
        let key = this.remember_key;

        if (!mode || !key || !this.selected_tab) {
            return;
        }

        let name = this.get_tab_name(this.selected_tab);

        if (mode === REMEMBER_MODES.URL) {
            let url = new URL(window.location.href);

            url.searchParams.set(key, name);
            window.history.replaceState(window.history.state, "", url);
        }
        else if (mode === REMEMBER_MODES.SESSION) {
            let session_store = window.galaxy_session_store;

            if (typeof session_store?.set !== "function") {
                this.warn_about_missing_session_store();
                return;
            }

            session_store.set(key, name);
        }
        else {
            throw new Error(`Remember mode "${mode}" is not valid here.`);
        }
    }

    /**
     * Follows the URL when the user goes back or forward to a page whose URL names another tab.
     */
    on_popstate = () => {
        if (this.remember === REMEMBER_MODES.URL && this.remember_key) {
            this.apply_remembered_name(new URLSearchParams(window.location.search).get(this.remember_key));
        }
    }

    /**
     * Warns, once per page, that `remember="session"` has no store to use.
     */
    warn_about_missing_session_store = () => {
        if (GalaxyTabs.has_warned_about_missing_session_store) {
            return;
        }

        GalaxyTabs.has_warned_about_missing_session_store = true;
        console.warn(`${this.constructor.name}: remember="session" needs window.galaxy_session_store ({get(key), set(key, value)}) to be registered by the app.`);
    }

    /***************  State Binding  ***************/

    /**
     * Binds the selected tab's name to `property-name` in the state manager: a state value already there selects its tab, and otherwise the selected tab's name is
     * written to it.
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
            state_manager.set(this.property_name, this.selected, this);
        }

        state_manager.bind(this.property_name, this);
        this.is_state_bound = true;
    }

    /**
     * Selects the tab a state change names, without dispatching `tab_change`. The state manager calls it for a change made anywhere else.
     * @param {string} value - The tab's name.
     */
    apply_state_value = (value) => {
        if (this.is_tab_selectable(this.find_tab(value))) {
            this.select_tab(value);
        }
    }

    /**
     * Writes the selected tab's name to state, which updates everything else bound to it.
     */
    write_state_value = () => {
        if (this.is_state_bound && this.property_name && this.selected_tab) {
            window.galaxy_state_manager?.set(this.property_name, this.selected, this);
        }
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.tabs_container = await this.get_template();
        this.shadow.appendChild(this.tabs_container);

        this.tab_list = this.tabs_container.querySelector(".tab-list");
        this.scroll_previous_button = this.tabs_container.querySelector(".scroll-previous");
        this.scroll_next_button = this.tabs_container.querySelector(".scroll-next");

        this.listeners_controller = new AbortController();

        let options = {signal: this.listeners_controller.signal};

        this.tab_list.addEventListener("click", this.on_tab_list_click, options);
        this.tab_list.addEventListener("keydown", this.on_tab_list_keydown, options);
        this.tab_list.addEventListener("scroll", this.update_scroll_buttons, {...options, passive: true});
        this.scroll_previous_button.addEventListener("click", () => this.scroll_tab_bar(-1), options);
        this.scroll_next_button.addEventListener("click", () => this.scroll_tab_bar(1), options);
        this.addEventListener("input", this.queue_error_mark_refresh, options);
        this.addEventListener("change", this.queue_error_mark_refresh, options);
        window.addEventListener("popstate", this.on_popstate, options);

        this.tab_observer = new MutationObserver(this.on_tab_mutation);
        this.tab_observer.observe(this, {childList: true, subtree: true, attributes: true, attributeFilter: TAB_ATTRIBUTE_NAMES});

        if (typeof ResizeObserver === "function") {
            this.resize_observer = new ResizeObserver(this.update_scroll_buttons);
            this.resize_observer.observe(this.tab_list);
        }

        // The starting tab, lowest priority first: `selected` (or the first enabled tab), then state, then the URL; the session answers later.
        this.apply_selection();
        this.connect_state_binding();
        this.read_remembered_selection();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.listeners_controller?.abort();
        this.listeners_controller = null;

        this.tab_observer?.disconnect();
        this.tab_observer = null;
        this.resize_observer?.disconnect();
        this.resize_observer = null;

        if (this.is_state_bound && this.property_name) {
            window.galaxy_state_manager?.unbind?.(this.property_name, this);
        }

        this.is_state_bound = false;

        // Removed so a reconnect, which runs on_create again, does not render a second tab bar.
        this.tabs_container?.remove();
        this.tabs_container = null;
        this.tab_list = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return TABS_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            :host {
                display: block;
                color: var(--text-dark);
            }

            .galaxy-tabs {
                display: flex;
                flex-direction: column;
            }

            :host([orientation="vertical"]) .galaxy-tabs {
                flex-direction: row;
            }

            .tab-bar {
                display: flex;
                align-items: stretch;
                border-bottom: 1px solid var(--lightgrey);
            }

            :host([orientation="vertical"]) .tab-bar {
                flex: 0 0 auto;
                flex-direction: column;
                max-width: 16rem;
                border-bottom: none;
                border-right: 1px solid var(--lightgrey);
            }

            /* Scrolls under its arrows; the scrollbar itself is hidden */
            .tab-list {
                position: relative;
                display: flex;
                flex: 1 1 auto;
                min-width: 0;
                overflow-x: auto;
                scrollbar-width: none;
            }

            .tab-list::-webkit-scrollbar {
                display: none;
            }

            :host([orientation="vertical"]) .tab-list {
                flex-direction: column;
                overflow-x: hidden;
                overflow-y: auto;
            }

            .tab {
                position: relative;
                display: inline-flex;
                flex: 0 0 auto;
                align-items: center;
                gap: 0.4rem;
                margin-bottom: -1px;
                padding: 0.5rem 1rem;
                border: none;
                border-bottom: 2px solid transparent;
                font: inherit;
                color: var(--text-grey);
                white-space: nowrap;
                background: none;
                cursor: pointer;
            }

            :host([orientation="vertical"]) .tab {
                justify-content: flex-start;
                margin-bottom: 0;
                margin-right: -1px;
                border-bottom: none;
                border-right: 2px solid transparent;
                text-align: left;
            }

            .tab:hover:not(:disabled) {
                color: var(--text-dark);
                background-color: rgba(0, 0, 0, 0.04);
            }

            .tab[aria-selected="true"] {
                color: var(--blue);
                border-bottom-color: var(--blue);
            }

            :host([orientation="vertical"]) .tab[aria-selected="true"] {
                border-right-color: var(--blue);
            }

            .tab:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: -2px;
            }

            .tab:disabled {
                opacity: 0.45;
                cursor: default;
            }

            .tab-badge {
                min-width: 1.25rem;
                padding: 0 0.4rem;
                font-size: 0.75rem;
                line-height: 1.25rem;
                text-align: center;
                color: #ffffff;
                background-color: var(--blue);
                border-radius: 0.625rem;
            }

            .tab-badge.danger {
                background-color: var(--red);
            }

            .tab-error-mark {
                width: 0.5rem;
                height: 0.5rem;
                background-color: var(--red);
                border-radius: 50%;
            }

            .scroll-button {
                flex: 0 0 auto;
                width: 2rem;
                padding: 0;
                border: none;
                color: var(--text-grey);
                background-color: #ffffff;
                cursor: pointer;
            }

            .scroll-button:hover {
                color: var(--text-dark);
                background-color: rgba(0, 0, 0, 0.04);
            }

            .scroll-button[hidden] {
                display: none;
            }

            .scroll-button svg {
                width: 1rem;
                height: 1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .tab-panels {
                flex: 1 1 auto;
                min-width: 0;
                padding-top: 0.75rem;
            }

            :host([orientation="vertical"]) .tab-panels {
                padding-top: 0;
                padding-left: 1rem;
            }
        `;
    }
}
