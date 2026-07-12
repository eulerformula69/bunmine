function getSettingsInput(id) {
    return document.getElementById(id);
}
function getSettingsSelect(id) {
    return document.getElementById(id);
}
function enableWheelOnSettings() {
    const settingsInputs = document.querySelectorAll("#settingsModal input[type=\"number\"], #settingsModal input[type=\"range\"]");
    settingsInputs.forEach((input) => {
        input.addEventListener("wheel", (e) => {
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
            if (step < 1)
                input.value = String(parseFloat(newValue.toFixed(Math.max(0, -Math.log10(step)))));
            else
                input.value = String(Math.round(newValue));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        }, { passive: false });
    });
}
function collectSettings() {
    return {
        language: currentLang,
        fontSize: getSettingsInput("fontSizeRange").value,
        offsetStart: getSettingsInput("subOffsetStart").value,
        offsetEnd: getSettingsInput("subOffsetEnd").value,
        audioVol: getSettingsInput("audioVol").value,
        playerVolume: getSettingsInput("volume")?.value || "1",
        ankiUrl: getSettingsInput("ankiUrl").value,
        deckName: getSettingsInput("deckName").value,
        screenshotMode: getSettingsSelect("screenshotMode").value,
        globalSubDelay: getSettingsInput("globalSubDelay").value,
        sidebarWidth: document.getElementById("sidebar").style.width,
        sentenceField: getSettingsInput("sentenceField").value,
        sentenceFuriganaField: getSettingsInput("sentenceFuriganaField").value,
        pictureField: getSettingsInput("pictureField").value,
        audioField: getSettingsInput("audioField").value,
        includeImageSubtitle: getSettingsInput("includeImageSubtitle").checked,
        subtitleHighlightEnabled: getSettingsInput("subtitleHighlightEnabled")?.checked ?? true,
        highlightColorNew: getSettingsInput("highlightColorNew")?.value || "#ffcc66",
        highlightColorLearning: getSettingsInput("highlightColorLearning")?.value || "#66ccff",
        highlightColorYoung: getSettingsInput("highlightColorYoung")?.value || "#66ccff",
        highlightColorMature: getSettingsInput("highlightColorMature")?.value || "#88ff88",
        highlightColorSuspended: getSettingsInput("highlightColorSuspended")?.value || "#999999",
        highlightColorUnknown: getSettingsInput("highlightColorUnknown")?.value || "#ffffff",
        highlightDeckNames: getSettingsInput("highlightDeckNames")?.value || "",
        highlightWordField: getSettingsInput("highlightWordField")?.value || "Word",
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
function saveSettingsLocal({ silent = false } = {}) {
    const settings = collectSettings();
    localStorage.setItem("subtitlePlayerSettings", JSON.stringify(settings));
    if (!silent)
        showToast("Settings saved", "success");
    return settings;
}
function saveSettings() {
    const settings = saveSettingsLocal({ silent: true });
    saveAnkiHighlightAutoRefreshSettings(settings).catch((err) => {
        console.warn("Failed to save Anki highlight auto-refresh settings:", err);
        showToast?.(err?.message || String(err), "error", 6000);
    });
    showToast("Settings saved", "success");
}
async function saveAnkiHighlightAutoRefreshSettings(settings) {
    if (typeof apiJson !== "function")
        return;
    const decks = String(settings.highlightDeckNames || "")
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const wordFields = String(settings.highlightWordField || "Word")
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const { response, data } = await apiJson("/known-anki-words/auto-refresh-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ankiUrl: settings.ankiUrl || "",
            decks,
            wordFields,
            autoRefresh: settings.ankiHighlightAutoRefreshInterval || "off"
        })
    });
    if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to save Anki highlight auto-refresh settings");
    }
}
function loadSettings() {
    const saved = localStorage.getItem("subtitlePlayerSettings");
    if (!saved) {
        initLangSelector();
        applyLanguage(currentLang);
        return;
    }
    const settings = JSON.parse(saved);
    if (settings.language)
        currentLang = settings.language;
    initLangSelector();
    applyLanguage(currentLang);
    if (settings.sidebarWidth) {
        const sidebarEl = document.getElementById("sidebar");
        if (sidebarEl)
            sidebarEl.style.width = settings.sidebarWidth;
    }
    const subtitleHighlightEnabled = getSettingsInput("subtitleHighlightEnabled");
    if (subtitleHighlightEnabled) {
        subtitleHighlightEnabled.checked = settings.subtitleHighlightEnabled ?? true;
    }
    const highlightColorNew = getSettingsInput("highlightColorNew");
    if (highlightColorNew) {
        highlightColorNew.value = settings.highlightColorNew || "#77b7d8";
    }
    const highlightColorLearning = getSettingsInput("highlightColorLearning");
    if (highlightColorLearning) {
        highlightColorLearning.value = settings.highlightColorLearning || "#ff8a3d";
    }
    const highlightColorYoung = getSettingsInput("highlightColorYoung");
    if (highlightColorYoung) {
        highlightColorYoung.value = settings.highlightColorYoung || "#7ec77a";
    }
    const highlightColorMature = getSettingsInput("highlightColorMature");
    if (highlightColorMature) {
        highlightColorMature.value = settings.highlightColorMature || "#2f9d4f";
    }
    const highlightColorSuspended = getSettingsInput("highlightColorSuspended");
    if (highlightColorSuspended) {
        highlightColorSuspended.value = settings.highlightColorSuspended || "#ffde4a";
    }
    const highlightColorUnknown = getSettingsInput("highlightColorUnknown");
    if (highlightColorUnknown) {
        highlightColorUnknown.value = settings.highlightColorUnknown || "#ffffff";
    }
    const highlightDeckNames = getSettingsInput("highlightDeckNames");
    if (highlightDeckNames) {
        highlightDeckNames.value = settings.highlightDeckNames || "";
    }
    const highlightWordField = getSettingsInput("highlightWordField");
    if (highlightWordField) {
        highlightWordField.value = settings.highlightWordField || "Word";
    }
    const ankiHighlightAutoRefreshInterval = getSettingsSelect("ankiHighlightAutoRefreshInterval");
    if (ankiHighlightAutoRefreshInterval) {
        ankiHighlightAutoRefreshInterval.value = settings.ankiHighlightAutoRefreshInterval || settings.ankiHighlightAutoRefresh || "daily";
    }
    const comprehensionVisibilityMapping = {
        showComprehensionI0: settings.showComprehensionI0,
        showComprehensionI1: settings.showComprehensionI1,
        showComprehensionI2: settings.showComprehensionI2,
        showComprehensionI3: settings.showComprehensionI3,
        showComprehensionI4: settings.showComprehensionI4,
        showComprehensionI5Plus: settings.showComprehensionI5Plus
    };
    for (const [id, value] of Object.entries(comprehensionVisibilityMapping)) {
        const el = getSettingsInput(id);
        if (el)
            el.checked = value !== false;
    }
    const mapping = {
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
    if (delayEl)
        globalSubDelay = parseFloat(delayEl.value) || 0;
    const includeImageSubtitleEl = getSettingsInput("includeImageSubtitle");
    if (includeImageSubtitleEl) {
        includeImageSubtitleEl.checked = settings.includeImageSubtitle !== false;
    }
    const autoAttachNextCardEnabled = getSettingsInput("autoAttachNextCardEnabled");
    if (autoAttachNextCardEnabled) {
        autoAttachNextCardEnabled.checked = settings.autoAttachNextCardEnabled === true;
    }
    const playerVolumeEl = getSettingsInput("volume");
    if (playerVolumeEl && typeof video !== "undefined") {
        video.volume = Math.max(0, Math.min(1, parseFloat(playerVolumeEl.value) || 1));
    }
}
function applyLanguage(lang) {
    currentLang = lang;
    const dictionary = i18n[lang].dict;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key && dictionary[key])
            el.textContent = dictionary[key];
    });
    if (typeof sidebar !== "undefined" && toggleBtn) {
        const langKey = sidebar.classList.contains("hidden") ? "showSubs" : "hideSubs";
        toggleBtn.textContent = dictionary[langKey];
    }
    const autoOption = document.querySelector("#targetNoteSelect option[value='']");
    if (autoOption && dictionary.lastAdded) {
        autoOption.textContent = dictionary.lastAdded;
    }
    if (typeof updateFullscreenButtonText === "function") {
        updateFullscreenButtonText();
    }
    if (typeof updateSubtitleSearchPanelLanguage === "function") {
        updateSubtitleSearchPanelLanguage();
    }
}
function initLangSelector() {
    const langSelect = getSettingsSelect("interfaceLangSelect");
    if (!langSelect)
        return;
    langSelect.innerHTML = "";
    Object.keys(i18n).forEach((langCode) => {
        const opt = document.createElement("option");
        opt.value = langCode;
        opt.textContent = i18n[langCode].name;
        langSelect.appendChild(opt);
    });
    langSelect.value = currentLang;
    langSelect.onchange = (e) => {
        applyLanguage(e.target.value);
        queueSettingsAutosave();
    };
}
let settingsAutosaveTimer = null;
function queueSettingsAutosave() {
    clearTimeout(settingsAutosaveTimer);
    settingsAutosaveTimer = setTimeout(() => {
        try {
            saveSettingsLocal({ silent: true });
        }
        catch (err) {
            console.warn("Settings autosave failed:", err);
        }
    }, 250);
}
function initSettingsAutosave() {
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
        if (!el)
            return;
        el.addEventListener("input", queueSettingsAutosave);
        el.addEventListener("change", queueSettingsAutosave);
    });
}
getSettingsInput("saveSettingsBtn").onclick = saveSettings;
window.addEventListener("load", loadSettings);
window.addEventListener("load", initSettingsAutosave);
enableWheelOnSettings();
initLangSelector();
applyLanguage(currentLang);
const langSelect = getSettingsSelect("interfaceLangSelect");
if (langSelect) {
    langSelect.onchange = (e) => {
        applyLanguage(e.target.value);
        queueSettingsAutosave();
    };
}
