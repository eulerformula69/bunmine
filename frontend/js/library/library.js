const LIBRARY_I18N = {
    en: {
        name: "English",
        dict: {
            libraryTitle: "Bunmine Library",
            loading: "Loading...",
            scanLibrary: "Scan library",
            scanning: "Scanning...",
            player: "Player",
            close: "Close",
            cancel: "Cancel",
            search: "Search",
            searching: "Searching...",
            open: "Open",
            error: "Error",
            allLinked: "All linked",
            partiallyLinked: "Partially linked",
            missingFiles: "Missing files",
            addAnime: "Add anime",
            addAnimeHint: "Scan a new folder",
            enterAnimeFolderPath: "Enter the folder path inside your media library:",
            addAnimeFailed: "Could not add anime",
            relinkFiles: "Relink files",
            enterRelinkPath: "Enter the new folder or file path for this series:",
            relinkDone: "Relinked {count} files. Unresolved: {unresolved}.",
            relinkFailed: "Could not relink files",
            deleteSeries: "Delete",
            deleteSeriesTitle: "Delete from library",
            deleteSeriesConfirm: "Remove \"{title}\" from the library? Files on disk will not be deleted.",
            deleteSeriesFailed: "Could not delete series",
            subtitleQueryHint: "Edit the Jimaku query, then press Search.",
            seriesSummary: "{count} series · {watched}/{total} watched",
            seriesStats: "{videos}/{episodes} video · {subtitles}/{episodes} subtitles · {status}",
            eps: "eps",
            watched: "watched",
            notWatched: "not watched",
            atTime: "at {time}",
            videoYes: "video ✓",
            videoNo: "video ×",
            subtitlesYes: "subtitles ✓",
            subtitlesNo: "subtitles ×",
            findJpSubs: "Find JP subs",
            changeJpSubs: "Change JP subs",
            findJapaneseSubtitles: "Find Japanese subtitles",
            changeJapaneseSubtitles: "Change Japanese subtitles",
            episodeLabel: "Episode {number}",
            searchingJimaku: "Searching Jimaku...",
            subtitleSearchFailed: "Subtitle search failed",
            noDirectSubtitles: "No direct .srt/.ass/.vtt subtitles found.",
            untitledSubtitle: "Untitled subtitle",
            couldNotSaveSubtitle: "Could not save subtitle",
            downloadMissingJpSubs: "Download missing JP subs",
            downloadMissingJapaneseSubtitles: "Download missing Japanese subtitles",
            preparingDownloadPlan: "Preparing download plan...",
            analyzingJimakuEntries: "Analyzing Jimaku series entries...",
            analyzing: "Analyzing...",
            analysisReadyChoose: "Analysis ready: choose one subtitle set · {selectable} episodes have candidates · {skipped} skipped · {entries} entries checked",
            analysisReadyNone: "Analysis ready: no matching subtitles found · {skipped} skipped · {entries} entries checked",
            couldNotAnalyzeJimaku: "Could not analyze Jimaku subtitles",
            jimakuRateLimitWait: "Jimaku rate limit. Waiting {seconds}s before retry...",
            jimakuRetryReached: "Jimaku rate limit: retry limit reached",
            noSubtitleSets: "No subtitle sets found.",
            recommendedSubtitleSets: "Recommended subtitle sets",
            subtitleSetsStillChecking: "Subtitle sets will appear while episodes are checked.",
            noFileFromSelectedSet: "No file from selected set. Choose manually if needed.",
            couldNotSearchEpisodeJimaku: "Could not search Jimaku for this episode",
            noMissingSubtitleEpisodes: "No episodes with missing subtitles.",
            searchingEpisodeJimaku: "Searching Jimaku...",
            searchingJimakuProgress: "Searching Jimaku {current}/{total}: episode {episode}...",
            planReadySelected: "Plan ready: {selected} selected · {review} need review · {skipped} skipped · {failed} failed",
            planReadyChoose: "Plan ready: choose one subtitle set · {selectable} episodes have candidates · {skipped} skipped · {failed} failed",
            bulkStatusReady: "{selected} selected · {review} need review · {skipped} skipped · {failed} failed",
            bulkStatusChecking: "{selected} selected · {pending} still being checked · {failed} failed",
            noSubtitleSelected: "No subtitle selected",
            untitled: "Untitled",
            chooseManually: "Choose manually...",
            ready: "ready",
            skipped: "skipped",
            needsReview: "needs-review",
            failed: "failed",
            selectedManually: "Selected manually",
            chooseSubtitleSetOrManual: "Choose one subtitle set or select manually",
            selectedFromSubtitleSet: "Selected from subtitle set",
            suggestedSetsFoundSoFar: "Suggested sets found so far",
            chooseSetBeforeDownloading: "Choose one subtitle set before downloading",
            other: "Other",
            subtitle: "subtitle",
            rateLimitedRetrying: "rate limited, retrying in {seconds}s...",
            downloadingProgress: "Downloading {done}/{total} completed · {concurrency} at a time...",
            downloadingState: "downloading...",
            downloadedState: "downloaded",
            failedState: "failed: {message}",
            downloadingSummary: "Downloading {done}/{total} completed · {downloaded} downloaded · {failed} failed",
            finishedDownloads: "Finished: {downloaded} downloaded, {failed} failed.",
            downloadSelected: "Download selected",
            changeCover: "Change cover",
            findCover: "Find cover",
            searchingAniList: "Searching AniList...",
            coverSearchFailed: "Cover search failed",
            noResultsFound: "No results found.",
            couldNotSaveCover: "Could not save cover",
            scanFailed: "Scan failed",
            couldNotLoadLibrary: "Could not load library",
            couldNotLoadSeries: "Could not load series",
            couldNotUpdateEpisodeStatus: "Could not update episode status"
        }
    },
    ru: {
        name: "Русский",
        dict: {
            libraryTitle: "Библиотека Bunmine", loading: "Загрузка...", scanLibrary: "Сканировать библиотеку", scanning: "Сканирование...", player: "Плеер", close: "Закрыть", cancel: "Отмена", search: "Искать", searching: "Поиск...", open: "Открыть", error: "Ошибка", allLinked: "Всё связано", partiallyLinked: "Частично связано", missingFiles: "Файлы отсутствуют", addAnime: "Добавить аниме", addAnimeHint: "Сканировать новую папку", enterAnimeFolderPath: "Введите путь к папке внутри медиатеки:", chooseFolderCancelled: "Выбор папки отменён.", openFolderDialogFailed: "Не удалось открыть выбор папки", subtitleSearchTitle: "Название для поиска субтитров (query)", addAnimeFailed: "Не удалось добавить аниме", relinkFiles: "Перепривязать файлы", enterRelinkPath: "Введите новый путь к папке или файлу для этого тайтла:", relinkDone: "Перепривязано файлов: {count}. Не найдено: {unresolved}.", relinkFailed: "Не удалось перепривязать файлы", deleteSeries: "Удалить", deleteSeriesTitle: "Удалить из библиотеки", deleteSeriesConfirm: "Удалить «{title}» из библиотеки? Файлы на диске не будут удалены.", deleteSeriesFailed: "Не удалось удалить тайтл", subtitleQueryHint: "Измените запрос Jimaku, затем нажмите Искать.", seriesSummary: "{count} тайтлов · {watched}/{total} просмотрено", seriesStats: "{videos}/{episodes} видео · {subtitles}/{episodes} субтитров · {status}", eps: "эп.", watched: "просмотрено", notWatched: "не просмотрено", atTime: "на {time}", videoYes: "видео ✓", videoNo: "видео ×", subtitlesYes: "субтитры ✓", subtitlesNo: "субтитры ×", findJpSubs: "Найти JP субтитры", changeJpSubs: "Заменить JP субтитры", findJapaneseSubtitles: "Найти японские субтитры", changeJapaneseSubtitles: "Заменить японские субтитры", episodeLabel: "Эпизод {number}", searchingJimaku: "Поиск в Jimaku...", subtitleSearchFailed: "Не удалось найти субтитры", noDirectSubtitles: "Прямые .srt/.ass/.vtt субтитры не найдены.", untitledSubtitle: "Субтитры без названия", couldNotSaveSubtitle: "Не удалось сохранить субтитры", downloadMissingJpSubs: "Скачать недостающие JP субтитры", downloadMissingJapaneseSubtitles: "Скачать недостающие японские субтитры", preparingDownloadPlan: "Подготовка плана загрузки...", analyzingJimakuEntries: "Анализ записей Jimaku...", analyzing: "Анализ...", analysisReadyChoose: "Анализ готов: выберите набор субтитров · кандидаты есть для {selectable} эп. · пропущено {skipped} · проверено записей {entries}", analysisReadyNone: "Анализ готов: подходящих субтитров нет · пропущено {skipped} · проверено записей {entries}", couldNotAnalyzeJimaku: "Не удалось проанализировать субтитры Jimaku", jimakuRateLimitWait: "Лимит Jimaku. Повтор через {seconds} с...", jimakuRetryReached: "Лимит Jimaku: исчерпан лимит повторов", noSubtitleSets: "Наборы субтитров не найдены.", recommendedSubtitleSets: "Рекомендуемые наборы субтитров", subtitleSetsStillChecking: "Наборы появятся по мере проверки эпизодов.", noFileFromSelectedSet: "В выбранном наборе нет файла. При необходимости выберите вручную.", couldNotSearchEpisodeJimaku: "Не удалось найти Jimaku-субтитры для эпизода", noMissingSubtitleEpisodes: "Нет эпизодов с недостающими субтитрами.", searchingEpisodeJimaku: "Поиск в Jimaku...", searchingJimakuProgress: "Поиск в Jimaku {current}/{total}: эпизод {episode}...", planReadySelected: "План готов: выбрано {selected} · требуют проверки {review} · пропущено {skipped} · ошибок {failed}", planReadyChoose: "План готов: выберите набор субтитров · кандидаты есть для {selectable} эп. · пропущено {skipped} · ошибок {failed}", bulkStatusReady: "{selected} выбрано · требуют проверки {review} · пропущено {skipped} · ошибок {failed}", bulkStatusChecking: "{selected} выбрано · ещё проверяется {pending} · ошибок {failed}", noSubtitleSelected: "Субтитры не выбраны", untitled: "Без названия", chooseManually: "Выбрать вручную...", ready: "готово", skipped: "пропущено", needsReview: "нужна проверка", failed: "ошибка", selectedManually: "Выбрано вручную", chooseSubtitleSetOrManual: "Выберите набор субтитров или вручную", selectedFromSubtitleSet: "Выбрано из набора субтитров", suggestedSetsFoundSoFar: "Предложенные наборы на данный момент", chooseSetBeforeDownloading: "Выберите один набор субтитров перед загрузкой", other: "Другое", subtitle: "субтитры", rateLimitedRetrying: "лимит, повтор через {seconds} с...", downloadingProgress: "Загрузка: завершено {done}/{total} · параллельно {concurrency}...", downloadingState: "загрузка...", downloadedState: "скачано", failedState: "ошибка: {message}", downloadingSummary: "Загрузка: завершено {done}/{total} · скачано {downloaded} · ошибок {failed}", finishedDownloads: "Готово: скачано {downloaded}, ошибок {failed}.", downloadSelected: "Скачать выбранные", changeCover: "Заменить обложку", findCover: "Найти обложку", searchingAniList: "Поиск в AniList...", coverSearchFailed: "Не удалось найти обложку", noResultsFound: "Ничего не найдено.", couldNotSaveCover: "Не удалось сохранить обложку", scanFailed: "Сканирование не удалось", couldNotLoadLibrary: "Не удалось загрузить библиотеку", couldNotLoadSeries: "Не удалось загрузить тайтл", couldNotUpdateEpisodeStatus: "Не удалось обновить статус эпизода"
        }
    },
    ja: {
        name: "日本語",
        dict: {
            libraryTitle: "Bunmine ライブラリ", loading: "読み込み中...", scanLibrary: "ライブラリをスキャン", scanning: "スキャン中...", player: "プレイヤー", close: "閉じる", cancel: "キャンセル", search: "検索", searching: "検索中...", open: "開く", error: "エラー", allLinked: "すべてリンク済み", partiallyLinked: "一部リンク済み", missingFiles: "ファイル不足", addAnime: "アニメを追加", addAnimeHint: "新しいフォルダをスキャン", enterAnimeFolderPath: "メディアライブラリ内のフォルダパスを入力:", chooseFolderCancelled: "フォルダ選択がキャンセルされました。", openFolderDialogFailed: "フォルダ選択を開けませんでした", subtitleSearchTitle: "字幕検索のタイトル（クエリ）", addAnimeFailed: "アニメを追加できませんでした", relinkFiles: "ファイルを再リンク", enterRelinkPath: "このシリーズの新しいフォルダまたはファイルパスを入力:", relinkDone: "{count} 件を再リンク。不明: {unresolved}。", relinkFailed: "ファイルを再リンクできませんでした", deleteSeries: "削除", deleteSeriesTitle: "ライブラリから削除", deleteSeriesConfirm: "「{title}」をライブラリから削除しますか？ディスク上のファイルは削除されません。", deleteSeriesFailed: "シリーズを削除できませんでした", subtitleQueryHint: "Jimaku クエリを編集してから検索してください。", seriesSummary: "{count} シリーズ · {watched}/{total} 視聴済み", seriesStats: "動画 {videos}/{episodes} · 字幕 {subtitles}/{episodes} · {status}", eps: "話", watched: "視聴済み", notWatched: "未視聴", atTime: "{time} まで", videoYes: "動画 ✓", videoNo: "動画 ×", subtitlesYes: "字幕 ✓", subtitlesNo: "字幕 ×", findJpSubs: "日本語字幕を探す", changeJpSubs: "日本語字幕を変更", findJapaneseSubtitles: "日本語字幕を探す", changeJapaneseSubtitles: "日本語字幕を変更", episodeLabel: "第{number}話", searchingJimaku: "Jimaku を検索中...", subtitleSearchFailed: "字幕検索に失敗しました", noDirectSubtitles: "直接利用できる .srt/.ass/.vtt 字幕は見つかりませんでした。", untitledSubtitle: "無題の字幕", couldNotSaveSubtitle: "字幕を保存できませんでした", downloadMissingJpSubs: "不足JP字幕をダウンロード", downloadMissingJapaneseSubtitles: "不足している日本語字幕をダウンロード", preparingDownloadPlan: "ダウンロード計画を準備中...", analyzingJimakuEntries: "Jimaku のシリーズ項目を分析中...", analyzing: "分析中...", analysisReadyChoose: "分析完了: 字幕セットを選択 · 候補あり {selectable} 話 · スキップ {skipped} · 確認済み項目 {entries}", analysisReadyNone: "分析完了: 一致する字幕なし · スキップ {skipped} · 確認済み項目 {entries}", couldNotAnalyzeJimaku: "Jimaku 字幕を分析できませんでした", jimakuRateLimitWait: "Jimaku の制限中。{seconds}秒後に再試行...", jimakuRetryReached: "Jimaku の制限: 再試行上限に達しました", noSubtitleSets: "字幕セットが見つかりません。", recommendedSubtitleSets: "おすすめ字幕セット", subtitleSetsStillChecking: "エピソード確認中に字幕セットが表示されます。", noFileFromSelectedSet: "選択したセットにファイルがありません。必要なら手動で選択してください。", couldNotSearchEpisodeJimaku: "このエピソードの Jimaku 字幕を検索できませんでした", noMissingSubtitleEpisodes: "字幕が不足しているエピソードはありません。", searchingEpisodeJimaku: "Jimaku を検索中...", searchingJimakuProgress: "Jimaku 検索 {current}/{total}: エピソード {episode}...", planReadySelected: "計画完了: {selected} 件選択 · 要確認 {review} · スキップ {skipped} · 失敗 {failed}", planReadyChoose: "計画完了: 字幕セットを選択 · 候補あり {selectable} 話 · スキップ {skipped} · 失敗 {failed}", bulkStatusReady: "{selected} 件選択 · 要確認 {review} · スキップ {skipped} · 失敗 {failed}", bulkStatusChecking: "{selected} 件選択 · 確認中 {pending} · 失敗 {failed}", noSubtitleSelected: "字幕が選択されていません", untitled: "無題", chooseManually: "手動で選択...", ready: "準備完了", skipped: "スキップ", needsReview: "要確認", failed: "失敗", selectedManually: "手動で選択済み", chooseSubtitleSetOrManual: "字幕セットを選ぶか手動で選択してください", selectedFromSubtitleSet: "字幕セットから選択済み", suggestedSetsFoundSoFar: "現在の候補セット", chooseSetBeforeDownloading: "ダウンロード前に字幕セットを1つ選択", other: "その他", subtitle: "字幕", rateLimitedRetrying: "制限中、{seconds}秒後に再試行...", downloadingProgress: "ダウンロード: {done}/{total} 完了 · 同時 {concurrency} 件...", downloadingState: "ダウンロード中...", downloadedState: "ダウンロード済み", failedState: "失敗: {message}", downloadingSummary: "ダウンロード: {done}/{total} 完了 · 成功 {downloaded} · 失敗 {failed}", finishedDownloads: "完了: 成功 {downloaded}, 失敗 {failed}。", downloadSelected: "選択をダウンロード", changeCover: "表紙を変更", findCover: "表紙を探す", searchingAniList: "AniList を検索中...", coverSearchFailed: "表紙検索に失敗しました", noResultsFound: "結果が見つかりません。", couldNotSaveCover: "表紙を保存できませんでした", scanFailed: "スキャンに失敗しました", couldNotLoadLibrary: "ライブラリを読み込めませんでした", couldNotLoadSeries: "シリーズを読み込めませんでした", couldNotUpdateEpisodeStatus: "エピソードの状態を更新できませんでした"
        }
    }
};

