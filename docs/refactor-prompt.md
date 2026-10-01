# Archived refactor prompt

Archived on 2026-10-01. This document describes an earlier refactor and does not define current work.
See [current results](refactor-results.md) for the completed five-phase update.
The original text follows unchanged.

---

# Промпт для Codex: закрыть технический долг Bunmine

Скопируй всё из блока «НАЧАЛО ПРОМПТА» в Codex.

---

## НАЧАЛО ПРОМПТА

Ты работаешь в проекте **Bunmine** (репозиторий `D:\Projects\Bunmine`). Это локальный
видеоплеер и медиатека для японского sentence mining. Flask + SQLite на бэкенде,
TypeScript без сборщика на фронтенде, AnkiConnect для карточек.

Моя задача: закрыть накопленный технический долг. Ниже список из семи фаз.
Выполняй их строго по порядку.

### Правила работы

1. **Одна фаза за раз.** Не начинай фазу N+1, пока фаза N не зелёная и не закоммичена.
2. **Коммит после каждой фазы.** Сообщение на английском, в стиле существующих
   коммитов: `Add busy timeout to sqlite connections`, `Stop booting app on import`.
   Один коммит на фазу, либо на логически цельный кусок внутри фазы.
3. **Тесты должны проходить после каждого коммита.** Команда проверки:
   ```
   py -m pytest -q
   npx tsc -p tsconfig.json --noEmit
   ```
   На Windows `python` может отсутствовать, используй `py`.
4. **Если тест упал, который ты не ожидал, остановись.** Не маскируй падение
   ослаблением проверки и не правь тест, чтобы он прошёл. Разберись в причине.
5. **Не меняй публичное поведение.** Ни один маршрут, ни один текст в интерфейсе,
   ни один формат ответа API не должен измениться. Рефакторинг только.
6. **Не удаляй непроверенное.** Перед удалением функции grep по всему `frontend/js`
   и `backend`, включая `tests/`. Приведи в ответе список мест, где нашлись вызовы.

### Что уже хорошо, не трогай это

- 104 теста Python и 24 фронтовых теста, CI зелёный
- ноль `as any`, ноль `@ts-ignore`, ноль голых `except:` в `backend/`
- страница плеера (`frontend/js/player/`, `frontend/js/subtitles/`, `frontend/js/highlighter/`)
  не использует `innerHTML` вообще, весь недоверенный текст идёт через `textContent`
- фабричный паттерн с внедрёнными зависимостями уже применяется примерно в 10
  контроллерах и покрыт тестами (`createRuntimePrefetchController`,
  `createAutoAttachController`, `createCandidateReviewController`, `createCandidatePanel`)
- `player/anki-acquire-lock.ts` и `core/api.ts` (`fetchWithRetry`) сделаны правильно
- `subtitles/sidebar-render.ts:97` делает инкрементальную перерисовку строк, не пересоздаёт DOM

---

### Фаза 1. Перестать запускать приложение на импорте

**Проблема (подтверждена).** `backend/__init__.py:1` содержит
`from backend.app import app, create_app`, а `backend/app.py:73` содержит
`app = create_app()` на уровне модуля. Поэтому `import backend.config` создаёт
директории, копирует старые данные, удаляет `data/dedupe_index.json`, выполняет
миграции и поднимает фоновый поток с обращением к AnkiConnect.

**Что сделать:**

1. Очистить `backend/__init__.py` (файл станет пустым или с одним docstring).
   Проверь, что `from backend import app_state` в `backend/routes/misc_routes.py:7`
   и `from backend.app_state import dedupe_lock` в `backend/services/dedupe_service.py:6`
   продолжают работать. Подмодули импортируются при пустом `__init__.py`.
2. Удалить строку 73 из `backend/app.py`.
3. Добавить в `backend/app.py` параметр `initialize: bool = True` в сигнатуру
   `create_app`, и вызывать `initialize_backend(settings)` только если он True.
