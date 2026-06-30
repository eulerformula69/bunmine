const scripts = [
    "js/core/dom.js",
    "js/core/i18n.js",
    "js/core/api.js",
    "js/core/state.js",
    "js/player/context.js",
    "js/player/ui.js",
    "js/video/video.js",
    "libs/kuromoji/kuromoji.js",
    "js/japanese/japanese-tokenizer.js",
    "js/highlighter/subtitles-highlighter.js",
    "js/highlighter/anki-highlighter.js",
    "js/subtitles/subtitles.js",
    "js/subtitles/subtitles-sidebar.js",
    "js/player/app.js",
    "js/video/audio-tracks.js",
    "js/player/settings.js"
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

if (document.readyState === "complete") {
    window.dispatchEvent(new Event("load"));
}
