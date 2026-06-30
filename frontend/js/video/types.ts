interface VideoRestoreDom {
    video: HTMLVideoElement;
    dropzone: HTMLElement;
    overlay: HTMLElement | null;
    videoPickerModal: HTMLElement | null;
    videoPickerList: HTMLElement | null;
}

interface UploadedVideoInfo extends VideoListItem {
    filename: string;
}