4. `server.py` переписать так, чтобы приложение создавалось внутри `if __name__ == "__main__":`
   через `create_app()`, а не через импорт готового объекта.
5. `tests/test_vocabulary_report.py:10,64` сейчас зовёт `create_app().test_client()`.
   Этот вызов запускает полный стартап и трогает реальные данные. Перепиши на
   `create_app(settings=..., initialize=False)`, где `settings` собран из `tmp_path`.
   Добавь фикстуру в `tests/conftest.py`, которая даёт `Settings` на временной папке.
6. Проверь, что после этих правок `py -c "import backend.config"` печатает
   ТОЛЬКО `IMPORTED backend.config OK` и больше ничего.

**Готово, когда:** `py -m pytest -q` даёт 104 passed, и голый импорт `backend.config`
не создаёт файлов и не печатает строки startup.

---

### Фаза 2. Убрать вторую систему конфигурации

**Проблема (подтверждена).** Есть два канала настроек:

- `backend/config.py:4` вызывает `load_settings()` на импорте и экспортирует 23
  модульные константы. Его импортируют 5 модулей: `backend/library_subtitles.py:8`,
  `backend/routes/misc_routes.py:8`, `backend/services/anki_highlight_store.py:3`,
  `backend/services/dedupe_service.py:7`, `backend/services/vocabulary_report_service.py:7`
- `app.config["SETTINGS"]` уже читают 3 модуля через `current_app`:
  `backend/routes/candidate_routes.py:27,36,41`, `backend/routes/media_routes.py:20`,
  `backend/routes/static_routes.py:10,16,25,41,48`

Из-за этого `tests/test_library_routes.py:20-25` патчит семь глобалей вручную.

**Что сделать:**

1. Удалить `backend/config.py`.
2. Перевести 5 модулей из списка выше на `current_app.config["SETTINGS"]`.
   Случай, когда настройки нужны вне контекста запроса (например, фоновый поток),
   реши через явную передачу аргумента, а не через новую глобальную переменную.
3. В `tests/test_library_routes.py` убрать блок monkeypatch констант
   (строки 20-25) и проверь, что тесты проходят за счёт фикстуры из фазы 1.
4. Удалить мёртвые экспорты, которые нигде не используются. Проверено как кандидаты:
   `VIDEO_DIR`, `ANKI_HIGHLIGHT_CACHE_DIR`, `ANKI_HIGHLIGHT_AUTO_REFRESH`,
   `ANKI_HIGHLIGHT_AUTO_REFRESH_HOUR`, `ANKI_HIGHLIGHT_AUTO_REFRESH_MINUTE`.
   Grep подтверди каждый.

**Готово, когда:** файла `backend/config.py` нет, в `backend/` нет ни одной ссылки
на него, тесты зелёные.

---

### Фаза 3. Безопасность и целостность данных

Сделай эту фазу раньше остальных, если хватает времени. Здесь правки маленькие,
а риск высокий.

**3.1 SSRF в `backend/library_covers.py:23-45`** (функция `download_cover_file`).
`cover_url` приходит из тела запроса, вызывающего `POST` в
`backend/routes/library/cover_routes.py:33`, и уходит в `urllib.request.urlopen`
без проверки. Требуется:

- разрешить только схему `https`
- разрешить только хосты из белого списка, например
  `s3.anilist.co`, `media.kitsu.app`, `s3.kitsu.app`, `kitsu.app`.
  Сделай список настраиваемым через `Settings`
- отклонять IP-адреса из приватных диапазонов и loopback после резолва
- ограничить размер чтения. Сейчас `response.read()` на строке 38 тянет всё в память,
  а лимита нет вообще

**3.2 Таймауты на subprocess.** `backend/ffmpeg_service.py:24-31` (`run_subprocess`)
не задаёт `timeout`. Зависший ffmpeg держит поток Flask навсегда. Добавь
`timeout` из конфигурации, значение по умолчанию 600 секунд, и лови
`subprocess.TimeoutExpired` с понятным сообщением. То же самое сделай для
`backend/services/frontend_build_service.py:32` и добавь `stdin=subprocess.DEVNULL`,
чтобы npm не зависал на интерактивном запросе.

