function getCurrentVideoPayload() {
    if (currentLibraryVideoFileId) {
        return {
            videoFileId: currentLibraryVideoFileId
        };
    }

    if (currentVideoFile) {
        return {
            filename: currentVideoFile
        };
    }

    return null;
}
