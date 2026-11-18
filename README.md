# Lyric Book

A simple lyric-writing app with rhyme highlighting, rhyme suggestions, synonyms and a dictionary.

**Open it:** https://slideintomypictochat.github.io/Lyric-Book/

## Install it like an app

It works in any modern browser, and can be installed so it opens in its own window and works offline.

| Device | How to install |
| --- | --- |
| iPhone / iPad | Open the link in **Safari**, tap **Share**, then **Add to Home Screen** |
| Android | Open the link in **Chrome**, tap the **⋮** menu, then **Install app** |
| Mac | **Safari:** File → **Add to Dock**. **Chrome:** the install icon at the right of the address bar |
| Windows / PC | Open the link in **Edge** or **Chrome**, then the install icon at the right of the address bar (or menu → Apps → Install) |

Once opened, it keeps working without internet. When you're online it picks up the newest version automatically.

## Good to know

- **Sign in to sync.** Tap the account icon (next to ✎) and sign in on each device. Your songs then stay the same everywhere,
  and still work offline (changes sync when you're back online). Signed out, songs are saved on that device only.
  Accounts need a one-time Supabase setup: see [`supabase/SETUP.md`](supabase/SETUP.md).
- The **Break down the writing** button in Analyse only works inside Claude, not on the website.

## Features

- **Rhyme highlighting:** rhymes in the same paragraph share a colour, including internal and multi-word rhymes ("diamonds" / "behind us").
- **Rhymes panel:** Multis, Perfect, Phrases and Near rhymes for the word at your cursor. Made-up words and slang are rhymed by how they're spelled.
- **Synonyms and Define:** tap a synonym to swap it in. It keeps the same tense and plural.
- **Syllables per line**, word and line counts, section headers like `[Verse 1]`, **Study** notes for breaking down other songs, and an **Analyse** drawer with stats per section.

## For developers

Everything is plain HTML, CSS and JavaScript with no build step. `CLAUDE.md` has the technical notes.

- `index.html` is the app. `dictionary.js` is loaded the first time Synonyms or Define is opened.
- `sync.js`, `config.js`, `vendor/supabase.js` and `supabase/` handle accounts and sync.
- `sw.js` and `manifest.webmanifest` make it installable and usable offline. Icons are in `icons/`.
- `build_rhyme_data.py` + `splice_rhyme_data.py` rebuild the rhyme data. `build_dictionary.py` rebuilds the dictionary.

Changes pushed to `main` go live on GitHub Pages within a minute or two.
