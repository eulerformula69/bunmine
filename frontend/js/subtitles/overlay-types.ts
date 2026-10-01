import { RuntimeSubtitleCue } from "./model.js";
import { SubtitleComprehensionHighlighter } from "./comprehension-level.js";
import { AnkiTextMatch, AnkiWordStatus } from "../highlighter/word-status-store.js";
import { SubtitleHighlightStatusSetting } from "../highlighter/subtitles-highlighter.js";

export interface SubtitleOverlayHighlighter extends SubtitleComprehensionHighlighter {
    enabled?: boolean;
    statusSettings?: Partial<Record<AnkiWordStatus, SubtitleHighlightStatusSetting>>;
    getStatusForTextToken?: (text: string) => AnkiWordStatus;
    findMatchesInText?: (text: string) => AnkiTextMatch[];
}

export interface SubtitleOverlayOptions {
    overlay: HTMLElement | null;
    cues?: RuntimeSubtitleCue[];
    cueIndices?: number[];
    texts?: string[];
    text?: string;
    highlighter?: SubtitleOverlayHighlighter | null;
}
