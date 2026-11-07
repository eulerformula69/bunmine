import { playMedia } from "../video/media-playback.js";

export interface PlayerShellBindingsOptions {
    video: HTMLVideoElement;
    volume: HTMLInputElement;
    dropzone: HTMLElement;
    videoContainer: HTMLElement;
    multiInput: HTMLInputElement;
    playPause: HTMLElement;
    settingsModal: HTMLElement;
    closeSettingsButton: HTMLElement;
    progress: HTMLInputElement;
    controls: HTMLElement;
    videoPickerModal?: HTMLElement | null;
    videoPickerCancelButton?: HTMLElement | null;
    handleFiles: (files: FileList | null) => unknown;
}

export function bindPlayerShell(options: PlayerShellBindingsOptions): void {
    const { video, volume, dropzone, videoContainer, multiInput, playPause,
        settingsModal, closeSettingsButton, progress, controls } = options;

    video.volume = Number(volume.value);
    volume.addEventListener("input", () => {
        video.volume = Math.max(0, Math.min(1, parseFloat(volume.value) || 0));
    });

    for (const zone of [dropzone, videoContainer]) {
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.style.cursor = "pointer";
        });
        zone.addEventListener("drop", (event: DragEvent) => {
            event.preventDefault();
            options.handleFiles(event.dataTransfer?.files || null);
        });
    }

    const uploadButton = document.getElementById("clickToUpload");
    if (uploadButton) uploadButton.onclick = () => multiInput.click();
    multiInput.addEventListener("change", () => options.handleFiles(multiInput.files));

    playPause.onclick = (event) => {
        event.stopPropagation();
        if (video.paused) void playMedia(video); else video.pause();
    };
    videoContainer.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("#controls, #episodeNavigation, .subtitle-overlay-line")) return;
        if (video.paused) void playMedia(video); else video.pause();
    });

    const closeSettings = () => settingsModal.classList.add("hidden");
    closeSettingsButton.onclick = closeSettings;
    settingsModal.addEventListener("click", (event) => {
        if (event.target === settingsModal) closeSettings();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSettings();
    });
    document.querySelectorAll<HTMLElement>(".settings-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".settings-tab").forEach((item) => {
                item.classList.toggle("active", item === tab);
            });
            document.querySelectorAll<HTMLElement>(".settings-page").forEach((page) => {
                page.classList.toggle("active", page.dataset.settingsPage === tab.dataset.settingsTab);
            });
        });
    });

    progress.oninput = () => {
        video.currentTime = (Number(progress.value) / 100) * video.duration;
    };
    let cursorTimer: ReturnType<typeof setTimeout> | undefined;
    let pointerOverVideo = false;
    const showCursor = () => {
        clearTimeout(cursorTimer);
        videoContainer.classList.remove("cursor-idle");
    };
    const scheduleCursorHide = () => {
        showCursor();
        if (!pointerOverVideo || video.paused || video.ended) return;
        cursorTimer = setTimeout(() => videoContainer.classList.add("cursor-idle"), 2000);
    };
    videoContainer.addEventListener("mousemove", (event) => {
        const target = event.target;
        pointerOverVideo = !(target instanceof Element && target.closest("#controls, #episodeNavigation, .subtitle-overlay-line"));
        scheduleCursorHide();
        const rect = videoContainer.getBoundingClientRect();
        const isBottom = event.clientY - rect.top >= rect.height - Math.max(120, controls.offsetHeight + 12);
        controls.style.opacity = isBottom ? "1" : "0";
        controls.style.pointerEvents = isBottom ? "auto" : "none";
    });
    videoContainer.addEventListener("mouseleave", () => {
        pointerOverVideo = false;
        showCursor();
    });
    videoContainer.addEventListener("mousedown", showCursor);
    video.addEventListener("play", scheduleCursorHide);
    video.addEventListener("pause", showCursor);
    video.addEventListener("ended", showCursor);

    controls.addEventListener("focusin", () => {
        controls.style.opacity = "1";
        controls.style.pointerEvents = "auto";
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden && !video.paused) void playMedia(video);
    });
    options.videoPickerCancelButton?.addEventListener("click", () => {
        options.videoPickerModal?.classList.add("hidden");
        dropzone.classList.remove("hidden");
    });
}
