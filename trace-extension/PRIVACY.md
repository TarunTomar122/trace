# Trace New Tab privacy disclosure

Trace New Tab replaces the browser's new-tab page with Trace's public technology news stories.

## Data stored on the device

The last successfully loaded set of public stories and its load time are stored locally through `chrome.storage.local`. This keeps new tabs fast and keeps cached stories available during temporary network failures. If you sign in, the extension also stores its connection token and your saved stories so they show under Saved.

## Data sent to Trace

If you sign in with Google (optional), the extension sends its connection token to Trace to read your account name and to save, remove and list your saved stories, so they match your Saved list on yourtrace.online. Without signing in, nothing about you is sent.

The extension requests the public Trace stories endpoint only when nothing is cached or the cache is older than 10 minutes. The request contains ordinary network information such as the IP address and user agent that every web request carries. The extension does not send browsing history, visited pages, or the contents of other websites to Trace.

Article thumbnails are loaded from the public image URL supplied with each story. The image host receives the ordinary IP address and user agent needed to deliver that image. A failed image is removed from the card.

The grid includes up to three cards marked "Sponsored" and one card for StocksBrew, another product from Trace's maker. Sponsor links go through yourtrace.online, which counts the click (sponsor, day and placement only) and forwards you to the sponsor's site. Nothing about you is sent to the sponsor beyond what any visit to their site carries.

## Browser permissions

The extension requests only `storage`. It does not request access to browsing history, tabs, page contents, or downloads. It does not inject scripts into other websites.

## Contact

Privacy questions can be sent through [Trace contact](https://www.yourtrace.online/contact).
