import { VideoListItem } from "../types/api.js";

export interface VideoRestoreDom {
    video: HTMLVideoElement;
    dropzone: HTMLElement;
    overlay: HTMLElement | null;
    videoPickerModal: HTMLElement | null;
    videoPickerList: HTMLElement | null;
}

export interface UploadedVideoInfo extends VideoListItem {
    filename: string;
}
