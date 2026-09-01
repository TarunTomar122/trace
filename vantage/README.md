# Vantage

A 5-minute **personalized daily AI/tech audio brief** for ambitious, time-poor tech people. Tell it who you are; every morning it reads the night's news and hands you a short, human-sounding brief pointed at the *openings* — not the headlines. **$5/month.**

This repo is the **frontend web app** (Vite + React + TS + Tailwind). Auth, payments, and the audio pipeline are wired as documented stubs so every screen is walkable today; the "LIVE SWAP" comments mark where to plug in the real backend.

## Run it

```bash
cd vantage
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

## What's here

| Route | Page | Notes |
|---|---|---|
| `/` | Landing | hero + real sample player, how it works, values, delivery, pricing, FAQ |
| `/how-it-works` | Explainer | the 2-question setup + how it writes a brief per person |
| `/pricing` | Pricing | single $5/mo plan |
| `/onboarding` | Onboarding | 2 questions (role + goal) → interests → email. Builds the profile. |
| `/signin` | Sign in | email + Google/Apple stubs |
| `/welcome` | Welcome | private podcast feed URL + first brief |
| `/today` | Today (auth) | the day's brief, player, highlights, transcript, paywall |
| `/library` | Library (auth) | searchable archive of past briefs |
| `/profile` | Profile (auth) | role/goal/interests, voice pace, delivery channels, membership |

Design system: `src/index.css` (tokens + component classes) + `tailwind.config.js`. Fraunces display serif + Inter, one ember accent (`#e8542a`), real cards, no templated kicker-labels. Rebrand from `src/lib/brand.ts`.

## Integrations to wire (all keys already live in the repo-root `.env`)

Copy `.env.example` → `.env.local` and fill the `VITE_*` client vars. Server-only keys stay server-side.

- **Auth — Firebase.** `src/lib/firebase.ts` + `src/lib/auth.tsx`. Prototype uses localStorage; swap for Firebase Auth. **Share the Trace project (`anybrew-7c6c1`)** so the listener's role/interests in `user_profiles/{uid}` *are* the personalization input. Client vars: `VITE_FIREBASE_*`.
- **Payments — Dodo.** `src/lib/checkout.ts`. A backend route creates a $5/mo checkout session (`DODO_API_KEY`, `DODO_PRODUCT_ID`), redirects to it, and a webhook (`DODO_WEBHOOK_SECRET`) flips the subscription in Firestore.
- **Script — OpenAI.** `OPENAI_API_KEY`. Daily: pull the user's feed → the persona prompt (see `../frontend/scripts/brief-audio.mjs`) → `gpt-5` writes the ~2-min brief.
- **Voice — Runway.** `RUNWAY_API_KEY`. `seed_audio` clones the chosen voice (`design-npr-podcast`, cloned from a Runway `eleven_ttv_v3` voice-design preview) at ~1.1× pace. **~10 credits per episode** → a 10k–100k credit budget = 1k–10k episodes.
- **Email — Brevo.** `BREVO_API_KEY`. The daily "your brief is ready" note.
- **Delivery — private podcast RSS.** Generate a per-user `feed/{uid}.xml` enclosing the day's mp3 (Firebase Storage). This is the primary, ~free channel.
- **WhatsApp — optional.** WhatsApp Business API (via Twilio ~$0.005/msg). Opt-in add-on; documented, not built.

## The daily pipeline (backend, to build)

```
for each active subscriber (on-demand or 7am cron):
  feed = read user's role/interests + curated daily items (Firestore v3_user_feeds)
  script = OpenAI gpt-5, persona: "friend who wants you to win", grounded to the feed
  mp3    = Runway seed_audio (voice: design-npr-podcast) → ~1.1× via ffmpeg → Firebase Storage
  write  audio_briefs/{uid}/{date}; append to the user's podcast RSS; email + (opt) WhatsApp
```

The script prompt + voice recipe are proven in `../frontend/scripts/brief-audio.mjs` (run: `node --env-file=../.env frontend/scripts/brief-audio.mjs`).

## Notes

- Social-proof numbers on the landing page are placeholders (`brand.ts`) — swap before launch.
- The one real audio sample (`public/samples/brief-daily.mp3`) plays across every player.
