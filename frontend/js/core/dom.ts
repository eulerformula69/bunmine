interface PlayerDom {
    video: HTMLVideoElement | null;
    sidebar: HTMLElement | null;
    multiInput: HTMLInputElement | null;
    fullscreenBtn: HTMLButtonElement | null;
    settingsBtn: HTMLButtonElement | null;
    settingsModal: HTMLElement | null;
    closeSettingsBtn: HTMLButtonElement | null;
    dropzone: HTMLElement | null;
    toggleBtn: HTMLButtonElement | null;
    overlay: HTMLElement | null;
    deleteVideoBtn: HTMLButtonElement | null;
    playPause: HTMLButtonElement | null;
    progress: HTMLInputElement | null;
    timeLabel: HTMLElement | null;
    videoContainer: HTMLElement | null;
    controls: HTMLElement | null;
    ankiAllBtn: HTMLButtonElement | null;
    targetNoteSelect: HTMLSelectElement | null;
    audioTrackSelect: HTMLSelectElement | null;
    fontSizeRange: HTMLInputElement | null;
    subtitleOverlay: HTMLElement | null;
    resizer: HTMLElement | null;
    videoPickerModal: HTMLElement | null;
    videoPickerList: HTMLElement | null;
    videoPickerCancelBtn: HTMLButtonElement | null;
    addKnownBasicBtn: HTMLButtonElement | null;
    addCardToDeck: HTMLButtonElement | null;
    volume: HTMLInputElement | null;
}

const dom: PlayerDom = {
    video: document.getElementById("video") as HTMLVideoElement | null,
    sidebar: document.getElementById("sidebar"),
    multiInput: document.getElementById("multiInput") as HTMLInputElement | null,
    fullscreenBtn: document.getElementById("fullscreenBtn") as HTMLButtonElement | null,
    settingsBtn: document.getElementById("settingsBtn") as HTMLButtonElement | null,
    settingsModal: document.getElementById("settingsModal"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn") as HTMLButtonElement | null,
    dropzone: document.getElementById("dropzone"),
    toggleBtn: document.getElementById("toggleSubs") as HTMLButtonElement | null,
    overlay: document.getElementById("subtitleOverlay"),
    deleteVideoBtn: document.getElementById("deleteVideoBtn") as HTMLButtonElement | null,
    playPause: document.getElementById("playPause") as HTMLButtonElement | null,
    progress: document.getElementById("progress") as HTMLInputElement | null,
    timeLabel: document.getElementById("time"),
    videoContainer: document.getElementById("videoContainer"),
    controls: document.getElementById("controls"),
    ankiAllBtn: document.getElementById("ankiAllBtn") as HTMLButtonElement | null,
    targetNoteSelect: document.getElementById("targetNoteSelect") as HTMLSelectElement | null,
    audioTrackSelect: document.getElementById("audioTrackSelect") as HTMLSelectElement | null,
    fontSizeRange: document.getElementById("fontSizeRange") as HTMLInputElement | null,
    subtitleOverlay: document.getElementById("subtitleOverlay"),
    resizer: document.getElementById("resizer"),
    videoPickerModal: document.getElementById("videoPickerModal"),
    videoPickerList: document.getElementById("videoPickerList"),
    videoPickerCancelBtn: document.getElementById("videoPickerCancelBtn") as HTMLButtonElement | null,
    addKnownBasicBtn: document.getElementById("addKnownBasicBtn") as HTMLButtonElement | null,
    addCardToDeck: document.getElementById("addCardToDeck") as HTMLButtonElement | null,
    volume: document.getElementById("volume") as HTMLInputElement | null
};
