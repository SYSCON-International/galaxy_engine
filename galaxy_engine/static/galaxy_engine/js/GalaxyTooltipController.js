/**
 * @file GalaxyTooltipController.js
 * @framework GalaxyEngine
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

const SHOW_DELAY_IN_MILLISECONDS = 400;
const HIDE_DELAY_IN_MILLISECONDS = 100;
const TOUCH_HOLD_IN_MILLISECONDS = 500;
const TOUCH_LINGER_IN_MILLISECONDS = 1500;

// How long after a touch-hold the click it would cause is still swallowed, in case the browser never sends one.
const HELD_CLICK_WINDOW_IN_MILLISECONDS = 800;

// How far a touch may move, in pixels, and still count as holding still.
const TOUCH_MOVE_TOLERANCE = 10;

// The gap between the anchor and the bubble, and the least the bubble keeps from the viewport's edges, in pixels.
const ANCHOR_GAP = 8;
const VIEWPORT_MARGIN = 8;

// The arrow is kept this far, in pixels, from the bubble's corners.
const ARROW_INSET = 10;

const PLACEMENTS = {
    TOP: "top",
    BOTTOM: "bottom",
    LEFT: "left",
    RIGHT: "right",
};

const OPPOSITE_PLACEMENTS = {
    [PLACEMENTS.TOP]: PLACEMENTS.BOTTOM,
    [PLACEMENTS.BOTTOM]: PLACEMENTS.TOP,
    [PLACEMENTS.LEFT]: PLACEMENTS.RIGHT,
    [PLACEMENTS.RIGHT]: PLACEMENTS.LEFT,
};

const TOOLTIP_CSS = `
    .galaxy-tooltip-bubble {
        position: fixed;
        inset: auto;
        max-width: min(20rem, calc(100vw - ${VIEWPORT_MARGIN * 2}px));
        margin: 0;
        padding: 0.375rem 0.625rem;
        border: none;
        overflow: visible;
        font-family: inherit;
        font-size: 0.875rem;
        font-weight: normal;
        line-height: 1.4;
        color: #ffffff;
        text-align: left;
        white-space: normal;
        overflow-wrap: break-word;
        background-color: #212529;
        border-radius: 0.25rem;
        box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.25);
        opacity: 0;
        transition: opacity 0.1s ease-in;
    }

    .galaxy-tooltip-bubble:popover-open {
        opacity: 1;
    }

    .galaxy-tooltip-arrow {
        position: absolute;
        width: 0.5rem;
        height: 0.5rem;
        background-color: inherit;
        transform: translate(-50%, -50%) rotate(45deg);
    }

    .galaxy-tooltip-bubble[data-placement="top"] .galaxy-tooltip-arrow {
        top: 100%;
        left: var(--galaxy-tooltip-arrow-offset, 50%);
    }

    .galaxy-tooltip-bubble[data-placement="bottom"] .galaxy-tooltip-arrow {
        top: 0;
        left: var(--galaxy-tooltip-arrow-offset, 50%);
    }

    .galaxy-tooltip-bubble[data-placement="left"] .galaxy-tooltip-arrow {
        top: var(--galaxy-tooltip-arrow-offset, 50%);
        left: 100%;
    }

    .galaxy-tooltip-bubble[data-placement="right"] .galaxy-tooltip-arrow {
        top: var(--galaxy-tooltip-arrow-offset, 50%);
        left: 0;
    }

    @media (prefers-reduced-motion: reduce) {
        .galaxy-tooltip-bubble {
            transition: none;
        }
    }
`;

/**
 * @class
 * @description
 *     Shows one tooltip bubble for the triggers inside a container: on hover after a delay, at once on keyboard focus, and on a touch held still for half a second. The
 *     bubble is a manual popover in the browser's top layer, so no ancestor's `overflow`, `transform`, or `z-index` clips it, and it is placed beside its anchor - flipping
 *     to the other side when there is no room, and kept inside the viewport with its arrow still pointing at the anchor.
 *
 *     The pointer can move from the anchor onto the bubble without it closing, and Escape closes it. After a touch-hold it stays a moment after the finger lifts, and the
 *     click and context menu the hold would cause are swallowed, so holding an icon button to read its tooltip does not press it. Only one tooltip shows at a time.
 *
 *     It is not an element: a component creates one for its shadow root - GalaxyTooltip for its trigger, GalaxyTable for its rows and cells - and {@link attach}es it to a
 *     container with a `resolve` function that says which anchor and content, if any, belong to the element under the pointer or focus.
 */
