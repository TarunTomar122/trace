import unittest

from v3 import build_daily_pulse as P


def item(source, title, url, points=None):
    return {"source": source, "title": title, "url": url, "signal": f"{points} points" if points is not None else "", "role_hints": ["developer"]}


class TopArticlesTests(unittest.TestCase):
    def test_caps_skips_and_dedupes(self):
        pool = [item("Hacker News", f"Story {i}", f"https://ex.com/{i}", 900 - i) for i in range(30)]
        pool += [
            item("Hacker News", "Ask HN: what are you reading?", "https://news.ycombinator.com/item?id=1", 999),
            item("Hacker News", "A text post", "https://news.ycombinator.com/item?id=2", 999),
            item("Show HN", "A guitar you strum with your keyboard", "https://guitar.example", 400),
            item("Lobsters", "Story 3", "https://ex.com/3/"),  # same link as an HN story
            item("Lobsters", "A plea not to use uv-build", "https://lob.example/1"),
            item("Sidebar", "Grieving the loss of details", "https://side.example/1"),
            item("r/programming", "Reddit thread", "https://reddit.example/1"),
            item("Hacker News", "Shown yesterday", "https://ex.com/old", 2000),
        ]
        picks = P._pick_discussions("developer", pool, {"https://ex.com/old"}, set())
        sources = [p["source"] for p in picks]
        titles = [p["title"] for p in picks]
        # only 3 non-HN picks exist, so HN fills the slots its cap would otherwise leave empty
        self.assertEqual(len(picks), P.DISCUSSIONS_LIMIT)
        self.assertEqual(sources.count("Hacker News"), P.DISCUSSIONS_LIMIT - 3)
        self.assertNotIn("r/programming", sources)
        self.assertFalse(any(t.startswith("Ask HN") or t == "A text post" or t == "Shown yesterday" for t in titles))
        # the HN copy of a link wins over the Lobsters copy (it has votes)
        self.assertEqual([p["source"] for p in picks if p["url"].rstrip("/") == "https://ex.com/3"], ["Hacker News"])
        self.assertTrue(all(p["roles"] for p in picks))

    def test_caps_hold_when_every_source_has_plenty(self):
        pool = [item("Hacker News", f"Story {i}", f"https://ex.com/{i}", 900 - i) for i in range(40)]
        pool += [item("Show HN", f"Show {i}", f"https://show.example/{i}", 300 - i) for i in range(6)]
        pool += [item("Lobsters", f"Lob {i}", f"https://lob.example/{i}") for i in range(6)]
        pool += [item("Sidebar", f"Design {i}", f"https://side.example/{i}") for i in range(6)]
        sources = [p["source"] for p in P._pick_discussions("developer", pool, set(), set())]
        self.assertEqual({s: sources.count(s) for s in set(sources)},
                         {"Hacker News": 15, "Show HN": 3, "Lobsters": 3, "Sidebar": 3})

    def test_curated_picks_are_spaced_not_sunk(self):
        pool = [item("Hacker News", f"Story {i}", f"https://ex.com/{i}", 900 - i) for i in range(20)]
        pool += [item("Sidebar", f"Design {i}", f"https://side.example/{i}") for i in range(3)]
        pool += [item("Lobsters", f"Lob {i}", f"https://lob.example/{i}") for i in range(3)]
        picks = P._pick_discussions("developer", pool, set(), set())
        positions = [i for i, p in enumerate(picks) if p["source"] in ("Sidebar", "Lobsters")]
        self.assertEqual(len(positions), 6)
        self.assertLess(positions[0], 6)                  # one shows up near the top
        self.assertGreater(min(b - a for a, b in zip(positions, positions[1:])), 1)  # never back to back
        hn_points = [P._hn_points(p) for p in picks if p["source"] == "Hacker News"]
        self.assertEqual(hn_points, sorted(hn_points, reverse=True))  # HN keeps vote order


