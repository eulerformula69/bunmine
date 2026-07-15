interface KnownBasicActionsOptions {
    tokenize: (text: string) => Promise<Array<Record<string, unknown>>>;
    request: (path: string, options: RequestInit) => Promise<{ response: Response; data: ApiPayload }>;
    translate: (key: string, params?: Record<string, unknown>) => string;
    toast: (message: string, kind?: string, duration?: number) => void;
    markMature: (word: string) => void;
    hideButton: () => void;
    clearSelection: () => void;
    copyText: (text: string) => Promise<void>;
}

function createKnownBasicActions(options: KnownBasicActionsOptions) {
    async function dictionaryForm(rawWord: unknown): Promise<string> {
        const selected = String(rawWord || "").trim();
        if (!selected) return "";

        try {
            const tokens = await options.tokenize(selected);
            if (!Array.isArray(tokens) || !tokens.length) return selected;

            const meaningful = tokens.filter((token) => {
                const surface = String(token.surface_form || "").trim();
                const partOfSpeech = String(token.pos || "");
                return surface && !["記号", "助詞", "助動詞"].includes(partOfSpeech);
            });
            if (meaningful.length !== 1 || String(meaningful[0].pos || "") !== "動詞") {
                return selected;
            }

            const basic = String(meaningful[0].basic_form || "").trim();
            return basic && basic !== "*" ? basic : selected;
        } catch (error) {
            console.warn("Known-basic dictionary form lookup failed:", error);
            return selected;
        }
    }

    async function addWord(word: unknown): Promise<void> {
        const originalWord = String(word || "").trim();
        const cleanWord = await dictionaryForm(originalWord);
        if (!cleanWord) {
            options.toast(options.translate("toastNoWordSelected"), "error", 3000);
            return;
        }

        try {
            const { response, data } = await options.request("/known-basic-words/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ word: cleanWord }),
            });
            if (!response.ok || data.error) throw new Error(String(data.error || "Could not add word"));

            options.markMature(cleanWord);
            options.clearSelection();
            options.hideButton();
            if (data.added) {
                const label = originalWord && originalWord !== cleanWord
                    ? `${originalWord} → ${cleanWord}`
                    : cleanWord;
                options.toast(`Added to known-basic: ${label}`, "success", 3000);
            } else {
                options.toast(options.translate("toastKnownBasicAlreadyExists", { word: cleanWord }), "info", 3000);
            }
        } catch (error) {
            console.error("Known-basic add failed:", error);
            options.toast(options.translate("toastKnownBasicAddFailed", {
                message: error instanceof Error ? error.message : String(error),
            }), "error", 6000);
        }
    }

    async function copyWord(word: unknown): Promise<void> {
        const cleanWord = String(word || "").trim();
        if (!cleanWord) {
            options.toast(options.translate("toastCopiedForYomitan", { word: cleanWord }), "success", 3000);
            return;
        }
        try {
            await options.copyText(cleanWord);
            options.toast(`Copied for Yomitan: ${cleanWord}`, "success", 3000);
        } catch (error) {
            console.error("Copy for Yomitan failed:", error);
            options.toast(options.translate("toastCopyFailed", {
                message: error instanceof Error ? error.message : String(error),
            }), "error", 5000);
        }
    }

    return { dictionaryForm, addWord, copyWord };
}