let libraryCurrentLang = loadLibraryLanguage();

function loadLibraryLanguage() {
    try {
        const settings = JSON.parse(localStorage.getItem("subtitlePlayerSettings") || "{}");
        return LIBRARY_I18N[settings.language] ? settings.language : "en";
    } catch {
        return "en";
    }
}

function lt(key, params = {}) {
    const fallback = LIBRARY_I18N.en.dict;
    const dict = LIBRARY_I18N[libraryCurrentLang]?.dict || fallback;
    let text = dict[key] || fallback[key] || key;
    for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
}

function applyLibraryLanguage() {
    libraryCurrentLang = loadLibraryLanguage();
    document.documentElement.lang = libraryCurrentLang;
    document.title = lt("libraryTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key) el.textContent = lt(key);
    });
    if (librarySummary?.textContent === "Loading..." || librarySummary?.textContent === "Загрузка..." || librarySummary?.textContent === "読み込み中...") librarySummary.textContent = lt("loading");
}

function watchedTextForEpisode(episode) {
    if (episode.completed) return lt("watched");
    if (episode.currentTimeSeconds > 0) return lt("atTime", { time: formatTime(episode.currentTimeSeconds) });
    return lt("notWatched");
}

const LINK_STATUS_ICON_PATHS = {
    linked: "/icons/chain-ok.svg",
    partial: "/icons/chain-missing.svg",
    missing: "/icons/chain-broken.svg",
};

