import { ApiPayload } from "../types/api.js";
import { LibraryTranslate } from "./library-presentation.js";

export interface LibrarySearchModalOptions {
    modal: HTMLElement;
    title: HTMLElement;
    subtitle: HTMLElement;
    searchInput: HTMLInputElement;
    searchButton: HTMLButtonElement;
    results: HTMLElement;
    translate: LibraryTranslate;
    escapeHtml(value: unknown): string;
    search(id: string | number, query: string): Promise<{response: Response; data: ApiPayload}>;
    select(id: string | number, payload: Record<string, unknown>): Promise<{response: Response; data: ApiPayload}>;
    reportError?(message: string): void;
}

export function createLibrarySearchModal<Context, Result>(
    options: LibrarySearchModalOptions,
    config: {
        describe(context: Context): {id: string | number; query: string; title: string; subtitle: string};
        render(result: Result): HTMLButtonElement;
        payload(result: Result): Record<string, unknown>;
        saved(context: Context, data: ApiPayload): void | Promise<unknown>;
        empty: string; searching: string; searchError: string; saveError: string;
        initialHint?: string;
        searchOnOpen?: boolean;
        closeBeforeSaved?: boolean;
    }
) {
    let current: Context | null = null;
    const t = options.translate;
    const message = (text: string, error = false) => {
        options.results.innerHTML = `<div class="cover-message${error ? " error" : ""}">${options.escapeHtml(text)}</div>`;
    };
    function close(): void {
        options.modal.classList.add("hidden");
        document.body.classList.remove("modal-open");
        current = null;
    }
    async function select(result: Result): Promise<void> {
        if (!current) return;
        const context = current;
        options.results.classList.add("is-loading");
        try {
            const {response, data} = await options.select(config.describe(context).id, config.payload(result));
            if (!response.ok || data.error) throw new Error(String(data.error || t(config.saveError)));
            if (config.closeBeforeSaved) close();
            await config.saved(context, data);
            if (!config.closeBeforeSaved) close();
        } catch (error) {
            options.reportError?.(error instanceof Error ? error.message : String(error));
        } finally {
            options.results.classList.remove("is-loading");
        }
    }
    async function search(): Promise<void> {
        if (!current) return;
        const context = config.describe(current);
        options.searchButton.disabled = true;
        options.searchButton.textContent = t("searching");
        message(t(config.searching));
        try {
            const {response, data} = await options.search(context.id, options.searchInput.value.trim() || context.query);
            if (!response.ok || data.error) throw new Error(String(data.error || t(config.searchError)));
            const results = (data.results || []) as Result[];
            options.results.replaceChildren();
            if (!results.length) message(t(config.empty));
            for (const result of results) {
                const item = config.render(result);
                item.addEventListener("click", () => { void select(result); });
                options.results.appendChild(item);
            }
        } catch (error) {
            message(error instanceof Error ? error.message : String(error), true);
        } finally {
            options.searchButton.disabled = false;
            options.searchButton.textContent = t("search");
        }
    }
    async function open(context: Context): Promise<void> {
        current = context;
        const description = config.describe(context);
        options.title.textContent = description.title;
        options.subtitle.textContent = description.subtitle;
        options.searchInput.value = description.query;
        options.results.replaceChildren();
        if (config.initialHint) message(t(config.initialHint));
        options.modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        if (config.searchOnOpen) await search();
        else { options.searchInput.focus(); options.searchInput.select(); }
    }
    return { open, close, search };
}