export class GalaxyTooltipController {
    static PLACEMENTS = PLACEMENTS;

    // The controller whose tooltip is showing, so showing another hides it.
    static open_controller = null;

    static next_bubble_number = 0;

    /**
     * @constructor
     * @param {ShadowRoot|Element} root - Where the bubble and its styles are added: the owning component's shadow root.
     */
    constructor(root) {
        this.root = root;
        this.placement = PLACEMENTS.TOP;
        this.show_delay = SHOW_DELAY_IN_MILLISECONDS;

        this.container = null;
        this.resolve = null;
        this.attach_controller = null;
        this.open_listeners_controller = null;

        this.anchor = null;
        this.pending_anchor = null;
        this.is_open = false;
        this.was_shown_by_touch = false;

        this.show_timer = null;
        this.hide_timer = null;
        this.touch_hold_timer = null;
        this.touch_start = null;
        this.held_click_controller = null;

        GalaxyTooltipController.next_bubble_number += 1;

        this.style_element = document.createElement("style");
        this.style_element.textContent = TOOLTIP_CSS;

        this.bubble = document.createElement("div");
        this.bubble.className = "galaxy-tooltip-bubble";
        this.bubble.id = `galaxy-tooltip-${GalaxyTooltipController.next_bubble_number}`;
        this.bubble.setAttribute("role", "tooltip");
        this.bubble.setAttribute("popover", "manual");

        this.content_element = document.createElement("div");
        this.content_element.className = "galaxy-tooltip-content";

        this.arrow_element = document.createElement("div");
        this.arrow_element.className = "galaxy-tooltip-arrow";

        this.bubble.append(this.content_element, this.arrow_element);
        this.root.append(this.style_element, this.bubble);

        this.bubble.addEventListener("pointerenter", this.on_bubble_pointerenter);
        this.bubble.addEventListener("pointerleave", this.on_bubble_pointerleave);
    }

    /***************  Attaching  ***************/

    /**
     * Listens for hover, focus, and touch on a container, replacing any container attached before.
     * @param {Element} container - The element the triggers are in, or the trigger itself.
     * @param {function(Element): ({anchor: Element, content: (string|function(HTMLElement))}|null)} resolve - Given the element under the pointer or focus, returns the
     *     anchor to place the bubble beside and its content - a string, or a function that fills the content element - or null when it has no tooltip.
     */
    attach = (container, resolve) => {
        this.detach_listeners();

        this.container = container;
        this.resolve = resolve;
        this.attach_controller = new AbortController();

        let options = {signal: this.attach_controller.signal};

        container.addEventListener("pointerover", this.on_pointerover, options);
        container.addEventListener("pointerout", this.on_pointerout, options);
        container.addEventListener("pointerdown", this.on_pointerdown, options);
        container.addEventListener("pointermove", this.on_pointermove, options);
        container.addEventListener("pointerup", this.on_pointerup, options);
        container.addEventListener("pointercancel", this.on_pointercancel, options);
        container.addEventListener("contextmenu", this.on_contextmenu, options);
        container.addEventListener("focusin", this.on_focusin, options);
        container.addEventListener("focusout", this.on_focusout, options);
    }

    /**
     * Stops listening on the container and hides the tooltip, keeping the bubble for a later {@link attach}.
     */
    detach_listeners = () => {
        this.hide();
        this.attach_controller?.abort();
        this.attach_controller = null;
        this.container = null;
        this.resolve = null;
    }

    /**
     * Stops listening and removes the bubble and its styles. The controller is not used again after this.
     */
    destroy = () => {
        this.detach_listeners();
        this.held_click_controller?.abort();
        this.held_click_controller = null;

        this.bubble.removeEventListener("pointerenter", this.on_bubble_pointerenter);
        this.bubble.removeEventListener("pointerleave", this.on_bubble_pointerleave);
        this.bubble.remove();
        this.style_element.remove();
    }

    /**
     * Gets the anchor and content for the element an event came from, through any shadow roots inside the container.
     * @param {Event} event - The event.
     * @return {{anchor: Element, content: (string|function(HTMLElement))}|null} - The tooltip, or null when there is none.
     */
    resolve_event = (event) => {
        let target = event.composedPath?.()[0] ?? event.target;

        if (!this.resolve || !(target instanceof Element)) {
            return null;
        }

        let resolved = this.resolve(target);
        let has_content = Boolean(resolved?.anchor) && (typeof resolved.content === "function" || (typeof resolved.content === "string" && resolved.content.trim() !== ""));

        return has_content ? resolved : null;
    }

