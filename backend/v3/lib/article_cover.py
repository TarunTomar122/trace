"""Cover image for a release-day X article, 1600x900, in Trace's night look.

Near-black #121110 with film grain, the release name in orange and the
headline in off-white, both in Satoshi Black, with a block cursor like the
launch film. Built with Pillow and the Instagram slides' assets and helpers.

Satoshi (Fontshare's free licence) may not be redistributed, so it is not in
the repo: put Satoshi-Black (.otf, .ttf or .woff2) in v3/assets/instagram/ or
point TRACE_KIT_FONT at it. Without it the headline falls back to Inter Bold.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from v3.lib.instagram_slides import ASSETS, _bold, _semibold, _wrap, without_missing_glyphs

W, H = 1600, 900
MARGIN = 110
NIGHT = (18, 17, 16)  # #121110
ORANGE = (247, 150, 58)  # #f7963a
PAPER = (242, 239, 233)  # #f2efe9
MUTED = (150, 144, 136)
SATOSHI_FILES = ("Satoshi-Black.otf", "Satoshi-Black.ttf", "Satoshi-Black.woff2")


@lru_cache(maxsize=1)
def satoshi_path() -> Path | None:
    """Satoshi Black if it is installed (TRACE_KIT_FONT, then the assets folder)."""
    candidates = [os.getenv("TRACE_KIT_FONT", "").strip()] + [str(ASSETS / name) for name in SATOSHI_FILES]
    for candidate in candidates:
        if not candidate or not Path(candidate).is_file():
            continue
        try:
            ImageFont.truetype(candidate, 40)
        except OSError:  # e.g. a Pillow built without WOFF2 support
            continue
        return Path(candidate)
    return None


def headline_font_name() -> str:
    return "Satoshi Black" if satoshi_path() else "Inter Bold (Satoshi not installed)"


@lru_cache(maxsize=None)
def _headline(size: int) -> ImageFont.FreeTypeFont:
    path = satoshi_path()
    return ImageFont.truetype(str(path), size) if path else _bold(size)


@lru_cache(maxsize=4096)
def _has_glyph(char: str) -> bool:
    font = _headline(40)
    return char.isspace() or bytes(font.getmask(char)) != bytes(font.getmask("\U0010fffd"))


def _drawable(text: str) -> bool:
    return all(_has_glyph(char) for char in text)


def _font_for(text: str, size: int) -> ImageFont.FreeTypeFont:
    """Satoshi when it has every character, else Inter Bold (wider coverage)."""
    return _headline(size) if _drawable(text) else _bold(size)


def _fit(text: str, width: int, sizes: range, max_lines: int) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    for size in sizes:
        font = _font_for(text, size)
        lines = _wrap(text, font, width)
        if len(lines) <= max_lines and all(font.getlength(line) <= width for line in lines):
            return font, lines
    font = _font_for(text, sizes[-1])
    lines = _wrap(text, font, width)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while lines[-1] and font.getlength(lines[-1] + "…") > width:
            lines[-1] = lines[-1].rsplit(" ", 1)[0] if " " in lines[-1] else lines[-1][:-1]
        lines[-1] = lines[-1].rstrip(" ,.:;") + "…"
    return font, lines


def _grain(image: Image.Image, strength: float = 0.22, seed_sigma: int = 48) -> Image.Image:
    """Film grain: noise centred on zero, added and subtracted so the black stays black-ish."""
    noise = Image.effect_noise(image.size, seed_sigma)
    light = noise.point(lambda v: max(0, v - 128) * strength).convert("RGB")
    dark = noise.point(lambda v: max(0, 128 - v) * strength).convert("RGB")
    return ImageChops.subtract(ImageChops.add(image, light), dark)


def _logo_tile(size: int = 64) -> Image.Image:
    logo = Image.open(ASSETS / "trace-logo.png").convert("RGBA").resize((size - 14, size - 14), Image.LANCZOS)
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, size - 1, size - 1), radius=15, fill=(*PAPER, 255))
    tile.alpha_composite(logo, (7, 7))
    return tile


def render_cover(kicker: str, headline: str, date_label: str = "") -> Image.Image:
    """The cover: kicker (the release's name) in orange, headline in off-white."""
    slide = Image.new("RGB", (W, H), NIGHT)
    # A faint warm glow on the right keeps the black from looking flat.
    glow = Image.new("L", (W // 8, H // 8), 0)
    ImageDraw.Draw(glow).ellipse((W // 8 - 80, -30, W // 8 + 60, H // 8 + 30), fill=30)
    glow = glow.filter(ImageFilter.GaussianBlur(28)).resize((W, H), Image.BICUBIC)
    slide = Image.composite(Image.new("RGB", (W, H), ORANGE), slide, glow)
    draw = ImageDraw.Draw(slide)
    width = W - 2 * MARGIN

    slide.paste(_logo_tile(), (MARGIN, 84), _logo_tile())
    draw.text((MARGIN + 84, 116), "Trace", font=_bold(36), anchor="lm", fill=PAPER)
    if date_label:
        draw.text((W - MARGIN, 116), date_label.upper(), font=_semibold(26), anchor="rm", fill=MUTED)

    # No "missing glyph" boxes: drop what even Inter can't draw (emoji, CJK).
    kicker = without_missing_glyphs(kicker.upper()) or "OUT TODAY"
    headline = without_missing_glyphs(headline)
    k_font, k_lines = _fit(kicker, width, range(120, 71, -6), max_lines=1)
    h_font, h_lines = _fit(headline, width - 40, range(112, 63, -4), max_lines=3)
    k_step, h_step = round(k_font.size * 0.98), round(h_font.size * 1.02)
    block = k_step * len(k_lines) + 18 + h_step * len(h_lines)
    y = max(220, (H - block) // 2 + 20)
    for line in k_lines:
        draw.text((MARGIN, y + k_font.size), line, font=k_font, anchor="ls", fill=ORANGE)
        y += k_step
    y += 18
    for i, line in enumerate(h_lines):
        draw.text((MARGIN, y + h_font.size), line, font=h_font, anchor="ls", fill=PAPER)
        if i == len(h_lines) - 1:
            # The launch film's solid block cursor after the last word.
            x = MARGIN + round(h_font.getlength(line)) + round(h_font.size * 0.16)
            draw.rectangle((x, y + round(h_font.size * 0.2), x + max(8, h_font.size // 12), y + h_font.size), fill=PAPER)
        y += h_step

    draw.text((MARGIN, H - 86), "yourtrace.online", font=_semibold(28), anchor="ls", fill=MUTED)
    draw.text((W - MARGIN, H - 86), "Free daily brief", font=_semibold(28), anchor="rs", fill=MUTED)
    return _grain(slide)
