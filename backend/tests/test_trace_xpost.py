import base64
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

SCRIPT = Path(__file__).resolve().parents[1] / "laptop" / "trace_xpost.py"
spec = importlib.util.spec_from_file_location("trace_xpost", SCRIPT)
xpost = importlib.util.module_from_spec(spec)
spec.loader.exec_module(xpost)

STORY = {"title": "Tesla's Roadster gets SpaceX thrusters", "headlines": ["The Roadster flew"],
         "sources": [{"name": "The Verge"}, {"name": "Engadget"}]}
KIT = {
    "date": "2026-10-16",
    "post": {"text": "Biggest updates in tech in the last 24 hours:\n\n- Tesla's Roadster flew <b>upside down</b>"
                     "\n\nDid I miss anything??", "length": 60,
             "hook": "Biggest updates in tech in the last 24 hours:", "written_by": "model", "lead": STORY,
             "bullets": [{"text": "Tesla's Roadster flew <b>upside down</b>", "story": STORY}]},
    "reply": "I send the biggest tech stories every morning, free: https://www.yourtrace.online/?utm_source=x",
    "image": {"name": "x-post.jpg", "size": [1200, 630], "from": "The Verge",
              "base64": base64.b64encode(b"\xff\xd8jpeg").decode()},
    "videos": [{"url": "https://www.youtube.com/watch?v=a", "title": "Roadster flip", "channel": "KBS News"}],
    "stories": 157,
    "final": True,
    "limit": 360,
}


class StartTests(unittest.TestCase):
    words = {"roadster", "thrusters", "flip"}

    def test_short_videos_play_from_the_start(self):
        self.assertEqual(xpost.pick_start({"duration": 31}, self.words, cues=[]), 0.0)

    def test_most_replayed_peak_is_centred(self):
        info = {"duration": 600, "heatmap": [{"start_time": 100, "end_time": 110, "value": 0.2},
                                             {"start_time": 300, "end_time": 310, "value": 1.0}]}
        self.assertEqual(xpost.pick_start(info, self.words, cues=[]), 290.0)
        info["heatmap"] = [{"start_time": 540, "end_time": 550, "value": 1.0}]
        self.assertEqual(xpost.pick_start(info, self.words, cues=[]), 530.0)
        # Peaks in the first or last 7% (the intro everyone rewatches, the end card) don't count.
        info["heatmap"] = [{"start_time": 0, "end_time": 10, "value": 1.0}, {"start_time": 590, "end_time": 600, "value": 1.0},
                           {"start_time": 200, "end_time": 210, "value": 0.3}]
        self.assertEqual(xpost.pick_start(info, self.words, cues=[]), 190.0)

    def test_a_chapter_about_the_story(self):
        info = {"duration": 1400, "chapters": [{"title": "Intro", "start_time": 0},
                                               {"title": "The Roadster flip", "start_time": 812}]}
        self.assertEqual(xpost.pick_start(info, self.words, cues=[]), 814.0)

    def test_captions_with_the_rarest_story_words(self):
        cues = [(t, "the roadster is great") for t in range(0, 900, 20)] + [(640, "now the thrusters fire"), (650, "a flip")]
        cues += [(t, "filler words") for t in range(1000, 36000, 5)]  # a ten-hour stream stays quick
        self.assertEqual(xpost.pick_start({"duration": 1000}, self.words, cues=sorted(cues)), 638.0)  # thrusters and flip both in view

    def test_otherwise_a_fifth_of_the_way_in(self):
        self.assertEqual(xpost.pick_start({"duration": 1000}, self.words, cues=[]), 200.0)
        self.assertEqual(xpost.pick_start({"duration": 90}, self.words, cues=[]), 18.0)


class FolderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        patcher = patch.object(xpost, "OUT_ROOT", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_files_page_and_latest_link(self):
        folder = self.root / "2026-10-16"
        folder.mkdir()
        (folder / "x-clip.mp4").write_bytes(b"\x00\x00\x00\x18ftypmp42video")
        clip = {"channel": "KBS News", "title": "Roadster <flip>", "official": False, "start": 34, "seconds": 30}
        page = xpost.write_folder(KIT, folder, clip)
        self.assertEqual((folder / "x-post.jpg").read_bytes(), b"\xff\xd8jpeg")
        self.assertIn("--- reply ---", (folder / "post.txt").read_text())
        text = page.read_text()
        self.assertIn("&lt;b&gt;upside down&lt;/b&gt;", text)
        self.assertNotIn("<b>upside", text)
        # The clip and the image are inside the page, with buttons: no folder needed.
        self.assertIn('<video id="clip"', text)
        self.assertIn(base64.b64encode(b"\x00\x00\x00\x18ftypmp42video").decode(), text)
        self.assertIn(KIT["image"]["base64"], text)
        for button in ("Copy post", "Download video", "Copy image", "Download image", "Copy reply"):
            self.assertIn(button, text)
        self.assertIn("x-clip-2026-10-16.mp4", text)
        self.assertIn("Roadster &lt;flip&gt;", text)
        self.assertIn("The Verge, Engadget", text)
        self.assertIn("60/360 characters", text)
        self.assertIn("Video: KBS News", text)
        self.assertIn("Video: KBS News", (folder / "post.txt").read_text())
        self.assertEqual(text.count("https://"), 1)  # the only link is Trace's, in the reply
        self.assertEqual((self.root / "latest").resolve(), folder.resolve())
        # The day keeps its own copy, clip and all.
        day_page = (folder / "index.html").read_text()
        self.assertIn(base64.b64encode(b"\x00\x00\x00\x18ftypmp42video").decode(), day_page)
        self.assertIn("Download video", day_page)
        xpost.write_folder(KIT, folder, None)  # a second run replaces the link
        self.assertNotIn("<video", page.read_text())
        self.assertIn('const CLIP = ""', page.read_text())

    def test_someone_elses_footage_is_credited_in_the_reply(self):
        clip = {"channel": "KBS News", "title": "t", "official": False, "start": 0, "seconds": 30}
        self.assertTrue(xpost.reply_text(KIT, clip).endswith("\n\nVideo: KBS News"))
        self.assertEqual(xpost.reply_text(KIT, {**clip, "official": True}), KIT["reply"])
        self.assertEqual(xpost.reply_text(KIT, None), KIT["reply"])

    def test_no_media_at_all(self):
        folder = self.root / "d"
        folder.mkdir()
        page = xpost.write_folder({**KIT, "image": None}, folder, None)
        self.assertIn("No clip or image today", page.read_text())

    def test_one_page_to_bookmark(self):
        for day, line in (("2026-10-14", "Older story"), ("2026-10-15", "Yesterday's <story>")):
            (self.root / day).mkdir()
            (self.root / day / "index.html").write_text("old page")
            (self.root / day / "post.txt").write_text(f"Biggest updates:\n\n- {line}\n- Second\n\n--- reply ---\nlink\n")
        (self.root / "2026-10-13").mkdir()  # a run that never finished: not listed
        (self.root / "2026-10-12").mkdir()
        (self.root / "2026-10-12" / "index.html").write_text("old page")
        (self.root / "2026-10-12" / "post.txt").write_bytes(b"- caf\xe9 \xff")  # not UTF-8: listed, not fatal
        (self.root / "2026-12-31").mkdir()  # a stray folder from the future doesn't freeze the page
        folder = self.root / "2026-10-16"
        folder.mkdir()
        page = xpost.write_folder(KIT, folder, None)
        self.assertEqual(page, self.root / "index.html")
        home = page.read_text()
        self.assertIn("<title>Trace · today's post</title>", home)  # what a bookmark is called
        self.assertIn("Copy post", home)
        self.assertIn('href="2026-10-12/index.html"', home)
        self.assertIn('id="stale" hidden', home)
        self.assertIn('const DAY = "2026-10-16"', home)
        # Newest first, each with its first story; the links stay inside the folder.
        self.assertLess(home.index('href="2026-10-15/index.html"'), home.index('href="2026-10-14/index.html"'))
        self.assertIn("Thursday, October 15</a>", home)
        self.assertIn("Yesterday&#x27;s &lt;story&gt;", home)
        self.assertNotIn("2026-10-13", home)
        self.assertNotIn('href="2026-10-16', home)
        self.assertFalse((self.root / ".index.html.tmp").exists())
        # The day's own copy has no list and no date check.
        day_page = (folder / "index.html").read_text()
        self.assertNotIn("Earlier days", day_page)
        self.assertNotIn("LOADED_ON", day_page)
        self.assertIn("<title>Post · 2026-10-16</title>", day_page)
        self.assertEqual((self.root / "latest").resolve(), folder.resolve())

    def test_an_older_day_by_hand_leaves_the_bookmarked_page(self):
        (self.root / "2026-10-17").mkdir()
        (self.root / "2026-10-17" / "index.html").write_text("the 17th's own page")
        (self.root / "index.html").write_text("the 17th")
        folder = self.root / "2026-10-16"
        folder.mkdir()
        page = xpost.write_folder(KIT, folder, None)
        self.assertEqual(page, folder / "index.html")
        self.assertEqual((self.root / "index.html").read_text(), "the 17th")
        self.assertFalse((self.root / "latest").exists())

    def test_a_broken_bookmarked_page_still_leaves_the_day(self):
        folder = self.root / "2026-10-16"
        folder.mkdir()
        with patch.object(xpost, "write_home", side_effect=PermissionError("read-only")):
            page = xpost.write_folder(KIT, folder, None)
        self.assertEqual(page, folder / "index.html")
        self.assertIn("Copy post", page.read_text())

    def test_dates_are_whole_strings(self):
        self.assertTrue(xpost.DATE.match("2026-10-19"))
        self.assertFalse(xpost.DATE.match("2026-10-19\n"))


class RunTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        for p in (patch.object(xpost, "OUT_ROOT", root / "posts"), patch.object(xpost, "STATE_DIR", root),
                  patch.object(xpost, "STATE", root / "state"), patch.object(xpost, "LOCK", root / "run.lock"),
                  patch.object(xpost, "log")):
            p.start()
            self.addCleanup(p.stop)

    def run_at(self, hour, argv=(), kit=KIT):
        fake_now = MagicMock(wraps=datetime)
        local = datetime(2026, 10, 16, hour, 5)
        # India is 4.5 hours ahead of London in October: its date turns over at 19:30 here.
        fake_now.now.side_effect = lambda tz=None: local if tz is None else (local + __import__("datetime").timedelta(hours=4, minutes=30))
        with patch.object(xpost, "datetime", fake_now), patch("sys.argv", ["trace_xpost.py", *argv]), \
                patch.object(xpost, "server_reachable", return_value=True), \
                patch.object(xpost, "fetch_kit", return_value=kit) as fetch, patch.object(xpost, "upgrade_yt_dlp"), \
                patch.object(xpost, "clip_for", return_value=None), patch.object(xpost, "notify") as notify:
            code = xpost.main()
        return code, fetch, notify

    def test_once_a_day_after_five(self):
        code, fetch, _ = self.run_at(4)
        self.assertEqual(code, 0)
        fetch.assert_not_called()
        code, fetch, notify = self.run_at(9)
        self.assertEqual(code, 0)
        fetch.assert_called_once_with(fresh=False, day="2026-10-16")  # only today's post, nothing early
        self.assertEqual(notify.call_args.args[1], "Tesla's Roadster flew <b>upside down</b>")
        self.assertEqual(xpost.STATE.read_text(), "2026-10-16")
        code, fetch, _ = self.run_at(10)
        fetch.assert_not_called()
        code, fetch, _ = self.run_at(10, ["--fresh"])
        fetch.assert_called_once_with(fresh=True, day="")

    def test_not_before_the_feed_reaches_today(self):
        # The server answers --day with no post while its feed is still on another day.
        code, fetch, notify = self.run_at(9, kit={"date": "2026-10-15", "post": None, "final": False})
        self.assertEqual(code, 1)  # launchd tries again in 20 minutes
        notify.assert_not_called()
        self.assertFalse(xpost.STATE.exists())

    def test_not_in_the_evening_once_india_is_on_tomorrow(self):
        code, fetch, _ = self.run_at(21)
        self.assertEqual(code, 0)
        fetch.assert_not_called()

    def test_waits_for_the_model_post(self):
        code, _, notify = self.run_at(9, kit={**KIT, "final": False, "post": {**KIT["post"], "written_by": "template"}})
        self.assertEqual(code, 1)
        notify.assert_not_called()
        self.assertFalse(xpost.STATE.exists())

    def test_a_broken_notification_still_finishes_the_day(self):
        with patch.object(xpost, "notify", side_effect=TimeoutError):
            fake_now = MagicMock(wraps=datetime)
            fake_now.now.side_effect = lambda tz=None: datetime(2026, 10, 16, 9, 5)
            with patch.object(xpost, "datetime", fake_now), patch("sys.argv", ["trace_xpost.py"]), \
                    patch.object(xpost, "server_reachable", return_value=True), \
                    patch.object(xpost, "fetch_kit", return_value=KIT), patch.object(xpost, "upgrade_yt_dlp"), \
                    patch.object(xpost, "clip_for", return_value=None):
                self.assertEqual(xpost.main(), 0)
        self.assertEqual(xpost.STATE.read_text(), "2026-10-16")

    def test_one_run_at_a_time(self):
        import fcntl
        with open(xpost.LOCK, "a") as held:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
            code, fetch, _ = self.run_at(9)
        self.assertEqual(code, 0)
        fetch.assert_not_called()

    def test_a_slow_upgrade_is_not_fatal(self):
        with patch.object(xpost, "UPGRADED", xpost.STATE_DIR / "upgraded"), \
                patch.object(xpost.subprocess, "run", side_effect=xpost.subprocess.TimeoutExpired("pip", 300)):
            xpost.upgrade_yt_dlp()  # logs and carries on

    def test_bad_server_output(self):
        out = "POSTKIT_JSON " + json.dumps({"date": "../../etc", "post": {"text": "x"}})
        with patch.object(xpost.subprocess, "run", return_value=MagicMock(stdout=out, stderr="")):
            self.assertIsNone(xpost.fetch_kit())
        self.assertEqual(xpost.image_base64({"base64": "not base64!!\"; alert(1)"}), "")

    def test_yt_dlp_is_upgraded_weekly(self):
        ok = MagicMock(returncode=0)
        with patch.object(xpost, "UPGRADED", xpost.STATE_DIR / "upgraded"), \
                patch.object(xpost.subprocess, "run", return_value=ok) as run:
            xpost.upgrade_yt_dlp()
            xpost.upgrade_yt_dlp()  # done this week already
            self.assertEqual(run.call_count, 1)
            self.assertIn("yt-dlp[default]", run.call_args.args[0])
            xpost.upgrade_yt_dlp(now=__import__("time").time() + 8 * 24 * 3600)
            self.assertEqual(run.call_count, 2)

    def test_searches_from_here_when_the_server_found_no_videos(self):
        folder = Path(self.tmp.name)
        found = [{"url": "https://www.youtube.com/watch?v=b", "title": "Roadster flip", "channel": "KBS"}]
        with patch.object(xpost, "search_here", return_value=found) as search, \
                patch.object(xpost, "grab_clip", return_value={"channel": "KBS", "title": "t", "start": 0,
                                                              "seconds": 30, "official": False}) as grab:
            clip = xpost.clip_for({**KIT, "videos": [], "post": {**KIT["post"], "video_query": "Tesla Roadster"}}, folder)
        search.assert_called_once()
        self.assertEqual(grab.call_args.args[0]["url"], "https://www.youtube.com/watch?v=b")
        self.assertEqual(clip["channel"], "KBS")

    def test_a_failed_notifier_falls_back(self):
        with patch.object(xpost.shutil, "which", return_value="/opt/homebrew/bin/terminal-notifier"), \
                patch.object(xpost.subprocess, "run", side_effect=[MagicMock(returncode=1), MagicMock(returncode=0)]) as run:
            xpost.notify("Ready", 'Tesla "flew"', Path("/tmp/x/index.html"))
        self.assertEqual(run.call_args.args[0][0], "osascript")
        self.assertIn('\\"flew\\"', run.call_args.args[0][2])
        # macOS's own notification can't open the page, so it says where it is.
        self.assertIn('subtitle "Open /tmp/x/index.html"', run.call_args.args[0][2])
        with patch.object(xpost.shutil, "which", return_value=None), \
                patch.object(xpost.subprocess, "run", return_value=MagicMock(returncode=0)) as run:
            xpost.notify("Ready", "Tesla", xpost.HOME / "x-posts" / "index.html")
        self.assertIn('subtitle "Open ~/x-posts/index.html"', run.call_args.args[0][2])

    def test_no_post_means_try_again_later(self):
        code, _, notify = self.run_at(9, kit=None)
        self.assertEqual(code, 1)
        notify.assert_not_called()
        self.assertFalse(xpost.STATE.exists())

    def test_reads_the_one_json_line(self):
        out = "log line\nPOSTKIT_JSON " + json.dumps({"date": "2026-10-16", "post": None}) + "\n"
        with patch.object(xpost.subprocess, "run", return_value=MagicMock(stdout=out, stderr="")) as run:
            self.assertEqual(xpost.fetch_kit(fresh=True), {"date": "2026-10-16", "post": None})
        self.assertTrue(run.call_args.args[0][-1].endswith("--json --fresh"))
        with patch.object(xpost.subprocess, "run", return_value=MagicMock(stdout=out, stderr="")) as run:
            xpost.fetch_kit(day="2026-10-16")
        self.assertTrue(run.call_args.args[0][-1].endswith("--json --day 2026-10-16"))
        with patch.object(xpost.subprocess, "run", return_value=MagicMock(stdout="Traceback", stderr="")):
            self.assertIsNone(xpost.fetch_kit())


if __name__ == "__main__":
    unittest.main()
