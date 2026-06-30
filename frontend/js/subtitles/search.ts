function findSubtitleTextMatches(cues: SubtitleCue[], query: string): SubtitleSearchMatch[] {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return [];

    const matches: SubtitleSearchMatch[] = [];

    cues.forEach((cue, subtitleIndex) => {
        const text = String(cue.text || "");
        const lower = text.toLowerCase();
        let start = lower.indexOf(normalizedQuery);

        while (start !== -1) {
            matches.push({
                subtitleIndex,
                start,
                end: start + normalizedQuery.length
            });
            start = lower.indexOf(normalizedQuery, start + normalizedQuery.length);
        }
    });

    return matches;
}
