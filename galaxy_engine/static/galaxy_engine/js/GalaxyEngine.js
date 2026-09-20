/**
 * @file GalaxyEngine.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyStateManager } from "./GalaxyStateManager.js";
import { GalaxyUtils } from "./GalaxyUtils.js";
import { GalaxyComponentsLoader } from "./GalaxyComponentsLoader.js";
import { GalaxyNotificationManager } from "./GalaxyNotificationManager.js";
import { GalaxyLoaderManager } from "./GalaxyLoaderManager.js";

/**
 * @class GalaxyEngine
 * @description
 *      The main entry point for the GalaxyEngine framework.
 */
export class GalaxyEngine {
    /**
     * @constructor
     */
    constructor() {
       this.initialize();
    }

    /**
     * List of all Galaxy component tag names used in forms.
     * @type {{FORM: string, INTEGER_INPUT: string, FLOAT_INPUT: string, TEXT_INPUT: string, SELECT: string, MULTI_SELECT: string, MODAL: string, BUTTON: string, DATE_PICKER: string, TIME_PICKER: string, DATETIME_PICKER: string, DATETIME_RANGE: string, DURATION_INPUT: string}}
     */
    GALAXY_COMPONENT_TAG_NAMES = {
        FORM: "GALAXY-FORM",
        INTEGER_INPUT: "GALAXY-INTEGER-INPUT",
        FLOAT_INPUT: "GALAXY-FLOAT-INPUT",
        TEXT_INPUT: "GALAXY-TEXT-INPUT",
        SELECT: "GALAXY-SELECT",
        MULTI_SELECT: "GALAXY-MULTI-SELECT",
        MODAL: "GALAXY-MODAL",
        BUTTON: "GALAXY-BUTTON",
        DATE_PICKER: "GALAXY-DATE-PICKER",
        TIME_PICKER: "GALAXY-TIME-PICKER",
        DATETIME_PICKER: "GALAXY-DATETIME-PICKER",
        DATETIME_RANGE: "GALAXY-DATETIME-RANGE",
        DURATION_INPUT: "GALAXY-DURATION-INPUT",
    }

    /**
     * Initializes the GalaxyEngine framework.
     */
    initialize = () => {
        this.add_engine_css();

        window.galaxy_state_manager = new GalaxyStateManager();
        window.galaxy_utils = new GalaxyUtils();

        new GalaxyComponentsLoader();

        this.notifications = new GalaxyNotificationManager();
        this.loaders = new GalaxyLoaderManager();

        document.body.addEventListener("click", this.handle_body_click);
    }

    /**
     * Handles click events on the body to trigger modals and other interactions.
     * @param {MouseEvent} event - The click event.
     */
    handle_body_click = (event) => {
        let target = event.target;

        let closest_galaxy_modal_id_element = target.closest("[galaxy-modal-id]");

        if (closest_galaxy_modal_id_element) {
            event.preventDefault();
            this.handle_modal(event, closest_galaxy_modal_id_element);
        }
    }

    /**
     * Handles the modal interaction when an element with `galaxy-modal-id` is clicked.
     * @param {MouseEvent} event - The click event.
     * @param {HTMLElement} closest_galaxy_modal_id_element - The closest element with `galaxy-modal-id` attribute.
     */
    handle_modal = (event, closest_galaxy_modal_id_element) => {
        closest_galaxy_modal_id_element = closest_galaxy_modal_id_element || event.target.closest("[galaxy-modal-id]");

        if (!closest_galaxy_modal_id_element) {
            console.warn("No element with galaxy-modal-id found in the event target hierarchy.");
            return;
        }

        let modal_id = closest_galaxy_modal_id_element.getAttribute("galaxy-modal-id");
        let modal = document.querySelector(`#${modal_id}`);

        if (modal && modal.tagName === "GALAXY-MODAL") {
            modal.open = true; // Open the modal
        }
        else {
            console.warn(`Modal with ID ${modal_id} not found.`);
        }
    }

    /**
     * Creates a `<style>` element containing {@link engine_css} and inserts it as the first child of the
     * document head, so a consuming app's own stylesheet (loaded normally via `<link>`/`<style>` in `<head>`)
     * comes later in document order and overrides these defaults for any shared `--variable` name.
     */
    add_engine_css = () => {
        let style = document.createElement("style");
        style.type = "text/css";
        style.innerHTML = this.engine_css;

        document.head.insertBefore(style, document.head.firstChild);
    }

    /**
     * Engine-wide CSS shared by all Galaxy components: the 12-column grid variables, the default color palette, and base notification sizing.
     * @returns {string} - The engine-wide CSS.
     */
    get engine_css() {
        return `
            :root {
                /* Column sizes for a 12-column grid system */
                --col-1: 8.333333%;
                --col-2: 16.666667%;
                --col-3: 25%;
                --col-4: 33.333333%;
                --col-5: 41.666667%;
                --col-6: 50%;
                --col-7: 58.333333%;
                --col-8: 66.666667%;
                --col-9: 75%;
                --col-10: 83.333333%;
                --col-11: 91.666667%;
                --col-12: 100%;

                /* Default color palette. Components read shared colors from these custom properties
                   (a component's Shadow DOM cannot see a consuming app's compiled CSS). A consuming app
                   can override any of these by redeclaring the same \`--variable\` name in its own
                   stylesheet, since that stylesheet loads after this one -- see add_engine_css above. */

                /* Brand colors */
                --plantstar-lightblue: #19a8fb;
                --plantstar-blue: #007bc4;
                --plantstar-darkblue: #003ac4;
                --plantstar-lightgrey: #9e9ea0;
                --plantstar-darkgrey: #3d3d41;

                /* Extra colors */
                --black: #212529;
                --blue: #007bff;
                --green: #28a745;
                --lightgrey: #ced4da;
                --grey: #6c757d;
                --red: #dc3545;
                --yellow: #ffc107;

                --sidebar: var(--plantstar-darkgrey);
                --sidebar-active-li: var(--plantstar-lightgrey);
                --table-header: var(--plantstar-lightgrey);
                --primary-link: var(--plantstar-lightblue);
                --text-light: #ffffff;
                --text-dark: #333;
                --text-grey: #495057;

                /* Machine status colors */
                --offline: #333333;
                --idle: #777777;
                --down: #ff0000;
                --process-exception: #af1253;
                --process-warning: #f78cb8;
                --high-rejects: #116963;
                --overrun: #44bfb7;
                --assist: #fd5f00;
                --slow: #d19800;
                --fast: #fff60c;
                --running: #3ac400;
                --reject: var(--high-rejects);

                /* Custom Dashboard colors */
                --trigger-component: #dc3545;
                --source-component: #28a745;
                --destination-component: #fd5f00;
            }

            galaxy-notification {
                min-height: 450px;
                min-width: 600px;
            }
        `;
    }
}

window.galaxy_engine = new GalaxyEngine();