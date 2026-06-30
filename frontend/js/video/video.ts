async function handleFiles(files) {
    let videoFile = null;
    let subtitleFile = null;
    let hasSubtitles = false;

    for (const file of files) {
        const lowerName = file.name.toLowerCase();

		if (lowerName.endsWith(".srt")) {
			subtitleFile = file;
			subtitles = parseSRT(await file.text());
			hasSubtitles = true;
		} else if (lowerName.endsWith(".ass")) {
			subtitleFile = file;

			// ASS Р±РѕР»СЊС€Рµ РЅРµ РїР°СЂСЃРёРј РІ Р±СЂР°СѓР·РµСЂРµ.
			// Р–РґС‘Рј, РїРѕРєР° СЃРµСЂРІРµСЂ СЃРєРѕРЅРІРµСЂС‚РёСЂСѓРµС‚ ASS -> SRT.
			subtitles = [];
			hasSubtitles = true;
		} else if (file.type.startsWith("video")) {
			videoFile = file;
		}
    }

    if (videoFile) {
        if (!hasSubtitles) {
            subtitles = [];
            lastRuntimeSubtitleText = "";

            renderSubtitleOverlay({
                overlay,
                text: ""
            });
        }

        video.src = URL.createObjectURL(videoFile);
        dropzone.classList.add("hidden");

        uploadVideoInBackground(videoFile, subtitleFile);
    }

    lastRuntimeSubtitleText = "";
    runtimePrefetchAllRunId += 1;
	runtimeHighlightPrefetchReady = false;

    clearRuntimeWordStatuses?.();

    renderSubtitles();

    requestAnimationFrame(() => {
        prefetchRuntimeStatusesForAllSubtitles({ silent: true });
    });
}
