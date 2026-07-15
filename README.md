# Bunmine

A local video player and media library for Japanese sentence mining. Bunmine can
search Japanese subtitles, highlight known words and attach sentence audio and
screenshots to Anki cards.

## Requirements

- Python with the packages from `requirements.txt`
- Node.js and npm
- FFmpeg available on `PATH`
- Anki with AnkiConnect for card integration

## Development

```powershell
npm install
py -m pip install -r requirements.txt
npm run build
py server.py
```

Run all static checks and tests with:

```powershell
npm run check
```

The Flask routes live in `backend/routes`, application logic in
`backend/services`, and browser source files in `frontend/js`. Generated browser
files are written to `dist`.




