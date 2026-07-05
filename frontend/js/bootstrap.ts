{
    const scripts: string[] = [
        "js/core/dom.js",
        "js/core/i18n.js",
        "js/core/api.js",
        "js/core/state.js",
        "js/player/context.js",
        "js/player/ui.js",
        "js/video/types.js",
        "js/video/media-payload.js",
        "js/video/upload.js",
        "js/video/playback-restore.js",
        "js/video/progress.js",
        "js/video/video.js",
        "libs/kuromoji/kuromoji.js",
        "js/japanese/japanese-tokenizer.js",
        "js/highlighter/subtitles-highlighter.js",
        "js/highlighter/anki-highlighter.js",
        "js/subtitles/parsing.js",
        "js/subtitles/timing.js",
        "js/subtitles/context-selection.js",
        "js/subtitles/search.js",
        "js/subtitles/search-panel.js",
        "js/subtitles/comprehension-level.js",
        "js/subtitles/render-model.js",
        "js/subtitles/sidebar-render.js",
        "js/subtitles/navigation.js",
        "js/subtitles/sidebar-actions.js",
        "js/subtitles/subtitles.js",
        "js/subtitles/subtitles-sidebar.js",
        "js/player/playback-loop.js",
        "js/player/hotkeys.js",
        "js/player/toast.js",
        "js/player/anki-actions.js",
        "js/player/app.js",
        "js/video/audio-tracks.js",
        "js/player/settings.js",
    ];

    const loadScript = (src: string): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");

            script.src = src;
            script.async = false;
            script.defer = false;

            script.onload = () => resolve();

            script.onerror = () => {
                reject(new Error(`Could not load ${src}`));
            };

            document.head.appendChild(script);
        });
    };

    (async (): Promise<void> => {
        for (const src of scripts) {
            await loadScript(src);
        }

        if (document.readyState === "complete") {
            window.dispatchEvent(new Event("load"));
        }
    })();
}
