import { logger } from "../core/logger.js";
import { ApiPayload } from "../types/api.js";

import { state } from "../core/state.js";

import { saveSettingsLocal } from "./settings.js";

import { showToast } from "./ui.js";

import { apiJson } from "../core/api.js";

export interface PlayerSettings {
    language?: string;
    fontSize?: string;
    offsetStart?: string;
    offsetEnd?: string;
    audioVol?: string;
    playerVolume?: string;
    ankiUrl?: string;
    deckName?: string;
    screenshotMode?: string;
	globalSubDelay?: string;
    sidebarWidth?: string;
	sentenceField?: string;
	sentenceFuriganaField?: string;
	pictureField?: string;
	audioField?: string;
	includeImageSubtitle?: boolean;
    imageSubtitleMode?: "all" | "timed";
	subtitleHighlightEnabled?: boolean;
	highlightColorNew?: string;
	highlightColorLearning?: string;
	highlightColorYoung?: string;
	highlightColorMature?: string;
	highlightColorSuspended?: string;
	highlightColorUnknown?: string;
	highlightDeckNames?: string;
	highlightWordField?: string;
	ankiSentenceFields?: string;
	ankiHighlightAutoRefresh?: string;
	ankiHighlightAutoRefreshInterval?: string;
	showComprehensionI0?: boolean;
	showComprehensionI1?: boolean;
	showComprehensionI2?: boolean;
	showComprehensionI3?: boolean;
	showComprehensionI4?: boolean;
	showComprehensionI5Plus?: boolean;
    autoAttachNextCardEnabled?: boolean;
}

export interface SaveAnkiHighlightAutoRefreshResponse extends ApiPayload {
    error?: string;
}

export function getSettingsInput(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
}

export function getSettingsSelect(id: string): HTMLSelectElement {
    return document.getElementById(id) as HTMLSelectElement;
}

export function collectSettings(): PlayerSettings {
    return {
        language: state.currentLang,
        fontSize: getSettingsInput("fontSizeRange").value,
        offsetStart: getSettingsInput("subOffsetStart").value,
        offsetEnd: getSettingsInput("subOffsetEnd").value,
        audioVol: getSettingsInput("audioVol").value,
        playerVolume: getSettingsInput("volume")?.value || "1",
        ankiUrl: getSettingsInput("ankiUrl").value,
        deckName: getSettingsInput("deckName").value,
        screenshotMode: getSettingsSelect("screenshotMode").value,
		globalSubDelay: getSettingsInput("globalSubDelay").value,
        sidebarWidth: document.getElementById("sidebar")!.style.width,
		sentenceField: getSettingsInput("sentenceField").value,
		sentenceFuriganaField: getSettingsInput("sentenceFuriganaField").value,
		pictureField: getSettingsInput("pictureField").value,
		audioField: getSettingsInput("audioField").value,
		includeImageSubtitle: getSettingsInput("includeImageSubtitle").checked,
        imageSubtitleMode: getSettingsInput("imageSubtitleMode")?.value === "timed" ? "timed" : "all",
		subtitleHighlightEnabled: getSettingsInput("subtitleHighlightEnabled")?.checked ?? true,
		highlightColorNew: getSettingsInput("highlightColorNew")?.value || "#ffcc66",
		highlightColorLearning: getSettingsInput("highlightColorLearning")?.value || "#66ccff",
		highlightColorYoung: getSettingsInput("highlightColorYoung")?.value || "#66ccff",
		highlightColorMature: getSettingsInput("highlightColorMature")?.value || "#88ff88",
		highlightColorSuspended: getSettingsInput("highlightColorSuspended")?.value || "#999999",
		highlightColorUnknown: getSettingsInput("highlightColorUnknown")?.value || "#ffffff",
		highlightDeckNames: getSettingsInput("highlightDeckNames")?.value || "",
		highlightWordField: getSettingsInput("highlightWordField")?.value || "Word",
		ankiSentenceFields: getSettingsInput("ankiSentenceFields")?.value || "Sentence, Example, ExpressionSentence, Context",
		ankiHighlightAutoRefreshInterval: getSettingsSelect("ankiHighlightAutoRefreshInterval")?.value || "off",
		showComprehensionI0: getSettingsInput("showComprehensionI0")?.checked ?? true,
		showComprehensionI1: getSettingsInput("showComprehensionI1")?.checked ?? true,
		showComprehensionI2: getSettingsInput("showComprehensionI2")?.checked ?? true,
		showComprehensionI3: getSettingsInput("showComprehensionI3")?.checked ?? true,
		showComprehensionI4: getSettingsInput("showComprehensionI4")?.checked ?? true,
		showComprehensionI5Plus: getSettingsInput("showComprehensionI5Plus")?.checked ?? true,
        autoAttachNextCardEnabled: getSettingsInput("autoAttachNextCardEnabled")?.checked ?? false

    };
}

export function saveSettings(): void {
    const settings = saveSettingsLocal({ silent: true });
    saveAnkiHighlightAutoRefreshSettings(settings).catch((err) => {
        logger.warn("Failed to save Anki highlight auto-refresh settings:", err);
        showToast?.(err?.message || String(err), "error", 6000);
    });
    showToast("Settings saved", "success");
}

export async function saveAnkiHighlightAutoRefreshSettings(settings: PlayerSettings): Promise<void> {

    const decks = String(settings.highlightDeckNames || "")
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const wordFields = String(settings.highlightWordField || "Word")
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const sentenceFields = String(settings.ankiSentenceFields || "Sentence, Example, ExpressionSentence, Context")
        .split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

    const { response, data } = await apiJson<SaveAnkiHighlightAutoRefreshResponse>("/known-anki-words/auto-refresh-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ankiUrl: settings.ankiUrl || "",
            decks,
            wordFields,
            sentenceFields,
            autoRefresh: settings.ankiHighlightAutoRefreshInterval || "off"
        })
    });

    if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to save Anki highlight auto-refresh settings");
    }
}
