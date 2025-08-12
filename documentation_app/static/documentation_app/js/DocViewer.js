export class DocViewer {
    constructor() {
        window.addEventListener("hashchange", this.load_section);

        this.content_container_element = document.querySelector(".content-container");
        this.nav_menu = document.querySelector("#nav_menu");
        this.nav_menu_toggle_button = document.querySelector("#nav_menu_toggle_button");

        this.add_general_event_listeners();
        this.set_logo_twinkle_delay();
        this.load_section();
    }

    add_general_event_listeners = () => {
        if (this.nav_menu_toggle_button) {
            this.nav_menu_toggle_button.addEventListener("click", this.toggle_nav_menu);
        }
    }

    toggle_nav_menu = () => {
        if (this.nav_menu) {
            this.nav_menu_toggle_button.classList.toggle("open");
            this.nav_menu.classList.toggle("open");
        }
    }

    load_section = () => {
        let section = location.hash.substring(1) || "home";
        let sub_section = section.split("##")[1];

        fetch(`/docs/${section}/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("404 Not Found");
                }

                return response.text();
            })
            .then(async html => {
                await this.section_change_clean_up();

                this.content_container_element.innerHTML = html;

                this.handle_scroll_to(sub_section);

                this.update_methods_headers();
                this.update_method_getter_and_setters_formatting();
                this.highlight_code_blocks();
                this.add_code_block_copy_buttons();
                this.hide_empty_section_elements();

                this.add_event_listeners_to_section();

                this.toggle_nav_menu();
            })
            .catch(error => {
                console.log(`Error loading section ${section}:`, error);
                this.content_container_element.innerHTML = `<p>Section not found.</p>`;
            });

        this.update_navigation_links();
    };

    add_event_listeners_to_section = () => {
        let detail_entries = this.content_container_element.querySelectorAll(".details-entry");

        for (let entry of detail_entries) {
            entry.addEventListener("click", this.toggle_details);
        }
    }

    toggle_details = async (event) => {
        let target = event.target;
        console.log(`Clicked element:`, event);

        // If the clicked elements nearest ancestor has the .details-entry class, do something
        let nearest_details_entry = target.closest(".details-entry");

        if (nearest_details_entry) {
            nearest_details_entry.classList.toggle("show-details");
        }
    }

    handle_scroll_to = (target_id) => {
        let target_element = document.getElementById(target_id);

        if (target_element) {
            target_element.classList.add("show-details");
            target_element.scrollIntoView({ behavior: 'smooth' });
        }
        else {
            this.content_container_element.scrollTo(0, 0);
        }
    }

    set_logo_twinkle_delay = () => {
        let stars = document.querySelectorAll(".star");

        for (let star of stars) {
            let duration = (Math.random() * 3 + 3).toFixed(2); // Random duration between 3 and 6 seconds
            let delay = (Math.random() * 5).toFixed(2); // Random delay between 0 and 3 seconds

            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;
        }
    }

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
        let getters_and_setters_elements = document.querySelectorAll(".getters-setters-container > div div div");

        for (let getter_or_setter of getters_and_setters_elements) {
            let method_name = getter_or_setter.innerHTML;

            // if the first word is get: or set:, wrap it in a span and add a class
            if (method_name.startsWith("get:") || method_name.startsWith("set:")) {
                let words = method_name.split(":");

                words[0] = `<span class="method-keyword">${words[0]}</span>`;

                getter_or_setter.innerHTML = words.join(": ");
            }
        }
    }

    highlight_code_blocks = () => {
        let code_blocks = document.querySelectorAll('code[data-lang]');

        for (let code_block of code_blocks) {
            let lang = code_block.dataset.lang;
            let raw = code_block.innerHTML;
            let code = this.escape_html(raw);

            if (lang === 'javascript') {
              code = this.highlight_js(code);
            }

            if (lang === 'html') {
              code = this.highlight_html(code);
            }

            code_block.innerHTML = code;
        }
    }

    highlight_html = (code) => {
        // Highlight HTML comments
        code = code.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="comment">$1</span>');

        // Highlight tags with attribute handling
        return code.replace(/(&lt;\/?)([a-zA-Z0-9\-]+)([^&]*?)(&gt;)/g, (match, tagPrefix, tagName, attrString, tagSuffix) => {
            const isClosingTag = tagPrefix.includes('/');

            // Highlight tag name differently based on whether it's an opening or closing tag
            const tagClass = isClosingTag ? 'tag-close' : 'tag-open';
            let formattedAttrs = '';

            // Match and format attributes
            const attrMatches = [...attrString.matchAll(/([a-zA-Z\-:]+)(=)("(.*?)"|'(.*?)')?/g)];
            attrMatches.forEach(([_, name, eq, fullVal = '', dbl = '', sgl = '']) => {
              if (fullVal === '""' || fullVal === "''" || !eq) {
                // Boolean attribute or missing value
                formattedAttrs += ` <span class="attr-name">${name}</span>`;
              } else {
                formattedAttrs += ` <span class="attr-name">${name}</span><span class="attr-eq">=</span><span class="string">${fullVal}</span>`;
              }
            });

            return `<span class="${tagClass}">${tagPrefix}${tagName}</span>${formattedAttrs}<span class="${tagClass}">${tagSuffix}</span>`;
        });
    }

    highlight_js = (code) => {
        // ---- Strings ----
        code = code.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="string">$1</span>');

        // ---- Template Strings ----
        code = code.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="template">$1</span>');

        // ---- Comments ----
        code = code.replace(/\/\/(.*?$)/gm, '<span class="comment">//$1</span>');

        // ---- Fix arrow: unescape => first ----
        code = code
            .replace(/=&amp;gt;/g, '=>')
            .replace(/=&gt;/g, '=>');

        code = code.replace(/=>/g, '<span class="arrow">=></span>');

        // ---- DOM Methods ----
        let dom_methods = [
        'querySelector', 'querySelectorAll', 'getElementById', 'getElementsByClassName',
        'getElementsByTagName', 'appendChild', 'removeChild', 'replaceChild',
        'createElement', 'createTextNode', 'addEventListener', 'removeEventListener',
        ];

        let dom_method_regex = new RegExp(`\\b(${dom_methods.join('|')})\\b(?=\\s*\\()`, 'g');

        code = code.replace(dom_method_regex, '<span class="dom-method">$1</span>');

        // ---- JS Globals ----
        let globals = ['window', 'document', 'navigator', 'console', 'localStorage', 'sessionStorage'];
        let global_regex = new RegExp(`\\b(${globals.join('|')})\\b`, 'g');

        code = code.replace(global_regex, '<span class="global">$1</span>');

        // ---- Built-in Global Functions ----
        let built_ins = ['fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'alert', 'prompt', 'confirm'];
        let built_in_regex = new RegExp(`\\b(${built_ins.join('|')})\\b(?=\\s*\\()`, 'g');

        code = code.replace(built_in_regex, '<span class="built-in">$1</span>');

        // ---- Console Methods ----
        code = code.replace(/console\.(log|warn|error|info|debug)/g, (match, method) => {
            return `<span class="global">console</span>.<span class="console-method">${method}</span>`;
        });

        // ---- Function Calls ----
        code = code.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="function">$1</span>');

        // ---- Class Definitions ----
        code = code.replace(/\bclass\s+([A-Z]\w*)/g, 'class <span class="class-name">$1</span>');

        // ---- Keywords (Last, Skip Tags) ----
        let keywords = [
        'function', 'return', 'const', 'let', 'if', 'else', 'for', 'while',
        'class', 'new', 'this', 'async', 'await', 'try', 'catch', 'finally'
        ];

        let keyword_regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');

        code = code.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
            if (tag) return tag;
            return text.replace(keyword_regex, '<span class="keyword">$1</span>');
        });

        return code;
    }

    escape_html(html) {
      return html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    add_code_block_copy_buttons() {
        let code_blocks = document.querySelectorAll('code[data-lang]');

        for (let code_block of code_blocks) {
            let copy_button = document.createElement('button');
            copy_button.className = 'copy-button';
            copy_button.textContent = '⧉';

            copy_button.addEventListener('click', () => {
                navigator.clipboard.writeText(code_block.textContent)
                    .then(() => {
                        copy_button.textContent = 'Copied!';

                        setTimeout(() => {
                            copy_button.textContent = '⧉';
                        }, 2000);
                    })
                    .catch(error => {
                        console.error('Failed to copy text: ', error);
                    });
            });

            code_block.parentElement.insertBefore(copy_button, code_block);
        }
    }

    hide_empty_section_elements = () => {
        // Hide attributes, methods, getters/setters, observers, and examples sections if they are empty
        let sections = ["attributes-container", "examples-container", "methods-container"];
        let method_sub_sections = ["other-methods-container", "getters-setters-container", "observers-container"];

        for (let section of sections) {
            let container = document.querySelector(`.${section}`);

            if (!container) {
                continue;
            }

            let section_h4s_with_content = Array.from(container.querySelectorAll('h4')).some(h4 => h4.textContent.trim());
            let section_code_blocks_with_content = section === "examples-container" ? Array.from(container.querySelectorAll('code')).some(code => code.textContent.trim()) : false;

            if (!section_h4s_with_content && !section_code_blocks_with_content) {
                container.style.display = 'none';
            }
            else if (section === "methods-container") {
                // Hide sub-sections if they are empty
                for (let sub_section of method_sub_sections) {
                    let sub_container = document.querySelector(`.${sub_section}`);
                    let sub_h4s_with_content = Array.from(sub_container.querySelectorAll('h4')).some(h4 => h4.textContent.trim());

                    if (sub_container && !sub_h4s_with_content) {
                        sub_container.style.display = 'none';
                    }
                }
            }
        }
    }

    section_change_clean_up = () => {
        let detail_entries = this.content_container_element.querySelectorAll(".details-entry");

        for (let entry of detail_entries) {
            entry.removeEventListener("click", this.toggle_details);
        }
    }
}

new DocViewer();