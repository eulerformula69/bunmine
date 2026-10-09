import { bindPlayerShell } from "./shell-bindings.js";

import { closeSettingsBtn,controls,dropzone,multiInput,playPause,progress,settingsModal,toggleBtn,video,videoContainer,videoPickerCancelBtn,videoPickerModal,volume } from "../core/dom.js";

import { handleFiles } from "../video/video.js";

import { bindPlayerHotkeys } from "./hotkeys.js";

import { seekBySeconds,stepFrame,toggleFullscreenMode } from "./ui.js";

import { seekBySubtitle } from "../subtitles/subtitles-sidebar.js";

import { playMedia } from "../video/media-playback.js";
import { installLocalMediaRecovery } from "../video/local-media-recovery.js";

import { focusSubtitleWordSearch,replayCurrentSubtitle } from "../subtitles/sidebar-actions.js";

import { createTimeupdateLoop } from "./timeupdate-loop.js";

import { refreshHighlightWords } from "./highlight-refresh.js";

import { bindPlayerEvents } from "./event-bindings.js";

import { startPlayer } from "./startup.js";

bindPlayerShell({
    video,
    volume,
    dropzone,
    videoContainer,
    multiInput,
    playPause,
    settingsModal,
    closeSettingsButton: closeSettingsBtn,
    progress,
    controls,
    videoPickerModal,
    videoPickerCancelButton: videoPickerCancelBtn,
    handleFiles,
});

bindPlayerHotkeys({
    seekBySeconds,
    seekBySubtitle,
    toggleFullscreen: toggleFullscreenMode,
    stepFrame,
    togglePlayback: () => video.paused ? void playMedia(video) : video.pause(),
    replaySubtitle: replayCurrentSubtitle,
    focusSearch: focusSubtitleWordSearch,
    toggleSubtitles: () => toggleBtn.click(),
});

video.addEventListener("timeupdate", createTimeupdateLoop());
installLocalMediaRecovery({ media: video });

document.getElementById("refreshAnkiHighlighterBtn")?.addEventListener("click", refreshHighlightWords);

bindPlayerEvents();

window.addEventListener("load", startPlayer, {once: true});
