# Trace New Tab privacy disclosure

Trace New Tab replaces the browser's new-tab page with public technology articles.

## Data stored on the device

The last successfully loaded public article pool and its load time are stored locally through `chrome.storage.local`. This keeps new tabs fast and allows cached articles to remain available during temporary network failures. The extension also stores the signed-in session, account display state, bookmarked public stories, IDs of summaries opened that day, a random analytics installation identifier, and the last daily analytics event. Signed-in bookmarks and subscription access sync with the Trace account; the remaining values stay on the device.

## Data sent to Trace

The extension requests the public Trace article endpoint only when no pool is cached or the cached pool is older than one hour. The request contains ordinary network information such as the IP address and user agent that every web request carries. The extension does not send browsing history, visited pages, or the contents of other websites to Trace.

Trace records a small set of extension actions to understand whether the product works: install or update, one feed view per day, filter changes, story opens, bookmarks, shares, source-link opens, sign-in clicks, and checkout clicks. Events use a random installation identifier stored on the device. They may include the extension version, story identifier, story tag, selected filter, article count, cache state, and whether an account or Pro access is present. Trace does not send story titles, article text, source URLs, email addresses, browsing history, or activity from other websites to analytics.

Article thumbnails are loaded from the public image URL supplied with each story. The image host receives the ordinary IP address and user agent needed to deliver that image. A failed image is removed from the card.

## Browser permissions

The extension requests only `storage`. It does not request access to browsing history, tabs, page contents, or downloads. It does not inject scripts into other websites.

## Contact

Privacy questions can be sent through [Trace contact](https://www.yourtrace.online/contact).