**3.3 `busy_timeout` для SQLite.** В `backend/repositories/connection.py` нет
`PRAGMA busy_timeout`, значение по умолчанию 0. При конкурентной записи прилетает
`database is locked` сразу. Добавь `conn.execute("PRAGMA busy_timeout = 5000")`.
Убери `PRAGMA journal_mode = WAL` из `get_db` (строка 13) и выставь его один раз
в `backend/migrations/migration_001_initial.py`, так как повторный вызов берёт
блокировку на каждое открытие соединения.

**3.4 Настоящие миграции.** `backend/migrations/runner.py:15` игнорирует
`schema_meta.schema_version` и каждый раз гоняет весь список миграций.
`backend/migrations/__init__.py:4` объявляет `CURRENT_SCHEMA_VERSION = 4`, а в
списке одна миграция `001`. Переделай runner так, чтобы он:

- читал текущую версию из `schema_meta`
- выполнял только миграции с большим номером
- записывал новую версию в той же транзакции
- умел создавать базу с нуля, для этого добавь начальное значение версии 1
  в `migration_001_initial.py`

**3.5 Индекс.** Добавь составной индекс, самая частая выборка в проекте идёт по нему:
```sql
CREATE INDEX IF NOT EXISTS idx_library_files_episode_type
ON library_files(episode_id, file_type, file_exists, is_primary)
```
Он покрывает 5 копий одного и того же запроса «выбрать главный файл эпизода»:
`backend/library_subtitles.py:157`, `:259`,
`backend/repositories/playback_repository.py:74`,
`backend/services/vocabulary_report_service.py:28`,
`backend/repositories/library_repository.py:183`.
Вынеси этот запрос в одну функцию репозитория и замени все 5 вызовов.

**3.6 Утечка внутренностей в ответах.** 30 обработчиков имеют вид
`except Exception as err: return jsonify({"error": str(err)}), 500`. Клиент получает
абсолютные пути и текст трейсбека. Добавь в `backend/api_response.py` обработчик
ошибок, который логирует настоящее исключение и возвращает нейтральное сообщение
с идентификатором запроса. Машируй `ValueError` в 400, `urllib.error.HTTPError` в 502,
остальное в 500. Убери `str(path)` из тела ответа.

**3.7 Мутирующий GET.** `backend/repositories/library_repository.py:39-83`
(`refresh_library_file_existence`) вызывается из 5 мест, включая `GET /library/series`.
Он делает `SELECT` по всей таблице `library_files`, затем `stat()` по каждой строке,
затем `UPDATE` внутри открытой транзакции. Список `IN (?, ?, ...)` собирается из
всех отсутствующих id, что падает на библиотеке с 1000 пропавших файлов. Перенеси
эту проверку в `scan_library` и добавь отдельный маршрут
`POST /library/refresh-files`. Чтение пусть доверяет колонке `file_exists`.
Разбивай `UPDATE` на пачки по 500 id.

**Готово, когда:** все пункты сделаны, `py -m pytest -q` зелёный, добавь тест на
таймаут ffmpeg и на отклонение `file://` в `download_cover_file`.

---

### Фаза 4. Мёртвый код и дубли на бэкенде

**4.1 Удалить мёртвый параллельный путь Jimaku.** В `backend/library_subtitles.py`
есть две взаимоисключающие стратегии. Живая используется фронтендом:
`build_series_jimaku_subtitle_analysis` на строке 472, плюс маршруты
`subtitles/search`, `subtitles/select`, `subtitles/analyze`, `subtitles/plan`,
которые зовут `frontend/js/library/library-api.ts:82,90,101,112`.