function statusIconPath(status) {
    return LINK_STATUS_ICON_PATHS[status] || LINK_STATUS_ICON_PATHS.missing;
}

function renderSeriesTitle(series) {
    const status = series?.linkStatus || "missing";
    const title = series?.title || "";
    seriesTitle.innerHTML = `
        <img
            class="series-title-status-icon"
            src="${escapeHtml(statusIconPath(status))}"
            alt="${escapeHtml(statusTitle(status))}"
            title="${escapeHtml(statusTitle(status))}"
            data-series-link-status-icon
        >
        <span>${escapeHtml(title)}</span>
    `;
}

function recomputeSeriesLinkStatusFromEpisodes(episodes) {
    const items = Array.isArray(episodes) ? episodes : [];
    if (!items.length) return "missing";

    const episodesWithVideo = items.filter((episode) => episode.hasVideo).length;
    const episodesWithSubtitle = items.filter((episode) => episode.hasSubtitle).length;

    if (episodesWithVideo <= 0 && episodesWithSubtitle <= 0) return "missing";
    if (episodesWithVideo === items.length && episodesWithSubtitle === items.length) return "linked";
    return "partial";
}

function refreshCurrentSeriesLinkStatus() {
    if (!currentOpenedSeries) return;

    currentOpenedSeries.linkStatus = recomputeSeriesLinkStatusFromEpisodes(currentOpenedEpisodes);
    currentOpenedSeries.episodesWithVideo = currentOpenedEpisodes.filter((episode) => episode.hasVideo).length;
    currentOpenedSeries.episodesWithSubtitle = currentOpenedEpisodes.filter((episode) => episode.hasSubtitle).length;

    renderSeriesTitle(currentOpenedSeries);
    seriesStats.textContent = lt("seriesStats", {
        videos: currentOpenedSeries.episodesWithVideo,
        episodes: currentOpenedSeries.episodesCount,
        subtitles: currentOpenedSeries.episodesWithSubtitle,
        status: statusLabel(currentOpenedSeries.linkStatus)
    });
}

function statusLabel(status) {
    if (status === "linked") return lt("allLinked");
    if (status === "partial") return lt("partiallyLinked");
    return lt("missingFiles");
}

function statusKeyLabel(status) {
    return lt(status === "ready" ? "ready" : status === "needs-review" ? "needsReview" : status === "failed" ? "failed" : "skipped");
}

const seriesGrid = document.getElementById("seriesGrid");
const librarySummary = document.getElementById("librarySummary");
const scanLibraryBtn = document.getElementById("scanLibraryBtn");

const seriesModal = document.getElementById("seriesModal");
const seriesPanel = document.getElementById("seriesPanel");
const seriesTitle = document.getElementById("seriesTitle");
const seriesStats = document.getElementById("seriesStats");
const episodeList = document.getElementById("episodeList");
const closeSeriesPanelBtn = document.getElementById("closeSeriesPanelBtn");

const coverModal = document.getElementById("coverModal");
const coverModalTitle = document.getElementById("coverModalTitle");
const coverModalSubtitle = document.getElementById("coverModalSubtitle");
const closeCoverModalBtn = document.getElementById("closeCoverModalBtn");
const coverSearchInput = document.getElementById("coverSearchInput");
const coverSearchBtn = document.getElementById("coverSearchBtn");
const coverResults = document.getElementById("coverResults");

const subtitleModal = document.getElementById("subtitleModal");
const subtitleModalTitle = document.getElementById("subtitleModalTitle");
const subtitleModalSubtitle = document.getElementById("subtitleModalSubtitle");
const closeSubtitleModalBtn = document.getElementById("closeSubtitleModalBtn");
const subtitleSearchInput = document.getElementById("subtitleSearchInput");
const subtitleSearchBtn = document.getElementById("subtitleSearchBtn");
const subtitleResults = document.getElementById("subtitleResults");

const changeSeriesCoverBtn = document.getElementById("changeSeriesCoverBtn");
const downloadMissingSubtitlesBtn = document.getElementById("downloadMissingSubtitlesBtn");
const relinkSeriesFilesBtn = document.getElementById("relinkSeriesFilesBtn");
const deleteSeriesBtn = document.getElementById("deleteSeriesBtn");
const bulkSubtitleModal = document.getElementById("bulkSubtitleModal");
const bulkSubtitleModalTitle = document.getElementById("bulkSubtitleModalTitle");
const bulkSubtitleModalSubtitle = document.getElementById("bulkSubtitleModalSubtitle");
const closeBulkSubtitleModalBtn = document.getElementById("closeBulkSubtitleModalBtn");
const bulkSubtitleSearchInput = document.getElementById("bulkSubtitleSearchInput");
const bulkSubtitleSearchBtn = document.getElementById("bulkSubtitleSearchBtn");
const bulkSubtitleStatus = document.getElementById("bulkSubtitleStatus");
const bulkSubtitleSets = document.getElementById("bulkSubtitleSets");
const bulkSubtitleList = document.getElementById("bulkSubtitleList");
const confirmBulkSubtitleDownloadBtn = document.getElementById("confirmBulkSubtitleDownloadBtn");
const cancelBulkSubtitleDownloadBtn = document.getElementById("cancelBulkSubtitleDownloadBtn");

let currentCoverSeries = null;
let currentSubtitleEpisode = null;
let currentOpenedSeries = null;
let currentOpenedEpisodes = [];
let currentBulkSubtitlePlan = null;
let currentBulkSubtitleSetKey = null;
let isBulkSubtitleDownloading = false;
let isBulkSubtitlePreparing = false;

