function createCandidatePanel(options: {
    sidebar: HTMLElement;
    busy(): boolean;
    select(candidate: MiningCandidate): Promise<void>;
    acquire(candidate: MiningCandidate): Promise<void>;
    reject(candidate: MiningCandidate): Promise<void>;
    error(error: unknown): void;
}) {
    const tabs = document.createElement("div");
    tabs.className = "candidate-tabs";
    tabs.setAttribute("role", "tablist");
    const subtitleTab = document.createElement("button");
    subtitleTab.textContent = "Субтитры";
    const candidateTab = document.createElement("button");
    const panel = document.createElement("section");
    panel.id = "candidatePanel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Кандидаты");
    const list = document.createElement("div");
    const context = document.createElement("p");
    context.className = "candidate-context";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    const add = document.createElement("button");
    add.textContent = "Добавить через Yomitan";
    const skip = document.createElement("button");
    skip.textContent = "Пропустить";
    const actions = document.createElement("div");
    actions.className = "candidate-actions";
    actions.append(add, skip);
    panel.append(list, context, actions, status);
    tabs.append(subtitleTab, candidateTab);
    options.sidebar.querySelector(".subtitle-sidebar-header")!.after(tabs);
    options.sidebar.append(panel);
    const counter = document.createElement("button");
    counter.type = "button";
    counter.id = "candidateCount";
    counter.title = "Открыть кандидатов";
    document.getElementById("toggleSubs")?.after(counter);
    counter.onclick = () => {
        if (options.sidebar.classList.contains("hidden")) document.getElementById("toggleSubs")?.click();
        showCandidates(true);
    };
    let candidates: MiningCandidate[] = [];
    let active: MiningCandidate | undefined;
    let selecting = false;

    function showCandidates(show: boolean): void {
        options.sidebar.classList.toggle("review-candidates", show);
        panel.hidden = !show;
        subtitleTab.setAttribute("aria-selected", String(!show));
        candidateTab.setAttribute("aria-selected", String(show));
    }
    for (const tab of [subtitleTab, candidateTab]) {
        tab.type = "button";
        tab.setAttribute("role", "tab");
    }
    subtitleTab.onclick = () => showCandidates(false);
    candidateTab.onclick = () => showCandidates(true);
    showCandidates(false);

    function render(): void {
        candidateTab.textContent = `Кандидаты · ${candidates.length}`;
        counter.textContent = `Кандидаты: ${candidates.length}`;
        list.replaceChildren();
        if (!candidates.length) list.textContent = "Выделите слово и нажмите «Сохранить кандидата» или Alt+Q.";
        for (const candidate of candidates) {
            const button = document.createElement("button");
            button.className = "candidate-item";
            button.type = "button";
            const source = candidate.episode_id ? `Серия ${candidate.episode_id}`
                : (candidate.snapshot.videoPayload as VideoFilePayload).filename;
            button.textContent = `${candidate.snapshot.selectedWord} · ${source} · ${formatTime(candidate.snapshot.targetTime)}`;
            button.setAttribute("aria-pressed", String(active?.id === candidate.id));
            button.disabled = options.busy() || selecting;
            button.onclick = () => { void select(candidate); };
            list.append(button);
        }
        context.textContent = active?.snapshot.combinedText || "";
        add.textContent = active?.anki_note_id ? "Повторить прикрепление медиа" : "Добавить через Yomitan";
        add.disabled = skip.disabled = !active || options.busy() || selecting;
    }
    async function select(candidate: MiningCandidate): Promise<void> {
        if (options.busy() || selecting) return;
        active = candidate;
        selecting = true;
        render();
        try { await options.select(candidate); }
        catch (error) { options.error(error); }
        finally { selecting = false; render(); }
    }
    async function perform(action: (candidate: MiningCandidate) => Promise<void>): Promise<void> {
        if (!active || selecting || options.busy()) return;
        const work = action(active);
        render();
        try { await work; }
        catch (error) { options.error(error); }
        finally { render(); }
    }
    add.onclick = () => { void perform(options.acquire); };
    skip.onclick = () => { void perform(options.reject); };
    return {
        status: (message: string) => { status.textContent = message; },
        async refresh(): Promise<void> {
            candidates = await candidateApi.list();
            const previous = active?.id;
            active = candidates.find((item) => item.id === previous);
            render();
            if (previous && !active && candidates[0]) await select(candidates[0]);
        },
    };
}
