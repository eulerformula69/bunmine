import { logger } from "../core/logger.js";
import { playMedia } from "./media-playback.js";

export interface LocalMediaRecoveryOptions {
    media: HTMLMediaElement;
    eventTarget?: Window;
    delayMs?: number;
    schedule?: (callback: () => void, milliseconds: number) => number;
    cancel?: (timerId: number) => void;
    play?: (media: HTMLMediaElement) => Promise<void>;
}

export function installLocalMediaRecovery(options: LocalMediaRecoveryOptions): () => void {
    const media = options.media;
    const eventTarget = options.eventTarget || window;
    const delayMs = options.delayMs ?? 1500;
    const schedule = options.schedule || ((callback, milliseconds) => window.setTimeout(callback, milliseconds));
    const cancel = options.cancel || ((timerId) => window.clearTimeout(timerId));
    const play = options.play || ((target) => playMedia(target));

    let expectedToPlay = false;
    let recoveryInProgress = false;
    let timerId: number | null = null;

    const clearScheduledRecovery = () => {
        if (timerId === null) return;
        cancel(timerId);
        timerId = null;
    };

    const recover = () => {
        const source = media.currentSrc || media.src;
        if (!source || !expectedToPlay || recoveryInProgress || media.ended) return;

        recoveryInProgress = true;
        const resumeTime = Number(media.currentTime || 0);
        const playbackRate = media.playbackRate;

        const resume = () => {
            if (Number.isFinite(resumeTime) && resumeTime > 0 && resumeTime < media.duration) {
                media.currentTime = resumeTime;
            }
            media.playbackRate = playbackRate;
            void play(media).finally(() => {
                recoveryInProgress = false;
            });
        };

        media.addEventListener("loadedmetadata", resume, { once: true });
        media.src = source;
        media.load();
        logger.info(`Recovering local media stream at ${resumeTime.toFixed(1)}s`);
    };

    const scheduleRecoveryIfPlaybackStops = () => {
        if (!expectedToPlay || recoveryInProgress || media.ended || !(media.currentSrc || media.src)) return;

        clearScheduledRecovery();
        const checkpoint = Number(media.currentTime || 0);
        timerId = schedule(() => {
            timerId = null;
            const currentTime = Number(media.currentTime || 0);
            if (!expectedToPlay || media.ended || currentTime > checkpoint + 0.1) return;
            recover();
        }, delayMs);
    };

    const onPlaying = () => {
        expectedToPlay = true;
        recoveryInProgress = false;
        clearScheduledRecovery();
    };
    const onPause = () => {
        if (recoveryInProgress || media.error) return;
        expectedToPlay = false;
        clearScheduledRecovery();
    };
    const onEnded = () => {
        expectedToPlay = false;
        recoveryInProgress = false;
        clearScheduledRecovery();
    };

    media.addEventListener("playing", onPlaying);
    media.addEventListener("pause", onPause);
    media.addEventListener("ended", onEnded);
    media.addEventListener("waiting", scheduleRecoveryIfPlaybackStops);
    media.addEventListener("stalled", scheduleRecoveryIfPlaybackStops);
    media.addEventListener("error", scheduleRecoveryIfPlaybackStops);
    eventTarget.addEventListener("offline", scheduleRecoveryIfPlaybackStops);

    return () => {
        clearScheduledRecovery();
        media.removeEventListener("playing", onPlaying);
        media.removeEventListener("pause", onPause);
        media.removeEventListener("ended", onEnded);
        media.removeEventListener("waiting", scheduleRecoveryIfPlaybackStops);
        media.removeEventListener("stalled", scheduleRecoveryIfPlaybackStops);
        media.removeEventListener("error", scheduleRecoveryIfPlaybackStops);
        eventTarget.removeEventListener("offline", scheduleRecoveryIfPlaybackStops);
    };
}
