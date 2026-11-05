import { readMachineSettings, writeMachineSettings } from "../core/machine-settings.js";
import { i18n as LIBRARY_I18N } from "../core/i18n.js";
import { createTranslator } from "../core/translate.js";
export { LIBRARY_I18N };
export const libraryCurrentLangState = { value: loadLibraryLanguage() };

export function loadLibraryLanguage() {
    try {
        const settings = readMachineSettings();
        return LIBRARY_I18N[settings.language] ? settings.language : "en";
    } catch {
        return "en";
    }
}

export const lt = createTranslator(() => libraryCurrentLangState.value);
