type LibraryDict = Record<string, string>;
type LibraryLanguageCatalog = Record<string, { name: string; dict: LibraryDict }>;

const LIBRARY_I18N: LibraryLanguageCatalog = {
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
            deleteMissingEpisode: "Delete",
            deleteMissingEpisodeConfirm: "Remove \"{title}\" from the list? Files on disk will not be deleted.",
            deleteMissingEpisodeFailed: "Could not delete episode",
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

Object.assign(LIBRARY_I18N.ru.dict, {
    deleteMissingEpisode: "Удалить",
    deleteMissingEpisodeConfirm: "Удалить «{title}» из списка? Файлы на диске не будут удалены.",
    deleteMissingEpisodeFailed: "Не удалось удалить серию"
});

for (const [lang, values] of Object.entries({
    en: { exportVocabulary: "Export vocabulary report", reportScopeEntire: "Scope: Entire series", includeStatuses: "Include statuses", statusUnknown: "Unknown / not in Anki", reportTokenTypes: "Token types", includeParticles: "Include particles", includeAuxiliaryForms: "Include auxiliary and conversational forms", reportSheets: "Sheets", prepareReport: "Prepare report", preparingReport: "Preparing report…", reportReady: "Report downloaded", reportFailed: "Could not create vocabulary report" },
    ru: { exportVocabulary: "Экспорт отчёта по лексике", reportScopeEntire: "Область: весь сериал", includeStatuses: "Статусы", statusUnknown: "Неизвестно / нет в Anki", reportTokenTypes: "Типы токенов", includeParticles: "Включать частицы", includeAuxiliaryForms: "Включать вспомогательные и разговорные формы", reportSheets: "Листы", prepareReport: "Подготовить отчёт", preparingReport: "Готовим отчёт…", reportReady: "Отчёт скачан", reportFailed: "Не удалось создать отчёт" },
    ja: { exportVocabulary: "語彙レポートを出力", reportScopeEntire: "範囲：シリーズ全体", includeStatuses: "含める状態", statusUnknown: "不明 / Ankiにない", reportTokenTypes: "トークンの種類", includeParticles: "助詞を含める", includeAuxiliaryForms: "助動詞・会話的な表現を含める", reportSheets: "シート", prepareReport: "レポートを作成", preparingReport: "レポートを作成中…", reportReady: "ダウンロード完了", reportFailed: "語彙レポートを作成できませんでした" }
})) Object.assign(LIBRARY_I18N[lang].dict, values);

Object.assign(LIBRARY_I18N.ja.dict, {
    deleteMissingEpisode: "削除",
    deleteMissingEpisodeConfirm: "「{title}」を一覧から削除しますか？ディスク上のファイルは削除されません。",
    deleteMissingEpisodeFailed: "エピソードを削除できませんでした"
});

Object.assign(LIBRARY_I18N.en.dict, {
    languageStudy: "Language study",
    searchByTitle: "Search by title", searchPlaceholder: "Anime title...", myLibrary: "My library", all: "All",
    watching: "Watching", notStarted: "Not started", completed: "Completed", files: "Files", tools: "Tools",
    episodes: "Episodes", missingVideo: "Missing video", missingSubtitles: "Missing Japanese subtitles",
    fileProblems: "File or linking problems", sorting: "Sorting", recentlyWatched: "Recently watched",
    byProgress: "By progress", byTitle: "By title", recentlyAdded: "Recently added",
    showingSeries: "Showing {count} of {total}", noMatchingSeries: "No series match these filters.",
    startWatching: "Start watching", continueWatching: "Continue", continueAt: "Continue at {time}",
    backToLibrary: "Back to library", inProgress: "In progress", noJp: "No JP", openEpisodes: "Open episodes",
    detailProgress: "Watched {watched} of {total}", currentEpisode: "Current episode: {number}",
    allEpisodesCompleted: "All available episodes are completed", subtitlesGroup: "Subtitles", mediaGroup: "Media",
    dangerZone: "Danger zone", deleteSeriesHint: "Removes the library record, not files on disk."
});

Object.assign(LIBRARY_I18N.ru.dict, {
    languageStudy: "Изучение языка",
    searchByTitle: "Поиск по названию", searchPlaceholder: "Название аниме...", myLibrary: "Моя библиотека", all: "Все",
    watching: "Смотрю", notStarted: "Не начато", completed: "Просмотрено", files: "Файлы", tools: "Инструменты",
    episodes: "Эпизоды", missingVideo: "Без видео", missingSubtitles: "Без японских субтитров",
    fileProblems: "Проблемы с файлами или привязкой", sorting: "Сортировка", recentlyWatched: "Недавно смотрел",
    byProgress: "По прогрессу", byTitle: "По названию", recentlyAdded: "Недавно добавлено",
    showingSeries: "Показано {count} из {total}", noMatchingSeries: "По этим фильтрам ничего не найдено.",
    startWatching: "Начать просмотр", continueWatching: "Продолжить", continueAt: "Продолжить с {time}",
    backToLibrary: "Назад в библиотеку", inProgress: "В процессе", noJp: "Нет JP", openEpisodes: "Открыть эпизоды",
    detailProgress: "Просмотрено {watched} из {total}", currentEpisode: "Текущий эпизод: {number}",
    allEpisodesCompleted: "Все доступные эпизоды просмотрены", subtitlesGroup: "Субтитры", mediaGroup: "Медиа",
    dangerZone: "Опасная зона", deleteSeriesHint: "Удаляет запись из библиотеки, но не файлы на диске."
});

Object.assign(LIBRARY_I18N.ja.dict, {
    languageStudy: "言語学習",
    searchByTitle: "タイトル検索", searchPlaceholder: "アニメタイトル...", myLibrary: "マイライブラリ", all: "すべて",
    watching: "視聴中", notStarted: "未視聴", completed: "視聴済み", files: "ファイル", tools: "ツール",
    episodes: "エピソード", missingVideo: "動画なし", missingSubtitles: "日本語字幕なし", fileProblems: "ファイル問題",
    sorting: "並び替え", recentlyWatched: "最近視聴", byProgress: "進捗順", byTitle: "タイトル順", recentlyAdded: "追加順",
    showingSeries: "{total}件中{count}件", noMatchingSeries: "該当するシリーズはありません。", startWatching: "視聴開始",
    continueWatching: "続ける", continueAt: "{time}から続ける", backToLibrary: "ライブラリへ戻る", inProgress: "視聴中",
    noJp: "JPなし", openEpisodes: "エピソードを開く", detailProgress: "{total}話中{watched}話視聴済み",
    currentEpisode: "現在のエピソード: {number}", allEpisodesCompleted: "すべてのエピソードを視聴済み",
    subtitlesGroup: "字幕", mediaGroup: "メディア", dangerZone: "危険な操作",
    deleteSeriesHint: "ディスク上のファイルは削除せず、ライブラリ情報のみ削除します。"
});

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
