/**
 * @file GalaxySidebar.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */
import {DEFAULT_THEME_COLORS, GalaxyNavbarBase, LAYOUT_OPTIONS} from "./GalaxyNavbarBase.js";

const COLLAPSE_STORAGE_KEY_PREFIX = "galaxy_sidebar_collapsed_";

// Where the collapsed state is remembered: the browser's localStorage (the default), the app's session through window.galaxy_session_store, or nowhere.
const REMEMBER_MODES = {
    LOCAL: "local",
    SESSION: "session",
    NONE: "none",
};

// Custom theme (not part of the built-in theme list in GalaxyNavbarBase) - passed through as a JSON string so
// add_theme_css()'s custom-theme fallback path gets exercised instead of a preset "light"/"dark" mode lookup.
const CUSTOM_THEME_FOREST = {
    nav_bg: "#0b2e13",
    nav_text: "#d1fae5",
    nav_border: "#166534",
    link_bg: "#14532d",
    link_text: "#d1fae5",
    link_hover_bg: "#22c55e",
    link_hover_text: "#052e16",
    font_family: "Inter, sans-serif"
};

// Reference/test config: icon-fallback letters (unicon items) and a nested-children dropdown. Not applied
// automatically - pass it through `config` (e.g. `element.config = TEST_SIDEBAR_CONFIG`) to see it rendered.
export const TEST_SIDEBAR_CONFIG = {
    theme: JSON.stringify(CUSTOM_THEME_FOREST),
    collapsible: true,
    brand: {
        name: "GX",
        logo_url: "",
        link: "/",
        tagline: "",
        should_show: true
    },
    navigation: [
        {label: "Home", icon: "fas fa-house", link: "/"},
        {label: "Analytics", link: "/analytics"},
        {
            label: "Team",
            children: [
                {label: "Members", link: "/team/members"},
                {label: "Invite", link: "/team/invite"}
            ]
        },
        {label: "General", is_heading: true},
        {label: "Preferences", icon: "fas fa-sliders", link: "/settings/preferences"},
        {label: "Billing", link: "/settings/billing"}
    ]
};

/**
 * @class
 * @description
 *      A vertical sidebar navigation component: a collapsible icon-only rail (state persisted to localStorage),
 *      nested-children dropdowns, icon-fallback badges for unicon items, and current-page highlighting.
 *      {@link GalaxyNavbar} is the horizontal counterpart - both extend {@link GalaxyNavbarBase}.
 * @extends GalaxyNavbarBase
 */
export class GalaxySidebar extends GalaxyNavbarBase {
    /**
     * {@link GalaxyNavbarBase#layout}
     * @override
     */
    static get layout_option() {return LAYOUT_OPTIONS.VERTICAL;}

    /**
     * {@link GalaxyHTMLComponentBase#pre_observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [...super.observed_attributes, "collapsed"];
    }

    /**
     * {@link GalaxyNavbarBase#attribute_handlers}
     * @override
     */
    get attribute_handlers() {
        return {
            ...super.attribute_handlers,
            "collapsed": this.handle_observed_collapsed
        };
    }

    /**
     * {@link GalaxyNavbarBase#default_config}
     * @override
     */
    get default_config() {
        return {...super.default_config, collapsible: true};
    }

    /**
     * Gets the collapsed state of the sidebar - collapses the rail down to an icon-only width.
     * @return {boolean} - The collapsed state of the sidebar.
     */
    get collapsed() {return this.hasAttribute("collapsed");}

    /**
     * Sets the collapsed state of the sidebar.
     * @param {boolean} value - The collapsed state of the sidebar.
     */
    set collapsed(value) {
        if (value) {
            this.setAttribute("collapsed", "");
        }
        else {
            this.removeAttribute("collapsed");
        }
    }

    /**
     * Gets where the collapsed state is remembered: `"local"` (the default) keeps it in the browser's localStorage, `"session"` in the app's session through
     * `window.galaxy_session_store`, which the app registers, and `"none"` nowhere.
     * @return {string} - One of the remember modes; an unrecognized value is `"local"`.
     */
    get remember() {
        let remember = this.getAttribute("remember");

        return Object.values(REMEMBER_MODES).includes(remember) ? remember : REMEMBER_MODES.LOCAL;
    }

