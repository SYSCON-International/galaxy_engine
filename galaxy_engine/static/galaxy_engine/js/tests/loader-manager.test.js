import { beforeEach, describe, expect, test } from "vitest";
import { GalaxyLoaderManager } from "../GalaxyLoaderManager.js";
import "./loader-test-helpers.js"; // registers <galaxy-loader>
import { flush } from "./loader-test-helpers.js";

describe("GalaxyLoaderManager", () => {
    let manager;

    beforeEach(() => {
        manager = new GalaxyLoaderManager();
    });

    describe("fullscreen loader reference counting", () => {
        test("show_fullscreen creates exactly one <galaxy-loader fullscreen> for concurrent callers", async () => {
            let token_a = manager.show_fullscreen();
            let token_b = manager.show_fullscreen();

            expect(token_a).not.toBe(token_b);
            expect(document.querySelectorAll("galaxy-loader[fullscreen]")).toHaveLength(1);
            expect(manager.is_loading_fullscreen()).toBe(true);

            manager.hide_fullscreen(token_a);
            expect(document.body.contains(manager.fullscreen_loader)).toBe(true); // token_b still holds it open
            expect(manager.is_loading_fullscreen()).toBe(true);

            manager.hide_fullscreen(token_b);
            expect(document.querySelectorAll("galaxy-loader[fullscreen]")).toHaveLength(0);
            expect(manager.is_loading_fullscreen()).toBe(false);
        });

        test("hiding with an unknown token warns and does not remove the loader", async () => {
            manager.show_fullscreen();

            expect(() => manager.hide_fullscreen("not-a-real-token")).not.toThrow();
            expect(manager.is_loading_fullscreen()).toBe(true);
        });

        test("only the first caller's options are applied to the fullscreen loader", async () => {
            manager.show_fullscreen({message: "First"});
            manager.show_fullscreen({message: "Second"});

            await flush();

            expect(manager.fullscreen_loader.message).toBe("First");
        });
    });

    describe("element-scoped loader reference counting", () => {
        test("show_element creates a loader inside the target and reference-counts it", async () => {
            let target = document.createElement("div");
            document.body.appendChild(target);

            let token_a = manager.show_element(target);
            let token_b = manager.show_element(target);

            expect(target.querySelectorAll("galaxy-loader")).toHaveLength(1);
            expect(manager.is_loading_element(target)).toBe(true);

            manager.hide_element(target, token_a);
            expect(target.querySelectorAll("galaxy-loader")).toHaveLength(1); // token_b still holds it open

            manager.hide_element(target, token_b);
            expect(target.querySelectorAll("galaxy-loader")).toHaveLength(0);
            expect(manager.is_loading_element(target)).toBe(false);
        });

        test("a statically-positioned target is switched to relative and restored after full release", async () => {
            let target = document.createElement("div");
            document.body.appendChild(target);

            expect(window.getComputedStyle(target).position).toBe("static");

            let token = manager.show_element(target);
            expect(target.style.position).toBe("relative");

            manager.hide_element(target, token);
            expect(target.style.position).toBe("");
        });

        test("a target that already has explicit positioning is left alone", async () => {
            let target = document.createElement("div");
            target.style.position = "absolute";
            document.body.appendChild(target);

            let token = manager.show_element(target);
            expect(target.style.position).toBe("absolute");

            manager.hide_element(target, token);
            expect(target.style.position).toBe("absolute");
        });

        test("show_element with no target warns and returns null", () => {
            expect(manager.show_element(null)).toBeNull();
        });

        test("hiding with an unknown token warns and does not remove the loader", async () => {
            let target = document.createElement("div");
            document.body.appendChild(target);

            manager.show_element(target);

            expect(() => manager.hide_element(target, "not-a-real-token")).not.toThrow();
            expect(manager.is_loading_element(target)).toBe(true);
        });

        test("element_loader_entries is a WeakMap, not a Map (fix #2)", () => {
            expect(manager.element_loader_entries).toBeInstanceOf(WeakMap);
        });
    });
});
