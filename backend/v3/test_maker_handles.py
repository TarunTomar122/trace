import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from v3.lib import maker_handles as M

NOW = datetime(2026, 10, 14, 6, 30, tzinfo=timezone.utc)


class FakeResponse:
    def __init__(self, status=200, body=b"", headers=None, url="", data=None):
        self.status_code, self.body, self.url = status, body, url
        self.headers = headers if headers is not None else {"content-type": "text/html; charset=utf-8"}
        self.data, self.encoding = data, "utf-8"
        self.chunks_read = 0

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def iter_content(self, size):
        for start in range(0, len(self.body), size):
            self.chunks_read += 1
            yield self.body[start:start + size]

    @property
    def text(self):
        return self.body.decode() if self.body else json.dumps(self.data or {})

    def json(self):
        return self.data


class FakeSession:
    def __init__(self, routes):
        self.routes, self.calls = routes, []

    def get(self, url, **_kwargs):
        self.calls.append(url)
        response = self.routes.get(url)
        if isinstance(response, Exception):
            raise response
        return response or FakeResponse(404)


class FakeDB:
    def __init__(self, table=None, fail_writes=False):
        self.table, self.fail_writes, self.writes = dict(table or {}), fail_writes, 0

    def collection(self, _name):
        return self

    def document(self, doc_id):
        db = self

        class Doc:
            def get(self):
                snap = MagicMock()
                snap.exists = doc_id in db.table
                snap.to_dict.return_value = dict(db.table.get(doc_id, {}))
                return snap

            def set(self, data, merge=False):
                if db.fail_writes:
                    raise RuntimeError("database is locked")
                db.writes += 1
                db.table[doc_id] = dict(data)

        return Doc()


def page(*metas):
    tags = "".join(f'<meta {attr}="{name}" content="{value}">' for attr, name, value in metas)
    return f"<html><head><title>x</title>{tags}</head><body>{'y' * 100}</body></html>".encode()


class HandleTests(unittest.TestCase):
    def test_clean_handle(self):
        self.assertEqual(M.clean_handle("@simonw"), "@simonw")
        self.assertEqual(M.clean_handle("simonw"), "@simonw")
        self.assertEqual(M.clean_handle("https://twitter.com/simonw"), "@simonw")
        self.assertEqual(M.clean_handle("https://x.com/simonw?lang=en"), "@simonw")
        for junk in ("@github", "@ProductHunt", "@username", "", None, "not a handle", "@sixteen_chars_xx", "@a-b"):
            self.assertEqual(M.clean_handle(junk), "", junk)

    def test_meta_handles_skip_platform_site_accounts(self):
        html = page(("name", "twitter:creator", "@jane"), ("name", "twitter:site", "@acme")).decode()
        self.assertEqual(M.meta_handles(html, "acme.dev"), [
            {"handle": "@jane", "via": "page author tag"}, {"handle": "@acme", "via": "site's X account"}])
        # On Medium, twitter:site is Medium itself; the author's own tag still counts.
        self.assertEqual(M.meta_handles(html, "medium.com"), [{"handle": "@jane", "via": "page author tag"}])
        self.assertEqual(M.meta_handles(html, "jane.medium.com"), [{"handle": "@jane", "via": "page author tag"}])
        same = page(("property", "twitter:creator", "@acme"), ("name", "twitter:site", "@Acme")).decode()
        self.assertEqual([h["handle"] for h in M.meta_handles(same, "acme.dev")], ["@acme"])
        self.assertEqual(M.meta_handles("", "acme.dev"), [])

    def test_github_repo_links(self):
        self.assertEqual(M.github_repo("https://github.com/astral-sh/uv"), ("astral-sh", "uv"))
        self.assertEqual(M.github_repo("https://www.github.com/a/b.git/tree/main"), ("a", "b"))
        for url in ("https://github.com/topics/ai", "https://github.com/astral-sh", "https://gitlab.com/a/b", "nope"):
            self.assertIsNone(M.github_repo(url))


class FetchTests(unittest.TestCase):
    def test_reads_only_the_head_and_caps_bytes(self):
        body = b"<html><head>" + b"<meta name='a' content='b'>" * 10 + b"</head><body>" + b"z" * 900_000 + b"</body>"
        response = FakeResponse(body=body, url="https://acme.dev")
        html = M.fetch_head("https://acme.dev", FakeSession({"https://acme.dev": response}))
        self.assertTrue(html.endswith("</head>"))
        self.assertEqual(response.chunks_read, 1)
        huge = FakeResponse(body=b"<html><head>" + b"x" * 900_000, url="https://big.dev")
        self.assertLessEqual(len(M.fetch_head("https://big.dev", FakeSession({"https://big.dev": huge}))), M.MAX_HTML_BYTES)

    def test_skips_non_html_errors_and_private_hosts(self):
        session = FakeSession({
            "https://pdf.dev": FakeResponse(body=b"%PDF", headers={"content-type": "application/pdf"}),
            "https://down.dev": RuntimeError("timeout"),
            "https://moved.dev": FakeResponse(body=page(("name", "twitter:site", "@x1")), url="http://127.0.0.1/admin"),
        })
        self.assertEqual(M.fetch_head("https://pdf.dev", session), "")
        self.assertEqual(M.fetch_head("https://down.dev", session), "")
        self.assertEqual(M.fetch_head("https://moved.dev", session), "")
        for url in ("http://localhost:8080/", "http://127.0.0.1/", "http://10.0.0.5/", "http://169.254.169.254/", "ftp://a.dev"):
            self.assertEqual(M.fetch_head(url, session), "")
        self.assertNotIn("http://localhost:8080/", session.calls)
        self.assertNotIn("http://169.254.169.254/", session.calls)


