{
    const scripts: string[] = [
        "js/core/api.js",
        "js/library/library-api.js",
        "js/library/library.js",
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
