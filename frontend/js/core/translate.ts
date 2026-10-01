import { i18n, TranslationKey, TranslationParams } from "./i18n.js";
import { state } from "./state.js";

export function t(key: TranslationKey, params: TranslationParams = {}, language = state.currentLang): string {
    let text = i18n[language]?.dict[key] || i18n.en.dict[key] || key;
    for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
    }
    return text;
}

export function createTranslator(language: () => string) {
    return (key: TranslationKey, params: TranslationParams = {}): string => t(key, params, language());
}