    /**
     * Handles changes to the observed 'collapsed' attribute - persists the new state and refreshes the collapse
     * toggle button so its icon/label stay in sync.
     */
    handle_observed_collapsed = () => {
        // Counted so a remembered state that arrives after the user has already toggled the rail does not undo their choice - see restore_collapsed_state.
        this.collapsed_change_count = (this.collapsed_change_count || 0) + 1;
        this.persist_collapsed_state();

        if (this.nav_menu) {
            this.build_collapse_toggle();
        }
    }

    /**
     * {@link GalaxyHTMLComponentBase#post_on_create}
     * @note `on_create = async () => {...}` (GalaxyNavbarBase's own hook) is a class field, not a prototype
     * method, so `super.on_create()` isn't reachable from here - class fields are assigned per-instance
     * during construction, never onto the prototype chain, so `super.<field>` always resolves to
     * undefined. post_on_create is the hook GalaxyHTMLComponentBase's lifecycle already runs immediately
     * after on_create for exactly this reason: extending a class-field hook without needing `super`.
     * @override
     */
    post_on_create = async () => {
        // Not awaited: a session store may answer late, and creation does not wait for it.
        this.restore_collapsed_state();
    }

    /**
     * Builds the key used to persist the collapsed rail state, scoped to this element's id if it has
     * one so multiple sidebars on a page don't clobber each other.
     * @return {string}
     */
    get_collapse_storage_key = () => `${COLLAPSE_STORAGE_KEY_PREFIX}${this.id || "default"}`;

    /**
     * Persists the current collapsed state where {@link remember} says, so the rail remembers its state across page loads.
     */
    persist_collapsed_state = () => {
        let mode = this.remember;
        let stored_value = this.collapsed ? "true" : "false";

        if (mode === REMEMBER_MODES.LOCAL) {
            try {
                window.localStorage.setItem(this.get_collapse_storage_key(), stored_value);
            }
            catch (error) {
                console.warn(`${this.constructor.name}: Unable to persist collapsed state.`, error);
            }
        }
        else if (mode === REMEMBER_MODES.SESSION) {
            let session_store = window.galaxy_session_store;

            if (typeof session_store?.set !== "function") {
                this.warn_about_missing_session_store();
                return;
            }

            session_store.set(this.get_collapse_storage_key(), stored_value);
        }
        else if (mode === REMEMBER_MODES.NONE) {
            return;
        }
        else {
            throw new Error(`Remember mode "${mode}" is not valid here.`);
        }
    }

    /**
     * Restores a previously persisted collapsed state from where {@link remember} says, if any exists. The session store may answer later; a state that arrives after
     * the user has toggled the rail is ignored.
     */
    restore_collapsed_state = async () => {
        let mode = this.remember;
        let stored_value = null;

        if (mode === REMEMBER_MODES.LOCAL) {
            try {
                stored_value = window.localStorage.getItem(this.get_collapse_storage_key());
            }
            catch (error) {
                console.warn(`${this.constructor.name}: Unable to read persisted collapsed state.`, error);

                return;
            }
        }
        else if (mode === REMEMBER_MODES.SESSION) {
            let session_store = window.galaxy_session_store;

            if (typeof session_store?.get !== "function") {
                this.warn_about_missing_session_store();
                return;
            }

            let change_count_before = this.collapsed_change_count || 0;

            try {
                stored_value = await session_store.get(this.get_collapse_storage_key());
            }
            catch (error) {
                console.warn(`${this.constructor.name}: Unable to read persisted collapsed state.`, error);

                return;
            }

            if ((this.collapsed_change_count || 0) !== change_count_before) {
                return;
            }
        }
        else if (mode === REMEMBER_MODES.NONE) {
            return;
        }
        else {
            throw new Error(`Remember mode "${mode}" is not valid here.`);
        }

        if (stored_value !== null && stored_value !== undefined) {
            this.collapsed = String(stored_value) === "true";
        }
    }

