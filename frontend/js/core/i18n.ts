import en from "./locales/en.js";
import ja from "./locales/ja.js";
import libraryEn from "./locales/library-en.js";
import libraryJa from "./locales/library-ja.js";
import libraryRu from "./locales/library-ru.js";
import ru from "./locales/ru.js";
export type I18nCatalog = Record<string, {name: string; dict: Record<string,string>}>;
export const i18n: I18nCatalog = {en, ru, ja};
export const libraryI18n: I18nCatalog = {en:libraryEn, ru:libraryRu, ja:libraryJa};
