# CineSubz Premium

Premium redesigned CineSubz — login-protected movie search with MongoDB caching,
so the site keeps working with cached data even if the movie API key stops working.

## Project structure

```
cinesubz/
├── index.html          → Main app (search + movie details) — protected, requires login
├── login.html           → Premium animated login / sign-up page
├── api/
│   ├── config.js         → Public: tells the frontend if email login is on/off
│   ├── search.js         → Protected: search proxy + MongoDB caching + fallback
│   ├── movie.js           → Protected: movie detail proxy + MongoDB caching + fallback
│   └── auth/
│       ├── register.js
│       ├── login.js
│       ├── logout.js
│       └── me.js
├── lib/
│   ├── db.js              → MongoDB connection helper
│   └── auth.js            → Password hashing, JWT, cookies, feature flags
├── package.json
├── vercel.json
└── .env.example
```

Why it isn't a single `.html` file: the API key has to stay on a server (never
in browser code), and login + MongoDB both require server-side logic. Vercel's
free `api/` serverless functions give you that server without needing to run
or pay for a separate backend — the two HTML pages stay as light, single
files, and all the "backend" is just these small function files.

## 1. MongoDB Atlas (free)

1. Create a free cluster at https://www.mongodb.com/atlas
2. Add a database user (username + password) under **Database Access**
3. Under **Network Access**, add `0.0.0.0/0` (allow from anywhere) so Vercel can connect
4. Click **Connect → Drivers**, copy the connection string — it looks like:
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/`

## 2. Deploy to Vercel

**Option A — Vercel CLI**
```bash
npm i -g vercel
cd cinesubz
vercel
```

**Option B — GitHub**
1. Push this folder to a GitHub repo
2. Go to https://vercel.com/new and import the repo
3. Framework preset: **Other** (no build step needed)

## 3. Environment variables (Vercel Dashboard)

Vercel එකේ env dashboard එකට යන විදිය:

1. Vercel dashboard → ඔයාගේ project → **Settings** tab → **Environment Variables**
2. පහත variables එකින් එක **Key** සහ **Value** විදියට add කරන්න (Environment: `Production`, `Preview`, `Development` — hamma tikama check කරන්න):

| Key | Value | Note |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://...` | Atlas connection string එක |
| `MONGODB_DB` | `cinesubz` | Database name (optional, default `cinesubz`) |
| `JWT_SECRET` | long random string | login sessions sign කරන්න. `openssl rand -hex 32` වගේ command එකකින් generate කරගන්න |
| `EMAIL_LOGIN_ENABLED` | `true` හෝ `false` | Email/password login on/off කරන්න |
| `MOVIE_API_KEY` | ඔයාගේ API key එක | Browser එකට කවදාවත් යන්නේ නෑ — server එකේ විතරයි use වෙන්නේ |
| `MOVIE_API_BASES` | (optional) | Comma-separated upstream API URLs, default value already set |

3. **Save** කරලා, project එක **Redeploy** කරන්න (env variable එකක් change කරාම, redeploy කරන්න ඕනේ අලුත් value එක effect වෙන්න)

### Email login on/off කරන්නේ කොහොමද

`EMAIL_LOGIN_ENABLED` env variable එකේ value එක:
- `true` → login/register form පෙන්නනවා (default)
- `false` → login page එකේ "email sign-in is currently disabled" message එක පෙන්නනවා, register/login API 403 return කරනවා

Value එක වෙනස් කරලා **Redeploy** කරන්න — code වෙනස් කරන්න ඕනේ නෑ.

## How the "works even without API key" caching works

- `/api/search` සහ `/api/movie` — request එකක් ආවම මුලින්ම upstream movie API එකට request කරනවා (server-side, `MOVIE_API_KEY` සමඟ)
- සාර්ථක වුනොත් → result MongoDB එකේ (`movies` සහ `movie_details` collections) upsert කරලා save කරනවා, user ට return කරනවා
- Upstream API එක fail උනොත් (key expire වුනත්, rate limit වුනත්, server down වුනත්) → MongoDB එකේ save කරලා තියෙන cached data එකෙන් search/details serve කරනවා, `source: "cache"` කියලා UI එකේ label එකක් පෙන්නනවා

## Local development

```bash
npm install
vercel dev
```
Copy `.env.example` → `.env` and fill in real values first.