const JIMAKU_PLAN_REQUEST_DELAY_MS = 1300;
const JIMAKU_429_DEFAULT_WAIT_MS = 12000;
const JIMAKU_429_MAX_RETRIES = 4;
const JIMAKU_DOWNLOAD_CONCURRENCY = 2;

function updateSeriesCompletedCount(seriesId, delta) {
    const cards = document.querySelectorAll(".series-card");

    for (const card of cards) {
        if (String(card.dataset.seriesId) !== String(seriesId)) continue;

        const completedEl = card.querySelector("[data-completed-episodes]");
        const totalEl = card.querySelector("[data-total-episodes]");
        const fillEl = card.querySelector(".progress-bar-fill");

        if (!completedEl || !totalEl) return;

        const currentCompleted = Number(completedEl.textContent || 0);
        const total = Number(totalEl.textContent || 0);
        const nextCompleted = Math.max(0, currentCompleted + delta);

        completedEl.textContent = String(nextCompleted);

        if (fillEl && total > 0) {
            fillEl.style.width = `${Math.round((nextCompleted / total) * 100)}%`;
        }

        return;
    }
}

function updateCurrentSeriesStatsText(delta) {
    if (!currentOpenedSeries) return;

    currentOpenedSeries.completedEpisodes = Math.max(
        0,
        Number(currentOpenedSeries.completedEpisodes || 0) + delta
    );
}

function formatTime(seconds) {
    const value = Number(seconds || 0);

    if (value <= 0) return "0m";

    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);

    if (value <= 0) return "";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}


function statusIcon(status) {
    if (status === "linked") return "✓";
    if (status === "partial") return "!";
    return "×";
}

function statusTitle(status) {
    if (status === "linked") return lt("allLinked");
    if (status === "partial") return lt("partiallyLinked");
    return lt("missingFiles");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function loadLibrarySeries() {
    seriesGrid.innerHTML = "";
    librarySummary.textContent = lt("loading");

    const { response, data } = await apiJson("/library/series");

    if (!response.ok || data.error) {
        throw new Error(data.error || lt("couldNotLoadLibrary"));
    }

    const series = Array.isArray(data.series) ? data.series : [];

    const totalEpisodes = series.reduce((sum, item) => {
        return sum + Number(item.episodesCount || 0);
    }, 0);

    const completedEpisodes = series.reduce((sum, item) => {
        return sum + Number(item.completedEpisodes || 0);
    }, 0);

    const totalCards = series.reduce((sum, item) => {
        return sum + Number(item.cardsCount || 0);
    }, 0);

	librarySummary.textContent =
		lt("seriesSummary", { count: series.length, watched: completedEpisodes, total: totalEpisodes });

    seriesGrid.appendChild(renderAddAnimeCard());

    for (const item of series) {
        seriesGrid.appendChild(renderSeriesCard(item));
    }
}

function renderAddAnimeCard() {
    const card = document.createElement("article");
    card.className = "series-card add-anime-card";
    card.title = lt("addAnime");
    card.innerHTML = `
        <div class="series-cover add-anime-cover">
            <div class="add-anime-plus">+</div>
        </div>
        <div class="series-title">${escapeHtml(lt("addAnime"))}</div>
        <div class="series-extra">${escapeHtml(lt("addAnimeHint"))}</div>
    `;
    card.addEventListener("click", addAnimeFromPath);
    return card;
}

async function chooseLocalFolder(initialPath = "") {
    const { response, data } = await apiJson("/library/dialog/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialPath })
    });

    if (!response.ok || data.error) {
        throw new Error(data.error || lt("openFolderDialogFailed"));
    }
    if (data.cancelled || !data.path) return null;
    return String(data.path);
}

async function addAnimeFromPath() {
    let path = null;
    try {
        path = await chooseLocalFolder();
    } catch (err) {
        alert(`${lt("openFolderDialogFailed")}: ${err.message}`);
        return;
    }
    if (!path || !path.trim()) return;

    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = lt("scanning");
    try {
        const { response, data } = await apiJson("/library/scan-path", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: path.trim() })
        });
        if (!response.ok || data.error) throw new Error(data.error || lt("addAnimeFailed"));
        await loadLibrarySeries();
    } catch (err) {
        alert(`${lt("addAnimeFailed")}: ${err.message}`);
    } finally {
        scanLibraryBtn.disabled = false;
        scanLibraryBtn.textContent = lt("scanLibrary");
    }
}

function renderSeriesCard(item) {
    const card = document.createElement("article");
    card.className = "series-card";
    card.title = item.title;
	card.dataset.seriesId = item.id;

    const progressPercent = item.episodesCount
        ? Math.round((item.completedEpisodes / item.episodesCount) * 100)
        : 0;

    const firstLetter = String(item.title || "?").trim().slice(0, 1).toUpperCase();

    const coverHtml = item.coverUrl
        ? `<img class="series-cover-image" src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)}">`
        : `<div class="series-cover-letter">${escapeHtml(firstLetter)}</div>`;

    card.innerHTML = `
        <div class="series-cover">
            ${coverHtml}
        </div>

        <div class="series-title">${escapeHtml(item.title)}</div>

		<div class="series-meta">
			<span>
				<span data-completed-episodes>${escapeHtml(item.completedEpisodes)}</span>/<span data-total-episodes>${escapeHtml(item.episodesCount)}</span> ${escapeHtml(lt("eps"))}
			</span>
		</div>

		<div class="progress-bar">
			<div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
		</div>

    `;

		card.addEventListener("click", () => {
			openSeries(item.id);
		});

    return card;
}
async function openSeries(seriesId) {
    openSeriesModal();
    seriesTitle.textContent = lt("loading");
    seriesStats.textContent = "";
    episodeList.innerHTML = "";
    currentOpenedEpisodes = [];

    const { response, data } = await apiJson(`/library/series/${encodeURIComponent(seriesId)}`);

    if (!response.ok || data.error) {
        seriesTitle.textContent = lt("error");
        seriesStats.textContent = data.error || lt("couldNotLoadSeries");
        return;
    }

    const series = data.series;
    const episodes = Array.isArray(data.episodes) ? data.episodes : [];
    currentOpenedEpisodes = episodes;
	currentOpenedSeries = {
		...series,
		completedEpisodes: episodes.filter((episode) => episode.completed).length
	};

    renderSeriesTitle(series);
    seriesStats.textContent =
        lt("seriesStats", { videos: series.episodesWithVideo, episodes: series.episodesCount, subtitles: series.episodesWithSubtitle, status: statusLabel(series.linkStatus) });

    episodeList.innerHTML = "";

    for (const episode of episodes) {
        episodeList.appendChild(renderEpisodeRow(episode));
    }
}

