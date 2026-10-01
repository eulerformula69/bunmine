# Bunmine

A local video player and media library for Japanese sentence mining. Bunmine finds Japanese subtitles, highlights known words, and attaches audio and screenshots to Anki cards.

## Requirements

- Python 3.13
- Node.js 22.13 or later in the 22 series, or Node.js 24
- FFmpeg and FFprobe on `PATH`
- Anki with AnkiConnect for card updates

## Setup

1. Install the dependencies:

   ```powershell
   npm ci
   py -m pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` in the project directory.
3. Set the two required paths in `.env`:

   ```dotenv
   ANKI_MEDIA_DIR=C:\Users\User\AppData\Roaming\Anki2\UserName\collection.media
   MEDIA_LIBRARY_DIR=D:\Anime
   ```

   Use the media directory for your Anki profile. Use your video library directory for the second path. Startup fails if either variable is absent. The application can write subtitles beside your videos and media into your Anki profile.

4. Start the server:

   ```powershell
   py server.py
   ```

   On Windows, `bunmine.bat` runs the same command from its own directory. Keep the server window open.

5. Open `http://127.0.0.1:5000/library-page` in your browser. Use the port from `.env` if you changed it.

On Linux or macOS, use `python3` instead of `py`. The npm test commands select Python for the current platform.

## Optional settings

The application reads `.env` from the project directory. Existing environment variables take precedence. Do not commit `.env` or API tokens.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Local server port |
| `ALLOWED_ORIGIN` | Unset | Browser origin allowed by the server |
| `PLAYER_SERVER_BASE_DIR` | Project directory | Directory that contains `frontend` |
| `PLAYER_SERVER_DATA_DIR` | `<base>/data` | Database, uploads, covers, and word caches |
| `JIMAKU_API_TOKEN` | Empty | Required for Jimaku subtitle search and download |
| `SUBPROCESS_TIMEOUT_SECONDS` | `600` | Maximum duration for FFmpeg and npm commands |
| `COVER_MAX_BYTES` | `10485760` | Maximum downloaded cover size |
| `COVER_ALLOWED_HOSTS` | AniList and Kitsu hosts | Comma-separated cover host allowlist |
| `BUNMINE_SKIP_FRONTEND_BUILD` | Unset | Set to `1` only when browser assets are already built |

Leave `PLAYER_SERVER_BASE_DIR` unset for a normal checkout. Change the data directory alone if you want to store application data elsewhere. Set automatic Anki refresh in the player settings. Manual refresh does not delay the automatic schedule.

## Development

```powershell
npm run build
npm run check
```

The build removes stale files from `dist`, compiles modules into `dist/esm`, and creates `dist/js/player.js` and `dist/js/library.js`. Kuromoji and media-captions remain separate vendor assets. Startup reuses a build when its inputs and outputs match.

`npm run check` runs Ruff, TypeScript, frontend tests, and Python tests. Frontend tests import modules directly and use the page HTML through jsdom. They do not test browser layout or real Anki connections.

The TypeScript configuration uses strict mode. The standard type check covers the strict rules.

## Documentation

- [Backend architecture](docs/backend-architecture.md)
- [Deferred mining workflow](docs/mining-candidates.md)

Generated assets, local data, `.env`, and the root `repomix-output.xml` stay outside Git.

Fonts remain in the repository so offline rendering stays unchanged. A download script needs verified sources, version checks, and a license review before it can replace these files.
