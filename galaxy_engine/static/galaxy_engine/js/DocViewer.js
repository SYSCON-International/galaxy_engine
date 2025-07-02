export class DocViewer {

    constructor() {
        window.addEventListener("hashchange", this.load_section);

        this.content_container_element = document.querySelector(".content-container");

        this.load_section();
    }

    load_section = () => {
        let section = location.hash.substring(1) || "home";

        fetch(`/docs/${section}/`)
            .then(res => {
                if (!res.ok) throw new Error("404 Not Found");
                return res.text();
            })
            .then(html => {
                this.content_container_element.innerHTML = html;
            })
            .catch(error => {
                this.content_container_element.innerHTML = `<p>Section not found.</p>`;
            });
        };
}

new DocViewer();