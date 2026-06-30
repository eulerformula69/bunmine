interface PlayerContext {
    dom: PlayerDom;
    state: BunmineState;
    i18n: I18nCatalog;
    getLanguageDict(): Record<string, string>;
}

interface Window {
    BunminePlayerContext: PlayerContext;
}

function createPlayerContext(): PlayerContext {
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
