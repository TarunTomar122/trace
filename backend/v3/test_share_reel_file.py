import argparse
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

from v3.flows import share_reel_file as srf
from v3.test_post_instagram import FakeStore


class TikTokCarouselTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.slides = self.tmp / "tiktok"
        self.slides.mkdir()
        for i in range(1, 6):
            Image.new("RGB", (1080, 1920), (i * 40, 0, 0)).save(self.slides / f"{i:02d}.jpg")
        for name in ("reel.mp4", "cover.jpg"):
            (self.tmp / name).write_bytes(b"x")
        (self.tmp / "caption.txt").write_text("Instagram caption #yourtrace")
        (self.tmp / "tt.txt").write_text("TikTok caption #technews")
        self.store = FakeStore([])
        self.docs = self.store.db.data.setdefault(srf.COLLECTION, {})

    def args(self, **overrides):
        return argparse.Namespace(**{
            "slug": "2026-11-15-cybercab", "video": str(self.tmp / "reel.mp4"), "cover": str(self.tmp / "cover.jpg"),
            "caption_file": str(self.tmp / "caption.txt"), "title": "Tesla's Cybercab needs a $299 subscription",
            "url": "https://example.com", "tiktok_video": None, "cover_at": 0.5, "dry_run": False,
            "tiktok_slides": str(self.slides), "tiktok_caption_file": str(self.tmp / "tt.txt"), "tiktok_only": False,
            **overrides})

    def run_flow(self, **overrides):
        with patch.object(srf, "V3Store", return_value=self.store), \
                patch.object(srf, "host_reel", return_value=("https://m/reel.mp4", "https://m/cover.jpg")), \
                patch.object(srf, "instagram_channel", return_value="ig"), \
                patch.object(srf, "create_post", return_value="p1") as self.ig_post, \
                patch.object(srf, "wait_until_sent", return_value={"status": "sent", "externalLink": "https://ig/x"}), \
                patch.object(srf, "share_to_youtube") as self.youtube, \
                patch.object(srf, "host_slides", side_effect=lambda s, f: [f"https://m/{f}/{i:02d}.jpg" for i in range(1, len(s) + 1)]) as self.host, \
                patch.object(srf, "share_to_tiktok") as self.tiktok:
            return srf.run(self.args(**overrides))

    def test_the_story_goes_to_tiktok_as_a_photo_carousel(self):
        self.assertEqual(self.run_flow(), 0)
        self.ig_post.assert_called_once()
        self.youtube.assert_called_once()
        ref, caption, assets, title = self.tiktok.call_args.args
        self.assertEqual(caption, "TikTok caption #technews")
        self.assertEqual(len(assets), 5)
        self.assertEqual(assets[0], {"image": {"url": "https://m/reels/2026-11-15-cybercab/tiktok-slides/01.jpg"}})
        self.assertFalse(self.tiktok.call_args.kwargs["ai_generated"])
        doc = self.docs["2026-11-15-cybercab"]
        self.assertEqual((len(doc["tiktok_slide_urls"]), doc["tiktok_caption"]), (5, "TikTok caption #technews"))

    def test_a_rerun_of_a_posted_reel_only_adds_the_carousel(self):
        self.docs["2026-11-15-cybercab"] = {"buffer_post_id": "p0", "status": "sent", "video_url": "https://m/reel.mp4",
                                            "caption": "Instagram caption", "cover_ms": 500}
        self.assertEqual(self.run_flow(), 0)
        self.ig_post.assert_not_called()
        self.tiktok.assert_called_once()
        self.host.assert_called_once()

    def test_a_retry_hosts_the_new_slides_not_the_old_ones(self):
        self.docs["2026-11-15-cybercab"] = {"buffer_post_id": "p0", "status": "sent", "video_url": "https://m/reel.mp4",
                                            "caption": "c", "tiktok_slide_urls": ["https://m/old.jpg"], "tiktok_status": "error"}
        self.assertEqual(self.run_flow(tiktok_only=True), 0)
        assets = self.tiktok.call_args.args[2]
        self.assertEqual(len(assets), 5)
        self.assertNotIn("old.jpg", assets[0]["image"]["url"])
        self.youtube.assert_not_called()  # --tiktok-only

    def test_tiktok_only_never_posts_a_reel_that_is_not_out(self):
        self.assertEqual(self.run_flow(tiktok_only=True), 1)
        self.ig_post.assert_not_called()
        self.tiktok.assert_not_called()

    def test_a_hosting_failure_never_fails_the_reel(self):
        with patch.object(srf, "host_slides", side_effect=RuntimeError("slide not served")):
            with patch.object(srf, "V3Store", return_value=self.store), \
                    patch.object(srf, "host_reel", return_value=("https://m/reel.mp4", "https://m/cover.jpg")), \
                    patch.object(srf, "instagram_channel", return_value="ig"), \
                    patch.object(srf, "create_post", return_value="p1"), \
                    patch.object(srf, "wait_until_sent", return_value={"status": "sent", "externalLink": "x"}), \
                    patch.object(srf, "share_to_youtube"), patch.object(srf, "share_to_tiktok") as tiktok:
                self.assertEqual(srf.run(self.args()), 0)
                tiktok.assert_not_called()

    def test_long_titles_are_cut_at_a_word(self):
        title = srf._title("word " * 30)
        self.assertTrue(len(title) <= 90 and title.endswith("word"))

    def test_without_slides_tiktok_gets_nothing(self):
        self.assertEqual(self.run_flow(tiktok_slides=None, tiktok_caption_file=None), 0)
        self.tiktok.assert_not_called()

    def test_bad_slide_sets_stop_before_posting(self):
        for f in list(self.slides.glob("*.jpg"))[2:]:
            f.unlink()
        self.assertEqual(self.run_flow(), 1)  # 2 slides: too few
        self.ig_post.assert_not_called()
        self.assertEqual(self.run_flow(tiktok_slides=str(self.tmp), tiktok_caption_file=None), 1)

    def test_a_dry_run_hosts_the_slides_but_posts_nothing(self):
        self.assertEqual(self.run_flow(dry_run=True), 0)
        self.host.assert_called_once()
        self.ig_post.assert_not_called()
        self.tiktok.assert_not_called()


if __name__ == "__main__":
    unittest.main()