function renderEpisodeRow(episode) {
    const row = document.createElement("div");
    row.className = "episode-row";

    const canOpen = Boolean(episode.hasVideo);

    const watched = watchedTextForEpisode(episode);

	row.innerHTML = `
		<div>
			<label class="episode-title episode-title-checkbox">
				<input
					class="episode-completed-checkbox"
					type="checkbox"
					${episode.completed ? "checked" : ""}
					data-episode-id="${escapeHtml(episode.id)}"
				>
				<span>${escapeHtml(episode.title)}</span>
			</label>

            <div class="episode-meta">
                <span>${episode.hasVideo ? lt("videoYes") : lt("videoNo")}</span>
                <span>·</span>
                <span>${episode.hasSubtitle ? lt("subtitlesYes") : lt("subtitlesNo")}</span>
                <button
                    class="find-subtitles-btn find-subtitles-btn-inline"
                    type="button"
                    ${canOpen ? "" : "disabled"}
                    data-episode-id="${escapeHtml(episode.id)}"
                >
                    ${episode.hasSubtitle ? lt("changeJpSubs") : lt("findJpSubs")}
                </button>
                <span>·</span>
				<span data-episode-watched-text>${escapeHtml(watched)}</span>
            </div>
        </div>

        <div class="episode-actions">
            <a class="open-episode-link ${canOpen ? "" : "disabled"}"
               href="/?episodeId=${encodeURIComponent(episode.id)}">
                ${escapeHtml(lt("open"))}
            </a>
        </div>
    `;

	const completedCheckbox = row.querySelector(".episode-completed-checkbox");

	completedCheckbox.addEventListener("click", (event) => {
		event.stopPropagation();
	});

completedCheckbox.addEventListener("change", async () => {
    const previousValue = !completedCheckbox.checked;
    const nextValue = completedCheckbox.checked;

    completedCheckbox.disabled = true;

    try {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(episode.id)}/completed`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    completed: nextValue
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("couldNotUpdateEpisodeStatus"));
        }

        const delta = nextValue ? 1 : -1;

        episode.completed = nextValue;
        updateCurrentSeriesStatsText(delta);
        updateSeriesCompletedCount(currentOpenedSeries?.id, delta);

        const watchedText = row.querySelector("[data-episode-watched-text]");
        if (watchedText) {
            watchedText.textContent = nextValue
                ? lt("watched")
                : episode.currentTimeSeconds > 0
                    ? lt("atTime", { time: formatTime(episode.currentTimeSeconds) })
                    : lt("notWatched");
        }
    } catch (err) {
        completedCheckbox.checked = previousValue;
        alert(err.message);
    } finally {
        completedCheckbox.disabled = false;
    }
});

    const findSubtitlesBtn = row.querySelector(".find-subtitles-btn");
    if (findSubtitlesBtn) {
        findSubtitlesBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            openSubtitleSearchModal(episode, row);
        });
    }

    return row;
}

function openSubtitleModal() {
    subtitleModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeSubtitleModal() {
    subtitleModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentSubtitleEpisode = null;
}

async function openSubtitleSearchModal(episode, row) {
    if (!currentOpenedSeries) return;

    currentSubtitleEpisode = { episode, row };

    const episodeNumber = episode.episodeNumber ?? "?";
    subtitleModalTitle.textContent = episode.hasSubtitle ? lt("changeJapaneseSubtitles") : lt("findJapaneseSubtitles");
    subtitleModalSubtitle.textContent = `${currentOpenedSeries.title} · ${lt("episodeLabel", { number: episodeNumber })}`;
    subtitleSearchInput.value = currentOpenedSeries.title;
    subtitleResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("subtitleQueryHint"))}</div>`;

    openSubtitleModal();
    subtitleSearchInput.focus();
    subtitleSearchInput.select();
}

async function searchSubtitlesForCurrentEpisode() {
    if (!currentSubtitleEpisode) return;

    const { episode } = currentSubtitleEpisode;
    const query = subtitleSearchInput.value.trim() || currentOpenedSeries?.title || "";

    subtitleSearchBtn.disabled = true;
    subtitleSearchBtn.textContent = lt("searching");
    subtitleResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("searchingJimaku"))}</div>`;

    try {
        const url =
            `/library/episodes/${encodeURIComponent(episode.id)}/subtitles/search` +
            `?q=${encodeURIComponent(query)}`;

        const { response, data } = await apiJson(url);

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("subtitleSearchFailed"));
        }

        renderSubtitleResults(data.results || []);
    } catch (err) {
        subtitleResults.innerHTML = `<div class="cover-message error">${escapeHtml(err.message)}</div>`;
    } finally {
        subtitleSearchBtn.disabled = false;
        subtitleSearchBtn.textContent = lt("search");
    }
}

function renderSubtitleResults(results) {
    subtitleResults.innerHTML = "";

    if (!results.length) {
        subtitleResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("noDirectSubtitles"))}</div>`;
        return;
    }

    for (const result of results) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "subtitle-result-item";

        const meta = [
            result.entryTitle,
            result.extension,
            formatBytes(result.sizeBytes),
            result.lastModified ? String(result.lastModified).slice(0, 10) : null,
        ].filter(Boolean).join(" · ");

        item.innerHTML = `
            <div class="cover-result-info">
                <div class="cover-result-title">${escapeHtml(result.filename || lt("untitledSubtitle"))}</div>
                <div class="cover-result-meta">${escapeHtml(meta)}</div>
            </div>
        `;

        item.addEventListener("click", () => {
            selectSubtitleResult(result);
        });

        subtitleResults.appendChild(item);
    }
}

