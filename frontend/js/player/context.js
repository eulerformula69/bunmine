function createPlayerContext() {
    return {
        dom,
        state: window.BunmineState,
        i18n,
        getLanguageDict() {
            return i18n[window.BunmineState.currentLang]?.dict
                || i18n.en?.dict
                || {};
        }
    };
}
window.BunminePlayerContext = createPlayerContext();
const playerContext = window.BunminePlayerContext;
