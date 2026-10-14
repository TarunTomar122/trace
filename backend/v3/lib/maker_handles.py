"""Best-effort X handles for the people behind a featured link.

Three places to look, all cheap:
- the linked page's <meta name="twitter:creator"> / "twitter:site";
- for a GitHub repo, the owner's `twitter_username` (GitHub REST API), then
  the repo's homepage meta if the owner has none;
- for a Hacker News item, the submitter (`by`), which the pipeline stores.

Fetches are short (a few seconds), read at most MAX_HTML_BYTES of a page, and
are remembered in `maker_handles` so a link is looked up once, not every day.
Nothing here raises: a lookup that fails just finds no handle.
"""

from __future__ import annotations

import hashlib
import ipaddress
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlsplit

import requests
from bs4 import BeautifulSoup

COLLECTION = "maker_handles"
USER_AGENT = "Mozilla/5.0 (compatible; TraceBot/1.0; +https://yourtrace.online)"
TIMEOUT = (3, 6)  # connect, read
MAX_HTML_BYTES = 256 * 1024
GITHUB_API = "https://api.github.com"
# Handles found stay good for a month; a failed fetch is tried again sooner.
FOUND_TTL = timedelta(days=30)
MISSED_TTL = timedelta(days=3)

HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,15}$")
# Where a handle came from, in words for the email.
VIA = {"twitter:creator": "page author tag", "twitter:site": "site's X account"}
# The platforms' own accounts and template leftovers: never the maker.
GENERIC_HANDLES = {
    "github", "gitlab", "producthunt", "ycombinator", "hackernews", "hn", "medium", "substack",
    "youtube", "x", "twitter", "wordpress", "wordpressdotcom", "ghost", "tumblr", "reddit", "linkedin",
    "thepracticaldev", "devto", "hashnode", "vercel", "netlify", "notionhq", "huggingface", "arxiv",
    "googledevs", "google", "lobsters", "sourcehut", "codeberg", "bsky", "bluesky", "mastodon",
    "username", "yourhandle", "handle", "site", "twitterhandle", "yourtwitter", "example",
}
# Hosting platforms: their twitter:site is the platform, so only twitter:creator
# (an author's own handle, e.g. on Medium) can be the maker.
PLATFORM_HOSTS = {
    "github.com", "gitlab.com", "medium.com", "substack.com", "youtube.com", "youtu.be", "producthunt.com",
    "news.ycombinator.com", "x.com", "twitter.com", "reddit.com", "linkedin.com", "dev.to", "hashnode.dev",
    "lobste.rs", "huggingface.co", "arxiv.org", "wordpress.com", "blogspot.com", "tumblr.com",
}
# github.com/<first segment> paths that are not a user or org.
GITHUB_RESERVED = {
    "about", "apps", "collections", "customer-stories", "enterprise", "events", "explore", "features",
    "login", "marketplace", "orgs", "pricing", "security", "settings", "site", "sponsors", "topics", "trending",
}


def _log_noop(_message: str) -> None:
    return None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def url_key(url: str) -> str:
    """One spelling per link: host without www., path without the trailing slash."""
    parts = urlsplit(str(url or "").strip())
    host = parts.netloc.lower().removeprefix("www.")
    return f"{host}{parts.path.rstrip('/')}" if host else ""


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


def _on_platform(host: str) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in PLATFORM_HOSTS)


def _public_http(url: str) -> bool:
    """http(s) to a public host: never localhost or a private address (this runs on the VPS)."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme not in {"http", "https"} or not host or host == "localhost" or host.endswith(".local"):
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return True
    return address.is_global


def clean_handle(value: Any) -> str:
    """"@Name", "Name" or "https://x.com/Name" as "@Name"; "" for generic or malformed ones."""
    text = str(value or "").strip()
    text = re.sub(r"^https?://(www\.)?(x|twitter)\.com/", "", text, flags=re.I).split("/")[0].split("?")[0]
    text = text.lstrip("@").strip()
    if not HANDLE_RE.match(text) or text.lower() in GENERIC_HANDLES:
        return ""
    return f"@{text}"


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------


def fetch_head(url: str, session: Any = requests) -> str:
    """The start of a page's HTML (up to MAX_HTML_BYTES, cut at </head>), or ""."""
    if not _public_http(url):
        return ""
    try:
        with session.get(url, timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}, stream=True,
                         allow_redirects=True) as response:
            if response.status_code != 200:
                return ""
            if "html" not in str(response.headers.get("content-type", "")).lower():
                return ""
            # A redirect can land anywhere: check the final host too.
            if not _public_http(str(getattr(response, "url", "") or url)):
                return ""
            data = b""
            for chunk in response.iter_content(16 * 1024):
                data += chunk
                if len(data) >= MAX_HTML_BYTES or b"</head>" in data.lower():
                    break
    except Exception:
        return ""
    text = data[:MAX_HTML_BYTES].decode(response.encoding or "utf-8", errors="ignore")
    end = text.lower().find("</head>")
    return text[: end + 7] if end != -1 else text


