from backend.app import create_app
from backend.services.frontend_build_service import build_frontend_on_startup

if __name__ == "__main__":
    app = create_app()
    settings = app.config["SETTINGS"]
    build_frontend_on_startup(settings.project_dir, settings.subprocess_timeout_seconds)
    app.run(host="127.0.0.1", port=app.config["SETTINGS"].port)

