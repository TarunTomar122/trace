# Trace New Tab

Trace New Tab is a Manifest V3 Chrome extension that shows Trace's daily stories on every new tab, in the same look as the web app.

The stories are the site's Home: one card per event (the coverage of one event from several outlets is merged), in the site's rank order, with the story of the day on top. Selecting a story opens the Trace summary, its other coverage, and links to the story on Trace and to the original report. Trace is free: every summary is open to everyone. Sponsor cards sit in the grid: up to three paid sponsors (the site's $19/mo slots; 3rd, 11th and 19th card), a "Sponsor spot open" card when none are booked, and a StocksBrew card (our own product, 9th).

Signing in with Google is optional; it syncs bookmarks with the site's Saved.

## Request behavior

The stories are cached locally for 10 minutes. Opening another new tab during that window renders the cached stories and makes no API request. Topic filters reuse the same stories.

## Privacy and permissions

The extension requests only Chrome's `storage` permission. It does not request browsing history, tabs, active-page access, content scripts, or page modification permissions.

## Load unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose this `trace-extension` directory.
5. Open a new tab.

## Verify and package

```sh
npm test
npm run validate
npm run package
```

The package command writes the Chrome Web Store archive to `dist/`.

## Backend contract

The extension reads `https://www.yourtrace.online/api/extension/stories` (payload version 6, `frontend/lib/extension-stories.ts`): the site's Home stories in rank order, one per event with its other coverage, plus up to three sponsors whose links go through `/api/tools/go?p=extension`. The client validates everything before caching or rendering it. `/api/extension/brief` (versions 4-5, one card per article) stays for installs older than 0.3.0.
