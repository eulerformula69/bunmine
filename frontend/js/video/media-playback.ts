
export async function playMedia(
    media: HTMLMediaElement,
    reportError: (error: unknown) => void = (error) => console.error("Media playback failed:", error)
): Promise<void> {
    try { await media.play(); }
    catch (error) {
        // A later pause or source change normally cancels a pending play request.
        if ((error as { name?: string })?.name !== "AbortError") reportError(error);
    }
}
