import { libraryI18n as LIBRARY_I18N } from "../core/i18n.js";
import { t } from "../core/translate.js";
export { LIBRARY_I18N };
export const libraryCurrentLangState = { value: loadLibraryLanguage() };

export function loadLibraryLanguage() {
    try {
        const settings = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}");
        return LIBRARY_I18N[settings.language] ? settings.language : "en";
    } catch {
        return "en";
    }
}

export function lt(key: string, params: Record<string, unknown> = {}): string {
    return t(key, params, libraryCurrentLangState.value, LIBRARY_I18N);
}