async function selectSubtitleResult(result) {
    if (!currentSubtitleEpisode) return;

    const { episode, row } = currentSubtitleEpisode;
    subtitleResults.classList.add("is-loading");

    try {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(episode.id)}/subtitles/select`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: result.source,
                    entryId: result.entryId,
                    filename: result.filename,
                    downloadUrl: result.downloadUrl
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("couldNotSaveSubtitle"));
        }

        episode.hasSubtitle = true;
        episode.subtitleFileId = data.subtitleFileId;
        episode.linkStatus = episode.hasVideo ? "linked" : "partial";

        const meta = row.querySelector(".episode-meta");
        if (meta) {
            const watchedText = row.querySelector("[data-episode-watched-text]")?.outerHTML || "";
            meta.innerHTML = `${episode.hasVideo ? lt("videoYes") : lt("videoNo")} <span>·</span> <span>${lt("subtitlesYes")}</span> <button class="find-subtitles-btn find-subtitles-btn-inline" type="button" ${episode.hasVideo ? "" : "disabled"} data-episode-id="${escapeHtml(episode.id)}">${lt("changeJpSubs")}</button> <span>·</span> ${watchedText}`;
        }

        const btn = row.querySelector(".find-subtitles-btn");
        if (btn) btn.textContent = lt("changeJpSubs");

        refreshCurrentSeriesLinkStatus();

        closeSubtitleModal();
    } catch (err) {
        alert(err.message);
    } finally {
        subtitleResults.classList.remove("is-loading");
    }
}

function openBulkSubtitleModal() {
    bulkSubtitleModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeBulkSubtitleModal() {
    if (isBulkSubtitleDownloading || isBulkSubtitlePreparing) return;
    bulkSubtitleModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentBulkSubtitlePlan = null;
    currentBulkSubtitleSetKey = null;
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    bulkSubtitleStatus.textContent = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;
}

async function prepareMissingSubtitlesForCurrentSeries() {
    if (!currentOpenedSeries) return;

    currentBulkSubtitlePlan = null;
    currentBulkSubtitleSetKey = null;
    bulkSubtitleModalTitle.textContent = lt("downloadMissingJapaneseSubtitles");
    bulkSubtitleModalSubtitle.textContent = currentOpenedSeries.title;
    bulkSubtitleSearchInput.value = currentOpenedSeries.title;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = lt("subtitleQueryHint");
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;
    openBulkSubtitleModal();
    bulkSubtitleSearchInput.focus();
    bulkSubtitleSearchInput.select();
}

async function analyzeMissingSubtitlesForCurrentSeries() {
    if (!currentOpenedSeries || isBulkSubtitlePreparing || isBulkSubtitleDownloading) return;

    const query = bulkSubtitleSearchInput.value.trim() || currentOpenedSeries.title;
    currentBulkSubtitlePlan = null;
    currentBulkSubtitleSetKey = null;
    bulkSubtitleStatus.classList.remove("error");
    bulkSubtitleStatus.textContent = lt("analyzingJimakuEntries");
    if (bulkSubtitleSets) bulkSubtitleSets.innerHTML = "";
    bulkSubtitleList.innerHTML = "";
    confirmBulkSubtitleDownloadBtn.disabled = true;

    const previousText = downloadMissingSubtitlesBtn.textContent;
    const previousSearchText = bulkSubtitleSearchBtn.textContent;
    downloadMissingSubtitlesBtn.disabled = true;
    bulkSubtitleSearchBtn.disabled = true;
    bulkSubtitleSearchBtn.textContent = lt("searching");
    downloadMissingSubtitlesBtn.textContent = lt("analyzing");
    isBulkSubtitlePreparing = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;

    try {
        const data = await requestSeriesSubtitleAnalysisWithBackoff(currentOpenedSeries.id, query);
        currentBulkSubtitlePlan = data;
        renderBulkSubtitlePlan(data);

        const selectable = (data.items || []).filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
        const skipped = (data.items || []).filter((item) => item.status === "skipped").length;
        bulkSubtitleStatus.textContent = selectable
            ? lt("analysisReadyChoose", { selectable, skipped, entries: data.entriesChecked || 0 })
            : lt("analysisReadyNone", { skipped, entries: data.entriesChecked || 0 });
    } catch (err) {
        bulkSubtitleStatus.classList.add("error");
        bulkSubtitleStatus.textContent = err.message;
    } finally {
        isBulkSubtitlePreparing = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        downloadMissingSubtitlesBtn.disabled = false;
        bulkSubtitleSearchBtn.disabled = false;
        bulkSubtitleSearchBtn.textContent = previousSearchText;
        downloadMissingSubtitlesBtn.textContent = previousText;
        renderBulkSubtitlePlan(currentBulkSubtitlePlan || { items: [] });
        updateBulkSubtitleConfirmState();
    }
}

async function requestSeriesSubtitleAnalysisWithBackoff(seriesId, query) {
    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await apiJson(
            `/library/series/${encodeURIComponent(seriesId)}/subtitles/analyze`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ query })
            }
        );

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || lt("couldNotAnalyzeJimaku"));
            }
            return data;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        bulkSubtitleStatus.textContent = lt("jimakuRateLimitWait", { seconds: Math.ceil(waitMs / 1000) });
        await sleep(waitMs);
    }

    throw new Error(lt("jimakuRetryReached"));
}

function retryAfterToMs(value) {
    const raw = String(value || "").trim();
    if (!raw) return JIMAKU_429_DEFAULT_WAIT_MS;

    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
        return Math.max(1000, asNumber * 1000);
    }

    const asDate = Date.parse(raw);
    if (Number.isFinite(asDate)) {
        return Math.max(1000, asDate - Date.now());
    }

    return JIMAKU_429_DEFAULT_WAIT_MS;
}

function updateBulkSubtitleConfirmState() {
    if (isBulkSubtitlePreparing || isBulkSubtitleDownloading || !currentBulkSubtitlePlan) {
        confirmBulkSubtitleDownloadBtn.disabled = true;
        return;
    }
    confirmBulkSubtitleDownloadBtn.disabled = getSelectedBulkSubtitleItems().length === 0;
}

function candidateKey(candidate) {
    return String(candidate?.downloadUrl || `${candidate?.entryId || ""}:${candidate?.filename || ""}`);
}

function formatSubtitleCandidate(candidate) {
    if (!candidate) return "";
    return [
        candidate.filename,
        candidate.entryTitle,
        candidate.extension,
        formatBytes(candidate.sizeBytes),
        candidate.lastModified ? String(candidate.lastModified).slice(0, 10) : null,
    ].filter(Boolean).join(" · ");
}

function getBulkSubtitleSets(plan) {
    const items = Array.isArray(plan?.items) ? plan.items : [];
    const totalEpisodes = items.filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
    const byKey = new Map();

    for (const item of items) {
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const usedForEpisode = new Set();

        for (const candidate of candidates) {
            const releaseKey = String(candidate.releaseKey || candidate.entryTitle || "other");
            if (!releaseKey || usedForEpisode.has(releaseKey)) continue;
            usedForEpisode.add(releaseKey);

            if (!byKey.has(releaseKey)) {
                byKey.set(releaseKey, {
                    key: releaseKey,
                    label: candidate.releaseLabel || candidate.entryTitle || lt("other"),
                    count: 0,
                    totalEpisodes,
                    examples: [],
                    candidatesByEpisodeId: new Map(),
                });
            }

            const group = byKey.get(releaseKey);
            group.count += 1;
            group.candidatesByEpisodeId.set(String(item.episodeId), candidate);
            if (group.examples.length < 2) {
                group.examples.push(candidate.filename || candidate.entryTitle || lt("subtitle"));
            }
        }
    }

    return Array.from(byKey.values())
        .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
}

function renderBulkSubtitleSets(plan) {
    if (!bulkSubtitleSets) return;

    const items = Array.isArray(plan?.items) ? plan.items : [];
    const hasPending = items.some((item) => ["pending", "searching", "rate-limited"].includes(item.status));
    const sets = getBulkSubtitleSets(plan);

    bulkSubtitleSets.innerHTML = "";

    if (!sets.length) {
        if (!hasPending) {
            bulkSubtitleSets.innerHTML = `<div class="cover-message">${escapeHtml(lt("noSubtitleSets"))}</div>`;
        }
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "bulk-subtitle-sets-inner";

    const title = document.createElement("div");
    title.className = "bulk-subtitle-sets-title";
    title.textContent = hasPending
        ? lt("suggestedSetsFoundSoFar")
        : lt("chooseSetBeforeDownloading");
    wrapper.appendChild(title);

    const list = document.createElement("div");
    list.className = "bulk-subtitle-set-list";

    for (const set of sets.slice(0, 8)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `bulk-subtitle-set-btn ${currentBulkSubtitleSetKey === set.key ? "selected" : ""}`;
        button.disabled = isBulkSubtitleDownloading;
        button.dataset.releaseKey = set.key;
        button.innerHTML = `
            <div class="bulk-subtitle-set-name">${escapeHtml(set.label)}</div>
            <div class="bulk-subtitle-set-count">${escapeHtml(set.count)} / ${escapeHtml(set.totalEpisodes)} episodes</div>
            <div class="bulk-subtitle-set-examples">${escapeHtml(set.examples.join(" · "))}</div>
        `;
        list.appendChild(button);
    }

    wrapper.appendChild(list);
    bulkSubtitleSets.appendChild(wrapper);
}

function applyBulkSubtitleSet(releaseKey) {
    if (!currentBulkSubtitlePlan) return;

    currentBulkSubtitleSetKey = releaseKey;

    for (const item of currentBulkSubtitlePlan.items || []) {
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const candidate = candidates.find((candidate) => String(candidate.releaseKey || candidate.entryTitle || "other") === String(releaseKey));

        if (candidate) {
            item.selected = candidate;
            item.status = "ready";
            item.message = lt("selectedFromSubtitleSet");
        } else if (candidates.length) {
            item.selected = null;
            item.status = "needs-review";
            item.message = lt("noFileFromSelectedSet");
        }
    }

    renderBulkSubtitlePlan(currentBulkSubtitlePlan);
}

async function requestEpisodeSubtitlePlanWithBackoff(item) {
    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(item.episodeId)}/subtitles/plan`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: currentOpenedSeries.title
                })
            }
        );

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || lt("couldNotSearchEpisodeJimaku"));
            }
            return data.item;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        item.status = "rate-limited";
        item.message = lt("jimakuRateLimitWait", { seconds: Math.ceil(waitMs / 1000) });
        renderBulkSubtitlePlan(currentBulkSubtitlePlan);
        await sleep(waitMs);
    }

    throw new Error(lt("jimakuRetryReached"));
}

async function prepareBulkSubtitlePlanGradually(plan) {
    const items = Array.isArray(plan.items) ? plan.items : [];
    if (!items.length) {
        bulkSubtitleStatus.textContent = lt("noMissingSubtitleEpisodes");
        return;
    }

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        item.status = "searching";
        item.message = lt("searchingEpisodeJimaku");
        renderBulkSubtitlePlan(plan);
        bulkSubtitleStatus.textContent = lt("searchingJimakuProgress", { current: index + 1, total: items.length, episode: item.episodeNumber ?? "?" });

        try {
            const plannedItem = await requestEpisodeSubtitlePlanWithBackoff(item);
            Object.assign(item, plannedItem);
            if (currentBulkSubtitleSetKey) {
                const candidates = Array.isArray(item.candidates) ? item.candidates : [];
                const candidate = candidates.find((candidate) => String(candidate.releaseKey || candidate.entryTitle || "other") === String(currentBulkSubtitleSetKey));
                if (candidate) {
                    item.selected = candidate;
                    item.status = "ready";
                    item.message = lt("selectedFromSubtitleSet");
                }
            }
        } catch (err) {
            item.status = "failed";
            item.message = err.message;
            item.selected = null;
            item.candidates = [];
            item.alternativesCount = 0;
        }

        renderBulkSubtitlePlan(plan);

        if (index < items.length - 1) {
            await sleep(JIMAKU_PLAN_REQUEST_DELAY_MS);
        }
    }

    const selectable = items.filter((item) => Array.isArray(item.candidates) && item.candidates.length).length;
    const selected = items.filter((item) => item.status === "ready" && item.selected).length;
    const skipped = items.filter((item) => item.status === "skipped").length;
    const failed = items.filter((item) => item.status === "failed").length;
    bulkSubtitleStatus.textContent = selected
        ? lt("planReadySelected", { selected, review: selectable - selected, skipped, failed })
        : lt("planReadyChoose", { selectable, skipped, failed });
    updateBulkSubtitleConfirmState();
}

