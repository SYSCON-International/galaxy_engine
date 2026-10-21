/**
 * @file GalaxyTooltip.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";
import {GalaxyTooltipController} from "../GalaxyTooltipController.js";

const TOOLTIP_HTML_TEMPLATE = `<slot></slot>`;

/**
 * @class
 * @description
 *     A tooltip for the element it wraps - `<galaxy-tooltip text="Delete row"><button>...</button></galaxy-tooltip>` - or for the element whose id its `for` names, for an
 *     element that cannot be wrapped. Its content is its `text`, or the markup it holds with `slot="content"`, which takes precedence; it is for reading, so it should hold
 *     nothing interactive.
 *
 *     It shows on hover after `delay` milliseconds, at once on keyboard focus, and on a touch held still for half a second, and it floats above the page - never clipped
 *     by a scrolling or overflow-hidden container - beside the trigger on its `placement` side, flipping to the other side when there is no room and always kept inside
 *     the viewport. See {@link GalaxyTooltipController} for the full behavior. A wrapped disabled button still shows its tooltip, since the wrapper, not the button,
 *     listens for the pointer.
 *
 *     The trigger is given the tooltip's text for screen readers: as its `aria-label` when it has no name of its own (an icon-only button), and otherwise as its
 *     `aria-description`. Neither is set when the trigger already has one, and the tooltip removes only what it set.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyTooltip extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(TOOLTIP_HTML_TEMPLATE);

        this.tooltip_controller = null;
        this.trigger_element = null;
        this.content_slot = null;
        this.text_element = null;
        this.default_slot = null;
        this.applied_aria_attribute = null;
        this.applied_aria_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["text", "for", "placement", "delay", "disabled"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        if (!this.tooltip_controller) {
            return;
        }

        const attribute_lookup_table = {
            "text": this.on_content_change,
            "for": this.attach_to_trigger,
            "placement": this.apply_controller_options,
            "delay": this.apply_controller_options,
            "disabled": this.on_disabled_change,
        }

        attribute_lookup_table[name]?.();
    }

    /***************  Getters and Setters  ***************/

    /**
     * Gets the tooltip's text.
     * @return {string} - The text, "" when there is none.
     */
    get text() {return this.getAttribute("text") ?? "";}

    /**
     * Sets the tooltip's text. Markup with `slot="content"` takes precedence over it.
     * @param {string|null} value - The text.
     */
    set text(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("text");
        }
        else {
            this.setAttribute("text", String(value));
        }
    }

    /**
     * Gets the id of the element the tooltip is for, when it does not wrap its trigger.
     * @return {string|null} - The id.
     */
    get for() {return this.getAttribute("for");}

    /**
     * Sets the id of the element the tooltip is for, found in the same document or shadow root as the tooltip.
     * @param {string|null} value - The id, or null to use the wrapped element.
     */
    set for(value) {
        if (value) {
            this.setAttribute("for", value);
        }
        else {
            this.removeAttribute("for");
        }
    }

    /**
     * Gets the side of the trigger the tooltip is placed on.
     * @return {string} - "top" (the default), "bottom", "left", or "right".
     */
    get placement() {
        let placement = this.getAttribute("placement");

        return Object.values(GalaxyTooltipController.PLACEMENTS).includes(placement) ? placement : GalaxyTooltipController.PLACEMENTS.TOP;
    }

    /**
     * Sets the side of the trigger the tooltip is placed on. It flips to the other side when there is no room.
     * @param {string|null} value - "top", "bottom", "left", or "right".
     */
    set placement(value) {
        if (value) {
            this.setAttribute("placement", value);
        }
        else {
            this.removeAttribute("placement");
        }
    }

    /**
     * Gets how long the pointer rests on the trigger before the tooltip shows.
     * @return {number} - The delay in milliseconds, 400 by default.
     */
    get delay() {
        let delay = Number(this.getAttribute("delay"));
        let has_valid_delay = this.hasAttribute("delay") && Number.isFinite(delay) && delay >= 0;

        return has_valid_delay ? delay : 400;
    }

    /**
     * Sets how long the pointer rests on the trigger before the tooltip shows. Keyboard focus and a touch-hold are not delayed by it.
     * @param {number|null} value - The delay in milliseconds, or null for the default.
     */
    set delay(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("delay");
        }
        else {
            this.setAttribute("delay", String(value));
        }
    }

    /**
     * Gets whether the tooltip is disabled.
     * @return {boolean} - True when it never shows.
     */
    get disabled() {return this.hasAttribute("disabled");}

    /**
     * Sets whether the tooltip is disabled. A disabled tooltip never shows and gives its trigger no label or description.
     * @param {boolean} value - True to disable it.
     */
    set disabled(value) {
        this.toggleAttribute("disabled", Boolean(value));
    }

    /**
     * Gets whether the tooltip is showing.
     * @return {boolean} - True when showing.
     */
    get open() {
        return Boolean(this.tooltip_controller?.is_open);
    }

    /**
     * Gets whether the content comes from markup with `slot="content"` rather than `text`.
     * @return {boolean} - True when there is slotted content.
     */
    get has_slotted_content() {
        return Array.from(this.children).some((child) => child.slot === "content");
    }

    /**
     * Gets the tooltip's text as a screen reader reads it: the slotted content's text, or `text`.
     * @return {string} - The text, trimmed.
     */
    get tooltip_text() {
        if (this.has_slotted_content) {
            return Array.from(this.children)
                .filter((child) => child.slot === "content")
                .map((child) => child.textContent)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
        }

        return this.text.trim();
    }

    /***************  Other Methods  ***************/

    /**
     * Shows the tooltip beside its trigger, from code.
     */
    show = () => {
        let anchor = this.get_anchor();

        if (this.disabled || !anchor || !this.has_content()) {
            return;
        }

        this.tooltip_controller?.show(anchor, this.fill_content);
    }

    /**
     * Hides the tooltip.
     */
    hide = () => {
        this.tooltip_controller?.hide();
    }

    /**
     * Gets whether the tooltip has anything to show.
     * @return {boolean} - True when it has slotted content or text.
     */
    has_content = () => {
        return this.has_slotted_content || this.text.trim() !== "";
    }

    /**
     * Gets the element the bubble is placed beside: the `for` element, or the tooltip itself around what it wraps.
     * @return {Element|null} - The anchor.
     */
    get_anchor = () => {
        return this.for ? this.trigger_element : this;
    }

    /**
     * Gets the element given the tooltip's label or description: the `for` element, or the wrapped element.
     * @return {Element|null} - The element.
     */
    get_described_element = () => {
        if (this.for) {
            return this.trigger_element;
        }

        let assigned_elements = this.default_slot?.assignedElements({flatten: true}) ?? [];

        return assigned_elements[0] ?? null;
    }

    /**
     * Fills the bubble's content element: the `slot="content"` markup, projected through a slot, or else the text. The slot stays in place either way, so a change to the
     * slotted markup is always noticed.
     * @param {HTMLElement} content_element - The bubble's content element.
     */
    fill_content = (content_element) => {
        let is_filled = this.content_slot.parentNode === content_element && this.text_element.parentNode === content_element && content_element.childNodes.length === 2;

        if (!is_filled) {
            content_element.replaceChildren(this.content_slot, this.text_element);
        }

        this.text_element.textContent = this.has_slotted_content ? "" : this.text;
    }

    /**
     * Resolves what the controller shows for the element under the pointer or focus: this tooltip, for anything inside its trigger.
     * @return {{anchor: Element, content: function(HTMLElement)}|null} - The tooltip, or null when it is disabled or empty.
     */
    resolve_tooltip = () => {
        let anchor = this.get_anchor();

        if (this.disabled || !anchor || !this.has_content()) {
            return null;
        }

        return {anchor: anchor, content: this.fill_content};
    }

    /**
     * Listens on the trigger - the `for` element, or this element around what it wraps - and gives it the tooltip's label or description.
     */
    attach_to_trigger = () => {
        if (!this.tooltip_controller) {
            return;
        }

        this.remove_applied_aria();
        this.tooltip_controller.detach_listeners();

        if (this.for) {
            let root = this.getRootNode();

            this.trigger_element = typeof root.getElementById === "function" ? root.getElementById(this.for) : null;

            if (!this.trigger_element) {
                console.warn(`${this.constructor.name}: No element with the id "${this.for}" was found for the tooltip.`);
                return;
            }
        }
        else {
            this.trigger_element = this;
        }

        this.tooltip_controller.attach(this.trigger_element, this.resolve_tooltip);
        this.apply_aria();
    }

    /**
     * Applies {@link placement} and {@link delay} to the controller.
     */
    apply_controller_options = () => {
        this.tooltip_controller.placement = this.placement;
        this.tooltip_controller.show_delay = this.delay;
        this.tooltip_controller.position();
    }

    /**
     * Updates the open bubble and the trigger's label or description after the content changes.
     */
    on_content_change = () => {
        this.fill_content(this.tooltip_controller.content_element);

        if (this.open) {
            this.tooltip_controller.position();
        }

        this.apply_aria();
    }

    /**
     * Hides the tooltip when it is disabled, and updates the trigger's label or description.
     */
    on_disabled_change = () => {
        if (this.disabled) {
            this.hide();
        }

        this.apply_aria();
    }

    /***************  Accessibility  ***************/

    /**
     * Gives the trigger the tooltip's text: as its `aria-label` when it has no name of its own, otherwise as its `aria-description`. One it already has is left alone.
     */
    apply_aria = () => {
        this.remove_applied_aria();

        let described_element = this.get_described_element();
        let text = this.tooltip_text;

        if (!described_element || this.disabled || text === "") {
            return;
        }

        let attribute_name = this.has_accessible_name(described_element) ? "aria-description" : "aria-label";

        if (described_element.hasAttribute(attribute_name)) {
            return;
        }

        described_element.setAttribute(attribute_name, text);

        this.applied_aria_attribute = attribute_name;
        this.applied_aria_element = described_element;
    }

    /**
     * Removes the label or description this tooltip gave its trigger, if it gave one.
     */
    remove_applied_aria = () => {
        if (this.applied_aria_element && this.applied_aria_attribute) {
            this.applied_aria_element.removeAttribute(this.applied_aria_attribute);
        }

        this.applied_aria_attribute = null;
        this.applied_aria_element = null;
    }

    /**
     * Gets whether an element has a name of its own - an `aria-label` or `aria-labelledby`, its own text, or an image's `alt` inside it.
     * @param {Element} element - The element.
     * @return {boolean} - True when it has a name.
     */
    has_accessible_name = (element) => {
        let has_label_attribute = element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby");
        let has_text = (element.textContent ?? "").trim() !== "";
        let has_image_alt = Boolean(element.querySelector?.("img[alt]:not([alt=\"\"])"));

        return has_label_attribute || has_text || has_image_alt;
    }

    /***************  Lifecycle  ***************/

    /**
     * {@link GalaxyHTMLComponentBase#on_create}
     */
    on_create = async () => {
        this.default_slot = await this.get_template();
        this.shadow.appendChild(this.default_slot);
        this.default_slot.addEventListener("slotchange", this.apply_aria);

        this.content_slot = document.createElement("slot");
        this.content_slot.name = "content";
        this.content_slot.addEventListener("slotchange", this.on_content_change);

        this.text_element = document.createElement("span");

        this.tooltip_controller = new GalaxyTooltipController(this.shadow);
        this.fill_content(this.tooltip_controller.content_element);

        this.apply_controller_options();
        this.attach_to_trigger();
    }

    /**
     * {@link GalaxyHTMLComponentBase#on_destroy}
     */
    on_destroy = async () => {
        this.remove_applied_aria();

        this.default_slot?.removeEventListener("slotchange", this.apply_aria);
        this.content_slot?.removeEventListener("slotchange", this.on_content_change);

        // Removed so a reconnect, which runs on_create again, does not add a second slot and bubble.
        this.default_slot?.remove();
        this.tooltip_controller?.destroy();
        this.tooltip_controller = null;
        this.trigger_element = null;
        this.default_slot = null;
        this.content_slot = null;
        this.text_element = null;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return TOOLTIP_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            :host {
                display: inline-block;
            }

            /* Pointing at another element, the tooltip has no box of its own - but display: contents still renders the bubble in its shadow root */
            :host([for]) {
                display: contents;
            }
        `;
    }
}
