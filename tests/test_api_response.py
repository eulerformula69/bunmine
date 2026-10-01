import urllib.error

import pytest
from flask import Flask

from backend.api_response import register_error_handlers


@pytest.mark.parametrize("error,status", [
    (RuntimeError("secret /internal/path"), 500),
    (ValueError("secret /internal/path"), 400),
    (urllib.error.HTTPError("https://secret", 503, "secret", {}, None), 502),
])
def test_error_response_hides_details_and_logs_request_id(error, status, caplog):
    app = Flask(__name__)
    register_error_handlers(app)
    @app.get("/failure")
    def failure():
        raise error
    response = app.test_client().get("/failure")
    assert response.status_code == status
    assert "secret" not in response.get_data(as_text=True)
    request_id = response.json["error"]["requestId"]
    assert response.headers["X-Request-ID"] == request_id
    assert request_id in caplog.text
    assert "secret" in caplog.text


@pytest.mark.parametrize('payload', [
    {'error': 'Missing'},
    {'ok': False, 'error': 'Missing'},
    {'ok': False, 'error': {'code': 'ERROR', 'message': 'Missing'}},
])
def test_error_payloads_have_one_contract(payload):
    from backend.api_response import normalize_payload
    expected = {'ok': False, 'error': {'code': 'ERROR', 'message': 'Missing'}}
    assert normalize_payload(payload) == expected
    assert normalize_payload(expected) == expected
