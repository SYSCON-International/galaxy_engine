/**
 * @file GalaxyNavbarBase.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */
import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

export const LAYOUT_OPTIONS = {
    HORIZONTAL: "horizontal",
    VERTICAL: "vertical"
}

export const DEFAULT_THEME = "light";

const DEFAULT_CONFIG = {
    brand: {
        name: "Galaxy Engine",
        logo_url: "",
        link: "/",
        tagline: "",
        should_show: false
    },
    theme: DEFAULT_THEME,
    navigation: []
};

const themes = [
    {
        mode: "light",
        nav_bg: "#ffffff",
        nav_text: "#000000",
        nav_border: "#bfbfbf",
        link_bg: "#f3f4f6",
        link_text: "#000000",
        link_hover_bg: "#3b82f6",
        link_hover_text: "#e0e7ff",
        font_family: "Inter, sans-serif"
    },
    {
        mode: "dark",
        nav_bg: "#0f172a",
        nav_text: "#ffffff",
        nav_border: "#1e293b",
        link_bg: "#1e293b",
        link_text: "#ffffff",
        link_hover_bg: "#38bdf8",
        link_hover_text: "#1e293b",
        font_family: "Inter, sans-serif"
    },
]

// Ready-to-use custom themes (not part of the built-in `mode`-keyed `themes` list above). Pass one through as
// `theme: JSON.stringify(CUSTOM_THEME_X)` in a config object - the same mechanism GalaxyNavbar/GalaxySidebar's own
// test configs already use for their Sunset/Forest themes - to exercise add_theme_css()'s custom-theme fallback
// path instead of a preset "light"/"dark" mode lookup.
export const CUSTOM_THEME_OCEAN = {
    nav_bg: "#f0f9ff",
    nav_text: "#0c4a6e",
    nav_border: "#7dd3fc",
    link_bg: "#e0f2fe",
    link_text: "#075985",
    link_hover_bg: "#0ea5e9",
    link_hover_text: "#f0f9ff",
    font_family: "Inter, sans-serif"
};

export const CUSTOM_THEME_GRAPE = {
    nav_bg: "#2e1065",
    nav_text: "#ede9fe",
    nav_border: "#6d28d9",
    link_bg: "#4c1d95",
    link_text: "#ede9fe",
    link_hover_bg: "#a855f7",
    link_hover_text: "#2e1065",
    font_family: "Inter, sans-serif"
};

export const CUSTOM_THEME_ROSE = {
    nav_bg: "#fff1f2",
    nav_text: "#881337",
    nav_border: "#fda4af",
    link_bg: "#ffe4e6",
    link_text: "#9f1239",
    link_hover_bg: "#e11d48",
    link_hover_text: "#fff1f2",
    font_family: "Inter, sans-serif"
};

export const NAV_HTML_TEMPLATE = `
    <div class="galaxy-nav">
        <ul class="nav-left"></ul>
        <ul class="nav-center"></ul>
        <ul class="nav-right"></ul>
    </div>
`;