Мёртвая: `get_missing_jimaku_subtitle_candidates` (строка 388),
`build_missing_jimaku_subtitle_plan` (568), `bulk_download_missing_jimaku_subtitles` (633),
и маршруты `subtitles/missing`, `download-plan`, `download-missing`
в `backend/routes/library/subtitle_routes.py:71,142,165`. Никто их не зовёт.
Удали всё это, около 120 строк. Перед удалением покажи grep вызовов.

**4.2 Перевернуть слои.** `backend/services/startup_service.py:7` импортирует
`backend/routes/misc_routes`. Перенеси `refresh_known_anki_words_if_stale_on_startup`
в новый `backend/services/anki_word_sync_service.py` вместе со всей логикой
(строки 41-301 и 459-628 в `misc_routes.py` это 174 строки бизнес-логики и оркестрации
AnkiConnect в роуте). Оба модуля должны импортировать сервис, а не наоборот.

**4.3 Убрать дубли.**

- `get_library_file_by_id` существует дважды:
  `backend/repositories/library_repository.py:395` и
  `backend/repositories/playback_repository.py:42`. Оставь версию, которая
  всегда обновляет `file_exists`
- 4 самописных HTTP-клиента: `backend/library_subtitles.py:33,94`,
  `backend/library_cover_search.py:90,11`, `backend/library_covers.py:28`,
  `backend/services/anki_client.py:12`. Собери один `backend/http_client.py`
  с функциями `get_json`, `post_json`, `get_bytes` с лимитом размера
- 3 реализации снятия HTML-тегов: `backend/routes/misc_routes.py:89`,
  `backend/services/vocabulary_report_model.py:27`,
  `backend/services/dedupe_service.py:63`. Собери в один модуль
- `jimaku_cache` создаётся дважды: в `backend/migrations/migration_001_initial.py:116`
  и в `backend/library_subtitles.py:43-54` во время каждого запроса. Удали второй
- `backend/services/library_service.py:111` это мёртвая прокладка, её никто не
  импортирует. Удали
- Мёртвые глобалы: `backend/app_state.py:6` (`last_heartbeat`),
  `backend/routes/vocabulary_report_routes.py:11` (`_report_files`),
  `backend/library_subtitles.py:103,109` (`_safe_subtitle_name`, `_episode_label`)

**4.4 Ограничить job_service.** `backend/services/job_service.py:7` хранит
`_jobs` в памяти без очистки. Каждый скан библиотеки и каждый отчёт добавляют запись
навсегда. Добавь вытеснение по TTL и по максимальному размеру.

**4.5 Логи вместо print.** Во всём `backend/` нет `logging`, кроме одного файла.
`startup_service.py` и `frontend_build_service.py` печатают через `print`.
Добавь `logging.basicConfig` в `backend/app.py` и переведи на logging, включая
все проглоченные исключения. Их 5 мест, например `backend/routes/media_routes.py:206`.
В `backend/routes/media_routes.py:205` проверка удаления временных файлов сделана
через `safe_filename in item`, это сравнение подстроки. Удаление `ep.mkv` заденет
`temp_xep.mkv_y.mkv`. Сделай `startswith("temp_")` плюс `endswith`.

**Готово, когда:** фаза удалена, дубли сведены, логи есть, тесты зелёные.

---

### Фаза 5. Модульная система на фронтенде

Это самая большая фаза, но она убирает сразу больше всего проблем.
Не пытайся сделать всё сразу, детай ниже.

**Проблема (подтверждена измерением).** `tsconfig.json:5` содержит
`"module": "None"`. Во всех 81 файле `frontend/js` ноль `import` и `export`.
Я запустил `tsc --noEmit --strict` и получил 185 ошибок, из которых 135
это TS18046 и TS18047, то есть прямое следствие отсутствия модулей.
Оставшиеся 50 это настоящие ошибки типов.

**Что сделать, строго в этом порядке:**

1. В `tsconfig.json` поменять `"module": `" на `"ESNext"`, добавить
   `"moduleResolution": "bundler"`. Флаги `strict` и `noImplicitAny` пока
   оставь выключенными. Включать `strict` в этой фазе нельзя, получится 185
   ошибок вместо управляемых 50.
