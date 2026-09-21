/**
 * @file GalaxyNavbar.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */
import {GalaxyNavbarBase, LAYOUT_OPTIONS} from "./GalaxyNavbarBase.js";

// Custom theme (not part of the built-in theme list in GalaxyNavbarBase) - passed through as a JSON string so
// add_theme_css()'s custom-theme fallback path gets exercised instead of a preset "light"/"dark" mode lookup.
const CUSTOM_THEME_SUNSET = {
    nav_bg: "#fff7ed",
    nav_text: "#7c2d12",
    nav_border: "#fdba74",
    link_bg: "#ffedd5",
    link_text: "#9a3412",
    link_hover_bg: "#f97316",
    link_hover_text: "#fff7ed",
    font_family: "Inter, sans-serif"
};

// Reference/test config: brand, multi-column dropdown, nested children, sections, a heading, and a button
// item. Not applied automatically - pass it through `config` (e.g. `element.config = TEST_NAVBAR_CONFIG`)
// to see it rendered.
export const TEST_NAVBAR_CONFIG = {
    theme: JSON.stringify(CUSTOM_THEME_SUNSET),
    brand: {
        name: "Galaxy Engine",
        logo_url: "/assets/logo.svg",
        link: "/",
        tagline: "The future of frontend",
        should_show: true
    },
    navigation: [
        {label: "Dashboard", icon: "fas fa-home", link: "/dashboard"},
        {
            label: "Reports",
            icon: "fas fa-chart-line",
            multi_column: true,
            columns: [
                {
                    title: "Production",
                    items: [
                        {label: "Live Feed", link: "/reports/live"},
                        {label: "Summary", link: "/reports/summary"}
                    ]
                },
                {
                    title: "Maintenance",
                    items: [
                        {label: "Schedule", link: "/reports/maintenance/schedule"},
                        {label: "Downtime Logs", link: "/reports/maintenance/logs"}
                    ]
                }
            ]
        },
        {
            label: "Settings",
            icon: "fas fa-cogs",
            section: "center",
            children: [
                {label: "User Management", link: "/settings/users"},
                {label: "Roles & Permissions", link: "/settings/roles"},
                {label: "Preferences", link: "/settings/preferences"}
            ]
        },
        {label: "Documentation", icon: "fas fa-book", link: "https://docs.galaxyengine.dev", section: "right"},
        {label: "Support", is_heading: true, section: "right"},
        {label: "Contact Us", icon: "fas fa-envelope", link: "/contact", section: "right"},
        {
            type: "button",
            label: "Sign Out",
            icon: "fas fa-right-from-bracket",
            section: "right",
            onclick: () => console.log("Sign out clicked")
        }
    ]
};

/**
 * @class
 * @description
 *      A horizontal top-bar navigation component: left/center/right sections, an optional brand block, dropdowns
 *      (single-column and multi-column mega-menu), and current-page highlighting. {@link GalaxySidebar} is the
 *      vertical/collapsible counterpart - both extend {@link GalaxyNavbarBase}.
 * @extends GalaxyNavbarBase
 */
export class GalaxyNavbar extends GalaxyNavbarBase {
    /**
     * {@link GalaxyNavbarBase#layout}
     * @override
     */
    static get layout_option() {return LAYOUT_OPTIONS.HORIZONTAL;}
}
