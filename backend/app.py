import json
import logging

from flask import Flask
from flask_cors import CORS

from backend.routes.library import (
    library_series_bp,
    library_episode_bp,
    library_subtitle_bp,
    library_cover_bp,
    library_file_bp,
)
from backend.routes.vocabulary_report_routes import vocabulary_report_bp
from backend.routes.media_routes import media_bp
from backend.routes.misc_routes import misc_bp
from backend.routes.static_routes import static_bp
from backend.routes.candidate_routes import candidate_bp
from backend.services.startup_service import initialize_backend
from backend.settings import Settings, load_settings
from backend.api_response import normalize_payload, register_error_handlers


def create_app(settings: Settings | None = None, initialize: bool = True) -> Flask:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = settings or load_settings()
    if initialize:
        initialize_backend(settings)
    app = Flask(__name__, static_folder=str(settings.frontend_dir))
    app.config["SETTINGS"] = settings
    register_error_handlers(app)

    if settings.allowed_origin:
        CORS(app, resources={r"/*": {"origins": [settings.allowed_origin]}})
    else:
        CORS(app)

    app.register_blueprint(library_series_bp)
    app.register_blueprint(library_episode_bp)
    app.register_blueprint(library_subtitle_bp)
    app.register_blueprint(library_cover_bp)
    app.register_blueprint(library_file_bp)
    app.register_blueprint(candidate_bp)
    app.register_blueprint(vocabulary_report_bp)
    app.register_blueprint(media_bp)
    app.register_blueprint(misc_bp)
    app.register_blueprint(static_bp)

    @app.after_request
    def normalize_json_response(response):
        if not response.is_json:
            return response

        payload = response.get_json(silent=True)
        if not isinstance(payload, dict):
            return response

        payload = normalize_payload(payload)

        response.set_data(json.dumps(payload, ensure_ascii=False))
        response.headers["Content-Type"] = "application/json"
        return response

    return app
