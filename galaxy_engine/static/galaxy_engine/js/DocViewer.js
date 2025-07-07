export class DocViewer {

    constructor() {
        window.addEventListener("hashchange", this.load_section);

        this.content_container_element = document.querySelector(".content-container");

        this.load_section();
    }

    load_section = (event) => {
        let section = location.hash.substring(1) || "home";

        fetch(`/docs/${section}/`)
            .then(res => {
                if (!res.ok) throw new Error("404 Not Found");
                return res.text();
            })
            .then(html => {
                this.content_container_element.innerHTML = html;

                this.update_methods_headers();
                this.update_method_getter_and_setters_formatting();
            })
            .catch(error => {
                this.content_container_element.innerHTML = `<p>Section not found.</p>`;
            });

        this.update_navigation_links();
    };

    update_navigation_links = () => {
        let active_nav_link = document.querySelector(".nav-link.active");

        active_nav_link.classList.remove("active");

        let current_section = location.hash.substring(1) || "home";
        let new_active_nav_link = document.querySelector(`.nav-link[href="#${current_section}"]`);

        if (new_active_nav_link) {
            new_active_nav_link.classList.add("active");
        }
        else {
            console.warn(`No navigation link found for section: ${current_section}`);
        }
    }

    update_methods_headers = () => {
        let method_headers = document.querySelectorAll(".methods-container h4");

        for (let header of method_headers) {
            let method_name = header.textContent.trim();

            // if the first word is get, set, async, or await, wrap it in a span and add a class
            if (method_name.startsWith("get ") || method_name.startsWith("set ") ||
                method_name.startsWith("async ") || method_name.startsWith("await ")) {

                let words = method_name.split(" ");

                words[0] = `<span class="method-keyword">${words[0]}</span>`;

                header.innerHTML = words.join(" ");
            }
        }
    }

    update_method_getter_and_setters_formatting = () => {
        let getters_and_setters_li_elements = document.querySelectorAll(".getters-setters-container > div div");

        for (let li of getters_and_setters_li_elements) {
            let method_name = li.textContent.trim();

            // if the first word is get: or set:, wrap it in a span and add a class
            if (method_name.startsWith("get:") || method_name.startsWith("set:")) {
                let words = method_name.split(":");

                words[0] = `<span class="method-keyword">${words[0]}</span>`;

                li.innerHTML = words.join(": ");
            }
        }
    }
}

new DocViewer();