2. По одному файлу пройдись по папкам от листьев к корню: `core`, `types`,
   `video`, `japanese`, `highlighter`, `subtitles`, `player`, `library`.
   Добавь `export` на верхнеуровневые объявления, которые использует другой файл,
   и `import` на использование. Список символов, которые нужны наружу, возьми из
   `frontend/js/types/legacy-globals.d.ts`, там 72 ambient объявления. Это и есть
   карта экспортов.
3. Удалить `frontend/js/types/legacy-globals.d.ts` целиком.
4. Удалить `frontend/js/core/state.ts:89-100`, а именно 29 вызовов
   `Object.defineProperty(window, ...)`. Замени на обычный
   `export const state = {...}` в одном модуле, импортируй его. Удалить
   `frontend/js/player/context.ts`, его поля `state` и `getLanguageDict` никто
   не читает, а `app.ts:29` делает небезопасный каст
   `playerContext.dom as Required<PlayerDom>`.
5. В `frontend/js/bootstrap.ts:32-103` и `frontend/js/library-bootstrap.ts:2-15`
   удалить массивы `scripts` и ручной загрузчик `loadScript`.
6. Подключить esbuild. Он уже стоит в `devDependencies` версии 0.25.6 и не
   используется ни в одном скрипте. Добавь в `package.json`:
   - `build:ts` скомпилировать в `dist/esm`
   - `build:bundle` собрать esbuild-ом `dist/esm/bootstrap.js` в
     `dist/js/player.js` и `dist/esm/library-bootstrap.js` в `dist/js/library.js`
   - `kuromoji` и `media-captions` отдать как externals, они грузятся отдельно
   В `frontend/player.html:334` и `frontend/library.html` замени
   `<script type="module" src="/dist/js/bootstrap.js">` на ссылку на сборку.
7. Почистить сборку: `rimraf dist` перед `tsc`. Сейчас в `dist` лежит
   `dist/js/player/auto-attach-queue.js` на 219 строк, а исходника
   `frontend/js/player/auto-attach-queue.ts` не существует. Он попал в сборку
   тестов, потому что `tests/*.mjs` читают из `dist`.
8. Удалить 17 проверок `typeof X === "function"` на глобалах, которые
   компилятор знает. Они перечислены в `frontend/js/player/anki-actions.ts:218`,
   `frontend/js/highlighter/anki-highlighter.ts:253,467,468,469`,
   `frontend/js/player/app.ts:148`, `frontend/js/player/settings.ts:140,296,310,313,320,324`,
   `frontend/js/subtitles/subtitles-sidebar.ts:201`,
   `frontend/js/subtitles/subtitles.ts:138,152,160`,
   `frontend/js/japanese/japanese-tokenizer.ts:10`
9. Исправить `frontend/js/bootstrap.ts:60`, путь `libs/kuromoji/kuromoji.js`
   относительный, а остальные 70 абсолютные. Добавь ведущий слэш.
10. Переписать `tests/*.mjs`. Сейчас они читают скомпилированный `dist/js/*.js`,
    делают строковую замену и запускают в `node:vm` с рукописным фейковым DOM.
    После появления модулей тесты должны импортировать функции напрямую, а фабрики
    получать зависимости аргументами. Фейковые DOM в
    `tests/subtitle-sidebar-tests.mjs:6-40`,
    `tests/candidate-media-tests.mjs:12-23`,
    `tests/library-subtitle-controller-tests.mjs:5-12` удали.

**Готово, когда:** в `frontend/js` есть `import` и `export`, файла
`legacy-globals.d.ts` нет, в `player.html` и `library.html` грузится 2 файла
вместо 71, `npx tsc -p tsconfig.json --noEmit` зелёный, все 24 фронтовых теста
проходят.

---

### Фаза 6. Дробление больших файлов на фронтенде

