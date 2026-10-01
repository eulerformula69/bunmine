import { PlayerSettings,collectSettings,getSettingsInput,getSettingsSelect,saveSettings } from "./settings-storage.js";

import { showToast,updateFullscreenButtonText } from "./ui.js";

import { state } from "../core/state.js";

import { video } from "../core/dom.js";

import { i18n } from "../core/i18n.js";

import { updateSubtitleSidebarLabels } from "../subtitles/sidebar-shell.js";

import { candidatePanel } from "./candidate-bindings.js";

import { updateSubtitleSearchPanelLanguage } from "../subtitles/sidebar-actions.js";

export function enableWheelOnSettings(): void {
    const settingsInputs = document.querySelectorAll<HTMLInputElement>("#settingsModal input[type=\"number\"], #settingsModal input[type=\"range\"]");
    settingsInputs.forEach((input) => {
        input.addEventListener("wheel", (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const step = parseFloat(input.step) || 1;
            const direction = e.deltaY < 0 ? 1 : -1;
            let val = parseFloat(input.value) || 0;
            let newValue = val + (direction * step);

            const minAttr = input.getAttribute("min");
            const maxAttr = input.getAttribute("max");
            const min = minAttr !== null ? parseFloat(minAttr) : -Infinity;
            const max = maxAttr !== null ? parseFloat(maxAttr) : Infinity;
            newValue = Math.max(min, Math.min(max, newValue));

            if (step < 1) input.value = String(parseFloat(newValue.toFixed(Math.max(0, -Math.log10(step)))));
            else input.value = String(Math.round(newValue));

            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }, { passive: false });
    });

}

export function saveSettingsLocal({ silent = false }: { silent?: boolean } = {}): PlayerSettings {
    const settings = collectSettings();
    localStorage.setItem("subtitlePlayerSettings", JSON.stringify(settings));
    if (!silent) showToast("Settings saved", "success");
    return settings;
}

export function loadSettings(): void {
    const saved = localStorage.getItem("subtitlePlayerSettings");
    if (!saved) {
        initLangSelector();
        applyLanguage(state.currentLang);
        return;
    }

    const settings = JSON.parse(saved) as PlayerSettings;
    if (settings.language) state.currentLang = settings.language;

    initLangSelector();
    applyLanguage(state.currentLang);

    if (settings.sidebarWidth) {
        const sidebarEl = document.getElementById("sidebar");
        if (sidebarEl) sidebarEl.style.width = settings.sidebarWidth;
    }

	const subtitleHighlightEnabled = getSettingsInput("subtitleHighlightEnabled");
	if (subtitleHighlightEnabled) {
		subtitleHighlightEnabled.checked = settings.subtitleHighlightEnabled ?? true;
	}

    const inputDefaults: Array<[keyof PlayerSettings, string]> = [
    [
        "highlightColorNew",
        "#77b7d8"
    ],
    [
        "highlightColorLearning",
        "#ff8a3d"
    ],
    [
        "highlightColorYoung",
        "#7ec77a"
    ],
    [
        "highlightColorMature",
        "#2f9d4f"
    ],
    [
        "highlightColorSuspended",
        "#ffde4a"
    ],
    [
        "highlightColorUnknown",
        "#ffffff"
    ],
    [
        "highlightDeckNames",
        ""
    ],
    [
        "highlightWordField",
        "Word"
    ],
    [
        "ankiSentenceFields",
        "Sentence, Example, ExpressionSentence, Context"
    ]
];
    for (const [key, fallback] of inputDefaults) {
        const input = getSettingsInput(key);
        if (input) input.value = String(settings[key] || fallback);
    }

	const ankiHighlightAutoRefreshInterval = getSettingsSelect("ankiHighlightAutoRefreshInterval");
	if (ankiHighlightAutoRefreshInterval) {
		ankiHighlightAutoRefreshInterval.value = settings.ankiHighlightAutoRefreshInterval || settings.ankiHighlightAutoRefresh || "daily";
	}

	const comprehensionVisibilityMapping: Record<string, boolean | undefined> = {
		showComprehensionI0: settings.showComprehensionI0,
		showComprehensionI1: settings.showComprehensionI1,
		showComprehensionI2: settings.showComprehensionI2,
		showComprehensionI3: settings.showComprehensionI3,
		showComprehensionI4: settings.showComprehensionI4,
		showComprehensionI5Plus: settings.showComprehensionI5Plus
	};

	for (const [id, value] of Object.entries(comprehensionVisibilityMapping)) {
		const el = getSettingsInput(id);
		if (el) el.checked = value !== false;
	}

    const mapping: Record<string, string | undefined> = {
        fontSizeRange: settings.fontSize,
        subOffsetStart: settings.offsetStart,
        subOffsetEnd: settings.offsetEnd,
        audioVol: settings.audioVol,
        volume: settings.playerVolume,
        ankiUrl: settings.ankiUrl,
        deckName: settings.deckName,
		globalSubDelay: settings.globalSubDelay,
        screenshotMode: settings.screenshotMode,
		sentenceField: settings.sentenceField,
		sentenceFuriganaField: settings.sentenceFuriganaField,
		pictureField: settings.pictureField,
		audioField: settings.audioField
    };

    for (const [id, value] of Object.entries(mapping)) {
        const el = getSettingsInput(id);
        if (el && value !== undefined) {
            el.value = value;
            el.dispatchEvent(new Event("input"));
        }
    }

	const delayEl = getSettingsInput("globalSubDelay");
	if (delayEl) state.globalSubDelay = parseFloat(delayEl.value) || 0;

	const includeImageSubtitleEl = getSettingsInput("includeImageSubtitle");
	if (includeImageSubtitleEl) {
		includeImageSubtitleEl.checked = settings.includeImageSubtitle !== false;
	}
    const imageSubtitleMode = document.getElementById("imageSubtitleMode") as HTMLButtonElement | null;
    if (imageSubtitleMode) imageSubtitleMode.value = settings.imageSubtitleMode === "timed" ? "timed" : "all";
    updateImageSubtitleModeButton();

    const autoAttachNextCardEnabled = getSettingsInput("autoAttachNextCardEnabled");
    if (autoAttachNextCardEnabled) {
        autoAttachNextCardEnabled.checked = settings.autoAttachNextCardEnabled === true;
    }

    const playerVolumeEl = getSettingsInput("volume");
    if (playerVolumeEl && typeof video !== "undefined") {
        video.volume = Math.max(0, Math.min(1, parseFloat(playerVolumeEl.value) || 1));
    }

}