def meta_handles(html: str, host: str) -> list[dict[str, str]]:
    """X handles in a page's twitter:creator / twitter:site meta tags."""
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    found: list[dict[str, str]] = []
    for name in ("twitter:creator", "twitter:site"):
        if name == "twitter:site" and _on_platform(host):
            continue
        for tag in soup.find_all("meta"):
            key = str(tag.get("name") or tag.get("property") or "").strip().lower()
            if key != name:
                continue
            handle = clean_handle(tag.get("content"))
            if handle and all(h["handle"].lower() != handle.lower() for h in found):
                found.append({"handle": handle, "via": VIA[name]})
    return found


class GitHubRateLimited(RuntimeError):
    """GitHub said no more requests for now: stop asking for the rest of the run."""


def _github(path: str, session: Any) -> dict[str, Any] | None:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": USER_AGENT}
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = session.get(f"{GITHUB_API}{path}", headers=headers, timeout=TIMEOUT)
    if response.status_code in {403, 429} and (
        str(response.headers.get("x-ratelimit-remaining", "")) == "0" or "rate limit" in response.text.lower()
    ):
        raise GitHubRateLimited(f"GitHub rate limit ({response.status_code})")
    if response.status_code != 200:
        return None
    data = response.json()
    return data if isinstance(data, dict) else None


def github_repo(url: str) -> tuple[str, str] | None:
    """(owner, repo) for a github.com/<owner>/<repo> link."""
    parts = urlsplit(str(url or ""))
    if (parts.hostname or "").lower().removeprefix("www.") != "github.com":
        return None
    segments = [s for s in parts.path.split("/") if s]
    if len(segments) < 2 or segments[0].lower() in GITHUB_RESERVED:
        return None
    return segments[0], segments[1].removesuffix(".git")


def github_handles(owner: str, repo: str, session: Any = requests) -> list[dict[str, str]]:
    """The owner's X handle from their GitHub profile, else the repo homepage's meta.

    Raises GitHubRateLimited; any other failure finds nothing.
    """
    try:
        user = _github(f"/users/{owner}", session) or {}
    except GitHubRateLimited:
        raise
    except Exception:
        return []
    handle = clean_handle(user.get("twitter_username"))
    if handle:
        return [{"handle": handle, "via": "GitHub profile"}]
    try:
        homepage = str((_github(f"/repos/{owner}/{repo}", session) or {}).get("homepage") or "").strip()
    except GitHubRateLimited:
        raise
    except Exception:
        homepage = ""
    homepage = homepage or str(user.get("blog") or "").strip()
    if homepage and not homepage.startswith(("http://", "https://")):
        homepage = f"https://{homepage}"
    if not homepage or _host(homepage) == "github.com":
        return []
    return [{**h, "via": "project homepage"} for h in meta_handles(fetch_head(homepage, session), _host(homepage))]


# ---------------------------------------------------------------------------
# Cache + lookup
# ---------------------------------------------------------------------------


class HandleFinder:
    """Looks up handles for links, remembering results in `maker_handles`.

    `db` is the Firestore-shaped client, or None for an in-memory cache only.
    With `read_only` (dry runs) the cache is read but never written.
    """

    def __init__(self, db: Any = None, *, read_only: bool = False, session: Any = requests,
                 log: Callable[[str], None] = _log_noop, now: datetime | None = None) -> None:
        self.db, self.read_only, self.session, self.log = db, read_only, session, log
        self.now = now or _now()
        self.memory: dict[str, dict[str, Any]] = {}
        self.github_limited = False
        self.fetched = 0
        self.cached = 0

    def _doc_id(self, key: str) -> str:
        return hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]

    def _cached(self, key: str) -> list[dict[str, str]] | None:
        record = self.memory.get(key)
        if record is None and self.db is not None:
            try:
                snap = self.db.collection(COLLECTION).document(self._doc_id(key)).get()
                record = snap.to_dict() if snap.exists else None
            except Exception as exc:
                self.log(f"handle cache read failed: {exc}")
                record = None
        if not record:
            return None
        try:
            checked = datetime.fromisoformat(str(record.get("checked_at")).replace("Z", "+00:00"))
        except ValueError:
            return None
        handles = [h for h in record.get("handles") or [] if isinstance(h, dict) and h.get("handle")]
        if self.now - checked > (FOUND_TTL if handles else MISSED_TTL):
            return None
        return handles

    def _remember(self, key: str, url: str, handles: list[dict[str, str]]) -> None:
        record = {"url": url, "handles": handles, "checked_at": self.now.isoformat()}
        self.memory[key] = record
        if self.db is None or self.read_only:
            return
        try:
            self.db.collection(COLLECTION).document(self._doc_id(key)).set(record)
        except Exception as exc:
            self.log(f"handle cache write failed: {exc}")

    def lookup(self, url: str) -> list[dict[str, str]]:
        """Handles for the people behind `url`, best first. [] when none are found."""
        key = url_key(url)
        if not key:
            return []
        cached = self._cached(key)
        if cached is not None:
            self.cached += 1
            return cached
        repo = github_repo(url)
        if repo:
            if self.github_limited:
                return []  # not remembered: tomorrow's run asks again
            try:
                handles = github_handles(*repo, session=self.session)
            except GitHubRateLimited as exc:
                self.github_limited = True
                self.log(f"{exc}; skipping the remaining GitHub lookups (set GITHUB_TOKEN for more)")
                return []
        else:
            handles = meta_handles(fetch_head(url, self.session), _host(url))
        self.fetched += 1
        self._remember(key, url, handles)
        return handles
