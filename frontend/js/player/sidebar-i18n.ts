import { i18n } from "../core/i18n.js";
export const sidebarTranslations: Record<string, Record<string, string>> = {
    ru: {
        candidateContextChanged: "Границы кандидата изменились. Повторите добавление карточки.",
        candidateContextTitle: "Контекст кандидата",
        candidateSeconds: "с",
        candidateSavedShort: "Сохранено",
        candidateSaving: "Сохраняю…",
        candidateEditing: "Выбор границ",
        candidateStartBoundary: "Начало контекста",
        candidateEndBoundary: "Конец контекста",
        candidateBoundaryHelp: "Перетащите границу или используйте стрелки вверх и вниз",
        candidateContextUnavailable: "Исходные субтитры не совпали с сохранённым текстом. Сохранённый контекст доступен без редактирования.",

        sidebarTitle: "Боковая панель", showSidebar: "Показать боковую панель", hideSidebar: "Скрыть боковую панель", closeSidebar: "Закрыть боковую панель",
        candidateTitle: "Кандидаты", candidateOpen: "Открыть кандидатов", candidateAdd: "Добавить через Yomitan", candidateSkip: "Пропустить",
        candidateEmpty: "Выделите слово и нажмите «Сохранить кандидата» или Alt+Q.", candidateEpisode: "Серия {id}", candidateRetry: "Повторить прикрепление медиа",
        candidateSelectWord: "Выделите слово в субтитрах.", candidateMultiple: "Создано несколько записей Anki. Нельзя выбрать запись однозначно.",
        candidateWaiting: "Слово скопировано. Создайте одну запись через Yomitan. Ожидание: 60 секунд.", candidateTimeout: "Новая запись не найдена. Кандидат остался в очереди.",
        candidateAttaching: "Прикрепляю сохранённые текст, аудио и изображение…", candidateDone: "Карточка готова.", candidateSkipped: "Кандидат пропущен.",
        candidateMismatch: "Слово не найдено в новой записи. Проверьте её в Anki.", candidateSettings: "Заполните настройки Anki перед добавлением карточки.",
        candidateSaved: "Кандидат сохранён. Разберите его в боковой панели.", candidateSourceMissing: "Исходное видео недоступно.", candidateEpisodeMissing: "Серия больше недоступна в библиотеке.",
        candidateVideoFailed: "Не удалось открыть исходное видео.", ankiAcquireBusy: "Уже идёт ожидание или добавление записи Anki. Завершите его сначала."
    },
    en: {
        candidateContextChanged: "Candidate bounds changed. Try adding the card again.",
        candidateContextTitle: "Candidate context",
        candidateSeconds: "s",
        candidateSavedShort: "Saved",
        candidateSaving: "Saving…",
        candidateEditing: "Selecting range",
        candidateStartBoundary: "Context start",
        candidateEndBoundary: "Context end",
        candidateBoundaryHelp: "Drag the boundary or use the up and down arrow keys",
        candidateContextUnavailable: "The source subtitles do not match the saved text. The saved context remains available without editing.",

        sidebarTitle: "Sidebar", showSidebar: "Show sidebar", hideSidebar: "Hide sidebar", closeSidebar: "Close sidebar",
        candidateTitle: "Candidates", candidateOpen: "Open candidates", candidateAdd: "Add through Yomitan", candidateSkip: "Skip",
        candidateEmpty: "Select a word and click Save candidate or press Alt+Q.", candidateEpisode: "Episode {id}", candidateRetry: "Retry media attachment",
        candidateSelectWord: "Select a word in the subtitles.", candidateMultiple: "Multiple Anki notes appeared. The target note is ambiguous.",
        candidateWaiting: "Word copied. Create one note through Yomitan. Waiting for 60 seconds.", candidateTimeout: "No new note found. The candidate remains in the queue.",
        candidateAttaching: "Attaching saved text, audio, and image…", candidateDone: "Card ready.", candidateSkipped: "Candidate skipped.",
        candidateMismatch: "The word was not found in the new note. Check it in Anki.", candidateSettings: "Complete the Anki settings before adding a card.",
        candidateSaved: "Candidate saved. Review it in the sidebar.", candidateSourceMissing: "The source video is unavailable.", candidateEpisodeMissing: "The episode is no longer available in the library.",
        candidateVideoFailed: "Could not open the source video.", ankiAcquireBusy: "An Anki note is already being awaited or updated. Finish that action first."
    },
    ja: {
        candidateContextChanged: "候補の範囲が変更されました。カードの追加をやり直してください。",
        candidateContextTitle: "候補の文脈",
        candidateSeconds: "秒",
        candidateSavedShort: "保存済み",
        candidateSaving: "保存中…",
        candidateEditing: "範囲を選択中",
        candidateStartBoundary: "文脈の開始",
        candidateEndBoundary: "文脈の終了",
        candidateBoundaryHelp: "境界をドラッグするか、上下キーを使ってください",
        candidateContextUnavailable: "元の字幕が保存したテキストと一致しません。保存した文脈は編集せずに利用できます。",

        sidebarTitle: "サイドバー", showSidebar: "サイドバーを表示", hideSidebar: "サイドバーを非表示", closeSidebar: "サイドバーを閉じる",
        candidateTitle: "候補", candidateOpen: "候補を開く", candidateAdd: "Yomitanで追加", candidateSkip: "スキップ",
        candidateEmpty: "単語を選択し、「候補を保存」を押すか Alt+Q を押してください。", candidateEpisode: "エピソード {id}", candidateRetry: "メディアの追加を再試行",
        candidateSelectWord: "字幕の単語を選択してください。", candidateMultiple: "複数のAnkiノートが作成されたため、対象を特定できません。",
        candidateWaiting: "単語をコピーしました。Yomitanでノートを1件追加してください。60秒間待機します。", candidateTimeout: "新しいノートが見つかりません。候補はキューに残ります。",
        candidateAttaching: "保存したテキスト・音声・画像を追加中…", candidateDone: "カードの準備ができました。", candidateSkipped: "候補をスキップしました。",
        candidateMismatch: "新しいノートに単語が見つかりません。Ankiで確認してください。", candidateSettings: "カードを追加する前にAnkiの設定を入力してください。",
        candidateSaved: "候補を保存しました。サイドバーで確認できます。", candidateSourceMissing: "元の動画を利用できません。", candidateEpisodeMissing: "ライブラリにエピソードがありません。",
        candidateVideoFailed: "元の動画を開けませんでした。", ankiAcquireBusy: "別のAnkiノートを待機中、または更新中です。先にその操作を完了してください。"
    }
};
for (const [language, dictionary] of Object.entries(sidebarTranslations)) {
    Object.assign(i18n[language].dict, dictionary);
}
