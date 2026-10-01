import { ApiPayload } from "./api.js";

export type ToastType = "info" | "success" | "error" | "warning" | string;

export interface VideoFilePayload {
    filename: string;
}

export interface LibraryVideoFilePayload {
    videoFileId: string | number;
}

export type CurrentVideoPayload = VideoFilePayload | LibraryVideoFilePayload;

export interface LibraryPlaybackPayload extends ApiPayload {
    seriesId?: string | number | null;
    episodeId?: string | number | null;
    videoFileId?: string | number | null;
    subtitleFileId?: string | number | null;
    videoUrl: string;
    subtitleUrl?: string | null;
    currentTimeSeconds?: number | null;
    seriesTitle?: string;
    episodeTitle?: string;
}

export interface LibraryProgressPayload extends ApiPayload {
    progress?: {
        completed?: boolean;
        duration_seconds?: number;
        current_time_seconds?: number;
        watched_seconds?: number;
    };
}

declare global {
interface Window {
    BunmineEarlyLibraryPlayback?: Promise<LibraryPlaybackPayload | null>;
    kuromoji?: {
        builder(options: { dicPath: string }): {
            build(callback: (err: Error | null, tokenizer: JapaneseTokenizer) => void): void;
        };
    };
}
}

export interface JapaneseTokenizer {
    tokenize(text: string): JapaneseToken[];
}

export interface JapaneseToken {
    surface_form?: string;
    basic_form?: string;
    reading?: string;
    pos?: string;
    word_position?: number;
    [key: string]: unknown;
}

export interface RuntimeWordStatusInfo {
    status?: string;
    [key: string]: unknown;
}

export interface AnkiHighlightRefreshResult {
    count?: number;
    cardsChecked?: number;
    notesFound?: number;
    notesChecked?: number;
    importedWords?: number;
    preservedLockedWords?: number;
}
