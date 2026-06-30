function formatToastMessage(template, params = {}) {
    return Object.entries(params).reduce((message, [key, value]) => message.split(`{${key}}`).join(String(value)), template);
}
function showTranslatedToast(key, params = {}, type = "info", duration = 3000) {
    showToast(t(key, params), type, duration);
}
// TODO: Move auto-attach action toast lifecycle here after the queue state leaves player/app.js.
function showPersistentActionToast(message, actions, type = "info") {
    showActionToast(message, actions, type, 0);
}
