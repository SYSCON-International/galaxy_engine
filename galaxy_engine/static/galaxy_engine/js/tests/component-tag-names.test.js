import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Both files are read as text: importing GalaxyEngine.js would self-instantiate a full engine as a side effect (see setup.js).
const read_source = (relative_path) => {
    return readFileSync(fileURLToPath(new URL(relative_path, import.meta.url)), "utf8");
};

const get_registered_tag_names = () => {
    let loader_source = read_source("../GalaxyComponentsLoader.js");

    return [...loader_source.matchAll(/customElements\.define\(\s*['"]([a-z0-9-]+)['"]/g)].map((match) => {
        return match[1].toUpperCase();
    });
};

const get_listed_tag_names = () => {
    let engine_source = read_source("../GalaxyEngine.js");
    let list_body = engine_source.match(/GALAXY_COMPONENT_TAG_NAMES\s*=\s*\{([\s\S]*?)\}/)[1];

    return [...list_body.matchAll(/[A-Z_]+:\s*"([A-Z0-9-]+)"/g)].map((match) => {
        return match[1];
    });
};

describe("GALAXY_COMPONENT_TAG_NAMES", () => {
    test("lists exactly the tags GalaxyComponentsLoader registers", () => {
        let registered_tag_names = get_registered_tag_names();
        let listed_tag_names = get_listed_tag_names();

        expect(registered_tag_names.length).toBeGreaterThan(0);
        expect([...listed_tag_names].sort()).toEqual([...registered_tag_names].sort());
    });

    test("lists each tag once", () => {
        let listed_tag_names = get_listed_tag_names();

        expect(new Set(listed_tag_names).size).toBe(listed_tag_names.length);
    });
});
