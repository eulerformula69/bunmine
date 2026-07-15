{
    const scripts: string[] = [
        "/dist/js/core/api.js",
        "/dist/js/library/library-api.js",
        "/dist/js/library/library-types.js",
        "/dist/js/library/library-i18n.js",
        "/dist/js/library/library-presentation.js",
        "/dist/js/library/library-bulk-model.js",
        "/dist/js/library/library.js",
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
    })();
}
