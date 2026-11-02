/**
 * @file static_server.mjs
 * @description
 *     A dependency-free static file server for the browser tests. It serves the package's static files the way a Django site serves them after
 *     `collectstatic` - unchanged, under `/static/` - and the test pages under `/`. Nothing is transformed or bundled, so a test sees exactly the
 *     modules a consumer's browser would load.
 *
 *     Only two folders are reachable: `galaxy_engine/static/` and `browser_tests/fixtures/`. The package's jsdom test folder is refused, so its
 *     ElementInternals recorder polyfill can never reach a real browser, and nothing else in the repository - `.pypirc` included - can be served.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BROWSER_TESTS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_DIRECTORY = path.resolve(BROWSER_TESTS_DIRECTORY, "..");
const STATIC_DIRECTORY = path.join(REPOSITORY_DIRECTORY, "galaxy_engine", "static");
const FIXTURES_DIRECTORY = path.join(BROWSER_TESTS_DIRECTORY, "fixtures");
const REFUSED_STATIC_DIRECTORY = path.join(STATIC_DIRECTORY, "galaxy_engine", "js", "tests");
const PORT = Number(process.env.GALAXY_BROWSER_TEST_PORT || 8137);

const CONTENT_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
};

/**
 * Maps a request path to a file inside one of the two served folders, or null when the path falls outside them.
 * @param {string} url_path - The decoded request path.
 * @return {string|null}
 */
const resolve_file_path = (url_path) => {
    let root_directory = FIXTURES_DIRECTORY;
    let relative_path = url_path;

    if (url_path.startsWith("/static/")) {
        root_directory = STATIC_DIRECTORY;
        relative_path = url_path.slice("/static/".length);
    }

    let file_path = path.resolve(root_directory, `.${path.sep}${relative_path}`);
    let is_inside_root = file_path === root_directory || file_path.startsWith(`${root_directory}${path.sep}`);
    let is_refused = file_path === REFUSED_STATIC_DIRECTORY || file_path.startsWith(`${REFUSED_STATIC_DIRECTORY}${path.sep}`);

    if (!is_inside_root || is_refused) {
        return null;
    }

    return file_path;
};

const server = http.createServer((request, response) => {
    let url_path;

    try {
        url_path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    }
    catch (error) {
        response.writeHead(400).end();
        return;
    }

    if (url_path.endsWith("/")) {
        url_path = `${url_path}index.html`;
    }

    let file_path = resolve_file_path(url_path);

    if (file_path === null) {
        response.writeHead(403).end();
        return;
    }

    fs.readFile(file_path, (error, file_contents) => {
        if (error) {
            response.writeHead(404).end();
            return;
        }

        let content_type = CONTENT_TYPES[path.extname(file_path)] || "application/octet-stream";

        response.writeHead(200, {"Content-Type": content_type, "Cache-Control": "no-store"});
        response.end(file_contents);
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.warn(`Galaxy browser test server on http://127.0.0.1:${PORT}`);
});
