from backend.settings import Settings, load_settings


_SETTINGS = load_settings()

PROJECT_DIR = _SETTINGS.project_dir
BASE_DIR = _SETTINGS.base_dir
DATA_DIR = _SETTINGS.data_dir
FRONTEND_DIR = _SETTINGS.frontend_dir
VIDEO_DIR = _SETTINGS.video_dir
ANKI_HIGHLIGHT_DIR = _SETTINGS.anki_highlight_dir
ANKI_HIGHLIGHT_CACHE_DIR = ANKI_HIGHLIGHT_DIR
ANKI_MEDIA_DIR = _SETTINGS.anki_media_dir
SCREENSHOT_DIR = _SETTINGS.screenshot_dir
AUDIO_DIR = _SETTINGS.audio_dir
MEDIA_LIBRARY_DIR = _SETTINGS.media_library_dir
ALLOWED_ORIGIN = _SETTINGS.allowed_origin
ALLOWED_VIDEO_EXTENSIONS = _SETTINGS.allowed_video_extensions
ALLOWED_SUBTITLE_EXTENSIONS = _SETTINGS.allowed_subtitle_extensions
DEDUPE_INDEX_PATH = _SETTINGS.dedupe_index_path
LIBRARY_DB_PATH = _SETTINGS.library_db_path
LIBRARY_COVERS_DIR = _SETTINGS.library_covers_dir
FONTS_DIR = _SETTINGS.fonts_dir
PORT = _SETTINGS.port
JIMAKU_API_TOKEN = _SETTINGS.jimaku_api_token
ANKI_HIGHLIGHT_AUTO_REFRESH = _SETTINGS.anki_highlight_auto_refresh
ANKI_HIGHLIGHT_AUTO_REFRESH_HOUR = _SETTINGS.anki_highlight_auto_refresh_hour
ANKI_HIGHLIGHT_AUTO_REFRESH_MINUTE = _SETTINGS.anki_highlight_auto_refresh_minute
