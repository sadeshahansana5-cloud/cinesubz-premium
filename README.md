# CineSubz Premium

Cinema-themed, login-protected movie search with MongoDB caching, OTP email
verification at sign-up, and a homepage that's never empty.

## Project structure

```
cinesubz/
├── index.html            → Main app: search, trending grid, movie details — requires login
├── login.html             → Curtain-open animated login / sign-up / OTP verification
├── privacy.html           → Privacy policy page
├── api/
│   ├── config.js            → Public: tells the frontend if email login is on/off
│   ├── search.js             → Protected: search proxy + MongoDB caching + fallback
│   ├── movie.js                → Protected: movie detail proxy + MongoDB caching + fallback
│   ├── trending.js              → Protected: recently-cached movies for the homepage
│   └── auth/
│       ├── register.js            → Starts sign-up, sends OTP email
│       ├── verify-otp.js            → Confirms OTP, creates the account
│       ├── resend-otp.js             → Resends OTP with a cooldown
│       ├── login.js                   → Sign in existing (verified) users
│       ├── logout.js
│       └── me.js
├── lib/
│   ├── db.js                → MongoDB connection helper
│   ├── auth.js                → Password hashing, JWT, cookies, OTP helpers, feature flags
│   └── mailer.js                → SMTP email sending + the OTP email template
├── package.json
├── vercel.json
└── .env.example
```

## 1. MongoDB Atlas (free)

1. Create a free cluster at https://www.mongodb.com/atlas
2. Add a database user under **Database Access**
3. Under **Network Access**, add `0.0.0.0/0` so Vercel can connect
4. **Connect → Drivers**, copy the connection string

## 2. Email (for the sign-up OTP code)

Any SMTP provider works. Easiest options:
- **Gmail**: turn on 2-Step Verification, then create an [App Password](https://myaccount.google.com/apppasswords) — use that as `SMTP_PASS` (not your normal Gmail password). `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`.
- **Resend / SendGrid / Mailgun**: each gives you SMTP credentials on their dashboard — use those instead.

## 3. Deploy to Vercel

```bash
npm i -g vercel
cd cinesubz
vercel
```
or import the folder from GitHub at https://vercel.com/new (Framework preset: **Other**).

## 4. Environment variables (Vercel Dashboard)

Vercel dashboard → project → **Settings → Environment Variables** — මේවා add කරන්න (Production/Preview/Development තුනටම):

| Key | Value | Note |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://...` | Atlas connection string |
| `MONGODB_DB` | `cinesubz` | optional |
| `JWT_SECRET` | random string | `openssl rand -hex 32` |
| `EMAIL_LOGIN_ENABLED` | `true` / `false` | Email login on/off |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | your provider's values | sends the OTP email |
| `MOVIE_API_KEY` | your API key | optional — a working default is baked in if you skip this |
| `MOVIE_API_BASES` | (optional) | comma-separated upstream API URLs |

Save → **Redeploy** (env variable වෙනස් කළාම redeploy කරන්න ඕනේ, code වෙනස් කරන්න ඕනේ නෑ).

### Email login on/off කරන්නේ කොහොමද
`EMAIL_LOGIN_ENABLED=false` → login page එකේ "sign-in is disabled" screen එක පෙන්නනවා, register/login API 403 return කරනවා. `true` කළ විට normal ලෙස වැඩ කරනවා.

## What changed to fix "Details API is unavailable" errors

The previous version only used your own `MOVIE_API_KEY` and could fail silently
if it wasn't set correctly on Vercel, or if the request looked too "robotic" to
the upstream API. Two fixes:

1. **A working fallback key is baked into the code** (the same one the original
   single-file page used) — so search/details work immediately even before you
   set `MOVIE_API_KEY` yourself. Setting your own key in Vercel still overrides it.
2. **Requests now send browser-like headers** (User-Agent, Accept) to the
   upstream API, since some hosts silently reject bare server requests.

MongoDB is now a **quiet background safety net**, not something you need to
manage — it only kicks in if the live API genuinely fails, and it's what powers
the new **Trending** section on the homepage.

## New in this version

- **OTP email verification** at sign-up — a 6-digit code is emailed, must be entered within 10 minutes, with resend cooldown and attempt limits.
- **Homepage is never empty** — before any search, it shows a feature band (Sinhala subtitles / quality options / fast links / free) and a "Trending Right Now" grid pulled from MongoDB's most recently searched titles. Quick-search suggestion chips are always available too.
- **Nicer error/empty states** with a "Try Again" button instead of a bare red message.
- **Privacy Policy page** (`privacy.html`), linked from the account menu, the footer, and the sign-up consent checkbox.
- **Share button** on movie detail pages (copies the page link).
- **Back-to-top button**, **top-of-page loading progress bar**, and scroll-reveal animations for a more premium feel.
- Press **/** anywhere on the homepage to jump into the search box.

## How the caching works

- `/api/search` and `/api/movie` try the live API first (with browser-like headers). On success, results are cached into MongoDB (`movies` and `movie_details` collections).
- If the live API fails, cached results are served instead (labelled "from cache" in the UI) — the site keeps working.
- `/api/trending` reads the most recently cached titles to populate the homepage.

## Local development

```bash
npm install
vercel dev
```
Copy `.env.example` → `.env` and fill in real values first.
