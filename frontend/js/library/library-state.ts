import { BulkSubtitlePlan,LibraryEpisodeView,LibrarySeriesView } from "./library-types.js";

export const librarySeriesState = { value: [] as LibrarySeriesView[] };

export const currentOpenedSeriesState = { value: null as LibrarySeriesView | null };

export const currentOpenedEpisodesState = { value: [] as LibraryEpisodeView[] };

export const currentBulkSubtitlePlanState = { value: null as BulkSubtitlePlan | null };

export const currentBulkSubtitleSetKeyState = { value: null as string | null };

export const isBulkSubtitleDownloadingState = { value: false };

export const isBulkSubtitlePreparingState = { value: false };
