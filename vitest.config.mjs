import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./galaxy_engine/static/galaxy_engine/js/tests/setup.js"],
        include: ["galaxy_engine/static/galaxy_engine/js/tests/**/*.test.js"],
    },
});
