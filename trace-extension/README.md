# Trace New Tab

Trace New Tab is a Manifest V3 Chrome extension that puts a fresh selection of Trace articles on every new tab.

The article pool contains news from the current Edition. Cards show a thumbnail, story tag, and headline. Selecting one opens the Trace summary, key takeaways, and original-source link in the new tab. Trace is free: every summary is open to everyone.

Bookmarks are stored locally and appear under the Saved filter.

## Request behavior

The public article pool is cached locally for 15 minutes. Opening another new tab during that window selects a fresh random set from the cached pool and performs no API request. Story filters reuse that same pool. A request happens only when no pool is cached or the cached pool has expired.

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

The extension reads `https://www.yourtrace.online/api/extension/brief`. The version 5 payload contains an `articles` array with Edition news and canonical Trace share URLs. The client validates the pool before caching or rendering it.
