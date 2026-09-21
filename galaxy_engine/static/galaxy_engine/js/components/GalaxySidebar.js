/**
 * @file GalaxySidebar.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */
import {GalaxyNavbarBase, LAYOUT_OPTIONS} from "./GalaxyNavbarBase.js";

const COLLAPSE_STORAGE_KEY_PREFIX = "galaxy_sidebar_collapsed_";

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
     * Handles changes to the observed 'collapsed' attribute - persists the new state and refreshes the collapse
     * toggle button so its icon/label stay in sync.
     */
    handle_observed_collapsed = () => {
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
        this.restore_collapsed_state();
    }

    /**
     * Builds the localStorage key used to persist the collapsed rail state, scoped to this element's id if it has
     * one so multiple sidebars on a page don't clobber each other.
     * @return {string}
     */
    get_collapse_storage_key = () => `${COLLAPSE_STORAGE_KEY_PREFIX}${this.id || "default"}`;

    /**
     * Persists the current collapsed state to localStorage so the rail remembers its state across page loads.
     */
    persist_collapsed_state = () => {
        try {
            window.localStorage.setItem(this.get_collapse_storage_key(), this.collapsed ? "true" : "false");
        }
        catch (error) {
            console.warn(`${this.constructor.name}: Unable to persist collapsed state.`, error);
        }
    }

    /**
     * Restores a previously persisted collapsed state from localStorage, if any exists.
     */
    restore_collapsed_state = () => {
        let stored_value;

        try {
            stored_value = window.localStorage.getItem(this.get_collapse_storage_key());
        }
        catch (error) {
            console.warn(`${this.constructor.name}: Unable to read persisted collapsed state.`, error);

            return;
        }

        if (stored_value !== null) {
            this.collapsed = stored_value === "true";
        }
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
                                        border-color: transparent transparent var(--link-text, --default-link-text) transparent;
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
                border-top: 1px solid var(--nav-border, --default-nav-border);
                color: var(--link-text, --default-link-text);
                padding: 0.75rem;
                cursor: pointer;

                &:hover {
                    background-color: var(--link-bg, --default-link-bg);
                }

                &:focus-visible {
                    outline: 2px solid var(--link-hover-bg, --default-link-hover-bg);
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
                            border-top: 1px solid var(--nav-border, --default-nav-border);

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
