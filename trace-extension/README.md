# Trace New Tab

Trace New Tab is a Manifest V3 Chrome extension that puts 15 randomly selected Trace articles on every new tab.

The article pool mixes the current Edition with Pulse stories, builds, blogs, and discussions. Selecting a card opens the complete Trace summary in the new tab. Each card and full read include a direct original-source link.

## Request behavior

The public article pool is cached locally for 15 minutes. Opening another new tab during that window selects a fresh random set from the cached pool and performs no API request. A request happens only after the cache expires or the user selects refresh.

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

The extension reads `https://www.yourtrace.online/api/extension/brief`. The version 3 payload contains an `articles` array with Edition and Pulse items. The client validates the pool before caching or rendering it.