class TopArticlesEdgeTests(unittest.TestCase):
    def test_text_posts_job_ads_and_weak_show_hn_are_skipped(self):
        pool = [
            item("Show HN", "A text-only Show HN", "https://news.ycombinator.com/item?id=9", 500),
            item("Hacker News", "Acme (YC W24) Is Hiring Engineers", "https://acme.example/jobs", 300),
            item("Show HN", "A small weekend toy", "https://toy.example", 40),
            item("Hacker News", "Launch HN: Acme (YC W24) builds robots", "https://acme.example", 300),
        ]
        titles = [p["title"] for p in P._pick_discussions("developer", pool, set(), set())]
        self.assertEqual(titles, ["Launch HN: Acme (YC W24) builds robots"])

    def test_non_latin_titles_do_not_collide(self):
        pool = [item("Hacker News", "日本語のタイトル", "https://jp.example/1", 400),
                item("Hacker News", "中文标题", "https://cn.example/1", 300)]
        self.assertEqual(len(P._pick_discussions("developer", pool, set(), set())), 2)

    def test_link_spellings_are_one_link(self):
        pool = [item("Hacker News", "Story A", "https://www.ex.com/post/?utm_source=hn", 500),
                item("Lobsters", "Story A (lobsters)", "http://ex.com/post")]
        picks = P._pick_discussions("developer", pool, set(), set())
        self.assertEqual([p["source"] for p in picks], ["Hacker News"])
        # and a link shown yesterday stays out under any spelling
        self.assertEqual(P._pick_discussions("developer", pool, {"https://ex.com/post"}, set()), [])

    def test_fresh_stories_beat_older_ones_with_somewhat_more_votes(self):
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        old = {**item("Hacker News", "Old", "https://old.example", 660), "published_date": (now - timedelta(hours=46)).isoformat()}
        new = {**item("Hacker News", "New", "https://new.example", 370), "published_date": (now - timedelta(hours=5)).isoformat()}
        self.assertEqual([p["title"] for p in P._pick_discussions("developer", [old, new], set(), set())], ["New", "Old"])

    def test_discussion_fallback_is_blank_not_filler(self):
        self.assertEqual(P._fallback_summary("discussions", {"title": "X", "source": "Lobsters", "snippet": "Comments"}), "")
        self.assertEqual(P._fallback_summary("discussions", {"title": "X", "source": "Hacker News", "snippet": "https://x.example"}), "")

    def test_one_story_under_two_headlines_shows_once(self):
        pool = [item("Hacker News", "Apple's new 'Switch to Safari' campaign details why you should ditch Chrome", "https://news.example/a", 271),
                item("Lobsters", "Apple: Switch to Safari (from Chrome)", "https://apple.example/safari"),
                item("Hacker News", "New Apple TV 4K", "https://apple.example/tv", 333),
                item("Hacker News", "Apple HomeView", "https://apple.example/homeview", 723)]
        titles = [p["title"] for p in P._pick_discussions("developer", pool, set(), set())]
        self.assertEqual(len(titles), 3)  # the two Safari headlines collapse; other Apple stories stay
        self.assertIn("New Apple TV 4K", titles)
        self.assertIn("Apple HomeView", titles)


class HnSubmitterTests(unittest.TestCase):
    def test_hn_items_carry_the_submitter(self):
        from unittest.mock import MagicMock, patch

        from v3.lib import pulse_sources as S

        response = MagicMock()
        response.json.return_value = {"hits": [{"title": "A post", "url": "https://a.dev", "objectID": "1",
                                                "points": 300, "author": "jane", "created_at": "2026-10-14T00:00:00Z"}]}
        with patch.object(S.requests, "get", return_value=response):
            [hn] = S._fetch_hn_items(["https://hn.algolia.com/api/v1/search"], ["developer"],
                                     source_kind="community", log_fn=lambda _m: None)
        self.assertEqual((hn["by"], hn["source"]), ("jane", "Hacker News"))


if __name__ == "__main__":
    unittest.main()
