/**
 * @file GalaxyNotification.js
 * @framework GalaxyNotification
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import {GalaxyHTMLComponentBase} from "./GalaxyHTMLComponentBase.js";

const NOTIFICATION_HTML_TEMPLATE = `
    <div class="galaxy-notification">
        <div class="header">
            <div class="text-container">
                <div class="icon">!</div>
                <div class="text">Notification</div>
            </div>
            <button class="close-btn">X</button>
        </div>
        <div class="body"></div>
        <div class="footer hide">
            <div class="text"></div>
            <button class="action-btn hide"></button>
        </div>
    </div>
`;

/**
 * @class GalaxyNotification
 * @description
 *      A class for notifications that are shown in the UI.
 */
export class GalaxyNotification extends GalaxyHTMLComponentBase {
    /**
     * @constructor
     */
    constructor(config) {
        super(NOTIFICATION_HTML_TEMPLATE);

        this.config = config;

        this.types = [
            {type: "info", icon: "i"},
            {type: "success", icon: "✓"},
            {type: "error", icon: "✗"},
            {type: "warning", icon: "!"},
        ];
    }

    /**
     * Shows the notification by removing the "hide" class, which triggers the CSS transition to make the notification visible. The notification will remain visible until it is
     * hidden by calling the `hide` method or by clicking the close button.
     */
    show = () => {
        this.notification.classList.remove("hide");
    }

    /**
     * Hides the notification by adding the "hide" class, which triggers the CSS transition to fade out the notification. The notification will be removed from the DOM after a
     * short delay to allow for the fade-out animation to complete.
     */
    hide = () => {
        this.notification.classList.add("hide");
    }

    /**
     * Sets up event listeners for the notification component. This includes adding a click event listener to the close button, which will call the `handle_close_button_click`
     * method to hide the notification when the close button is clicked.
     */
    set_event_listeners = () => {
        this.close_btn.addEventListener("click", this.handle_close_button_click);
    }

    /**
     * Sets the icon for the notification based on the type specified in the configuration. The method looks up the appropriate icon for the notification type and updates the header
     * icon accordingly. If the specified type is not found in the list of types, it defaults to the first type in the list.
     */
    set_icon = () => {
        let filter_type = this.types.find(type => type.type === this.config.type);

        if (!filter_type) {
            filter_type = this.types[0];
        }

        for (let type of this.types) {
            this.notification.classList.remove(type.type);
        }

        this.header_icon.textContent = filter_type.icon;
        this.notification.classList.add(filter_type.type);
    }

    /**
     * Handles the click event on the close button. When the close button is clicked, this method is called to hide the notification by calling the `hide` method.
     */
    handle_close_button_click = () => {
        this.hide();
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_create}
    */
    on_create = async () => {
        this.notification = await this.get_template();

        this.header = this.notification.querySelector(".header");
        this.header_text = this.header.querySelector(".text");
        this.header_icon = this.header.querySelector(".icon");
        this.close_btn = this.header.querySelector(".close-btn");
        this.body = this.notification.querySelector(".body");
        this.footer = this.notification.querySelector(".footer");
        this.footer_text = this.footer.querySelector(".text");
        this.action_btn = this.footer.querySelector(".action-btn");

        this.header_text.textContent = this.config.title || this.config.type.charAt(0).toUpperCase() + this.config.type.slice(1);
        this.body.textContent = this.config.message || "";

        this.shadow.appendChild(this.notification);

        this.set_event_listeners();
        this.set_icon()
    }

    /**
    * {@link GalaxyHTMLComponentBase#on_destroy}
    */
    on_destroy = async () => {
        this.close_btn.removeEventListener("click", this.handle_close_button_click);
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_html}
     */
    get component_html() {
        return `
            <div class="galaxy-notification">
                <div class="header">
                    <div class="text-container">
                        <div class="icon">!</div>
                        <div class="text">Notification</div>
                    </div>
                    <button class="close-btn">X</button>
                </div>
                <div class="body"></div>
                <div class="footer hide">
                    <div class="text"></div>
                    <button class="action-btn hide"></button>
                </div>
            </div>
        `;
    }

    /**
     * {@link GalaxyHTMLComponentBase#component_css}
     */
    get component_css() {
        return `
            .galaxy-notification {
                min-height: 96px;
                width: 350px;
                background-color: white;
                border: 1px solid #ccc;
                border-radius: 5px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                padding: 10px;
                display: flex;
                flex-direction: column;
                margin-bottom: 1px;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 1;
                
                &.hide {
                    opacity: 0;
                }
            
                .header {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #eee;
                    margin: -10px;
                    padding: 10px;
                    
                    .text-container {
                        display: flex;
                        align-items: center;
                        padding-bottom: 5px;
                        
                        .icon {
                            width: 20px;
                            height: 20px;
                            background-color: white;
                            color: black;
                            border-radius: 50%;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin-right: 10px;
                        }
                        
                        .text {
                            font-size: 16px;
                            font-weight: bold;
                        }
                    }          
                    
                    .close-btn {
                        background: none;
                        border: none;
                        font-size: 16px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                }
                
                .body {
                    margin: 10px 0;
                }
                
                .footer {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    
                    &.hide {
                        display: none;
                    }
                    
                    .text {
                        font-size: 14px;
                        color: #666;
                    }
                    
                    .action-btn {
                        background-color: var(--blue);
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                }
                
                &.success {
                    border-color: var(--green);

                    .header {
                        background-color: var(--green);
                    }

                    .header .text {
                        color: black;
                    }
                }

                &.error {
                    border-color: var(--red);

                    .header {
                        background-color: var(--red);
                    }

                    .header .text {
                        color: black;
                    }
                }

                &.warning {
                    border-color: var(--yellow);

                    .header {
                        background-color: var(--yellow);
                    }

                    .header .text {
                        color: black;
                    }
                }

                &.info {
                    border-color: var(--blue);

                    .header {
                        background-color: var(--blue);
                    }

                    .header .text {
                        color: black;
                    }
                }
            }
        `;
    }
}