    /**
     * Warns, once per page, that `remember="session"` has no store to use.
     */
    warn_about_missing_session_store = () => {
        if (GalaxySidebar.has_warned_about_missing_session_store) {
            return;
        }

        GalaxySidebar.has_warned_about_missing_session_store = true;
        console.warn(`${this.constructor.name}: remember="session" needs window.galaxy_session_store ({get(key), set(key, value)}) to be registered by the app.`);
    }

    /**
     * {@link GalaxyNavbarBase#build_collapse_toggle}
     * @override
     */
    build_collapse_toggle = () => {
        let existing_toggle = this.nav_menu.querySelector(".galaxy-nav-collapse-toggle");

        if (existing_toggle) {
            existing_toggle.remove();
        }

        // this._config (the actual applied config), not this.config (the getter, which re-parses the
        // `config` attribute and returns undefined whenever _config was set without ever touching the
        // attribute, e.g. the default_config fallback in on_create).
        if (this._config?.collapsible === false) {
            return;
        }

        let toggle_button = document.createElement("button");
        toggle_button.type = "button";
        toggle_button.classList.add("galaxy-nav-collapse-toggle");
        toggle_button.setAttribute("aria-label", this.collapsed ? "Expand navigation" : "Collapse navigation");
        toggle_button.setAttribute("aria-expanded", (!this.collapsed).toString());

        let icon = document.createElement("i");
        icon.className = this.collapsed ? "fas fa-angles-right" : "fas fa-angles-left";
        toggle_button.appendChild(icon);

        toggle_button.addEventListener("click", this.on_collapse_toggle_click);

        this.nav_menu.appendChild(toggle_button);
    }

    /**
     * Handles a click of the collapse/expand toggle button.
     */
    on_collapse_toggle_click = () => {
        this.collapsed = !this.collapsed;
    }

    /**
     * {@link GalaxyNavbarBase#component_css}
     * @override
     */
    get component_css() {
        return `
            ${super.component_css}

            :host {
                height: 100%;

                .galaxy-nav {
                    flex-direction: column;

                    > ul {
                        flex-direction: column;

                        > .galaxy-nav-button {
                            width: 100%;
                        }

                        > li {
                            > a {
                                width: 100%;
                            }

                            &:has(div[dropdown]) {
                                > a {
                                    width: 100%;

                                    &:after {
                                        content: "";
                                        margin-top: 0.5rem;
                                        margin-left: 0.5rem;
                                        border-width: 0.4rem;
                                        border-style: solid;
                                        border-color: transparent transparent var(--link-text, ${DEFAULT_THEME_COLORS.link_text}) transparent;
                                        transform: rotateZ(180deg);
                                        position: absolute;
                                        right: 0.625rem;
                                    }
                                }
                            }

                            &.nav-heading {
                                padding: 0.25rem 0.75rem;
                            }
                        }
                    }
                }
            }

            .galaxy-nav-collapse-toggle {
                margin-top: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: none;
                border-top: 1px solid var(--nav-border, ${DEFAULT_THEME_COLORS.nav_border});
                color: var(--link-text, ${DEFAULT_THEME_COLORS.link_text});
                padding: 0.75rem;
                cursor: pointer;

                &:hover {
                    background-color: var(--link-bg, ${DEFAULT_THEME_COLORS.link_bg});
                }

                &:focus-visible {
                    outline: 2px solid var(--link-hover-bg, ${DEFAULT_THEME_COLORS.link_hover_bg});
                    outline-offset: -2px;
                }
            }

            :host([collapsed]) {
                .galaxy-nav {
                    width: max-content;

                    .brand {
                        span, p {
                            display: none;
                        }

                        a {
                            justify-content: center;
                        }
                    }

                    > ul > .galaxy-nav-button {
                        justify-content: center;

                        .nav-label {
                            display: none;
                        }

                        i, .nav-icon-fallback {
                            margin-right: 0;
                        }
                    }

                    > ul > li {
                        > a {
                            justify-content: center;

                            .nav-label {
                                display: none;
                            }

                            i, .nav-icon-fallback {
                                margin-right: 0;
                            }
                        }

                        &.nav-heading {
                            padding: 0.5rem 0;
                            border-top: 1px solid var(--nav-border, ${DEFAULT_THEME_COLORS.nav_border});

                            .nav-label {
                                display: none;
                            }
                        }
                    }
                }
            }
        `;
    }
}
