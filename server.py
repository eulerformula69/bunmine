from backend.app import app
from backend.services.frontend_build_service import build_frontend_on_startup

if __name__ == "__main__":
    build_frontend_on_startup(app.config["SETTINGS"].project_dir)
    app.run(host="127.0.0.1", port=app.config["SETTINGS"].port)

