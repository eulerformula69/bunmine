const scripts = [
    "js/core/api.js",
    "js/library/library.js"
];

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.defer = false;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.appendChild(script);
    });
}

for (const src of scripts) {
    await loadScript(src);
}
