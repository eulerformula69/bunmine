import json

from flask import Flask
from flask_cors import CORS

from backend.routes.library_routes import library_bp
from backend.routes.vocabulary_report_routes import vocabulary_report_bp
from backend.routes.media_routes import media_bp
from backend.routes.misc_routes import misc_bp
from backend.routes.static_routes import static_bp
from backend.services.startup_service import initialize_backend
from backend.settings import Settings, load_settings


def create_app(settings: Settings | None = None) -> Flask:
    settings = settings or load_settings()
    initialize_backend(settings)
    app = Flask(__name__, static_folder=str(settings.frontend_dir))
    app.config["SETTINGS"] = settings

    if settings.allowed_origin:
        CORS(app, resources={r"/*": {"origins": [settings.allowed_origin]}})
    else:
        CORS(app)

    app.register_blueprint(library_bp)
    app.register_blueprint(vocabulary_report_bp)
    app.register_blueprint(media_bp)
    app.register_blueprint(misc_bp)
    app.register_blueprint(static_bp)

    @app.after_request
    def normalize_json_response(response):
        if not response.is_json:
            return response

        payload = response.get_json(silent=True)
        if not isinstance(payload, dict) or "ok" in payload:
            return response

        if "error" in payload:
            message = str(payload.get("error") or "Request failed")
            payload = {
                "ok": False,
                **payload,
                "error": message,
                "errorInfo": {
                    "code": "ERROR",
                    "message": message,
                },
            }
        else:
            payload = {"ok": True, **payload}

        response.set_data(json.dumps(payload, ensure_ascii=False))
        response.headers["Content-Type"] = "application/json"
        return response
    return app


app = create_app()

