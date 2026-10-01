import en from "./locales/en.js";
import ja from "./locales/ja.js";
import ru from "./locales/ru.js";

export type TranslationKey = keyof typeof en.dict;
export type TranslationParams = Record<string, unknown>;
export type I18nCatalog = Record<string, {name: string; dict: Record<TranslationKey, string>}>;
export const i18n: I18nCatalog = {
    en,
    ru: {...ru, dict: {...en.dict, ...ru.dict}},
    ja: {...ja, dict: {...en.dict, ...ja.dict}},
};

export function isTranslationKey(key: string): key is TranslationKey {
    return Object.hasOwnProperty.call(en.dict, key);
}
