export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K, className = "", text?: string | number,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
}

export function requireElement<T extends HTMLElement>(
    selector: string, constructor: { new(): T },
): T {
    const element = document.querySelector(selector);
    if (!(element instanceof constructor)) {
        throw new Error(`Required element ${selector} is missing or has the wrong type`);
    }
    return element;
}

export function coverImage(url: string, fallback: string): HTMLElement {
    if (!url) return el("span", "cover-letter", fallback);
    const image = el("img");
    image.src = url;
    image.alt = "";
    return image;
}