Начинай только после зелёной фазы 5. Реальные размеры больше, чем кажется:
`player/anki-actions.ts` 588 строк, `highlighter/anki-highlighter.ts` 586,
`player/app.ts` 530, `subtitles/subtitles-sidebar.ts` 531,
`player/settings.ts` 438, `library/library-bulk-workflow.ts` 436.

Делай в этом порядке:

1. **`player/anki-actions.ts`.** Создай `anki/anki-connect-client.ts` с одной
   функцией `ankiRequest`. Сейчас бойлерплейт `POST {action, version: 6, params}`
   написан 5 раз, на строках 27, 51, 77, 109 в
   `highlighter/anki-highlighter.ts` и 534. Создай `anki/furigana.ts` с
   `buildSentenceFurigana` со строки 209, это чистая функция на 71 строку.
   Создай `anki/note-fields.ts` с `stripHtml`, `boldWordInText`, `getNoteWord`.
   Оставь в `anki-actions.ts` только фабрику контроллера. Удали мёртвые функции
   `hasRequiredAnkiMediaFields`, `normalizeSelectedAnkiWord`, `isKanaOnly`,
   `escapeAnkiFieldText`
2. **`player/app.ts`.** Вынеси обработчик `timeupdate` со строк 44-120 в
   `player/timeupdate-loop.ts`, сделай его внедряемым. Вынеси обработчик
   кнопки обновления подсветки со строк 474-530. `app.ts` должен стать
  composition root на 80-100 строк
3. **`player/settings.ts`.** Функция `loadSettings` на строках 170-300 это
   50 строк одного и того же паттерна, повторённого 13 раз. Собери таблицу
   `[keyof PlayerSettings, string]` и пройди по ней. Удали дубликат
   `langSelect.onchange` на строках 432-437, он уже назначен на 340-343
4. **i18n.** Сейчас 4 реализации поиска перевода: `player/ui.ts:92`,
   `library/library-i18n.ts:201`, `subtitles/search-panel.ts:18`,
   `player/context.ts:17`. `player/context.ts` мёртв, `player/toast.ts:6`
   тоже мёртв. Оставь один `t()`. Файл
   `player/sidebar-i18n.ts:69-71` делает `Object.assign(i18n[language].dict, dictionary)`
   в момент загрузки, то есть корректность зависит от порядка в
   `bootstrap.ts:34-35`. Перенеси строки сайдбара в общий каталог и удали merge-цикл.
   Удали примерно 45 мёртвых ключей, они перечислены в отчёте, проверь каждый grep-ом
5. **`library/library-cover-controller.ts` и `library/library-subtitle-controller.ts`**
   совпадают на 85 процентов. Собери одну `createLibrarySearchModal`, два контроллера
   станут объектами конфигурации по 20 строк
6. **`library/library-bulk-workflow.ts`.** Три одинаковых цикла повтора при
   HTTP 429 на строках 84, 194, 353. Собери `retryOnRateLimit`
7. **`player/toast.ts`** сейчас мёртв целиком, 25 строк и 3 неиспользуемые функции.
   Сделай его домом для `reportError`, который заменит 6 одинаковых блоков
   перехвата ошибок в `player/app.ts:296,495,520`,
   `player/candidate-bindings.ts:55,80`, `player/auto-attach-bindings.ts:31`

**Готово, когда:** нет файла длиннее 350 строк, все тесты зелёные.

---

### Фаза 7. Инструменты, тесты и гигиена

1. **Починить `ruff.toml`.** Сейчас там только `select = ["E9", "F63", "F7", "F82"]`.
   Это проверка только на синтаксис. Расширь до `["E", "F", "W", "B", "SIM", "UP", "C4", "RET", "ARG"]`
   и почини 130 замечаний, которые сейчас скрыты. Из них 9 неиспользуемых импортов,
   34 строки с `;` внутри, 62 строки длиннее 120 символов. Файл `pytest.ini`
   сейчас содержит секцию `[pytest]` и ключи `target-version` и `line-length`,
   которые относятся к ruff. Убери лишнее, ruff читает `ruff.toml`
