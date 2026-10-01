import fs from "node:fs";
import { JSDOM } from "jsdom";

export function installDom(page = "player") {
    const html = fs.readFileSync(`frontend/${page}.html`, "utf8");
    const dom = new JSDOM(html, { url: "http://localhost:5000/", pretendToBeVisual: true });
    for (const key of ["window", "document", "localStorage", "Node", "Element", "HTMLElement", "HTMLMediaElement", "HTMLInputElement", "HTMLButtonElement", "HTMLSelectElement", "Event", "MouseEvent", "CustomEvent", "MutationObserver", "getComputedStyle"]) {
        Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? dom.window : dom.window[key] });
    }
    dom.window.HTMLMediaElement.prototype.play = async function () {};
    dom.window.HTMLMediaElement.prototype.pause = function () {};
    dom.window.HTMLMediaElement.prototype.load = function () {};
    globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
    globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
    globalThis.ResizeObserver = class {
        observe() {}
        disconnect() {}
        unobserve() {}
    };
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
    dom.window.HTMLElement.prototype.scrollTo = function () {};
    return dom;
}
