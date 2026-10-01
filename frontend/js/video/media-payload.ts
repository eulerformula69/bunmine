import { state } from "../core/state.js";

export function getCurrentVideoPayload() {
    if (state.currentLibraryVideoFileId) {
        return {
            videoFileId: state.currentLibraryVideoFileId
        };
    }

    if (state.currentVideoFile) {
        return {
            filename: state.currentVideoFile
        };
    }

    return null;
}
