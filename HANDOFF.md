# Lyric Book: handoff brief for Claude Code

## What it is
A minimal, Notes-style lyric writing app (inspired by Rhymer's Block). Owner is a music producer and rapper with no coding experience, so explain changes simply and keep replies compact.

Current build: one self-contained web page, `lyric-book.html` (~2.3 MB, mostly embedded rhyme data). Target platforms: iPhone first, then Mac and PC. A native SwiftUI (iPhone/Mac) version is the long-term plan; the web version may stay for PC.

## Files
- `lyric-book.html`: the whole app (HTML, CSS and JS inline). Two `<script>` blocks: the first is data (`RHYME_DATA`, `RANKED`), the second is app logic.
- `build_rhyme_data.py`: regenerates the data block from the CMU Pronouncing Dictionary plus an English word-frequency list (source URLs and format are in the file header). Splice its `rhyme.js` output into the first `<script>`.

## Features working now
- **Projects:** notes-style list on the left (single-screen list/editor toggle on mobile, under 720px). Autosaves to `localStorage` key `lyricbook.projects.v1` as `{id,title,body,updated,study}`.
- **Delete:** two-tap confirm. `confirm()` is blocked in the sandbox, so don't use it.
- **Word and line count** in the footer. **Syllables per line** in the right margin.
- **Rhyme highlighting:** a transparent `<textarea>` sits over a `.hl` mirror div that holds `<mark>` tags. They must keep an identical width, font and wrapping, or the highlights drift; this broke once already. Rules:
  - Words match on their vowel key (vowels from the last stressed syllable onward).
  - A word only highlights if a partner is within 4 lines (`WINDOW`) **and** in the same paragraph.
  - A blank line or a `[Header]` line starts a new paragraph.
  - Multi-word rhymes are detected, e.g. "diamonds" ~ "behind us". AH/UH count as equal.
  - Stop-words are skipped. Slang `-in'` maps to `-ing`, and unknown words fall back to a spelling guess.
  - A Rhymes button toggles highlighting on and off.
- **Rhyme suggestions panel:** shows rhymes for the word at the cursor, or for the last word of the previous line when the current line is empty (but not across a paragraph break). Two groups, Perfect (same tail) and Near (same vowel key), most common words first. Tapping a word inserts it. Hide/Show is remembered.
- **Section headers:** lines like `[Verse 1]` are shaded, excluded from counts, and act as paragraph breaks.
- **Study notes** (Study button): the title takes "Artist – Song" and shows Genius/AZLyrics search links. Pasting into a Study note auto-cleans lyric-site junk (contributor counts, "Embed", "You might also like", ads) and adds gaps before headers.
- **Analyse drawer:** per-section stats (bars, average and range of syllables per bar, rhyme density %, multi-rhyme count, end-rhyme scheme). A "Break down the writing" button calls Claude through the artifact `sample` capability (`claude.use('sample')`) for a coaching breakdown. Selecting bars first focuses it on how those bars connect. The prompt forbids quoting full lines.

## Decisions and constraints
- **No automatic lyric fetching** from Genius, AZLyrics, Absolute Lyrics and similar. It's copyrighted content and against their terms; the only legit route is a licensed API like Musixmatch (paid for full lyrics). Workflow is open the site, then paste. In the native app, the plan is a lyrics site shown in a side panel.
- Rhyme scheme letters in the left margin were **removed at the owner's request**. The code still computes `scheme` for the Analyse drawer.
- Rhyme data is bundled for offline use, because the web sandbox blocks outside requests such as the Datamuse API. A native app could use Datamuse.

## Open issues and next ideas
1. **Check the highlighting alignment.** The owner's last screenshot showed highlights drifting off their words and blocks floating in empty space. The width fix (`.ed` padding-right 34px, `.hl` right:34px) should solve it. Verify with long wrapping lines; if it still drifts, consider rendering text and highlights in a single contenteditable layer.
2. **Highlighting may be too busy:** too many small and common words light up. Options are a stricter stop-word list, a minimum of 2 syllables or a stressed-vowel match, or weighting toward line ends.
3. Thesaurus and dictionary (an offline WordNet subset, or Apple's dictionary in the native app).
4. BPM/bar mode (syllables that fit per bar), a repeated-word warning, and copy/export.
5. Port to SwiftUI for iPhone/Mac, with a Genius side panel and Datamuse online.