    /**
     * Gets whether a node is the anchor or inside it.
     * @param {Node|null} node - The node.
     * @param {Element|null} anchor - The anchor.
     * @return {boolean} - True when inside.
     */
    is_inside = (node, anchor) => {
        return Boolean(node) && Boolean(anchor) && (node === anchor || anchor.contains(node));
    }

    /***************  Mouse and Pen  ***************/

    /**
     * Schedules the tooltip of the element the pointer moved onto, or switches to it at once when another tooltip is already showing.
     * @param {PointerEvent} event - The pointerover event.
     */
    on_pointerover = (event) => {
        if (event.pointerType === "touch") {
            return;
        }

        let resolved = this.resolve_event(event);

        if (!resolved) {
            this.schedule_hide();
            return;
        }

        this.cancel_hide();

        if (resolved.anchor === this.anchor && this.is_open) {
            return;
        }

        if (resolved.anchor === this.pending_anchor) {
            return;
        }

        // Moving from one tooltip to the next shows the next at once, as native tooltips do once one is up.
        let is_any_tooltip_open = GalaxyTooltipController.open_controller !== null;

        this.schedule_show(resolved, is_any_tooltip_open ? 0 : this.show_delay);
    }

    /**
     * Schedules hiding once the pointer leaves the anchor for something that is not the bubble.
     * @param {PointerEvent} event - The pointerout event.
     */
    on_pointerout = (event) => {
        if (event.pointerType === "touch") {
            return;
        }

        let anchor = this.anchor || this.pending_anchor;

        if (this.is_inside(event.relatedTarget, anchor) || this.is_inside(event.relatedTarget, this.bubble)) {
            return;
        }

        this.cancel_show();
        this.schedule_hide();
    }

    /**
     * Keeps the tooltip open while the pointer is over the bubble, so its content can be read and selected.
     */
    on_bubble_pointerenter = () => {
        this.cancel_hide();
    }

    /**
     * Hides the tooltip once the pointer leaves the bubble, unless it went back to the anchor.
     * @param {PointerEvent} event - The pointerleave event.
     */
    on_bubble_pointerleave = (event) => {
        if (this.is_inside(event.relatedTarget, this.anchor)) {
            return;
        }

        this.schedule_hide();
    }

    /***************  Focus  ***************/

    /**
     * Shows the focused element's tooltip at once when it was focused from the keyboard.
     * @param {FocusEvent} event - The focusin event.
     */
    on_focusin = (event) => {
        let resolved = this.resolve_event(event);
        let focused_element = event.composedPath?.()[0] ?? event.target;

        if (!resolved || !this.is_keyboard_focus(focused_element)) {
            return;
        }

        this.cancel_hide();
        this.show(resolved.anchor, resolved.content);
    }

    /**
     * Hides the tooltip when focus leaves its anchor.
     * @param {FocusEvent} event - The focusout event.
     */
    on_focusout = (event) => {
        if (this.is_inside(event.relatedTarget, this.anchor)) {
            return;
        }

        this.cancel_show();
        this.hide();
    }

    /**
     * Gets whether an element was focused from the keyboard rather than by a click, which already shows the tooltip on hover.
     * @param {Element} element - The focused element.
     * @return {boolean} - True for keyboard focus.
     */
    is_keyboard_focus = (element) => {
        try {
            return element.matches(":focus-visible");
        }
        catch (error) {
            // A browser without :focus-visible cannot tell the two apart; showing on every focus is the accessible choice.
            return true;
        }
    }

    /***************  Touch  ***************/

    /**
     * Starts timing a touch-hold on an element with a tooltip.
     * @param {PointerEvent} event - The pointerdown event.
     */
    on_pointerdown = (event) => {
        if (event.pointerType !== "touch") {
            this.cancel_show();
            this.hide();
            return;
        }

        this.cancel_touch_hold();

        let resolved = this.resolve_event(event);

        if (!resolved) {
            return;
        }

        this.touch_start = {x: event.clientX, y: event.clientY, pointer_id: event.pointerId};
        this.touch_hold_timer = setTimeout(() => {
            this.touch_hold_timer = null;
            this.was_shown_by_touch = true;
            this.show(resolved.anchor, resolved.content);
            this.swallow_held_click();
        }, TOUCH_HOLD_IN_MILLISECONDS);
    }

