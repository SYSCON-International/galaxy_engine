/**
 * @file GalaxyNotificationManager.js
 * @framework GalaxyNotificationManager
 * @version 0.0.0
 * @author
 *      Travis Borkholder <travis.borkholder@gmail.com>
 * @copyright
 *      (c) 2025 SYSCON International. All rights reserved.
 * @license MIT
 */

import { GalaxyNotification } from './components/GalaxyNotification.js';

/**
 * @class GalaxyNotificationManager
 * @description
 *      A class for managing notifications that are shown in the UI. This class is responsible for creating, updating, and removing notifications as needed.
 *      It can also handle different types of notifications (e.g., success, error, warning) and manage their display duration and positioning on the screen.
 */
export class GalaxyNotificationManager {
    /**
     * @constructor
     */
    constructor() {
        this.notifications = [];

        this.add_notifications_container();
    }

    /**
     * Adds a container to the DOM where notifications will be displayed. This container is positioned in the top-right corner of the screen and has a high z-index to ensure that
     * notifications are visible above other content.
     */
    add_notifications_container = () => {
        // May want to display as flex so that the new notifications are added to the bottom of the container and the old notifications are removed from the top of the container when they expire
        // Shifting the notifications up when one is removed.
        this.notifications_container = document.createElement("div");
        this.notifications_container.style.position = "fixed";
        this.notifications_container.style.top = "10px";
        this.notifications_container.style.right = "10px";
        this.notifications_container.style.zIndex = "9999";

        document.body.appendChild(this.notifications_container);
    }

    /**
     * Adds a new notification to the notifications container. The notification is created based on the provided type and message, and it is automatically removed after a specified duration.
     * @param {string} type - The type of the notification (e.g., "success", "error", "warning", "info").
     * @param {string} message - The message to be displayed in the notification.
     * @param {number} duration - The duration (in seconds) for which the notification should be displayed before it is automatically removed. If set to 0 or a negative value, the
     * notification will not be automatically removed.
     */
    add = (type, message, duration = 10) => {
        let notification_config = {
            type: type,
            message: message,
        }

        let notification = new GalaxyNotification(notification_config);

        notification.handle_close_button_click = () => {
            this.remove(notification);
        }

        if (duration > 0) {
            notification.remove_timeout = setTimeout(() => {
                this.remove(notification);
            }, duration * 1000);
        }

        this.notifications_container.appendChild(notification);
        this.notifications.push(notification);
    }

    /**
     * Removes a notification from the notifications container. The notification is hidden and then removed from the DOM after a short delay to allow for a fade-out animation.
     * @param {GalaxyNotification} notification_instance - The instance of the notification to be removed.
     */
    remove = (notification_instance) => {
        if (notification_instance.remove_timeout) {
            clearTimeout(notification_instance.remove_timeout);
        }

        notification_instance.hide();

        setTimeout(() => {
            this.notifications = this.notifications.filter(notification => notification !== notification_instance);
            notification_instance.remove();
        }, 300);
    }
}