class GitHubTests(unittest.TestCase):
    def test_profile_handle_first(self):
        session = FakeSession({f"{M.GITHUB_API}/users/astral-sh": FakeResponse(data={"twitter_username": "astral_sh"})})
        self.assertEqual(M.github_handles("astral-sh", "uv", session), [{"handle": "@astral_sh", "via": "GitHub profile"}])

    def test_falls_back_to_the_repo_homepage(self):
        session = FakeSession({
            f"{M.GITHUB_API}/users/jane": FakeResponse(data={"twitter_username": None, "blog": ""}),
            f"{M.GITHUB_API}/repos/jane/tool": FakeResponse(data={"homepage": "tool.dev"}),
            "https://tool.dev": FakeResponse(body=page(("name", "twitter:site", "@tooldev")), url="https://tool.dev"),
        })
        self.assertEqual(M.github_handles("jane", "tool", session), [{"handle": "@tooldev", "via": "project homepage"}])

    def test_token_is_sent_and_rate_limits_raise(self):
        limited = FakeResponse(403, headers={"x-ratelimit-remaining": "0"}, data={"message": "API rate limit exceeded"})
        session = MagicMock()
        session.get.return_value = limited
        with patch.dict("os.environ", {"GITHUB_TOKEN": "ghp_test"}):
            with self.assertRaises(M.GitHubRateLimited):
                M.github_handles("a", "b", session)
        self.assertEqual(session.get.call_args.kwargs["headers"]["Authorization"], "Bearer ghp_test")

    def test_other_failures_find_nothing(self):
        session = FakeSession({f"{M.GITHUB_API}/users/gone": FakeResponse(404, data={})})
        self.assertEqual(M.github_handles("gone", "repo", session), [])


class FinderTests(unittest.TestCase):
    def test_caches_lookups_and_respects_read_only(self):
        url = "https://acme.dev/post"
        session = FakeSession({url: FakeResponse(body=page(("name", "twitter:creator", "@jane")), url=url)})
        db = FakeDB()
        finder = M.HandleFinder(db, session=session, now=NOW)
        self.assertEqual(finder.lookup(url), [{"handle": "@jane", "via": "page author tag"}])
        self.assertEqual(db.writes, 1)
        # Another run (and another spelling of the link) reads the cache instead of fetching.
        again = M.HandleFinder(db, session=session, now=NOW + timedelta(days=2))
        self.assertEqual(again.lookup("https://www.acme.dev/post/"), [{"handle": "@jane", "via": "page author tag"}])
        self.assertEqual((len(session.calls), again.cached), (1, 1))
        dry = M.HandleFinder(FakeDB(), read_only=True, session=session, now=NOW)
        dry.lookup(url)
        self.assertEqual(dry.db.writes, 0)

    def test_cache_expires_misses_sooner_than_finds(self):
        url = "https://quiet.dev"
        key = M.HandleFinder(None)._doc_id(M.url_key(url))
        checked = (NOW - timedelta(days=4)).isoformat()
        session = FakeSession({})
        db = FakeDB({key: {"url": url, "handles": [], "checked_at": checked}})
        M.HandleFinder(db, session=session, now=NOW).lookup(url)
        self.assertEqual(session.calls, [url])  # a 4-day-old miss is tried again
        db = FakeDB({key: {"url": url, "handles": [{"handle": "@q", "via": "x"}], "checked_at": checked}})
        self.assertEqual(M.HandleFinder(db, session=session, now=NOW).lookup(url)[0]["handle"], "@q")
        self.assertEqual(len(session.calls), 1)  # a 4-day-old find is still good

    def test_rate_limit_stops_github_for_the_run_and_is_not_cached(self):
        db = FakeDB()
        session = MagicMock()
        session.get.return_value = FakeResponse(429, headers={}, data={"message": "rate limit"})
        finder = M.HandleFinder(db, session=session, now=NOW)
        self.assertEqual(finder.lookup("https://github.com/a/b"), [])
        self.assertTrue(finder.github_limited)
        self.assertEqual(finder.lookup("https://github.com/c/d"), [])
        self.assertEqual((session.get.call_count, db.writes), (1, 0))

    def test_cache_errors_never_stop_a_lookup(self):
        url = "https://acme.dev"
        session = FakeSession({url: FakeResponse(body=page(("name", "twitter:site", "@acme")), url=url)})
        db = FakeDB(fail_writes=True)
        db.collection = MagicMock(side_effect=RuntimeError("no db"))
        self.assertEqual(M.HandleFinder(db, session=session, now=NOW).lookup(url)[0]["handle"], "@acme")


if __name__ == "__main__":
    unittest.main()
