/**
 * @file GalaxyLoader.js
 * @framework GalaxyEngine
 * @version 0.0.0
 * @author
 *     Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *     (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

const LOADER_HTML_TEMPLATE = `
    <div class="galaxy-loader-backdrop">
        <div class="galaxy-loader-content" role="status" aria-live="polite">
            <div class="loader-drip" aria-hidden="true">
                <span></span><span></span><span></span>
            </div>
            <img class="custom-image hide" alt="Loading"/>
            <div class="message"></div>
        </div>
    </div>
`;

/**
 * @class
 * @description
 *     A loading indicator component. Can be displayed fullscreen (covering the viewport) or scoped to an individual element (positioned to fill its nearest positioned ancestor).
 *     Defaults to the same "drip" spinner look and feel as the legacy `base_app/js/LoaderManager.js`, but supports a custom image via the `image-url` attribute and/or custom CSS via
 *     the {@link custom_style} property.
 * @extends GalaxyHTMLComponentBase
 */
export class GalaxyLoader extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor() {
        super(LOADER_HTML_TEMPLATE);

        this._custom_style = null;
        this._custom_stylesheet = null; // The single CSSStyleSheet custom_style keeps updating in place - see its setter.
    }

    /**
     * {@link GalaxyHTMLComponentBase#observed_attributes}
     * @override
     */
    static get observed_attributes() {
        return ["image-url", "message"];
    }

    /**
     * {@link GalaxyHTMLComponentBase#attribute_changed_callback}
     * @override
     */
    attribute_changed_callback = async (name, old_value, new_value) => {
        const attribute_lookup_table = {
            "image-url": this.update_image,
            "message": this.update_message,
        }

        attribute_lookup_table[name]?.();
    }

    /**
     * Gets the fullscreen state of the loader.
     * @return {boolean} - The fullscreen state of the loader.
     */
    get fullscreen() {return this.hasAttribute("fullscreen");}

    /**
     * Sets the fullscreen state of the loader.
     * @param {boolean} value - The fullscreen state of the loader.
     */
    set fullscreen(value) {
        if (value) {
            this.setAttribute("fullscreen", "");
        }
        else {
            this.removeAttribute("fullscreen");
        }
    }

    /**
     * Gets the custom image URL of the loader.
     * @return {string|null} - The custom image URL of the loader, or null if the default spinner is being used.
     */
    get image_url() {return this.getAttribute("image-url");}

    /**
     * Sets the custom image URL of the loader. When set, the default spinner is replaced by an `<img>` pointing at this URL.
     * @param {string|null} value - The custom image URL of the loader.
     */
    set image_url(value) {
        if (value) {
            this.setAttribute("image-url", value);
        }
        else {
            this.removeAttribute("image-url");
        }
    }

    /**
     * Gets the message text of the loader. Defaults to "Loading" (matching the legacy `LoaderManager.js` default) when no `message` attribute has been set. Set the `message`
     * attribute (or property - @see {@link message} setter) to an empty string to hide the message entirely.
     * @return {string} - The message text of the loader.
     */
    get message() {
        let explicit_message = this.getAttribute("message");

        return explicit_message !== null ? explicit_message : "Loading";
    }

    /**
     * Sets the message text of the loader, shown below the spinner/image. Pass an empty string (not
     * null/undefined) to hide the message row entirely while still overriding the "Loading" default -
     * @see {@link message} getter. `null`/`undefined` clear the attribute instead, reverting to that default.
     * @param {string|null|undefined} value - The message text of the loader.
     */
    set message(value) {
        if (value === null || value === undefined) {
            this.removeAttribute("message");
        }
        else {
            this.setAttribute("message", value);
        }
    }

    /**
     * Gets the custom CSS most recently applied to the loader via {@link custom_style}.
     * @return {string|null} - The custom CSS string, or null if none has been applied.
     */
    get custom_style() {return this._custom_style;}

    /**
     * Applies a custom CSS string to the loader's shadow DOM, layered on top of the default styles so it can override them. Use this (rather than an attribute) to give a loader a
     * bespoke look and feel, since a CSS block is unwieldy as an HTML attribute value.
     * @note Deliberately doesn't use the generic {@link GalaxyHTMLComponentBase#add_shadow_css} helper, which always *adds* a new stylesheet - calling that again on re-assignment
     * would leave the previous custom CSS still adopted underneath the new one (any property only the old sheet set would keep bleeding through), and would grow
     * `shadowRoot.adoptedStyleSheets` without bound over repeated assignments. This keeps a single stylesheet and updates it in place instead.
     * @param {string|null|undefined} value - The custom CSS string to apply, or a falsy value to clear any previously-applied custom CSS.
     */
    set custom_style(value) {
        this._custom_style = value || null;

        if (!value) {
            if (this._custom_stylesheet) {
                let index = this.shadowRoot.adoptedStyleSheets.indexOf(this._custom_stylesheet);

                if (index !== -1) {
                    this.shadowRoot.adoptedStyleSheets.splice(index, 1);
                }

                this._custom_stylesheet = null;
            }

            return;
        }

        if (!this._custom_stylesheet) {
            this._custom_stylesheet = new CSSStyleSheet();
            this.shadowRoot.adoptedStyleSheets.push(this._custom_stylesheet);
        }

        this._custom_stylesheet.replaceSync(value);
    }

    /**
     * Updates the visible spinner/image based on the current {@link image_url}. Falls back to the default drip spinner when no custom image URL is set.
     */
    update_image = () => {
        if (!this.image_element || !this.drip_element) {
            return;
        }

        if (this.image_url) {
            this.image_element.src = this.image_url;
            this.image_element.classList.remove("hide");
            this.drip_element.classList.add("hide");
        }
        else {
            this.image_element.removeAttribute("src");
            this.image_element.classList.add("hide");
            this.drip_element.classList.remove("hide");
        }
    }

    /**
     * Updates the visible message text based on the current {@link message}. Defaults to showing "Loading"; the message row is only hidden when the `message` attribute is explicitly
     * set to an empty string.
     */
    update_message = () => {
        if (!this.message_element) {
            return;
        }

        if (this.message) {
            this.message_element.textContent = this.message;
            this.message_element.classList.remove("hide");
        }
        else {
            this.message_element.textContent = "";
            this.message_element.classList.add("hide");
        }
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_create}
    */
    on_create = async () => {
        this.loader = await this.get_template();

        this.shadow.appendChild(this.loader);

        this.backdrop_element = this.loader.querySelector(".galaxy-loader-backdrop");
        this.drip_element = this.loader.querySelector(".loader-drip");
        this.image_element = this.loader.querySelector(".custom-image");
        this.message_element = this.loader.querySelector(".message");

        this.update_image();
        this.update_message();
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     * @override
     */
    get component_html() {
        return LOADER_HTML_TEMPLATE;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     * @override
     */
    get component_css() {
        return `
            :host {
                display: block;
                position: absolute;
                inset: 0;
                z-index: 100;
                font-size: 1.5rem;
            }

            :host([fullscreen]) {
                position: fixed;
                z-index: 3000;
                font-size: clamp(1rem, 3vw, 5rem);
            }

            .galaxy-loader-backdrop {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: rgba(255, 255, 255, 0.7);
            }

            .galaxy-loader-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                font-size: 1em;
                text-align: center;
            }

            .loader-drip {
                display: flex;
                gap: 0.4em;
                height: 1.2em;
                align-items: flex-end;

                span {
                    width: 0.6em;
                    height: 0.6em;
                    background-color: #3498db;
                    border-radius: 50%;
                    animation: galaxy-loader-drip 1.5s infinite ease-in-out;

                    &:nth-child(2) {
                        animation-delay: 0.2s;
                    }

                    &:nth-child(3) {
                        animation-delay: 0.4s;
                    }
                }
            }

            .custom-image {
                width: 1.2em;
                height: 1.2em;
                object-fit: contain;
            }

            .message {
                margin-top: 0.5em;
                font-size: 0.875em;
                color: var(--text-dark);
                user-select: none;
            }

            .hide {
                display: none;
            }

            @keyframes galaxy-loader-drip {
                0%, 100% {
                    transform: translateY(0) scale(1);
                    opacity: 0.4;
                }

                50% {
                    transform: translateY(0.4em) scale(1.3);
                    opacity: 1;
                }
            }
        `;
    }
}