    /**
     * Cancels a touch-hold once the finger moves away - a scroll or a swipe, not a hold.
     * @param {PointerEvent} event - The pointermove event.
     */
    on_pointermove = (event) => {
        if (event.pointerType !== "touch" || !this.touch_start || event.pointerId !== this.touch_start.pointer_id) {
            return;
        }

        let distance = Math.hypot(event.clientX - this.touch_start.x, event.clientY - this.touch_start.y);

        if (distance > TOUCH_MOVE_TOLERANCE) {
            this.cancel_touch_hold();
        }
    }

    /**
     * Ends a touch: a hold lifted early is cancelled, and a tooltip a hold showed lingers a moment before hiding.
     * @param {PointerEvent} event - The pointerup event.
     */
    on_pointerup = (event) => {
        if (event.pointerType !== "touch") {
            return;
        }

        this.cancel_touch_hold();

        if (this.is_open && this.was_shown_by_touch) {
            this.schedule_hide(TOUCH_LINGER_IN_MILLISECONDS);
        }
    }

    /**
     * Cancels a touch-hold the browser took over, for a scroll or a zoom.
     * @param {PointerEvent} event - The pointercancel event.
     */
    on_pointercancel = (event) => {
        if (event.pointerType !== "touch") {
            return;
        }

        this.cancel_touch_hold();

        if (this.was_shown_by_touch) {
            this.hide();
        }
    }

    /**
     * Suppresses the context menu a touch-hold would open, while the hold is being timed or its tooltip is showing.
     * @param {MouseEvent} event - The contextmenu event.
     */
    on_contextmenu = (event) => {
        let is_touch_hold_active = this.touch_hold_timer !== null || (this.is_open && this.was_shown_by_touch);

        if (is_touch_hold_active) {
            event.preventDefault();
        }
    }

    /**
     * Swallows the one click a touch-hold's release causes, so holding an icon button to read its tooltip does not press it.
     */
    swallow_held_click = () => {
        this.held_click_controller?.abort();

        let swallow_controller = new AbortController();

        this.held_click_controller = swallow_controller;

        let on_click = (event) => {
            event.preventDefault();
            event.stopPropagation();
            swallow_controller.abort();
        };

        window.addEventListener("click", on_click, {capture: true, signal: swallow_controller.signal});

        // Ended on its own once the release has had time to produce its click, so an unrelated later click is never swallowed.
        let on_release = () => {
            setTimeout(() => swallow_controller.abort(), HELD_CLICK_WINDOW_IN_MILLISECONDS);
        };

        window.addEventListener("pointerup", on_release, {capture: true, once: true, signal: swallow_controller.signal});
        window.addEventListener("pointercancel", () => swallow_controller.abort(), {capture: true, once: true, signal: swallow_controller.signal});
    }

    /**
     * Stops timing a touch-hold.
     */
    cancel_touch_hold = () => {
        clearTimeout(this.touch_hold_timer);
        this.touch_hold_timer = null;
        this.touch_start = null;
    }

    /***************  Showing and Hiding  ***************/

    /**
     * Shows a tooltip after a delay, unless the pointer leaves first.
     * @param {{anchor: Element, content: (string|function(HTMLElement))}} resolved - The anchor and content.
     * @param {number} delay - The delay in milliseconds.
     */
    schedule_show = (resolved, delay) => {
        this.cancel_show();

        if (delay <= 0) {
            this.show(resolved.anchor, resolved.content);
            return;
        }

        this.pending_anchor = resolved.anchor;
        this.show_timer = setTimeout(() => {
            this.show_timer = null;
            this.pending_anchor = null;
            this.show(resolved.anchor, resolved.content);
        }, delay);
    }

    /**
     * Cancels a scheduled show.
     */
    cancel_show = () => {
        clearTimeout(this.show_timer);
        this.show_timer = null;
        this.pending_anchor = null;
    }

    /**
     * Hides the tooltip after a delay, unless the pointer comes back to it first.
     * @param {number} delay - The delay in milliseconds.
     */
    schedule_hide = (delay = HIDE_DELAY_IN_MILLISECONDS) => {
        if (!this.is_open) {
            return;
        }

        this.cancel_hide();
        this.hide_timer = setTimeout(() => {
            this.hide_timer = null;
            this.hide();
        }, delay);
    }