/**
 * @class
 * @abstract
 * @description
 *      Shared base for Galaxy's navigation components - config/theme handling, dropdown interaction (hover,
 *      click/tap, keyboard, outside-click/Escape dismissal), nav item/icon building, and current-page highlighting.
 *      Never registered as a custom element itself; {@link GalaxyNavbar} (horizontal) and {@link GalaxySidebar}
 *      (vertical/collapsible) extend it with the pieces specific to their own layout.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyNavbarBase extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(NAV_HTML_TEMPLATE);
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return [
            "theme",
            "config"
        ];
    }

    /**
     * Attribute-name -> handler lookup consumed by {@link attribute_changed_callback}. Subclasses that observe
     * additional attributes extend this (via `...super.attribute_handlers`) rather than overriding
     * `attribute_changed_callback` itself.
     * @return {Object<string, Function>}
     */
    get attribute_handlers() {
        return {
            "theme": this.handle_observed_theme,
            "config": this.handle_observed_config
        };
    }

    /**
     * {@link GalaxyHTMLComponentBase#pre_attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        this.attribute_handlers[name]?.(new_value);
    }

    /**
     * Gets the current config.
     * @returns {Object|undefined} - The config value of the form.
     */
    get config() {
        return this._config;
    }

    /**
     * Sets the config attribute of the Galaxy form.
     * @note Deliberately does not reflect back onto the `config` attribute. `config` is an observed
     * attribute (so a script can `setAttribute('config', json)` directly and have it apply), but
     * build_nav_sections() is async and rebuilds by clearing then re-appending nav items one at a time -
     * reflecting here would make every property-based `.config =` assignment also trigger the attribute's
     * own (async) reaction, running a second, overlapping build_nav_sections() concurrently with the first
     * and interleaving their DOM writes into a corrupted nav. apply_config() below never reflects either,
     * for the same reason.
     * @param value {string|Object} - The config value of the form.
     */
    set config(value) {
        this.apply_config(value);
    }

    /**
     * Parses `value` (a JSON string, as the `config` attribute stores it, or a plain object) into
     * `this._config` and rebuilds the nav if it's already built. Shared by the `config` property setter and
     * the `config` attribute reaction ({@link handle_observed_config}) so both paths apply the same
     * parsing/fallback.
     * @param {string|Object} value - The config value to apply.
     */
    apply_config = (value) => {
        let parsed_config;

        if (typeof value === "string") {
            try {
                parsed_config = JSON.parse(value);
            }
            catch (error) {
                console.warn(`${this.constructor.name}: Invalid config JSON string, falling back to default config.`);
                parsed_config = this.default_config;
            }
        }
        else if (value && typeof value === "object") {
            parsed_config = value;
        }
        else {
            console.warn(`${this.constructor.name}: Invalid config value, falling back to default config.`);
            parsed_config = this.default_config;
        }

        this._config = parsed_config;

        if (this.nav_menu) {
            this.build_nav_sections();
        }
    }

    /**
     * Gets the theme attribute of the Galaxy form.
     * @return {string} - The theme value of the form.
     */
    get theme() {return this.getAttribute("theme")}

    /**
     * Sets the theme attribute of the Galaxy form.
     * @param {string} value - The theme value of the form.
     */
    set theme(value) {
        if (value) {
            this.setAttribute("theme", value.toString());
            this.add_theme_css();
        }
        else {
            this.removeAttribute("theme");
        }
    }

    /**
     * The fixed layout orientation for this nav type. Set by each concrete subclass's `layout_option` static
     * getter (e.g. {@link GalaxyNavbar} returns "horizontal", {@link GalaxySidebar} returns "vertical") - unlike
     * theme, this never changes at runtime, so it isn't attribute-backed or independently settable.
     * @return {string}
     */
    get layout() {return this.constructor.layout_option;}

    /**
     * Gets the disable-hover state of the Galaxy nav. When set, dropdowns only open via click/tap or keyboard
     * activation instead of also opening on mouse hover.
     * @return {boolean} - The disable-hover state of the nav.
     */
    get disable_hover() {return this.hasAttribute("disable-hover");}

    /**
     * Sets the disable-hover state of the Galaxy nav.
     * @param {boolean} value - The disable-hover state of the nav.
     */
    set disable_hover(value) {
        if (value) {
            this.setAttribute("disable-hover", "");
        }
        else {
            this.removeAttribute("disable-hover");
        }
    }

    /**
     * The default config used when no `config` attribute/property has been supplied. Subclasses override to layer
     * on their own defaults (e.g. {@link GalaxySidebar} adds `collapsible`).
     * @return {Object}
     */
    get default_config() {
        return DEFAULT_CONFIG;
    }

    /**
     * Handles changes to the observed 'theme' attribute, including its removal (add_theme_css() falls back
     * to the default theme when this.theme is empty, so it's always safe to call here).
     * @param {string} new_value - The new value of the theme attribute.
     */
    handle_observed_theme = (new_value) => {
        this.add_theme_css();
    }

    /**
     * Handles changes to the observed 'config' attribute - e.g. a script calling
     * `el.setAttribute('config', json)` directly rather than through the `config` property setter.
     * @param {string} new_value - The new value of the config attribute.
     */
    handle_observed_config = (new_value) => {
        if (!this.nav_menu) {
            return; // Initial load: on_create reads the attribute directly instead of relying on this reaction's timing.
        }

        this.apply_config(new_value);
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        if (!this._config) {
            // A `config` attribute present in markup at upgrade time isn't guaranteed to have been applied
            // yet - attributeChangedCallback reactions race against connectedCallback (both are async
            // methods with internal awaits; see the identical fix in GalaxySelectBase.on_create). Read it
            // directly instead of trusting timing. apply_config() no-ops the rebuild here since nav_menu
            // doesn't exist yet - the unconditional build_nav_sections() call below is the real first build.
            if (this.hasAttribute("config")) {
                this.apply_config(this.getAttribute("config"));
            }
            else {
                this._config = this.default_config;
            }
        }

        // Only fall back to config.theme (or the default) the first time - an explicitly-set `theme`
        // attribute (from markup, or set before this element connected) must win over the config's own
        // theme, not be silently clobbered by it.
        if (!this.hasAttribute("theme")) {
            this.theme = this._config?.theme || DEFAULT_THEME;
        }

        this.add_theme_css();

        // Build the nav
        if (!this.nav_menu) {
            this.nav_menu = await this.get_template(NAV_HTML_TEMPLATE);
            this.shadow.appendChild(this.nav_menu);

            this.attach_nav_event_listeners();
        }

        this.nav_left = this.nav_menu.querySelector(".nav-left");
        this.nav_center = this.nav_menu.querySelector(".nav-center");
        this.nav_right = this.nav_menu.querySelector(".nav-right");

        await this.build_nav_sections();
    }

    /**
     * Attaches the delegated event listeners that drive dropdown interaction (hover, click/tap, and keyboard) and
     * outside-click/Escape dismissal. Only ever called once per element instance.
     */
    attach_nav_event_listeners = () => {
        this.nav_menu.addEventListener("mouseover", this.on_nav_mouse_over);
        this.nav_menu.addEventListener("mouseout", this.on_nav_mouse_out);
        this.nav_menu.addEventListener("click", this.on_nav_item_click);
        this.nav_menu.addEventListener("keydown", this.on_nav_item_keydown);

        document.addEventListener("click", this.on_document_click);
        document.addEventListener("keydown", this.on_document_keydown);
    }

    /**
     * Opens a dropdown-bearing nav item's own dropdown on hover, unless {@link disable_hover} is set.
     * @param {MouseEvent} event - The mouseover event.
     */
    on_nav_mouse_over = (event) => {
        if (this.disable_hover) {
            return;
        }

        let li = event.target.closest?.("li");

        if (!li?.querySelector(":scope > div[dropdown]")) {
            return;
        }

        this.open_dropdown(li);
    }

    /**
     * Closes a dropdown-bearing nav item's own dropdown once the mouse truly leaves that item (not merely moving
     * from the trigger into its own dropdown panel), unless {@link disable_hover} is set.
     * @param {MouseEvent} event - The mouseout event.
     */
    on_nav_mouse_out = (event) => {
        if (this.disable_hover) {
            return;
        }

        let li = event.target.closest?.("li");

        if (!li?.querySelector(":scope > div[dropdown]")) {
            return;
        }

        if (li.contains(event.relatedTarget)) {
            return;
        }

        this.close_dropdown(li);
    }

    /**
     * Toggles a dropdown-bearing nav item's own dropdown open/closed on click or tap. Always active regardless of
     * {@link disable_hover}, so touch and keyboard users can always reach dropdown content.
     * @param {MouseEvent} event - The click event.
     */
    on_nav_item_click = (event) => {
        let trigger_link = event.target.closest?.("a");

        if (!trigger_link || trigger_link.parentElement?.tagName !== "LI") {
            return;
        }

        let li = trigger_link.parentElement;

        if (!li.querySelector(":scope > div[dropdown]")) {
            return;
        }

        // Placeholder links (dropdown-only parents with no real destination) shouldn't navigate on click.
        if (trigger_link.getAttribute("href") === "#") {
            event.preventDefault();
        }

        this.toggle_dropdown(li);

        event.stopPropagation();
    }

    /**
     * Handles Space-key activation of a dropdown trigger (Enter is already handled natively as a click on anchors).
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_nav_item_keydown = (event) => {
        if (event.key !== " " && event.key !== "Spacebar") {
            return;
        }

        let trigger_link = event.target.closest?.("a");

        if (!trigger_link || trigger_link.parentElement?.tagName !== "LI") {
            return;
        }

        let li = trigger_link.parentElement;

        if (!li.querySelector(":scope > div[dropdown]")) {
            return;
        }

        event.preventDefault();

        this.toggle_dropdown(li);
    }

    /**
     * Closes every open dropdown belonging to this nav when the user clicks anywhere outside of it.
     * @param {MouseEvent} event - The click event.
     */
    on_document_click = (event) => {
        // composedPath() pierces the shadow boundary, so this correctly detects clicks inside this nav's shadow DOM.
        if (event.composedPath().includes(this)) {
            return;
        }

        this.close_all_dropdowns();
    }

    /**
     * Closes any open dropdown belonging to this nav on Escape and returns focus to its trigger.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_document_keydown = (event) => {
        if (event.key !== "Escape") {
            return;
        }

        let open_item = this.nav_menu?.querySelector("li[open]");

        if (!open_item) {
            return;
        }

        let trigger_link = open_item.querySelector(":scope > a");

        this.close_all_dropdowns();

        trigger_link?.focus();
    }

    /**
     * Opens a single nav item's dropdown.
     * @param {Element} li - The nav item's <li> element.
     */
    open_dropdown = (li) => {
        li.setAttribute("open", "");
        li.querySelector(":scope > a")?.setAttribute("aria-expanded", "true");
    }

    /**
     * Closes a single nav item's dropdown, along with any of its own nested open dropdowns.
     * @param {Element} li - The nav item's <li> element.
     */
    close_dropdown = (li) => {
        li.removeAttribute("open");
        li.querySelector(":scope > a")?.setAttribute("aria-expanded", "false");

        li.querySelectorAll("li[open]").forEach(this.close_dropdown);
    }

    /**
     * Toggles a single nav item's dropdown. Closes every other open dropdown first, so click/tap interaction behaves
     * like an accordion rather than allowing unrelated branches to stay open at once.
     * @param {Element} li - The nav item's <li> element.
     */
    toggle_dropdown = (li) => {
        if (li.hasAttribute("open")) {
            this.close_dropdown(li);

            return;
        }

        this.close_all_dropdowns();
        this.open_dropdown(li);
    }

    /**
     * Closes every open dropdown in this nav.
     */
    close_all_dropdowns = () => {
        this.nav_menu?.querySelectorAll("li[open]").forEach(this.close_dropdown);
    }

    /**
     * Applies this instance's theme as CSS custom properties directly on the host element (rather than
     * globally on :root, which every nav instance on the page would otherwise fight over - CSS custom
     * properties are inherited, so setting them on the host still reaches the shadow DOM's `var(--nav-bg, ...)`
     * references below it). It also determines the position of the navigation's dropdowns based on its
     * layout and viewport dimensions.
     */
    add_theme_css = () => {
        let theme_settings = themes.find(theme => theme.mode === this.theme);

        let nav_top = "unset";
        let nav_bottom = "unset";
        let nav_left = "unset";
        let nav_right = "unset";

        // Determine if the nav is more on the top/bottom if horizontal or left/right if vertical
        let nav_rect = this.getBoundingClientRect();

        if (this.layout === LAYOUT_OPTIONS.HORIZONTAL) {
            let viewport_height = window.innerHeight || document.documentElement.clientHeight;
            let distance_to_top = nav_rect.top;
            let distance_to_bottom = viewport_height - nav_rect.bottom;

            if (distance_to_top < distance_to_bottom) {
                nav_top = "100%";
            }
            else {
                nav_bottom = "100%";
            }
        }
        else if (this.layout === LAYOUT_OPTIONS.VERTICAL) {
            let viewport_width = window.innerWidth || document.documentElement.clientWidth;
            let distance_to_left = nav_rect.left;
            let distance_to_right = viewport_width - nav_rect.right;

            nav_top = "0";

            if (distance_to_left < distance_to_right) {
                nav_left = "100%";
            }
            else {
                nav_right = "100%";
            }
        }

        if (!theme_settings && this.theme) {
            try {
                let custom_theme = JSON.parse(this.theme);

                theme_settings = {
                    nav_bg: custom_theme.nav_bg || themes[0].nav_bg,
                    nav_text: custom_theme.nav_text || themes[0].nav_text,
                    nav_border: custom_theme.nav_border || themes[0].nav_border,
                    link_bg: custom_theme.link_bg || themes[0].link_bg,
                    link_text: custom_theme.link_text || themes[0].link_text,
                    link_hover_bg: custom_theme.link_hover_bg || themes[0].link_hover_bg,
                    link_hover_text: custom_theme.link_hover_text || themes[0].link_hover_text,
                    font_family: custom_theme.font_family || themes[0].font_family
                }
            }
            catch (e) {
                console.warn(`${this.constructor.name}: Invalid theme attribute, falling back to default theme.`);

                theme_settings = themes[0];
            }
        }

        // No theme attribute at all (e.g. it was just removed) and no custom theme to fall back to either.
        if (!theme_settings) {
            theme_settings = themes[0];
        }

        let properties = {
            "--nav-bg": theme_settings.nav_bg,
            "--nav-text": theme_settings.nav_text,
            "--nav-border": theme_settings.nav_border,
            "--link-bg": theme_settings.link_bg,
            "--link-text": theme_settings.link_text,
            "--link-hover-bg": theme_settings.link_hover_bg,
            "--link-hover-text": theme_settings.link_hover_text,
            "--font-family": theme_settings.font_family,
            "--nav-dropdown-top": nav_top,
            "--nav-dropdown-bottom": nav_bottom,
            "--nav-dropdown-left": nav_left,
            "--nav-dropdown-right": nav_right,
        };

        for (let [property, value] of Object.entries(properties)) {
            this.style.setProperty(property, value);
        }
    }

    /**
     * Builds the brand block (logo/name/tagline, linking home). Built via DOM APIs (.textContent/.href/.src)
     * rather than an HTML template string, since brand.name/tagline/logo_url/link are config-supplied and an
     * HTML-string build would parse them as markup - config isn't necessarily developer-authored (e.g. a
     * tenant-editable "brand name" setting), so that would be a stored/reflected XSS hole.
     * @param {Object} brand - `this.config.brand`.
     * @returns {Element}
     */
    build_brand_element = (brand) => {
        let container = document.createElement("div");
        container.className = "brand";

        let link = document.createElement("a");
        link.href = brand.link || "#";

        if (brand.logo_url) {
            let logo = document.createElement("img");
            logo.src = brand.logo_url;
            link.appendChild(logo);
        }

        if (brand.name) {
            let name = document.createElement("span");
            name.textContent = brand.name;
            link.appendChild(name);
        }

        container.appendChild(link);

        if (brand.tagline) {
            let tagline = document.createElement("p");
            tagline.textContent = brand.tagline;
            container.appendChild(tagline);
        }

        return container;
    }

    /**
     * Builds the navigation sections based on the configuration.
     * @returns {Promise<void>}
     */
    build_nav_sections = async () => {
        let brand_element = this.nav_menu.querySelector(".brand");

        if (brand_element) {
            brand_element.remove();
        }

        this.nav_left.innerHTML = "";
        this.nav_center.innerHTML = "";
        this.nav_right.innerHTML = "";

        // Brand Section - reads this._config (the actual applied config), not this.config (the getter,
        // which re-parses the `config` attribute and returns undefined whenever _config was set without
        // ever touching the attribute, e.g. the default_config fallback in on_create).
        if (this._config?.brand?.should_show) {
            this.nav_menu.prepend(this.build_brand_element(this._config.brand));
        }

        for (let item of this._config.navigation || []) {
            let section = item.section || "left"; // default to left

            let target_section = {
                left: this.nav_left,
                center: this.nav_center,
                right: this.nav_right
            }[section];

            if (!target_section) continue;

            if (item.type === "button") {
                let button = this.create_nav_button(item);
                target_section.appendChild(button);
            }
            else {
                let nav_item = await this.build_nav_item(item);
                target_section.appendChild(nav_item);
            }
        }

        this.build_collapse_toggle();
        this.mark_active_navigation_items();
    }

    /**
     * Builds (or removes) a collapse/expand affordance for this nav. No-op in the base class - only
     * {@link GalaxySidebar} has a collapsible rail.
     */
    build_collapse_toggle = () => {}

    /**
     * Marks the nav item(s) whose link matches the current page's path with `aria-current="page"` and an `active`
     * class, so the current page reads as highlighted by default with no configuration required. Placeholder
     * dropdown-only links (`href="#"`) are never matched.
     */
    mark_active_navigation_items = () => {
        let current_pathname = window.location.pathname.replace(/\/+$/, "") || "/";

        this.nav_menu.querySelectorAll("a[href]").forEach(link => {
            link.removeAttribute("aria-current");
            link.classList.remove("active");

            if (link.getAttribute("href") === "#") {
                return;
            }

            let link_pathname;

            try {
                link_pathname = new URL(link.href).pathname.replace(/\/+$/, "") || "/";
            }
            catch (error) {
                return;
            }

            if (link_pathname === current_pathname) {
                link.setAttribute("aria-current", "page");
                link.classList.add("active");
            }
        });
    }

    /**
     * Creates a navigation button element.
     * @param {Object} item - The navigation item configuration.
     * @returns {HTMLButtonElement}
     */
    create_nav_button = (item) => {
        let button = document.createElement("button");
        button.classList.add("galaxy-nav-button");

        let icon_element = this.build_item_icon(item, true);

        if (icon_element) {
            button.appendChild(icon_element);
        }

        if (item.label) {
            let span = document.createElement("span");
            span.classList.add("nav-label");
            span.textContent = item.label;
            button.appendChild(span);
        }

        if (typeof item.onclick === "function") {
            button.addEventListener("click", item.onclick);
        }

        return button;
    }

    /**
     * Builds an icon element for a nav item: its configured icon if present, otherwise (top-level items only) a
     * single-letter fallback so the item still reads correctly when the vertical rail is collapsed to icon-only
     * width. Nested children/column items with no icon get no icon element, matching prior behavior.
     * @param {Object} item - The navigation item configuration.
     * @param {boolean} is_top_level - Whether this item is a direct top-level nav entry.
     * @returns {Element|null}
     */
    build_item_icon = (item, is_top_level) => {
        if (item.icon) {
            let icon = document.createElement("i");
            icon.className = item.icon;
            icon.classList.add("nav-icon");

            return icon;
        }

        if (!is_top_level) {
            return null;
        }

        let fallback_letter = (item.label || "").trim().charAt(0).toUpperCase() || "?";

        let fallback_icon = document.createElement("span");
        fallback_icon.classList.add("nav-icon", "nav-icon-fallback");
        fallback_icon.textContent = fallback_letter;

        return fallback_icon;
    }

    /**
     * Builds a navigation item, including handling of multi-column dropdowns and nested children.
     * @param {Object} item - The navigation item configuration.
     * @param {boolean} is_top_level - Whether this item is a direct top-level nav entry (only top-level items get an icon fallback when uniconed).
     * @returns {Promise<Node>}
     */
    build_nav_item = async (item, is_top_level = true) => {
        if (item.is_heading) {
            let heading_html = `
                <li class="nav-heading"><span class="nav-label">${item.label}</span></li>
            `;

            return await this.get_template(heading_html);
        }

        const li = document.createElement("li");

        const link = document.createElement("a");
        link.href = item.link || "#";

        let icon_element = this.build_item_icon(item, is_top_level);

        if (icon_element) {
            link.appendChild(icon_element);
        }

        const label = document.createElement("span");
        label.classList.add("nav-label");
        label.textContent = item.label;
        link.appendChild(label);
        li.appendChild(link);

        let has_dropdown_children = (item.multi_column && item.columns?.length) || item.children?.length;

        if (has_dropdown_children) {
            link.setAttribute("aria-haspopup", "true");
            link.setAttribute("aria-expanded", "false");
        }

        // Multi-column dropdowns
        if (item.multi_column && item.columns?.length) {
            const dropdown = document.createElement("div");
            dropdown.setAttribute("dropdown", "");
            dropdown.setAttribute("multi-column", "");

            item.columns.forEach(col => {
                const column = document.createElement("div");

                if (col.title) {
                    const title = document.createElement("h4");
                    title.textContent = col.title;
                    column.appendChild(title);
                }

                col.items.forEach(subitem => {
                    const sublink = document.createElement("a");
                    sublink.href = subitem.link || "#";
                    sublink.textContent = subitem.label;
                    column.appendChild(sublink);
                });

                dropdown.appendChild(column);
            });

            li.appendChild(dropdown);
        }

        // Children (nested nav)
        if (item.children?.length) {
            let list_container = document.createElement("div");
            const sublist = document.createElement("ul");
            list_container.setAttribute("dropdown", "");

            for (let child of item.children) {
                sublist.appendChild(await this.build_nav_item(child, false))
            }

            list_container.appendChild(sublist);
            li.appendChild(list_container);
        }

        return li;
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        document.removeEventListener("click", this.on_document_click);
        document.removeEventListener("keydown", this.on_document_keydown);
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     */
    get component_html() {
        return NAV_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     */
    get component_css() {
        return `
            :host {
                height: auto;
                width: 100%;
                display: block;
                background-color: var(--nav-bg, --default-nav-bg);
                color: var(--nav-text, --default-nav-text);
            }

            .galaxy-nav {
                display: flex;
                flex-direction: row;
                background-color: var(--nav-bg, --default-nav-bg);
                color: var(--nav-text, --default-nav-text);
                padding: 0.25rem;
                border: 1px solid var(--nav-border, --default-nav-border);

                /* Brand Container */
                .brand {
                    padding: 0.75rem;

                    a {
                        display: flex;
                        align-items: center;
                        text-decoration: none;
                        color: inherit;

                        &:hover {
                            text-decoration: none;
                        }
                    }

                    img {
                        height: 32px;
                        margin-right: 0.5rem;
                    }
                }

                /* Nav Items Container */
                > ul {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: row;
                    gap: 1rem;
                    flex: 1;

                    &.nav-left {
                        justify-content: flex-start;
                    }

                    &.nav-center {
                        justify-content: center;
                    }

                    &.nav-right {
                        justify-content: flex-end;
                    }

                    /* Nav Items */
                    > li {
                        position: relative;
                        background-color: var(--link-bg, --default-link-bg);

                        &.nav-heading {
                            pointer-events: none;
                            cursor: default;
                            background-color: transparent;
                        }

                        a {
                            display: flex;
                            align-items: center;
                            padding: 0.75rem;
                            text-decoration: none;
                            color: var(--link-text, --default-link-text);

                            i, .nav-icon-fallback {
                                margin-right: 0.5rem;
                            }

                            &:hover {
                                background-color: var(--link-hover-bg, --default-link-hover-bg);
                                color: var(--link-hover-text, --default-link-hover-text);
                                text-decoration: none;
                            }

                            &:active {
                                background-color: var(--link-hover-bg, --default-link-hover-bg);
                                color: var(--link-hover-text, --default-link-hover-text);
                                text-decoration: none;
                            }

                            &:disabled, &[aria-disabled="true"] {
                                pointer-events: none;
                                opacity: 0.5;
                                cursor: default;
                            }

                            &:focus-visible {
                                outline: 2px solid var(--link-hover-bg, --default-link-hover-bg);
                                outline-offset: -2px;
                            }

                            &[aria-current="page"] {
                                background-color: var(--link-hover-bg, --default-link-hover-bg);
                                color: var(--link-hover-text, --default-link-hover-text);
                                font-weight: 600;
                            }
                        }

                        > a {
                            height: 100%;
                        }

                        > div {
                            &[dropdown] {
                                min-width: 200px;
                                display: none;
                                position: absolute;
                                background: #1e293b;
                                z-index: 100;
                                gap: 2rem;
                                top: var(--nav-dropdown-top, unset);
                                bottom: var(--nav-dropdown-bottom, unset);
                                left: var(--nav-dropdown-left, unset);
                                right: var(--nav-dropdown-right, unset);

                                > div, > ul {
                                    h4 {
                                        font-size: 0.9rem;
                                        font-weight: bold;
                                        margin-bottom: 0.5rem;
                                        color: var(--link-text, --default-link-text);
                                    }

                                    a {
                                        padding: 0.35rem;
                                        white-space: nowrap;
                                        width: 100%;
                                    }
                                }

                                > ul {
                                    list-style: none;
                                    flex-direction: column;
                                    gap: 0;
                                    padding: 0.75rem;
                                    flex: 1;
                                }

                                a {
                                    display: block;
                                    color: var(--link-text, --default-link-text);
                                    text-decoration: none;
                                }

                                ~ a:after {
                                    content: "";
                                    position: absolute;
                                    top: -0.5rem;
                                    left: 1rem;
                                    border-width: 0.5rem;
                                    border-style: solid;
                                    border-color: transparent transparent var(--link-text, --default-link-text) transparent;
                                }
                            }

                            &[multi-column] {
                                flex-direction: row;
                                padding: 1rem;
                            }
                        }

                        &:has(div[dropdown]) {
                            display: block;

                            > a {
                                width: max-content;

                                &:after {
                                    content: "";
                                    margin-top: 0.5rem;
                                    margin-left: 0.5rem;
                                    border-width: 0.4rem;
                                    border-style: solid;
                                    border-color: transparent transparent var(--link-text, --default-link-text) transparent;
                                }
                            }
                        }
                    }
                }
            }

            /* Dropdown open state - triggered by hover (unless disable-hover is set) or by the "open" attribute
               that click/tap/keyboard toggling applies. Kept as flat rules (rather than nested under :host) so the
               hover-gating and attribute-driven paths can be listed side by side. */
            :host(:not([disable-hover])) .galaxy-nav > ul > li:has(> div[dropdown]):hover > div[dropdown],
            .galaxy-nav > ul > li[open] > div[dropdown] {
                display: flex;
                background-color: var(--link-bg, --default-link-bg);
                color: var(--link-text, --default-link-text);
            }

            :host(:not([disable-hover])) .galaxy-nav > ul > li:has(> div[dropdown]):hover > a,
            .galaxy-nav > ul > li[open] > a {
                width: max-content;

                &:after {
                    content: "";
                    margin-top: 0.5rem;
                    margin-left: 0.5rem;
                    border-width: 0.4rem;
                    border-style: solid;
                    border-color: transparent transparent var(--link-hover-text, --default-hover-link-text) transparent;
                    transform: rotateZ(180deg);
                }
            }

            .nav-icon-fallback {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 1em;
                height: 1em;
                font-size: 0.85em;
                font-weight: bold;
                border-radius: 0.2rem;
                background-color: var(--link-hover-bg, --default-link-hover-bg);
                color: var(--link-hover-text, --default-link-hover-text);
            }
        `;
    }
}
