import { ankiRequest } from "./anki-connect-client.js";

export interface AnkiNoteInfo {
    noteId?: string | number;
    fields?: Record<string, { value?: unknown }>;
}

export function fetchDeckNoteIds(ankiUrl: string, deckName: string): Promise<number[]> {
    return fetchNoteIdsByQuery(ankiUrl, `deck:"${deckName}"`);
}

export async function fetchNoteIdsByQuery(
    ankiUrl: string, query: string, label = "AnkiConnect findNotes"
): Promise<number[]> {
    const result = await ankiRequest<number[]>(ankiUrl, "findNotes", { query }, { label });
    return Array.isArray(result) ? result : [];
}

export async function fetchNotesInfo(ankiUrl: string, noteIds: Array<string | number>): Promise<AnkiNoteInfo[]> {
    const result = await ankiRequest<AnkiNoteInfo[]>(ankiUrl, "notesInfo", { notes: noteIds });
    return Array.isArray(result) ? result : [];
}
