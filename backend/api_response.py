from flask import jsonify


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


def legacy_error_response(message: str, status: int = 400, code: str = "ERROR", **extra):
    error = {"code": code, "message": message}
    if extra:
        error.update(extra)
    return jsonify({"ok": False, "error": message, "errorInfo": error}), status
