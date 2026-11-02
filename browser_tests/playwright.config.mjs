/**
 * @file playwright.config.mjs
 * @description
 *     Real-browser smoke tests for Galaxy Engine, run in Chromium, Firefox and WebKit against the unmodified package files. Kept outside the
 *     `galaxy_engine/` package folder so nothing here is published to PyPI, and separate from the jsdom suite (`npm test`), whose setup file is
 *     never loaded into a browser.
 *
 *     Run with `npm run test:browser`.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.GALAXY_BROWSER_TEST_PORT || 8137);
const IS_CI = Boolean(process.env.CI);

export default defineConfig({
    testDir: "./specs",
    testMatch: "**/*.spec.mjs",
    outputDir: "./test-results",
    fullyParallel: true,
    forbidOnly: IS_CI,
    // No retries: a test that passes only on a retry is a flaky test, and is reported as a failure rather than hidden.
    retries: 0,
    timeout: 30_000,
    reporter: IS_CI
        ? [["list"], ["github"], ["html", {outputFolder: "./playwright-report", open: "never"}], ["json", {outputFile: "./test-results/results.json"}]]
        : [["list"], ["json", {outputFile: "./test-results/results.json"}]],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        trace: "retain-on-failure",
    },
    projects: [
        {name: "chromium", use: {...devices["Desktop Chrome"]}},
        {name: "firefox", use: {...devices["Desktop Firefox"]}},
        {name: "webkit", use: {...devices["Desktop Safari"]}},
    ],
    webServer: {
        // Run from this config's folder, Playwright's default for a web server.
        command: "node static_server.mjs",
        url: `http://127.0.0.1:${PORT}/blank.html`,
        reuseExistingServer: !IS_CI,
        stdout: "ignore",
        stderr: "pipe",
    },
});
