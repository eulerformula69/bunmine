"""Library routes package."""

from backend.routes.library.series_routes import library_series_bp
from backend.routes.library.episode_routes import library_episode_bp
from backend.routes.library.subtitle_routes import library_subtitle_bp
from backend.routes.library.cover_routes import library_cover_bp
from backend.routes.library.file_routes import library_file_bp

__all__ = [
    "library_series_bp",
    "library_episode_bp",
    "library_subtitle_bp",
    "library_cover_bp",
    "library_file_bp",
]
