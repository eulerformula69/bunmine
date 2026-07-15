{
    const scripts: string[] = [
        "/dist/js/core/dom.js",
        "/dist/js/core/i18n.js",
        "/dist/js/core/api.js",
        "/dist/js/subtitles/model.js",
        "/dist/js/subtitles/parser-types.js",
        "/dist/js/subtitles/format-detection.js",
        "/dist/js/subtitles/normalization.js",
        "/dist/js/subtitles/parsing.js",
        "/dist/js/subtitles/parsers/legacy-parser.js",
        "/dist/js/subtitles/parsers/external-parser.js",
        "/libs/media-captions/media-captions.js",
        "/dist/js/subtitles/parsers/media-captions-ass-metadata.js",
        "/dist/js/subtitles/parsers/media-captions-parser.js",
        "/dist/js/subtitles/parser-registry.js",
        "/dist/js/subtitles/parse-subtitle-source.js",
        "/dist/js/core/state.js",
        "/dist/js/player/context.js",
        "/dist/js/player/ui.js",
        "/dist/js/video/types.js",
        "/dist/js/video/media-payload.js",
        "/dist/js/video/upload.js",
        "/dist/js/video/playback-restore.js",
        "/dist/js/video/progress.js",
        "/dist/js/video/video.js",
        "libs/kuromoji/kuromoji.js",
        "/dist/js/japanese/japanese-tokenizer.js",
        "/dist/js/highlighter/subtitles-highlighter.js",
        "/dist/js/highlighter/anki-highlighter.js",
        "/dist/js/subtitles/timing.js",
        "/dist/js/subtitles/context-selection.js",
        "/dist/js/subtitles/search.js",
        "/dist/js/subtitles/search-panel.js",
        "/dist/js/subtitles/comprehension-level.js",
        "/dist/js/subtitles/render-model.js",
        "/dist/js/subtitles/sidebar-render.js",
        "/dist/js/subtitles/navigation.js",
        "/dist/js/subtitles/sidebar-actions.js",
        "/dist/js/subtitles/subtitles.js",
        "/dist/js/subtitles/subtitles-sidebar.js",
        "/dist/js/player/playback-loop.js",
        "/dist/js/player/hotkeys.js",
        "/dist/js/player/toast.js",
        "/dist/js/player/known-basic-actions.js",
        "/dist/js/player/anki-actions.js",
        "/dist/js/player/target-note-dropdown.js",
        "/dist/js/player/auto-attach-queue.js",
        "/dist/js/video/audio-preview.js",
        "/dist/js/player/app.js",
        "/dist/js/player/settings.js",
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
