# Lyric Book: handoff brief for Claude Code

## What it is
A minimal, Notes-style lyric writing app (inspired by Rhymer's Block). Owner is a music producer and rapper with no coding experience, so explain changes simply and keep replies compact.

Current build: a web app (`index.html`, ~2.6 MB, mostly embedded rhyme data) installable as a PWA on iPhone, Android, Mac and PC, and usable offline. A native SwiftUI (iPhone/Mac) version is the long-term plan; the web version may stay for PC.

## Hosting
GitHub repo `slideintomypictochat/Lyric-Book` is the single home of the project: all work is committed and pushed to `main`, which GitHub Pages serves at https://slideintomypictochat.github.io/Lyric-Book/ (the owner tests there on iPhone and PC). `README.md` is the owner-facing guide (install steps per platform).

## Files
- `index.html`: the whole app (HTML, CSS and JS inline). Two `<script>` blocks: the first is data (`RHYME_DATA`, `RANKED`), the second is app logic.
- `build_rhyme_data.py`: regenerates the data block from the CMU Pronouncing Dictionary, an English word-frequency list and a spell-check list (to filter names). Source URLs and format are in the file header. Keeps stress digits and alternate pronunciations; `OVERRIDES` fixes words CMU gets wrong (e.g. dopamine).
- `dictionary.js`: definitions, synonyms, opposites and related words for ~29k common words (WordNet), ~4 MB. Loaded on demand the first time Synonyms/Define is opened, so it must sit next to `index.html`.
- `build_dictionary.py`: regenerates `dictionary.js` from WordNet (via nltk). Changed forms (ran, dreams) point to their dictionary form; slurs are blocked.
- `splice_rhyme_data.py`: puts the generated `rhyme.js` into the first `<script>` of `index.html`.
- `manifest.webmanifest`, `sw.js`, `icons/`: make it an installable app. `sw.js` is network-first (updates show straight away) with a cache fallback for offline use; bump `CACHE` in `sw.js` if cached files ever need a hard reset. The worker registers only on https or localhost.
- `config.js`: Supabase project URL + anon key (public by design). Empty = no accounts, app works as before.
- `sync.js`: accounts + sync (account drawer, sign in/up, forgot password, admin panel, background sync). Uses globals from the app script (`projects`, `current`, `storeKey`, `load`, `persist`, `sorted`, `renderList`, `renderMain`, `esc`).
- `vendor/supabase.js`: supabase-js 2.45.4 UMD, vendored so it works offline.
- `supabase/setup.sql`: tables, row-level security and functions (run in the Supabase SQL editor; safe to re-run). `supabase/SETUP.md`: owner's setup steps.
- Source data for the build scripts (cmu.dict, freq.txt, en_US.dic, WordNet) is downloaded, not committed; URLs are in each script's header.

## Features working now
- **Accounts + sync** (Supabase): username + email + password; sign in with either. Songs save locally first (`dirty` flag), then sync: pull rows with `modified_at` newer than the last pull, newest `updated` wins per song, push dirty songs. Deletes are tombstones (`deleted:true`, hidden by `sorted()`). Syncs ~1.5s after an edit, on focus/online, and every 20s. Signed in, songs live under `lyricbook.projects.v1.<userId>`; songs written signed out move into the first account that signs in on that device. Forgot password = Supabase reset email (redirects back; `PASSWORD_RECOVERY` shows a new-password form). **Admin** (first account, `profiles.is_admin`): list accounts and set anyone's password (`admin_set_password`, no email); signed out, an **admin recovery code** (bcrypt-hashed in `admin_recovery`) sets a new password (`admin_recover`). Username lookup (`email_for_username`) is callable signed out, which reveals the email for a username; acceptable for a private app.
- **Projects:** saved per device in `localStorage`, synced when signed in. Notes-style list on the left (single-screen list/editor toggle on mobile, under 720px). Autosaves to `localStorage` key `lyricbook.projects.v1` as `{id,title,body,updated,study}`.
- **Delete:** two-tap confirm. `confirm()` is blocked in the sandbox, so don't use it.
- **Word and line count** in the footer. **Syllables per line** in the right margin.
- **Rhyme highlighting:** a transparent `<textarea>` sits over a `.hl` mirror div that holds `<mark>` tags. They must keep an identical width, font and wrapping, or the highlights drift; this broke once already. Rules:
  - Words match on their main-stress vowel key (`k`) **or** their end sound (`ek`, from the last stressed syllable including secondary stress, so dopa-MINE ~ seen, para-DISE ~ price). Vowels are normalised: unstressed UH and IH = AH (stressed UH, as in took, stays separate from love).
  - A word highlights if a partner is anywhere in the same paragraph (`WINDOW` = Infinity, owner's request: show how rhymes string through a verse).
  - A blank line or a `[Header]` line starts a new paragraph.
  - Multi-word rhymes are detected, e.g. "diamonds" ~ "behind us".
  - Internal rhymes count: any real word highlights wherever it sits (bitch ~ nitch mid-line). Filler words (`FILLER_HL`: pronouns, auxiliaries, slang like im/wanna/aint) only highlight if among the last 2 words of a line (`NEAR_END`). Multi-word groups can't contain stop-words, and groups with filler ("behind us") must end the line.
  - Stop-words are skipped. Slang `-in'` maps to `-ing`. **Made-up words** (slang, ad-libs) get a guessed pronunciation (`guessEntries`): the most common dictionary word sharing the longest spelling ending lends its ending sound (scoopy → snoopy, nitch → snitch, rari → ferrari). Guessed words work everywhere (highlighting, syllables, suggestions); the panel says which word it was rhymed like. Words with no vowel letters (skrrt) can't be guessed.
  - A Rhymes button toggles highlighting on and off.
- **Rhyme suggestions panel:** shows rhymes for the word at the cursor, or for the last word of the previous line when the current line is empty (but not across a paragraph break). Groups: **Multis** (match extra syllables before the rhyme, e.g. dopamine → gasoline), **Perfect** (same end sound and consonants), **Phrases** (two-word rhymes following the word's stress, e.g. "broken seen", "behind us"), **Near** (same vowels, ranked by how close the ending consonants sound). Names and obscure words are never suggested.
- **Synonyms / Define tabs** in the same panel, for the same word. Synonyms are grouped by part of speech with syllable counts, plus Related and Opposites. Tapping a synonym **replaces** the word at the cursor, matching its form (running → escaping, stopped → gave up, dreams → pipe dreams; irregular verbs table `IRREGULAR`) and capital letter. Changed forms combine their own meanings with the verb meanings of their dictionary form (running = running + run). The active tab is remembered. Tapping a word inserts it. Hide/Show is remembered.
- **Section headers:** lines like `[Verse 1]` are shaded, excluded from counts, and act as paragraph breaks.
- **Study notes** (Study button): the title takes "Artist – Song" and shows Genius/AZLyrics search links. Pasting into a Study note auto-cleans lyric-site junk (contributor counts, "Embed", "You might also like", ads) and adds gaps before headers.
- **Analyse drawer:** per-section stats (bars, average and range of syllables per bar, rhyme density %, multi-rhyme count, end-rhyme scheme). A "Break down the writing" button calls Claude through the artifact `sample` capability (`claude.use('sample')`) for a coaching breakdown. Selecting bars first focuses it on how those bars connect. The prompt forbids quoting full lines.

## Decisions and constraints
- **No automatic lyric fetching** from Genius, AZLyrics, Absolute Lyrics and similar. It's copyrighted content and against their terms; the only legit route is a licensed API like Musixmatch (paid for full lyrics). Workflow is open the site, then paste. In the native app, the plan is a lyrics site shown in a side panel.
- Rhyme scheme letters in the left margin were **removed at the owner's request**. The code still computes `scheme` for the Analyse drawer.
- Rhyme data is bundled for offline use, because the web sandbox blocks outside requests such as the Datamuse API. A native app could use Datamuse.

## Open issues and next ideas
1. **Highlighting alignment:** verified pixel-perfect in Chromium with long wrapping lines. Still to check on iPhone Safari, whose textareas have a ~3px built-in side inset that could shift highlights; if so, add a WebKit-only offset to `.hl`.
2. ~~Highlighting too busy~~: done (see `NEAR_END` rule above).
3. ~~Thesaurus and dictionary~~: done (WordNet). Idea: flag synonyms that rhyme with the previous line's end word.
4. BPM/bar mode (syllables that fit per bar), a repeated-word warning, and copy/export.
5. Port to SwiftUI for iPhone/Mac, with a Genius side panel and Datamuse online.