2. **Починить скрипты.** `npm run test:python` зовёт `python`, которого на этой
   машине нет. Сделай кроссплатформенно. `tests/player-pointer-browser-tests.mjs`
   не подключён ни к одному npm-скрипту, а playwright нет в `devDependencies`.
   Либо добавь playwright в `devDependencies` и скрипт `test:browser` в CI,
   либо удали файл. Сейчас он выглядит как покрытие, но не даёт его
3. **Покрыть пустые места.** Нулевое покрытие у
   `backend/library_subtitles.py` (691 строка), `backend/routes/misc_routes.py` (658),
   `backend/library_covers.py`. На фронтенде 21 модуль из 81 без тестов, включая
   `subtitles-sidebar.ts` и `library-bulk-workflow.ts`. Покрой чистые функции
   первыми
4. **Починить живые баги, которые нашлись при разборе:**

   - `frontend/js/library/library-subtitle-controller.ts:100-106` не работает.
     Три селектора `.episode-meta`, `[data-episode-watched-text]` и
     `.find-subtitles-btn` никогда не появляются в DOM. Единственный производитель
     строк эпизодов это `renderEpisodeRow` в `frontend/js/library/library.ts:210`,
     и там таких элементов нет. Либо добавь их в шаблон, либо удали блок
   - `frontend/js/library/library-bulk-workflow.ts:386` и
     `frontend/js/library/library-bindings.ts:43`. Кнопка Cancel во время
     загрузки субтитров не делает ничего, потому что `closeBulkSubtitleModal`
     делает ранний выход на строке 7. Добавь `AbortController` и подключи отмену
   - `frontend/js/library/library.ts:311` и
     `frontend/js/library/vocabulary-report-controller.ts:29` это два бесконечных
     `while (true)` без таймаута и без отмены. Добавь таймаут
   - `backend/routes/misc_routes.py:155`. Ручной refresh двигает метку
     авто-refresh и этим отменяет следующий автоматический запуск.
     Записывай `lastAutoRefreshAt` только когда `autoRun` истинно
   - `frontend/js/library/library-presentation.ts:71-77`. Функция `escapeHtml`
     не экранирует одинарную кавычку. Добавь `'` к `&#39;` и напиши тест
5. **Гигиена репозитория.** В `.gitignore` есть дубликаты строк
   `.tmp_pytest_cache`. Файл `bunmine.bat` добавлен в игнор, но README и
   `bunmine.bat` это точка входа для пользователя, реши что с ним делать.
   `NEXT.md` тоже в игноре. Файлы `frontend/fonts/meiryo.ttf` 9.4 МБ,
   `NotoSansJP.ttf` 8.7 МБ и `NotoSansJP-Bold.ttf` 5.2 МБ лежат в git,
   они дают почти всё место в репозитории. Рассмотри скрипт загрузки шрифтов
   в `npm run build:libs`
6. **Обнови документацию.** `README.md` не описывает настройку через `.env`
   подробно, хотя `load_settings` падает без `ANKI_MEDIA_DIR` и
   `MEDIA_LIBRARY_DIR`. Добавь раздел с обязательными переменными.
   В `docs/` лежат 2 файла. Опиши слои backend так, как они станут после
   фаз 2 и 4

---

## Проверка в конце

Выполни и покажи вывод целиком:

```
py -m pytest -q
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.json --noEmit --strict
py -m ruff check backend/
```

Ожидаемый результат: тесты зелёные, `tsc` зелёный, ruff зелёный. Число ошибок
под `--strict` должно упасть с 185 до 50 или ниже.

Затем ответь на пять вопросов:

1. Какие фазы ты сделал, а какие нет, и почему
2. Сколько строк кода удалено и сколько добавлено, `git diff --stat` в конце
3. Что осталось из исходного долга и почему
4. Какие новые баги ты нашёл и какие тесты на них написал
5. Что бы ты сделал дальше, одна рекомендация

## КОНЕЦ ПРОМПТА
