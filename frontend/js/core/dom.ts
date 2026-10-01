
function requiredElement<T>(element: T | null): T {
    if (element === null) throw new Error("Required player element is missing");
    return element;
}

export interface PlayerDom {
    video: HTMLVideoElement;
    sidebar: HTMLElement;
    multiInput: HTMLInputElement;
    fullscreenBtn: HTMLButtonElement;
    settingsBtn: HTMLButtonElement;
    settingsModal: HTMLElement;
    closeSettingsBtn: HTMLButtonElement;
    dropzone: HTMLElement;
    toggleBtn: HTMLButtonElement;
    overlay: HTMLElement;
    deleteVideoBtn: HTMLButtonElement;
    playPause: HTMLButtonElement;
    progress: HTMLInputElement;
    timeLabel: HTMLElement;
    videoContainer: HTMLElement;
    controls: HTMLElement;
    ankiAllBtn: HTMLButtonElement;
    targetNoteSelect: HTMLSelectElement;
    fontSizeRange: HTMLInputElement;
    subtitleOverlay: HTMLElement;
    resizer: HTMLElement;
    videoPickerModal: HTMLElement;
    videoPickerList: HTMLElement;
    videoPickerCancelBtn: HTMLButtonElement;
    addKnownBasicBtn: HTMLButtonElement;
    addCardToDeck: HTMLButtonElement;
    volume: HTMLInputElement;
}

export const dom: PlayerDom = {
    video: requiredElement(document.getElementById("video") as HTMLVideoElement | null),
    sidebar: requiredElement(document.getElementById("sidebar")),
    multiInput: requiredElement(document.getElementById("multiInput") as HTMLInputElement | null),
    fullscreenBtn: requiredElement(document.getElementById("fullscreenBtn") as HTMLButtonElement | null),
    settingsBtn: requiredElement(document.getElementById("settingsBtn") as HTMLButtonElement | null),
    settingsModal: requiredElement(document.getElementById("settingsModal")),
    closeSettingsBtn: requiredElement(document.getElementById("closeSettingsBtn") as HTMLButtonElement | null),
    dropzone: requiredElement(document.getElementById("dropzone")),
    toggleBtn: requiredElement(document.getElementById("toggleSubs") as HTMLButtonElement | null),
    overlay: requiredElement(document.getElementById("subtitleOverlay")),
    deleteVideoBtn: requiredElement(document.getElementById("deleteVideoBtn") as HTMLButtonElement | null),
    playPause: requiredElement(document.getElementById("playPause") as HTMLButtonElement | null),
    progress: requiredElement(document.getElementById("progress") as HTMLInputElement | null),
    timeLabel: requiredElement(document.getElementById("time")),
    videoContainer: requiredElement(document.getElementById("videoContainer")),
    controls: requiredElement(document.getElementById("controls")),
    ankiAllBtn: requiredElement(document.getElementById("ankiAllBtn") as HTMLButtonElement | null),
    targetNoteSelect: requiredElement(document.getElementById("targetNoteSelect") as HTMLSelectElement | null),
    fontSizeRange: requiredElement(document.getElementById("fontSizeRange") as HTMLInputElement | null),
    subtitleOverlay: requiredElement(document.getElementById("subtitleOverlay")),
    resizer: requiredElement(document.getElementById("resizer")),
    videoPickerModal: requiredElement(document.getElementById("videoPickerModal")),
    videoPickerList: requiredElement(document.getElementById("videoPickerList")),
    videoPickerCancelBtn: requiredElement(document.getElementById("videoPickerCancelBtn") as HTMLButtonElement | null),
    addKnownBasicBtn: requiredElement(document.getElementById("addKnownBasicBtn") as HTMLButtonElement | null),
    addCardToDeck: requiredElement(document.getElementById("addCardToDeck") as HTMLButtonElement | null),
    volume: requiredElement(document.getElementById("volume") as HTMLInputElement | null)
};

﻿export const {
    video,
    sidebar,
    multiInput,
    fullscreenBtn,
    settingsBtn,
    settingsModal,
    closeSettingsBtn,
    dropzone,
    toggleBtn,
    overlay,
    deleteVideoBtn,
    playPause,
    progress,
    timeLabel,
    videoContainer,
    controls,
    ankiAllBtn,
    targetNoteSelect,
    fontSizeRange,
    subtitleOverlay,
    resizer,
    videoPickerModal,
    videoPickerList,
    videoPickerCancelBtn,
    addKnownBasicBtn,
    addCardToDeck,
    volume
} = dom;