    /**
     * Cancels a scheduled hide.
     */
    cancel_hide = () => {
        clearTimeout(this.hide_timer);
        this.hide_timer = null;
    }

    /**
     * Shows the tooltip beside an anchor, hiding any other tooltip that is showing.
     * @param {Element} anchor - The element the bubble is placed beside.
     * @param {string|function(HTMLElement)} content - The text, or a function that fills the content element.
     */
    show = (anchor, content) => {
        let other_controller = GalaxyTooltipController.open_controller;

        if (other_controller && other_controller !== this) {
            other_controller.hide();
        }

        this.cancel_show();
        this.cancel_hide();

        if (typeof content === "function") {
            content(this.content_element);
        }
        else {
            this.content_element.textContent = content;
        }

        this.anchor = anchor;

        if (!this.is_open) {
            try {
                this.bubble.showPopover();
            }
            catch (error) {
                console.warn("GalaxyTooltipController: The tooltip could not be shown as a popover.", error);
                return;
            }

            this.is_open = true;
            this.add_open_listeners();
        }

        GalaxyTooltipController.open_controller = this;

        this.position();
    }

    /**
     * Hides the tooltip.
     */
    hide = () => {
        this.cancel_show();
        this.cancel_hide();
        this.cancel_touch_hold();

        this.was_shown_by_touch = false;
        this.anchor = null;

        if (GalaxyTooltipController.open_controller === this) {
            GalaxyTooltipController.open_controller = null;
        }

        if (!this.is_open) {
            return;
        }

        this.is_open = false;
        this.open_listeners_controller?.abort();
        this.open_listeners_controller = null;

        try {
            this.bubble.hidePopover();
        }
        catch (error) {
            // Already hidden - the browser hides a popover itself when it leaves the document.
        }
    }

    /**
     * Listens, while the tooltip shows, for what moves or dismisses it: scrolling and resizing reposition it, and Escape or a press elsewhere hides it.
     */
    add_open_listeners = () => {
        this.open_listeners_controller = new AbortController();

        let options = {capture: true, signal: this.open_listeners_controller.signal};

        window.addEventListener("scroll", this.position, {...options, passive: true});
        window.addEventListener("resize", this.position, options);
        window.addEventListener("keydown", this.on_open_keydown, options);
        window.addEventListener("pointerdown", this.on_open_pointerdown, options);
    }

    /**
     * Hides the tooltip on Escape, keeping the key from also closing whatever is behind it.
     * @param {KeyboardEvent} event - The keydown event.
     */
    on_open_keydown = (event) => {
        if (event.key !== "Escape") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.hide();
    }

    /**
     * Hides a touch-hold's lingering tooltip on the next press anywhere but the bubble.
     * @param {PointerEvent} event - The pointerdown event.
     */
    on_open_pointerdown = (event) => {
        if (event.composedPath?.().includes(this.bubble)) {
            return;
        }

        if (this.was_shown_by_touch) {
            this.hide();
        }
    }

    /***************  Positioning  ***************/

    /**
     * Places the bubble beside its anchor in viewport coordinates: on the preferred side when it fits, else the opposite side, then clamped inside the viewport with the
     * arrow still pointing at the anchor. Hides it once the anchor has scrolled out of view.
     */
    position = () => {
        if (!this.is_open || !this.anchor) {
            return;
        }

        if (!this.anchor.isConnected) {
            this.hide();
            return;
        }

        let anchor_rect = this.anchor.getBoundingClientRect();
        let viewport_width = window.innerWidth;
        let viewport_height = window.innerHeight;
        let is_anchor_out_of_view = anchor_rect.bottom < 0 || anchor_rect.top > viewport_height || anchor_rect.right < 0 || anchor_rect.left > viewport_width;

        if (is_anchor_out_of_view) {
            this.hide();
            return;
        }

        let bubble_rect = this.bubble.getBoundingClientRect();
        let placement = this.choose_placement(anchor_rect, bubble_rect, viewport_width, viewport_height);
        let {top, left} = this.get_unclamped_position(placement, anchor_rect, bubble_rect);

        top = this.clamp(top, VIEWPORT_MARGIN, viewport_height - VIEWPORT_MARGIN - bubble_rect.height);
        left = this.clamp(left, VIEWPORT_MARGIN, viewport_width - VIEWPORT_MARGIN - bubble_rect.width);

        let is_vertical_placement = placement === PLACEMENTS.TOP || placement === PLACEMENTS.BOTTOM;
        let arrow_offset = 0;

        if (is_vertical_placement) {
            arrow_offset = this.clamp(anchor_rect.left + anchor_rect.width / 2 - left, ARROW_INSET, bubble_rect.width - ARROW_INSET);
        }
        else {
            arrow_offset = this.clamp(anchor_rect.top + anchor_rect.height / 2 - top, ARROW_INSET, bubble_rect.height - ARROW_INSET);
        }

        this.bubble.dataset.placement = placement;
        this.bubble.style.top = `${Math.round(top)}px`;
        this.bubble.style.left = `${Math.round(left)}px`;
        this.bubble.style.setProperty("--galaxy-tooltip-arrow-offset", `${Math.round(arrow_offset)}px`);
    }

