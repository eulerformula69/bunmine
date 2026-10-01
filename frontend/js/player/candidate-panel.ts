import { candidateApi } from "./candidate-api.js";

import { createCandidateContextEditor } from "./candidate-context-editor.js";

import { MiningCandidate } from "./candidate-model.js";

import { CandidateContext } from "./candidate-context-model.js";

import { t } from "../core/translate.js";

import { VideoFilePayload } from "../types/runtime-types.js";

import { formatTime } from "../core/formatters.js";

export function createCandidatePanel(options: {
    list?: typeof candidateApi.list;
    createEditor?: typeof createCandidateContextEditor;
    sidebar: HTMLElement;
    busy(): boolean;
    select(candidate: MiningCandidate): Promise<CandidateContext | null | void>;
    saveContext(candidate: MiningCandidate, context: CandidateContext, start: number, end: number): Promise<MiningCandidate>;
    acquire(candidate: MiningCandidate): Promise<void>;
    reject(candidate: MiningCandidate): Promise<void>;
    error(error: unknown): void;
    playback?(candidate: MiningCandidate | undefined, restart: boolean): void;
}) {
    const tabs = document.createElement("div");
    tabs.className = "candidate-tabs";
    tabs.setAttribute("role", "tablist");
    const subtitleTab = document.createElement("button");
    subtitleTab.textContent = t("subtitlesPanelTitle");
    const candidateTab = document.createElement("button");
    const panel = document.createElement("section");
    panel.id = "candidatePanel";
    panel.hidden = true;
    panel.setAttribute("aria-label", t("candidateTitle"));
    const list = document.createElement("div");
    list.className = "candidate-list";
    const editor = (options.createEditor || createCandidateContextEditor)({
        editing: (value) => { editing = value; render(); },
        error: options.error,
        change: async (start, end) => {
            if (!active || !editorContext) return;
            savingContext = true;
            let updated: MiningCandidate;
            try { updated = await options.saveContext(active, editorContext, start, end); }
            finally { savingContext = false; }
            candidates = candidates.map((item) => item.id === updated.id ? updated : item);
            active = updated;
            editorContext = updated.snapshot.context || null;
            options.playback?.(active, false);
            render();
        },
    });
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const add = document.createElement("button");
    add.textContent = t("candidateAdd");
    const skip = document.createElement("button");
    skip.textContent = t("candidateSkip");
    const actions = document.createElement("div");
    actions.className = "candidate-actions";
    actions.append(add, skip);
    panel.append(list, editor.element, actions, status);
    tabs.append(subtitleTab, candidateTab);
    options.sidebar.querySelector(".subtitle-sidebar-header")!.after(tabs);
    options.sidebar.append(panel);
    const counter = document.createElement("button");
    counter.type = "button";
    counter.id = "candidateCount";
    counter.title = t("candidateOpen");
    document.getElementById("toggleSubs")?.after(counter);
    counter.onclick = () => {
        if (options.sidebar.classList.contains("hidden")) document.getElementById("toggleSubs")?.click();
        showCandidates(true);
    };
    let candidates: MiningCandidate[] = [];
    let active: MiningCandidate | undefined;
    let selecting = false;
    let editing = false;
    let savingContext = false;
    let editorContext: CandidateContext | null = null;

    function showCandidates(show: boolean): void {
        options.sidebar.classList.toggle("review-candidates", show);
        panel.hidden = !show;
        subtitleTab.setAttribute("aria-selected", String(!show));
        candidateTab.setAttribute("aria-selected", String(show));
        options.playback?.(show ? active : undefined, false);
    }
    for (const tab of [subtitleTab, candidateTab]) {
        tab.type = "button";
        tab.setAttribute("role", "tab");
    }
    subtitleTab.onclick = () => showCandidates(false);
    candidateTab.onclick = () => showCandidates(true);
    showCandidates(false);

    function render(): void {
        subtitleTab.textContent = t("subtitlesPanelTitle");
        panel.setAttribute("aria-label", t("candidateTitle"));
        counter.title = t("candidateOpen");
        skip.textContent = t("candidateSkip");
        candidateTab.textContent = `${t("candidateTitle")} · ${candidates.length}`;
        counter.textContent = `${t("candidateTitle")}: ${candidates.length}`;
        const listScroll = list.scrollTop;
        list.replaceChildren();
        if (!candidates.length) list.textContent = t("candidateEmpty");
        for (const candidate of candidates) {
            const button = document.createElement("button");
            button.className = "candidate-item";
            button.type = "button";
            const source = candidate.episode_id ? t("candidateEpisode", { id: candidate.episode_id })
                : (candidate.snapshot.videoPayload as VideoFilePayload).filename;
            button.textContent = `${candidate.snapshot.selectedWord} · ${source} · ${formatTime(candidate.snapshot.targetTime)}`;
            button.setAttribute("aria-pressed", String(active?.id === candidate.id));
            button.disabled = options.busy() || selecting || editing;
            button.onclick = () => { void select(candidate); };
            list.append(button);
        }
        list.scrollTop = listScroll;
        editor.set(active, editorContext, options.busy() || selecting || editing);
        add.textContent = active?.anki_note_id ? t("candidateRetry") : t("candidateAdd");
        add.disabled = skip.disabled = !active || options.busy() || selecting || editing;
    }
    async function select(candidate: MiningCandidate): Promise<void> {
        if (options.busy() || selecting || editing) return;
        status.textContent = "";
        active = candidate;
        editorContext = candidate.snapshot.context || null;
        selecting = true;
        render();
        options.playback?.(undefined, false);
        try {
            editorContext = await options.select(candidate) || editorContext;
            editor.focus?.();
            if (!panel.hidden) options.playback?.(active, true);
        }
        catch (error) { options.error(error); }
        finally { selecting = false; render(); }
    }
    async function perform(action: (candidate: MiningCandidate) => Promise<void>): Promise<void> {
        if (!active || selecting || editing || options.busy()) return;
        const work = action(active);
        render();
        try { await work; }
        catch (error) { options.error(error); }
        finally { render(); }
    }
    add.onclick = () => { void perform(options.acquire); };
    skip.onclick = () => { void perform(options.reject); };
    return {
        render,
        exportCandidateId(): number | undefined {
            if (panel.hidden || !active) return undefined;
            if (selecting || (editing && !savingContext)) throw new Error(t("candidateSaving"));
            return active.id;
        },
        status: (message: string) => { status.textContent = message; },
        async refresh(): Promise<void> {
            if (editing) return;
            const loaded = await (options.list || candidateApi.list)();
            if (editing) return;
            candidates = loaded;
            const previous = active?.id;
            active = candidates.find((item) => item.id === previous);
            editorContext = active?.snapshot.context || (active ? editorContext : null);
            if (!panel.hidden && !selecting) options.playback?.(active, false);
            render();
            if (previous && !active && candidates[0]) await select(candidates[0]);
        },
    };
}
