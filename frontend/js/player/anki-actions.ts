interface AnkiMediaSnapshotDraft {
    videoPayload: CurrentVideoPayload;
    subtitleIndex: number;
    selectedWord: string;
    sentence: string;
    audioStart: number;
    audioEnd: number;
    volume: number;
}

function hasRequiredAnkiMediaFields(fields: {
    pictureField?: string;
    audioField?: string;
}): boolean {
    return Boolean(fields.pictureField?.trim() && fields.audioField?.trim());
}

function normalizeSelectedAnkiWord(word: string): string {
    return String(word || "").trim();
}

// TODO: Move AnkiConnect polling/update flows after auto-attach queue state is separated from player/app.js.