    /**
     * Chooses the side to place the bubble on: the preferred one when the bubble fits there, else the opposite one when it fits there, else the preferred one anyway.
     * @param {DOMRect} anchor_rect - The anchor's rect.
     * @param {DOMRect} bubble_rect - The bubble's rect.
     * @param {number} viewport_width - The viewport's width.
     * @param {number} viewport_height - The viewport's height.
     * @return {string} - The placement.
     */
    choose_placement = (anchor_rect, bubble_rect, viewport_width, viewport_height) => {
        let preferred_placement = OPPOSITE_PLACEMENTS[this.placement] ? this.placement : PLACEMENTS.TOP;

        let fits = (placement) => {
            if (placement === PLACEMENTS.TOP) {
                return anchor_rect.top - ANCHOR_GAP - bubble_rect.height >= VIEWPORT_MARGIN;
            }
            else if (placement === PLACEMENTS.BOTTOM) {
                return anchor_rect.bottom + ANCHOR_GAP + bubble_rect.height <= viewport_height - VIEWPORT_MARGIN;
            }
            else if (placement === PLACEMENTS.LEFT) {
                return anchor_rect.left - ANCHOR_GAP - bubble_rect.width >= VIEWPORT_MARGIN;
            }
            else if (placement === PLACEMENTS.RIGHT) {
                return anchor_rect.right + ANCHOR_GAP + bubble_rect.width <= viewport_width - VIEWPORT_MARGIN;
            }
            else {
                throw new Error(`Placement "${placement}" is not valid here.`);
            }
        };

        if (fits(preferred_placement)) {
            return preferred_placement;
        }

        let opposite_placement = OPPOSITE_PLACEMENTS[preferred_placement];

        return fits(opposite_placement) ? opposite_placement : preferred_placement;
    }

    /**
     * Gets the bubble's position on a side of the anchor, centered along it, before clamping to the viewport.
     * @param {string} placement - The side.
     * @param {DOMRect} anchor_rect - The anchor's rect.
     * @param {DOMRect} bubble_rect - The bubble's rect.
     * @return {{top: number, left: number}} - The position.
     */
    get_unclamped_position = (placement, anchor_rect, bubble_rect) => {
        let centered_left = anchor_rect.left + anchor_rect.width / 2 - bubble_rect.width / 2;
        let centered_top = anchor_rect.top + anchor_rect.height / 2 - bubble_rect.height / 2;

        if (placement === PLACEMENTS.TOP) {
            return {top: anchor_rect.top - ANCHOR_GAP - bubble_rect.height, left: centered_left};
        }
        else if (placement === PLACEMENTS.BOTTOM) {
            return {top: anchor_rect.bottom + ANCHOR_GAP, left: centered_left};
        }
        else if (placement === PLACEMENTS.LEFT) {
            return {top: centered_top, left: anchor_rect.left - ANCHOR_GAP - bubble_rect.width};
        }
        else if (placement === PLACEMENTS.RIGHT) {
            return {top: centered_top, left: anchor_rect.right + ANCHOR_GAP};
        }
        else {
            throw new Error(`Placement "${placement}" is not valid here.`);
        }
    }

    /**
     * Clamps a value between a minimum and a maximum, preferring the minimum when they cross (a bubble wider than the viewport stays at its left edge).
     * @param {number} value - The value.
     * @param {number} minimum - The minimum.
     * @param {number} maximum - The maximum.
     * @return {number} - The clamped value.
     */
    clamp = (value, minimum, maximum) => {
        return Math.max(minimum, Math.min(value, maximum));
    }
}
