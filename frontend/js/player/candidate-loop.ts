import { logger } from "../core/logger.js";
import { playMedia } from "../video/media-playback.js";

import { AnkiMediaSnapshot } from "../anki/media-snapshot.js";

export function createCandidateLoop(media: HTMLVideoElement) {
    let range: { start: number; end: number } | null = null;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let playbackVersion = 0;

    async function play(reportError: (error: unknown) => void): Promise<void> {
        const version = ++playbackVersion;
        await playMedia(media, (error) => {
            if (version === playbackVersion) reportError(error);
        });
    }

    function cancel(): void {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
    }
    function constrain(): void {
        if (!range || media.readyState < 1) return;
        const end = Math.min(range.end, Number.isFinite(media.duration) ? media.duration : range.end);
        // Media clocks round seek targets. Do not repeatedly seek over that rounding gap.
        if (media.currentTime < range.start - 0.001 || media.currentTime >= end) media.currentTime = range.start;
    }
    function schedule(): void {
        cancel();
        if (!range || media.paused) return;
        constrain();
        // A timer also guards the end when animation frames are throttled.
        const end = Math.min(range.end, Number.isFinite(media.duration) ? media.duration : range.end);
        timer = setTimeout(schedule, Math.max(1, (end - media.currentTime) * 1000 / (media.playbackRate || 1)));
        frame = requestAnimationFrame(schedule);
    }
    for (const event of ["play", "seeked", "ratechange", "timeupdate"]) {
        media.addEventListener(event, () => { constrain(); schedule(); });
    }
    media.addEventListener("seeking", constrain);
    media.addEventListener("pause", cancel);
    media.addEventListener("ended", () => {
        if (!range) return;
        media.currentTime = range.start;
        void play((error) => logger.error("Candidate playback failed:", error));
    });
    media.addEventListener("emptied", () => { playbackVersion++; range = null; cancel(); });
    return {
        play,
        set(snapshot: AnkiMediaSnapshot | null, restart = false): void {
            if (!snapshot || restart) playbackVersion++;
            range = snapshot ? { start: snapshot.audioStart, end: snapshot.audioEnd } : null;
            if (range && restart) media.currentTime = range.start;
            constrain();
            schedule();
        },
    };
}
