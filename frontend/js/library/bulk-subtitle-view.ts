import { BulkSubtitlePlan } from "./library-types.js";
import { currentBulkSubtitlePlanState,currentBulkSubtitleSetKeyState,isBulkSubtitleDownloadingState,isBulkSubtitlePreparingState } from "./library-state.js";

import { bulkSubtitleList,bulkSubtitleSets,bulkSubtitleStatus,confirmBulkSubtitleDownloadBtn } from "./library-dom.js";

import { escapeHtml, formatBytes } from "../core/formatters.js";

import { LibraryPresentation } from "./library-presentation.js";

import { lt } from "./library-i18n.js";

import { LibraryBulkModel } from "./library-bulk-model.js";

export function updateBulkSubtitleConfirmState() {
    if (isBulkSubtitlePreparingState.value || isBulkSubtitleDownloadingState.value || !currentBulkSubtitlePlanState.value) {
        confirmBulkSubtitleDownloadBtn.disabled = true;
        return;
    }
    confirmBulkSubtitleDownloadBtn.disabled = getSelectedBulkSubtitleItems().length === 0;
}

export function renderBulkSubtitleSets(plan: BulkSubtitlePlan | null) {
    if (!bulkSubtitleSets) return;

    const items = Array.isArray(plan?.items) ? plan.items : [];
    const hasPending = items.some((item) => ["pending", "searching", "rate-limited"].includes(item.status ?? ""));
    const sets = LibraryBulkModel.getSets(plan, lt);

    bulkSubtitleSets.replaceChildren();

    if (!sets.length) {
        if (!hasPending) {
            bulkSubtitleSets.innerHTML = `<div class="cover-message">${escapeHtml(lt("noSubtitleSets"))}</div>`;
        }
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "bulk-subtitle-sets-inner";

    const title = document.createElement("div");
    title.className = "bulk-subtitle-sets-title";
    title.textContent = hasPending
        ? lt("suggestedSetsFoundSoFar")
        : lt("chooseSetBeforeDownloading");
    wrapper.appendChild(title);

    const list = document.createElement("div");
    list.className = "bulk-subtitle-set-list";

    for (const set of sets.slice(0, 8)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `bulk-subtitle-set-btn ${currentBulkSubtitleSetKeyState.value === set.key ? "selected" : ""}`;
        button.disabled = isBulkSubtitleDownloadingState.value;
        button.dataset.releaseKey = set.key;
        button.innerHTML = `
            <div class="bulk-subtitle-set-name">${escapeHtml(set.label)}</div>
            <div class="bulk-subtitle-set-count">${escapeHtml(set.count)} / ${escapeHtml(set.totalEpisodes)} episodes</div>
            <div class="bulk-subtitle-set-examples">${escapeHtml(set.examples.join(" · "))}</div>
        `;
        list.appendChild(button);
    }

    wrapper.appendChild(list);
    bulkSubtitleSets.appendChild(wrapper);
}

export function renderBulkSubtitlePlan(plan: BulkSubtitlePlan | null) {
    const items = Array.isArray(plan?.items) ? plan.items : [];
    const readyItems = items.filter((item) => item.status === "ready" && item.selected);
    const reviewItems = items.filter((item) => item.status === "needs-review" || (Array.isArray(item.candidates) && item.candidates.length && !item.selected));
    const skippedItems = items.filter((item) => item.status === "skipped");
    const failedItems = items.filter((item) => item.status === "failed");
    const pendingItems = items.filter((item) => ["pending", "searching", "rate-limited"].includes(item.status ?? ""));

    bulkSubtitleStatus.classList.remove("error");
    if (!isBulkSubtitlePreparingState.value && !isBulkSubtitleDownloadingState.value) {
        bulkSubtitleStatus.textContent =
            lt("bulkStatusReady", { selected: readyItems.length, review: reviewItems.length, skipped: skippedItems.length, failed: failedItems.length });
    } else if (pendingItems.length) {
        bulkSubtitleStatus.textContent =
            lt("bulkStatusChecking", { selected: readyItems.length, pending: pendingItems.length, failed: failedItems.length });
    }

    renderBulkSubtitleSets(plan);
    bulkSubtitleList.replaceChildren();

    if (!items.length) {
        bulkSubtitleList.innerHTML = `<div class="cover-message">${escapeHtml(lt("noMissingSubtitleEpisodes"))}</div>`;
        confirmBulkSubtitleDownloadBtn.disabled = true;
        return;
    }

    for (const item of items) {
        const row = document.createElement("div");
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const selected = item.selected || null;
        const canDownload = item.status === "ready" && selected?.downloadUrl;
        const hasManualChoices = candidates.length > 0 && !isBulkSubtitlePreparingState.value && !isBulkSubtitleDownloadingState.value;
        const meta = canDownload
            ? LibraryBulkModel.formatCandidate(selected, formatBytes)
            : candidates.length
                ? item.message || lt("chooseSubtitleSetOrManual")
                : item.message || lt("noSubtitleSelected");

        row.className = `bulk-subtitle-item ${escapeHtml(item.status || "skipped")}`;
        row.innerHTML = `
            <input
                class="bulk-subtitle-checkbox"
                type="checkbox"
                ${canDownload ? "checked" : "disabled"}
                ${isBulkSubtitlePreparingState.value || isBulkSubtitleDownloadingState.value ? "disabled" : ""}
                data-episode-id="${escapeHtml(item.episodeId)}"
            >
            <div class="bulk-subtitle-info">
                <div class="bulk-subtitle-title">
                    ${escapeHtml(lt("episodeLabel", { number: item.episodeNumber ?? "?" }))} · ${escapeHtml(item.episodeTitle || lt("untitled"))}
                </div>
                <div class="bulk-subtitle-meta">${escapeHtml(meta)}</div>
                ${hasManualChoices ? `
                    <select class="bulk-subtitle-select" data-episode-id="${escapeHtml(item.episodeId)}">
                        <option value="">${escapeHtml(lt("chooseManually"))}</option>
                        ${candidates.map((candidate) => `
                            <option value="${escapeHtml(LibraryBulkModel.candidateKey(candidate))}" ${selected && LibraryBulkModel.candidateKey(candidate) === LibraryBulkModel.candidateKey(selected) ? "selected" : ""}>
                                ${escapeHtml(candidate.releaseLabel || candidate.entryTitle || lt("other"))} — ${escapeHtml(candidate.filename || lt("subtitle"))}
                            </option>
                        `).join("")}
                    </select>
                ` : ""}
            </div>
            <div class="bulk-subtitle-state" data-bulk-state-for="${escapeHtml(item.episodeId)}">
                ${escapeHtml(canDownload ? lt("ready") : LibraryPresentation.planStatusLabel(item.status ?? "", lt))}
            </div>
        `;

        bulkSubtitleList.appendChild(row);
    }

    updateBulkSubtitleConfirmState();
}

export function getSelectedBulkSubtitleItems() {
    if (!currentBulkSubtitlePlanState.value) return [];

    const selectedIds = new Set(
        Array.from(bulkSubtitleList.querySelectorAll<HTMLInputElement>(".bulk-subtitle-checkbox:checked"))
            .map((checkbox) => String(checkbox.dataset.episodeId))
    );

    return (currentBulkSubtitlePlanState.value.items || []).filter((item) => {
        return item.status === "ready" && item.selected && selectedIds.has(String(item.episodeId));
    });
}
