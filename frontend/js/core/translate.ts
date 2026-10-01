import { i18n,I18nCatalog } from "./i18n.js";
import { state } from "./state.js";

export function t(
    key: string,
    params: Record<string, unknown> = {},
    language = state.currentLang,
    catalog: I18nCatalog = i18n
): string {
    let text = catalog[language]?.dict[key] || catalog.en.dict[key] || key;
    for (const [name, value] of Object.entries(params)) {
        text = text.split(`{${name}}`).join(String(value));
    }
    return text;
}