function renderBulkSubtitlePlan(plan) {
    const items = Array.isArray(plan.items) ? plan.items : [];
    const readyItems = items.filter((item) => item.status === "ready" && item.selected);
    const reviewItems = items.filter((item) => item.status === "needs-review" || (Array.isArray(item.candidates) && item.candidates.length && !item.selected));
    const skippedItems = items.filter((item) => item.status === "skipped");
    const failedItems = items.filter((item) => item.status === "failed");
    const pendingItems = items.filter((item) => ["pending", "searching", "rate-limited"].includes(item.status));

    bulkSubtitleStatus.classList.remove("error");
    if (!isBulkSubtitlePreparing && !isBulkSubtitleDownloading) {
        bulkSubtitleStatus.textContent =
            lt("bulkStatusReady", { selected: readyItems.length, review: reviewItems.length, skipped: skippedItems.length, failed: failedItems.length });
    } else if (pendingItems.length) {
        bulkSubtitleStatus.textContent =
            lt("bulkStatusChecking", { selected: readyItems.length, pending: pendingItems.length, failed: failedItems.length });
    }

    renderBulkSubtitleSets(plan);
    bulkSubtitleList.innerHTML = "";

    if (!items.length) {
        bulkSubtitleList.innerHTML = `<div class="cover-message">${escapeHtml(lt("noMissingSubtitleEpisodes"))}</div>`;
        confirmBulkSubtitleDownloadBtn.disabled = true;
        return;
    }

    for (const item of items) {
        const row = document.createElement("div");
        const candidates = Array.isArray(item.candidates) ? item.candidates : [];
        const selected = item.selected || null;
        const canDownload = item.status === "ready" && selected?.downloadUrl;
        const hasManualChoices = candidates.length > 0 && !isBulkSubtitlePreparing && !isBulkSubtitleDownloading;
        const meta = canDownload
            ? formatSubtitleCandidate(selected)
            : candidates.length
                ? item.message || lt("chooseSubtitleSetOrManual")
                : item.message || lt("noSubtitleSelected");

        row.className = `bulk-subtitle-item ${escapeHtml(item.status || "skipped")}`;
        row.innerHTML = `
            <input
                class="bulk-subtitle-checkbox"
                type="checkbox"
                ${canDownload ? "checked" : "disabled"}
                ${isBulkSubtitlePreparing || isBulkSubtitleDownloading ? "disabled" : ""}
                data-episode-id="${escapeHtml(item.episodeId)}"
            >
            <div class="bulk-subtitle-info">
                <div class="bulk-subtitle-title">
                    ${escapeHtml(lt("episodeLabel", { number: item.episodeNumber ?? "?" }))} · ${escapeHtml(item.episodeTitle || lt("untitled"))}
                </div>
                <div class="bulk-subtitle-meta">${escapeHtml(meta)}</div>
                ${hasManualChoices ? `
                    <select class="bulk-subtitle-select" data-episode-id="${escapeHtml(item.episodeId)}">
                        <option value="">${escapeHtml(lt("chooseManually"))}</option>
                        ${candidates.map((candidate) => `
                            <option value="${escapeHtml(candidateKey(candidate))}" ${selected && candidateKey(candidate) === candidateKey(selected) ? "selected" : ""}>
                                ${escapeHtml(candidate.releaseLabel || candidate.entryTitle || lt("other"))} — ${escapeHtml(candidate.filename || lt("subtitle"))}
                            </option>
                        `).join("")}
                    </select>
                ` : ""}
            </div>
            <div class="bulk-subtitle-state" data-bulk-state-for="${escapeHtml(item.episodeId)}">
                ${escapeHtml(canDownload ? lt("ready") : statusKeyLabel(item.status))}
            </div>
        `;

        bulkSubtitleList.appendChild(row);
    }

    updateBulkSubtitleConfirmState();
}

function getSelectedBulkSubtitleItems() {
    if (!currentBulkSubtitlePlan) return [];

    const selectedIds = new Set(
        Array.from(bulkSubtitleList.querySelectorAll(".bulk-subtitle-checkbox:checked"))
            .map((checkbox) => String(checkbox.dataset.episodeId))
    );

    return (currentBulkSubtitlePlan.items || []).filter((item) => {
        return item.status === "ready" && item.selected && selectedIds.has(String(item.episodeId));
    });
}

async function postSubtitleDownloadWithBackoff(item) {
    const selected = item.selected;

    for (let attempt = 0; attempt <= JIMAKU_429_MAX_RETRIES; attempt += 1) {
        const { response, data } = await apiJson(
            `/library/episodes/${encodeURIComponent(item.episodeId)}/subtitles/select`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: selected.source,
                    entryId: selected.entryId,
                    filename: selected.filename,
                    downloadUrl: selected.downloadUrl
                })
            }
        );

        if (response.status !== 429) {
            if (!response.ok || data.error) {
                throw new Error(data.error || lt("couldNotSaveSubtitle"));
            }
            return data;
        }

        const waitMs = retryAfterToMs(data.retryAfter);
        const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);
        if (stateEl) stateEl.textContent = lt("rateLimitedRetrying", { seconds: Math.ceil(waitMs / 1000) });
        await sleep(waitMs);
    }

    throw new Error(lt("jimakuRetryReached"));
}

async function downloadSelectedBulkSubtitles() {
    const items = getSelectedBulkSubtitleItems();
    if (!items.length) return;

    isBulkSubtitleDownloading = true;
    confirmBulkSubtitleDownloadBtn.disabled = true;
    cancelBulkSubtitleDownloadBtn.disabled = true;
    closeBulkSubtitleModalBtn.disabled = true;
    bulkSubtitleList.querySelectorAll("input, select").forEach((input) => {
        input.disabled = true;
    });

    let downloaded = 0;
    let failed = 0;
    let nextIndex = 0;

    async function worker(workerId) {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            const item = items[index];
            const stateEl = bulkSubtitleList.querySelector(`[data-bulk-state-for="${String(item.episodeId)}"]`);

            bulkSubtitleStatus.textContent = lt("downloadingProgress", { done: downloaded + failed, total: items.length, concurrency: Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length) });
            if (stateEl) stateEl.textContent = lt("downloadingState");

            try {
                await postSubtitleDownloadWithBackoff(item);
                downloaded += 1;
                if (stateEl) stateEl.textContent = lt("downloadedState");
            } catch (err) {
                failed += 1;
                if (stateEl) stateEl.textContent = lt("failedState", { message: err.message });
            }

            bulkSubtitleStatus.textContent = lt("downloadingSummary", { done: downloaded + failed, total: items.length, downloaded, failed });
        }
    }

    try {
        const workerCount = Math.min(JIMAKU_DOWNLOAD_CONCURRENCY, items.length);
        await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index)));
        bulkSubtitleStatus.textContent = lt("finishedDownloads", { downloaded, failed });
        await openSeries(currentOpenedSeries.id);
        await loadLibrarySeries();
    } finally {
        isBulkSubtitleDownloading = false;
        cancelBulkSubtitleDownloadBtn.disabled = false;
        closeBulkSubtitleModalBtn.disabled = false;
        confirmBulkSubtitleDownloadBtn.disabled = true;
    }
}




