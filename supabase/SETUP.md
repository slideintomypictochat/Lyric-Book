# Switching on accounts and sync

Lyric Book uses a free [Supabase](https://supabase.com) project to keep accounts and songs. One-time setup, about 10 minutes.

1. **Make a Supabase account** at supabase.com (Sign in with GitHub is easiest), then **New project**.
   Name it `lyric-book`, pick the region closest to you, and choose a database password (save it somewhere; the app doesn't need it).
2. **Create the tables:** in the project, open **SQL Editor** → **New query**. Paste everything from
   [`setup.sql`](setup.sql) and press **Run**. It should say "Success. No rows returned".
3. **Tell it where the app lives:** **Authentication** → **URL Configuration**.
   - Site URL: `https://slideintomypictochat.github.io/Lyric-Book/`
   - Redirect URLs → Add URL: `https://slideintomypictochat.github.io/Lyric-Book/`
4. **Let new accounts sign in straight away:** **Authentication** → **Sign In / Providers** → **Email**,
   turn **Confirm email** off, and save.
5. **Copy two values** from **Project Settings** → **API Keys** (or **Data API**): the **Project URL** and the
   **anon public** key (newer projects call it the **publishable** key). Put them in `config.js`.
   Both are meant to be public, so they're safe to share and to commit.
6. Open the app, tap the account icon, and **create your account first**. The first account becomes the **admin**.
   Then, in the account panel, tap **Make a new recovery code** and save it.

## Good to know
- **Forgot password emails:** Supabase's free built-in email only sends to the addresses of people on the Supabase
  project (you), and only a few per hour. That covers your own account. For other people, the admin sets their
  password in the account panel. To email anyone, add your own email service under **Authentication** → **Emails** → **SMTP**.
- **Admin, signed out and forgot the password?** On the sign-in screen, use **Admin recovery code**.
- Free Supabase projects pause after a week with no use. Open the Supabase dashboard and press **Restore** if sync
  stops working after a long break.
