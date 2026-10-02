# Deferred mining

1. Select a word in the subtitles. Click Save candidate or press Alt+Q.
2. Open Candidates in the right panel. Select an item to seek to its saved frame and read its saved context.
3. Select the word in the saved context with Yomitan. Bunmine reads the initial Anki note IDs.
4. Create one note through Yomitan. Bunmine attaches the saved context, audio, and image when automatic attachment is enabled.
5. If automatic attachment is disabled or missed the note, click Add manually to attach the candidate to the latest Anki card.
6. Click Skip to reject the candidate and open the next pending item.

Capture does not need Anki. Hover and selection alone do not save a candidate.
Automatic attachment only listens for new Anki notes while the Candidates panel is open.
Review needs AnkiConnect and Yomitan.

## Storage

Schema version 4 retains `mining_candidates` separately from `cards` and adds a revision counter for concurrent edits.
The snapshot stores the word, text, subtitle index, audio interval, frame time, video source, and media settings.
Candidate states are `pending`, `accepted`, and `rejected`. An accepted candidate retains its `anki_note_id`.
Uploaded videos and subtitles now survive server restarts. The existing delete action remains available.
Library sources retain `videoFileId` and `episode_id`. Uploaded sources retain their server filename.
File size and modification time detect source replacement. This metadata check does not compare file contents.
Missing or replaced sources block review and leave the candidate pending.

## Context boundaries

The candidate list uses a compact scroll area above the context editor.
Select a candidate to see its saved subtitle range and nearby lines.
Drag either purple handle to extend or shorten the range. The range always includes the subtitle with the selected word.
You can also focus a handle and use the up and down arrow keys.
The editor previews the text and audio interval during a drag. Release the handle to save both changes.
Press Escape or cancel the pointer gesture to discard the drag.
The screenshot time stays fixed. Image subtitle text follows the new range when image subtitles are enabled.
New candidates retain a copy of the subtitle cues. Later subtitle changes do not replace that copy.
For older candidates, the editor matches the saved text against the source subtitles before it enables the handles.
If no match exists, the saved context remains available without editing.
Edits survive a restart. A failed save restores the previous range and shows an error.
Concurrent edits cannot overwrite each other. Select the candidate again to load its latest revision after a conflict.

## Review and recovery

Only one candidate can acquire a note at a time, including across browser tabs.
The server lock renews during review. After a tab closes, it expires within two minutes.
Bunmine waits up to 60 seconds for a new note. Multiple new notes or a word mismatch stop the review.
Do not create unrelated Anki notes during this interval.
Bunmine saves the note ID before media export. After an export error, a retry uses that same note.
If the app closes before it saves the note ID, the new note can remain unlinked. Check Anki before creating another note.
Skipping a candidate does not delete its Anki note.

Manual Update Card retains its existing behavior.
Enable automatic media attachment in the Candidates settings.
Selecting a word outside candidate review never starts the Anki listener.
Candidate review uses an exclusive lock in browsers with Web Locks support, including Chrome.
The sidebar title, tabs, actions, and messages follow the selected interface language: English, Russian, or Japanese.

## Checks

`npm run check` covers frontend and backend tests, including migration, restart, state transitions, exclusive review, and panel actions.
Anki tests use simulated responses. A user creates the actual note through Yomitan.
