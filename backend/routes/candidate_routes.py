import sqlite3

from flask import Blueprint, current_app, jsonify, request

from backend.repositories import candidate_repository as repository
from backend.services.candidate_service import capture_candidate, check_source

candidate_bp = Blueprint('candidates', __name__)


def json_object():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError('A JSON object is required')
    return data


@candidate_bp.errorhandler(ValueError)
@candidate_bp.errorhandler(sqlite3.IntegrityError)
def candidate_error(error):
    return jsonify(error=str(error)), 409


@candidate_bp.route('/mining-candidates', methods=['GET', 'POST'])
def candidates():
    settings = current_app.config['SETTINGS']
    if request.method == 'GET':
        return jsonify(candidates=repository.list_candidates(settings.library_db_path))
    data = json_object()
    return jsonify(candidate=capture_candidate(settings, data.get('snapshot'))), 201


@candidate_bp.route('/mining-candidates/<int:candidate_id>/source')
def candidate_source(candidate_id):
    return jsonify(candidate=check_source(current_app.config['SETTINGS'], candidate_id))


@candidate_bp.route('/mining-candidates/<int:candidate_id>/<action>', methods=['POST'])
def candidate_action(candidate_id, action):
    settings = current_app.config['SETTINGS']
    data = json_object()
    if action == 'claim':
        check_source(settings, candidate_id)
    result = repository.change_candidate(
        settings.library_db_path, candidate_id, action, data.get('token'), data.get('noteId'),
    )
    return jsonify(result)