export function applyLanguage(lang: string): void {
    state.currentLang = lang;
    const dictionary = i18n[lang].dict;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key && dictionary[key]) el.textContent = dictionary[key];
    });

    updateSubtitleSidebarLabels();
    updateImageSubtitleModeButton();

    candidatePanel.render();

    const autoOption = document.querySelector<HTMLOptionElement>("#targetNoteSelect option[value='']");
    if (autoOption && dictionary.lastAdded) {
        autoOption.textContent = dictionary.lastAdded;
    }

    updateFullscreenButtonText();

    updateSubtitleSearchPanelLanguage();
}

export function initLangSelector(): void {
    const langSelect = getSettingsSelect("interfaceLangSelect");
    if (!langSelect) return;
    langSelect.innerHTML = "";
    Object.keys(i18n).forEach((langCode) => {
        const opt = document.createElement("option");
        opt.value = langCode;
        opt.textContent = i18n[langCode].name;
        langSelect.appendChild(opt);
    });
    langSelect.value = state.currentLang;
    langSelect.onchange = (e) => {
        applyLanguage((e.target as HTMLSelectElement).value);
        queueSettingsAutosave();
    };
}

export const settingsAutosaveTimerState = { value: null as ReturnType<typeof setTimeout> | null };

export function queueSettingsAutosave(): void {
    clearTimeout(settingsAutosaveTimerState.value ?? undefined);
    settingsAutosaveTimerState.value = setTimeout(() => {
        try {
            saveSettingsLocal({ silent: true });
        } catch (err) {
            console.warn("Settings autosave failed:", err);
        }
    }, 250);
}

export const settingsAutosaveInitializedState = { value: false };

export function initSettingsAutosave(): void {
    if (settingsAutosaveInitializedState.value) return;
    settingsAutosaveInitializedState.value = true;
    const imageSubtitleMode = document.getElementById("imageSubtitleMode") as HTMLButtonElement | null;
    imageSubtitleMode?.addEventListener("click", () => {
        imageSubtitleMode.value = imageSubtitleMode.value === "timed" ? "all" : "timed";
        updateImageSubtitleModeButton();
        saveSettingsLocal({ silent: true });
    });
    getSettingsInput("includeImageSubtitle")?.addEventListener("change", updateImageSubtitleModeButton);
    [
        "fontSizeRange",
        "subOffsetStart",
        "subOffsetEnd",
        "audioVol",
        "volume",
        "ankiUrl",
        "deckName",
        "screenshotMode",
        "globalSubDelay",
        "sentenceField",
        "sentenceFuriganaField",
        "pictureField",
        "audioField",
        "includeImageSubtitle",
        "subtitleHighlightEnabled",
        "highlightColorNew",
        "highlightColorLearning",
        "highlightColorYoung",
        "highlightColorMature",
        "highlightColorSuspended",
        "highlightColorUnknown",
        "highlightDeckNames",
        "highlightWordField",
        "ankiSentenceFields",
        "ankiHighlightAutoRefreshInterval",
        "showComprehensionI0",
        "showComprehensionI1",
        "showComprehensionI2",
        "showComprehensionI3",
        "showComprehensionI4",
        "showComprehensionI5Plus",
        "autoAttachNextCardEnabled",
        "interfaceLangSelect"
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", queueSettingsAutosave);
        el.addEventListener("change", queueSettingsAutosave);
    });
}

export function updateImageSubtitleModeButton(): void {
    const button = document.getElementById("imageSubtitleMode") as HTMLButtonElement | null;
    if (!button) return;
    const timed = button.value === "timed";
    button.dataset.i18n = timed ? "imageSubtitleTimed" : "imageSubtitleAll";
    button.textContent = i18n[state.currentLang].dict[button.dataset.i18n];
    button.title = i18n[state.currentLang].dict.imageSubtitleModeHelp;
    button.setAttribute("aria-pressed", String(timed));
    button.disabled = getSettingsInput("includeImageSubtitle")?.checked === false;
}

getSettingsInput("saveSettingsBtn").onclick = saveSettings;

window.addEventListener("load", loadSettings);

window.addEventListener("load", initSettingsAutosave);

enableWheelOnSettings();

initLangSelector();

applyLanguage(state.currentLang);
