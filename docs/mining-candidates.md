# Deferred mining

1. Select a word in the subtitles. Click Save candidate or press Alt+Q.
2. Open Candidates in the right panel. Select an item to seek to its saved frame and read its saved context.
3. Click Add through Yomitan. Bunmine reads the initial Anki note IDs, then copies the word.
4. Create one note through Yomitan. Bunmine attaches the saved context, audio, and image.
5. Click Skip to reject the candidate and open the next pending item.

Capture does not need Anki. Hover and selection alone do not save a candidate.
Review needs AnkiConnect and Yomitan. Use clipboard search in Yomitan, or paste the copied word into its search page.

## Storage

Schema version 3 adds `mining_candidates` separately from `cards`.
The snapshot stores the word, text, subtitle index, audio interval, frame time, video source, and media settings.
Candidate states are `pending`, `accepted`, and `rejected`. An accepted candidate retains its `anki_note_id`.
Uploaded videos and subtitles now survive server restarts. The existing delete action remains available.
Library sources retain `videoFileId` and `episode_id`. Uploaded sources retain their server filename.
File size and modification time detect source replacement. This metadata check does not compare file contents.
Missing or replaced sources block review and leave the candidate pending.

## Review and recovery

Only one candidate can acquire a note at a time, including across browser tabs.
The server lock renews during review. After a tab closes, it expires within two minutes.
Bunmine waits up to 60 seconds for a new note. Multiple new notes or a word mismatch stop the review.
Do not create unrelated Anki notes during this interval.
Bunmine saves the note ID before media export. After an export error, a retry uses that same note.
If the app closes before it saves the note ID, the new note can remain unlinked. Check Anki before creating another note.
Skipping a candidate does not delete its Anki note.

Manual Update Card retains its existing behavior.
Enable automatic media attachment in Settings to wait for a new Anki note after subtitle selection.
This mode captures the current context without adding a candidate. The new note receives that saved image, audio, and text.
Click Cancel to stop the wait. Saving a candidate also cancels the automatic wait.
Direct attachment and candidate review share an exclusive lock in browsers with Web Locks support, including Chrome.
The sidebar title, tabs, actions, and messages follow the selected interface language: English, Russian, or Japanese.

## Checks

`npm run check` covers frontend and backend tests, including migration, restart, state transitions, exclusive review, and panel actions.
Anki tests use simulated responses. A user creates the actual note through Yomitan.
