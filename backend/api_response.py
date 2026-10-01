import logging
import urllib.error
import uuid

from flask import g, jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


def exception_response(error: Exception, status: int | None = None, code: str = "ERROR"):
    request_id = getattr(g, "error_request_id", None) or uuid.uuid4().hex
    g.error_request_id = request_id
    logger.error("Request %s failed", request_id, exc_info=(type(error), error, error.__traceback__))
    if status is None:
        status = 400 if isinstance(error, ValueError) else 502 if isinstance(error, urllib.error.HTTPError) else 500
    message = (
        "Invalid request" if status < 500 else "External service request failed" if status == 502 else "Request failed"
    )
    response, status = error_response(message, status, code, requestId=request_id)
    response.headers["X-Request-ID"] = request_id
    return response, status


def register_error_handlers(app):
    @app.errorhandler(Exception)
    def handle_error(error):
        if isinstance(error, HTTPException):
            return error
        return exception_response(error)


def ok_response(payload: dict | None = None, status: int = 200):
    body = {"ok": True}
    if payload:
        body.update(payload)
    return jsonify(body), status


def error_response(message: str, status: int = 400, code: str = "ERROR", **extra):
    error = {"code": code, "message": message}
    if extra:
        error.update(extra)
    return jsonify({"ok": False, "error": error}), status


def normalize_payload(payload: dict) -> dict:
    if payload.get("error") is not None:
        error = payload["error"]
        if not isinstance(error, dict):
            error = {"code": "ERROR", "message": str(error or "Request failed")}
        return {**payload, "ok": False, "error": error}
    return {"ok": True, **payload}
