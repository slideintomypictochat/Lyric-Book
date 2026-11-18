// Supabase project used for accounts and sync. Leave both empty to run without accounts.
// These two values are meant to be public: each account can still only reach its own songs.
window.LYRIC_SYNC = {
  url: '',  // e.g. https://abcdefgh.supabase.co
  key: ''   // the project's "anon public" (or "publishable") key
};
