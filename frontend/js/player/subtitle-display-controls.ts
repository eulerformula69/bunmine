import {
    DEFAULT_SUBTITLE_COMPREHENSION_MINIMUM,
    normalizeSubtitleComprehensionMinimum
} from "../subtitles/comprehension-level.js";
import type { SubtitleComprehensionLevel } from "../subtitles/comprehension-level.js";

const initializedControls = new WeakSet<Element>();

function dispatchControlChange(input: HTMLInputElement): void {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function updateSubtitleDisplayControls(): void {
    const visibilityInput = document.getElementById("subtitlesVisible") as HTMLInputElement | null;
    const subtitlesVisible = visibilityInput?.checked !== false;
    document.body.classList.toggle("subtitles-hidden", !subtitlesVisible);

    document.querySelectorAll<HTMLButtonElement>("[data-subtitle-visible]").forEach((button) => {
        const selected = button.dataset.subtitleVisible === String(subtitlesVisible);
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    const thresholdInput = document.getElementById("subtitleComprehensionMinimum") as HTMLInputElement | null;
    const threshold = normalizeSubtitleComprehensionMinimum(
        thresholdInput?.value,
        DEFAULT_SUBTITLE_COMPREHENSION_MINIMUM
    );
    if (thresholdInput) thresholdInput.value = threshold;

    document.querySelectorAll<HTMLButtonElement>("[data-comprehension-minimum]").forEach((button) => {
        const selected = button.dataset.comprehensionMinimum === threshold;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

export function initSubtitleDisplayControls(): void {
    const visibilityInput = document.getElementById("subtitlesVisible") as HTMLInputElement | null;
    const visibilityControl = document.getElementById("subtitleVisibilityControl");
    if (visibilityInput && visibilityControl && !initializedControls.has(visibilityControl)) {
        initializedControls.add(visibilityControl);
        visibilityControl.addEventListener("click", (event) => {
            const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-subtitle-visible]");
            if (!button) return;
            visibilityInput.checked = button.dataset.subtitleVisible === "true";
            updateSubtitleDisplayControls();
            dispatchControlChange(visibilityInput);
        });
    }

    const thresholdInput = document.getElementById("subtitleComprehensionMinimum") as HTMLInputElement | null;
    const thresholdControl = document.getElementById("subtitleComprehensionMinimumControl");
    if (thresholdInput && thresholdControl && !initializedControls.has(thresholdControl)) {
        initializedControls.add(thresholdControl);
        thresholdControl.addEventListener("click", (event) => {
            const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-comprehension-minimum]");
            if (!button) return;
            thresholdInput.value = normalizeSubtitleComprehensionMinimum(button.dataset.comprehensionMinimum);
            updateSubtitleDisplayControls();
            dispatchControlChange(thresholdInput);
        });
    }

    updateSubtitleDisplayControls();
}

export function getLegacySubtitleDisplaySettings(settings: {
    showComprehensionI0?: boolean;
    showComprehensionI1?: boolean;
    showComprehensionI2?: boolean;
    showComprehensionI3?: boolean;
    showComprehensionI4?: boolean;
    showComprehensionI5Plus?: boolean;
}): { visible: boolean; minimum: SubtitleComprehensionLevel } | null {
    const legacyLevels: Array<[SubtitleComprehensionLevel, boolean | undefined]> = [
        ["i+0", settings.showComprehensionI0],
        ["i+1", settings.showComprehensionI1],
        ["i+2", settings.showComprehensionI2],
        ["i+3", settings.showComprehensionI3],
        ["i+4", settings.showComprehensionI4],
        ["i+5+", settings.showComprehensionI5Plus]
    ];
    if (!legacyLevels.some(([, value]) => value !== undefined)) return null;

    const firstVisibleLevel = legacyLevels.find(([, value]) => value !== false)?.[0];
    return {
        visible: firstVisibleLevel !== undefined,
        minimum: firstVisibleLevel ?? DEFAULT_SUBTITLE_COMPREHENSION_MINIMUM
    };
}