function openCoverModal() {
    coverModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeCoverModal() {
    coverModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentCoverSeries = null;
}

async function openCoverSearchModal(series) {
    currentCoverSeries = series;

    coverModalTitle.textContent = series.coverUrl ? lt("changeCover") : lt("findCover");
    coverModalSubtitle.textContent = series.title;
    coverSearchInput.value = series.title;
    coverResults.innerHTML = "";

    openCoverModal();

    await searchCoversForCurrentSeries();
}

async function searchCoversForCurrentSeries() {
    if (!currentCoverSeries) return;

    const query = coverSearchInput.value.trim() || currentCoverSeries.title;

    coverSearchBtn.disabled = true;
    coverSearchBtn.textContent = lt("searching");
    coverResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("searchingAniList"))}</div>`;

    try {
        const url =
            `/library/series/${encodeURIComponent(currentCoverSeries.id)}/cover/search` +
            `?q=${encodeURIComponent(query)}`;

        const { response, data } = await apiJson(url);

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("coverSearchFailed"));
        }

        renderCoverResults(data.results || []);
    } catch (err) {
        coverResults.innerHTML = `<div class="cover-message error">${escapeHtml(err.message)}</div>`;
    } finally {
        coverSearchBtn.disabled = false;
        coverSearchBtn.textContent = lt("search");
    }
}

function renderCoverResults(results) {
    coverResults.innerHTML = "";

    if (!results.length) {
        coverResults.innerHTML = `<div class="cover-message">${escapeHtml(lt("noResultsFound"))}</div>`;
        return;
    }

    for (const result of results) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "cover-result-item";

        const meta = [
            result.format,
            result.seasonYear,
            result.episodes ? `${result.episodes} ${lt("eps")}` : null,
        ].filter(Boolean).join(" · ");

        item.innerHTML = `
            <img src="${escapeHtml(result.coverUrl)}" alt="">
            <div class="cover-result-info">
                <div class="cover-result-title">${escapeHtml(result.title || result.preferredTitle || lt("untitled"))}</div>
                <div class="cover-result-subtitle">${escapeHtml(result.englishTitle || result.nativeTitle || "")}</div>
                <div class="cover-result-meta">${escapeHtml(meta)}</div>
            </div>
        `;

        item.addEventListener("click", () => {
            selectCoverResult(result);
        });

        coverResults.appendChild(item);
    }
}

async function selectCoverResult(result) {
    if (!currentCoverSeries) return;

    coverResults.classList.add("is-loading");

    try {
        const { response, data } = await apiJson(
            `/library/series/${encodeURIComponent(currentCoverSeries.id)}/cover/select`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    source: result.source,
                    externalId: result.externalId,
                    coverUrl: result.coverUrl
                })
            }
        );

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("couldNotSaveCover"));
        }

        closeCoverModal();
        await loadLibrarySeries();
    } catch (err) {
        alert(err.message);
    } finally {
        coverResults.classList.remove("is-loading");
    }
}


async function deleteSeriesFromLibrary(seriesId, title) {
    const label = title || currentOpenedSeries?.title || lt("untitled");
    const ok = window.confirm(lt("deleteSeriesConfirm", { title: label }));
    if (!ok) return;

    if (deleteSeriesBtn) deleteSeriesBtn.disabled = true;
    try {
        const { response, data } = await apiJson(`/library/series/${encodeURIComponent(seriesId)}`, {
            method: "DELETE"
        });
        if (!response.ok || data.error) throw new Error(data.error || lt("deleteSeriesFailed"));

        if (currentOpenedSeries && String(currentOpenedSeries.id) === String(seriesId)) {
            closeSeriesModal();
        }
        await loadLibrarySeries();
    } catch (err) {
        alert(`${lt("deleteSeriesFailed")}: ${err.message}`);
    } finally {
        if (deleteSeriesBtn) deleteSeriesBtn.disabled = false;
    }
}


async function relinkCurrentSeriesFiles() {
    if (!currentOpenedSeries) return;

    let path = null;
    try {
        path = await chooseLocalFolder();
    } catch (err) {
        alert(`${lt("openFolderDialogFailed")}: ${err.message}`);
        return;
    }
    if (!path || !path.trim()) return;

    relinkSeriesFilesBtn.disabled = true;
    try {
        const { response, data } = await apiJson(`/library/series/${encodeURIComponent(currentOpenedSeries.id)}/relink`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: path.trim() })
        });
        if (!response.ok || data.error) throw new Error(data.error || lt("relinkFailed"));
        seriesStats.textContent = lt("relinkDone", {
            count: Array.isArray(data.relinked) ? data.relinked.length : 0,
            unresolved: Array.isArray(data.unresolved) ? data.unresolved.length : 0
        });
        await openSeries(currentOpenedSeries.id);
        await loadLibrarySeries();
    } catch (err) {
        alert(`${lt("relinkFailed")}: ${err.message}`);
    } finally {
        relinkSeriesFilesBtn.disabled = false;
    }
}


scanLibraryBtn.addEventListener("click", async () => {
    scanLibraryBtn.disabled = true;
    scanLibraryBtn.textContent = lt("scanning");

    try {
        const { response, data } = await apiJson("/library/scan");

        if (!response.ok || data.error) {
            throw new Error(data.error || lt("scanFailed"));
        }

        await loadLibrarySeries();
    } catch (err) {
        alert(err.message);
    } finally {
        scanLibraryBtn.disabled = false;
        scanLibraryBtn.textContent = lt("scanLibrary");
    }
});

closeSeriesPanelBtn.addEventListener("click", () => {
    closeSeriesModal();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeSeriesModal();
        closeCoverModal();
        closeSubtitleModal();
        closeBulkSubtitleModal();
    }
});

seriesModal.addEventListener("click", (event) => {
    if (event.target === seriesModal) {
        closeSeriesModal();
    }
});

loadLibrarySeries().catch((err) => {
    console.error(err);
    librarySummary.textContent = err.message;
});

function openSeriesModal() {
    seriesModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeSeriesModal() {
    seriesModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    currentOpenedSeries = null;
    currentOpenedEpisodes = [];
}

closeCoverModalBtn.addEventListener("click", () => {
    closeCoverModal();
});

coverSearchBtn.addEventListener("click", () => {
    searchCoversForCurrentSeries();
});

coverSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        searchCoversForCurrentSeries();
    }
});

coverModal.addEventListener("click", (event) => {
    if (event.target === coverModal) {
        closeCoverModal();
    }
});

closeSubtitleModalBtn.addEventListener("click", () => {
    closeSubtitleModal();
});

subtitleSearchBtn.addEventListener("click", () => {
    searchSubtitlesForCurrentEpisode();
});

subtitleSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        searchSubtitlesForCurrentEpisode();
    }
});

subtitleModal.addEventListener("click", (event) => {
    if (event.target === subtitleModal) {
        closeSubtitleModal();
    }
});

closeBulkSubtitleModalBtn.addEventListener("click", () => {
    closeBulkSubtitleModal();
});

cancelBulkSubtitleDownloadBtn.addEventListener("click", () => {
    closeBulkSubtitleModal();
});

confirmBulkSubtitleDownloadBtn.addEventListener("click", () => {
    downloadSelectedBulkSubtitles();
});

bulkSubtitleSearchBtn.addEventListener("click", () => {
    analyzeMissingSubtitlesForCurrentSeries();
});

bulkSubtitleSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        analyzeMissingSubtitlesForCurrentSeries();
    }
});

bulkSubtitleModal.addEventListener("click", (event) => {
    if (event.target === bulkSubtitleModal) {
        closeBulkSubtitleModal();
    }
});

if (bulkSubtitleSets) {
    bulkSubtitleSets.addEventListener("click", (event) => {
        const button = event.target.closest(".bulk-subtitle-set-btn");
        if (!button || button.disabled) return;
        applyBulkSubtitleSet(button.dataset.releaseKey);
    });
}

bulkSubtitleList.addEventListener("change", (event) => {
    if (event.target && event.target.classList.contains("bulk-subtitle-checkbox")) {
        updateBulkSubtitleConfirmState();
        return;
    }

    if (event.target && event.target.classList.contains("bulk-subtitle-select")) {
        const episodeId = String(event.target.dataset.episodeId);
        const value = String(event.target.value || "");
        const item = (currentBulkSubtitlePlan?.items || []).find((item) => String(item.episodeId) === episodeId);
        if (!item) return;

        const candidate = (item.candidates || []).find((candidate) => candidateKey(candidate) === value);
        if (candidate) {
            item.selected = candidate;
            item.status = "ready";
            item.message = lt("selectedManually");
        } else {
            item.selected = null;
            item.status = item.candidates?.length ? "needs-review" : "skipped";
            item.message = item.candidates?.length ? lt("chooseSubtitleSetOrManual") : lt("noSubtitleSelected");
        }

        renderBulkSubtitlePlan(currentBulkSubtitlePlan);
    }
});

seriesGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".series-delete-card-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    deleteSeriesFromLibrary(button.dataset.seriesId, button.dataset.seriesTitle);
});

if (deleteSeriesBtn) {
    deleteSeriesBtn.addEventListener("click", () => {
        if (!currentOpenedSeries) return;
        deleteSeriesFromLibrary(currentOpenedSeries.id, currentOpenedSeries.title);
    });
}

relinkSeriesFilesBtn.addEventListener("click", relinkCurrentSeriesFiles);

changeSeriesCoverBtn.addEventListener("click", () => {
    if (!currentOpenedSeries) return;
    openCoverSearchModal(currentOpenedSeries);
});

downloadMissingSubtitlesBtn.addEventListener("click", () => {
    prepareMissingSubtitlesForCurrentSeries();
});

applyLibraryLanguage();