export function bindProgressSlider(video: HTMLVideoElement, progress: HTMLInputElement): void {
    let frame = 0;

    const update = () => {
        progress.value = String(Number.isFinite(video.duration) && video.duration > 0
            ? (video.currentTime / video.duration) * 100
            : 0);
    };
    const animate = () => {
        frame = 0;
        update();
        if (!video.paused && !video.ended) frame = requestAnimationFrame(animate);
    };
    const start = () => {
        if (!frame) animate();
    };
    const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        update();
    };

    progress.oninput = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = (Number(progress.value) / 100) * video.duration;
        }
    };
    video.addEventListener("play", start);
    for (const event of ["pause", "ended", "emptied"]) video.addEventListener(event, stop);
    for (const event of ["timeupdate", "loadedmetadata", "seeking", "seeked"]) {
        video.addEventListener(event, update);
    }
    start();
}
