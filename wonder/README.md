# Wonder (Brainwave)

A React Native / Expo learning app that surfaces bite-sized ideas from books, articles, and videos in a swipeable card feed.

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| **Node.js** | 18+ | tested on 22.x |
| **npm** | comes with Node | yarn/pnpm work too |
| **Xcode** | 16+ | iOS builds only; includes Simulator |
| **Xcode Command Line Tools** | — | `xcode-select --install` |
| **CocoaPods** | 1.14+ | `sudo gem install cocoapods` (or via Homebrew) |
| **Ruby** | 2.7+ | ships with macOS; needed by CocoaPods |
| **Watchman** (optional) | — | `brew install watchman` — improves Metro file-watching |

Android builds also require Android Studio + SDK 34, but iOS is the primary target right now.

## Project structure

```
wonder/
├── app/              # Expo React Native app
│   ├── App.js        # root component & navigation
│   ├── screens/      # all screens (BookFeed, IdeaReel, Onboarding, etc.)
│   ├── navigation/   # navigator config
│   ├── lib/          # supabase client, helpers
│   ├── app.json      # Expo config
│   └── package.json  # JS dependencies
├── data/             # static content JSON
│   ├── articles/     # one file per interest
│   ├── videos/       # one file per interest
│   └── interests/    # book card data per interest
└── README.md
```

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd wonder

# 2. Install JS dependencies
cd app
npm install

# 3. Generate native projects (ios/ and android/)
npx expo prebuild

# 4. Install CocoaPods (iOS)
cd ios
pod install
cd ..

# 5. Run on iOS Simulator
npx expo run:ios

# Or start Metro and pick a target
npx expo start
```

## Google Sign-In

The app uses `@react-native-google-signin/google-signin`. A Google OAuth client plist is checked in at:

```
app/client_<id>.apps.googleusercontent.com.plist
```

The matching `iosUrlScheme` is configured in `app.json` under `plugins`. The client ID is a public identifier (not a secret) and is safe to commit. Google Sign-In will only work with the registered bundle ID `com.brainwave.app` — if you change the bundle ID, you'll need your own OAuth client.

## Supabase

The Supabase client is configured in `app/lib/supabase.js` with a publishable anon key. No `.env` file is used right now — the URL and key are inline. If you swap to a different Supabase project, update that file.

## Content data format

Articles and videos in `data/` use a v3.0 card schema:

```json
{
  "id": "business-article-01",
  "title": "Strategy Is Choosing What Not to Do",
  "subtitle": "Most teams call everything a priority, then wonder why nothing ships well.",
  "body": [
    "First paragraph...",
    "Second paragraph..."
  ],
  "takeaway": "If everything is strategic, nothing is."
}
```

Book cards in `data/interests/` still use the older `idea` + `description` format. The `IdeaReel` screen handles both.

## Common issues

| Problem | Fix |
|---------|-----|
| `pod install` fails | make sure Xcode CLI tools are installed: `sudo xcode-select -s /Applications/Xcode.app` |
| Metro can't find files | clear cache: `npx expo start -c` |
| iOS build fails after dependency change | `cd ios && pod install --repo-update && cd ..` |
| Simulator won't launch | open Xcode → Settings → Platforms → install a simulator runtime |
