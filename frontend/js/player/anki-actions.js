function hasRequiredAnkiMediaFields(fields) {
    return Boolean(fields.pictureField?.trim() && fields.audioField?.trim());
}
function normalizeSelectedAnkiWord(word) {
    return String(word || "").trim();
}
// TODO: Move AnkiConnect polling/update flows after auto-attach queue state is separated from player/app.js.
