import math


def finite_number(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def validate_context(context, snapshot):
    if not isinstance(context, dict) or not isinstance(context.get('cues'), list):
        raise ValueError('Invalid candidate context')
    cues = context['cues']
    if not cues or len(cues) > 50000:
        raise ValueError('Invalid subtitle count')
    for cue in cues:
        if not isinstance(cue, dict) or not isinstance(cue.get('text'), str):
            raise ValueError('Invalid subtitle text')
        if any(not finite_number(cue.get(key)) or cue[key] < 0 for key in ('start', 'end')) or cue['end'] < cue['start']:
            raise ValueError('Invalid subtitle time')
    for key in ('start', 'end', 'anchor'):
        value = context.get(key)
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value < len(cues):
            raise ValueError('Invalid context boundary')
    if not context['start'] <= context['anchor'] <= context['end'] or context['anchor'] != snapshot['currentIdx']:
        raise ValueError('The range must contain the selected word subtitle')
    if any(not finite_number(context.get(key)) for key in ('startOffset', 'endOffset')):
        raise ValueError('Invalid context offset')
    original = apply_context(snapshot, context, context['start'], context['end'])
    if original['combinedText'] != snapshot['combinedText'] or any(
        not math.isclose(original[key], snapshot[key], abs_tol=0.001) for key in ('audioStart', 'audioEnd')
    ):
        raise ValueError('The subtitles do not match the saved candidate')


def apply_context(snapshot, context, start, end):
    cues = context['cues']
    if any(isinstance(value, bool) or not isinstance(value, int) for value in (start, end)):
        raise ValueError('Invalid context range')
    if not 0 <= start <= context['anchor'] <= end < len(cues):
        raise ValueError('The range must contain the selected word subtitle')
    text = ' '.join(cue['text'] for cue in cues[start:end + 1])
    audio_start = max(0, cues[start]['start'] + context['startOffset'])
    audio_end = cues[end]['end'] + context['endOffset']
    if audio_end <= audio_start:
        audio_end = audio_start + 0.5
    return {**snapshot, 'context': {**context, 'start': start, 'end': end},
            'combinedText': text, 'audioStart': audio_start, 'audioEnd': audio_end,
            'imageSubtitleText': text if snapshot['imageSubtitleText'] else '',
            'imageSubtitleCues': [
                {'start': cue['start'] + snapshot.get('imageSubtitleDelay', 0),
                 'end': cue['end'] + snapshot.get('imageSubtitleDelay', 0), 'text': cue['text']}
                for cue in cues[start:end + 1]
            ] if snapshot['imageSubtitleText'] else []}


def update_candidate_context(db_path, candidate_id, data):
    from backend.repositories.candidate_repository import update_context

    def transform(snapshot):
        context = snapshot.get('context') or data.get('context')
        validate_context(context, snapshot)
        return apply_context(snapshot, context, data.get('start'), data.get('end'))

    return update_context(db_path, candidate_id, data.get('revision'), transform)
