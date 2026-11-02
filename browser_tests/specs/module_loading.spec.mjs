/**
 * @file module_loading.spec.mjs
 * @description
 *     B6 - Packaging and load paths: the native ES module entry and every module it imports load from the static path, unmodified, with no failed
 *     request and nothing fetched beyond the entry's own import graph. The expected graph is read from the source files themselves, so a broken or
 *     missing relative import shows up as a difference between what the files say and what the browser fetched.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { collect_browser_reports, expect_clean_load, open_engine_page, record_observation } from "./helpers.mjs";

const JS_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "galaxy_engine", "static", "galaxy_engine", "js");
const STATIC_URL_PREFIX = "/static/galaxy_engine/js/";
const STATIC_IMPORT_PATTERN = /^\s*(?:import|export)\s[^;]*?\sfrom\s+["'](\.{1,2}\/[^"']+)["']/gm;

/**
 * Follows the static relative imports from a module, returning every module reached, as paths relative to the js folder.
 * @param {string} entry_relative_path - e.g. "GalaxyEngine.js".
 * @return {string[]}
 */
const read_import_graph = (entry_relative_path) => {
    let reached = new Set();
    let pending = [entry_relative_path];

    while (pending.length > 0) {
        let relative_path = pending.pop();

        if (reached.has(relative_path)) {
            continue;
        }

        reached.add(relative_path);

        let source = fs.readFileSync(path.join(JS_DIRECTORY, relative_path), "utf8");

        for (let match of source.matchAll(STATIC_IMPORT_PATTERN)) {
            let imported_path = path.posix.normalize(path.posix.join(path.posix.dirname(relative_path), match[1]));
            pending.push(imported_path);
        }
    }

    return [...reached].sort();
};

test("the entry and exactly its import graph load from the static path, all successfully", async ({ page }) => {
    let expected_modules = read_import_graph("GalaxyEngine.js");
    let responses = [];

    page.on("response", (response) => {
        responses.push({url: response.url(), status: response.status(), content_type: response.headers()["content-type"]});
    });

    let reports = await open_engine_page(page);

    let module_responses = responses.filter((response) => new URL(response.url).pathname.startsWith(STATIC_URL_PREFIX));
    let loaded_modules = module_responses.map((response) => new URL(response.url).pathname.slice(STATIC_URL_PREFIX.length)).sort();
    let unexpected_requests = reports.requested_urls.filter((url) => {
        let pathname = new URL(url).pathname;

        return pathname !== "/engine.html" && !pathname.startsWith(STATIC_URL_PREFIX);
    });

    expect(loaded_modules).toEqual(expected_modules);
    expect(module_responses.every((response) => response.status === 200)).toBe(true);
    expect(module_responses.every((response) => response.content_type.startsWith("text/javascript"))).toBe(true);
    expect(unexpected_requests).toEqual([]);
    expect_clean_load(reports);
    await record_observation(test.info(), "module requests", {count: loaded_modules.length});
});

test("the optional standalone modules outside the entry's graph load on their own", async ({ page }) => {
    let entry_graph = new Set(read_import_graph("GalaxyEngine.js"));
    let standalone_modules = fs.readdirSync(JS_DIRECTORY).filter((file_name) => file_name.endsWith(".js") && !entry_graph.has(file_name)).sort();

    let reports = collect_browser_reports(page);
    await page.goto("/blank.html");

    let load_results = await page.evaluate(async ({ module_names, prefix }) => {
        let results = {};

        for (let module_name of module_names) {
            try {
                let exported = await import(`${prefix}${module_name}`);
                results[module_name] = Object.keys(exported).sort();
            }
            catch (error) {
                results[module_name] = `${error.name}: ${error.message}`;
            }
        }

        return results;
    }, {module_names: standalone_modules, prefix: STATIC_URL_PREFIX});

    // Each loads and exports something; a load failure would be a string here instead of an export list.
    for (let module_name of standalone_modules) {
        expect(Array.isArray(load_results[module_name]), `${module_name}: ${load_results[module_name]}`).toBe(true);
        expect(load_results[module_name].length).toBeGreaterThan(0);
    }

    expect_clean_load(reports);
    await record_observation(test.info(), "standalone modules", load_results);
});

test("the harness refuses the package's jsdom test folder, so its polyfill can never load in a browser", async ({ request }) => {
    let response = await request.get(`${STATIC_URL_PREFIX}tests/setup.js`);

    expect(response.status()).toBe(403);
});
