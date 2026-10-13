"""Render Instagram carousel slides for Trace stories.

Two slides per story, 1080x1350 (4:5) JPEG, sized like the old studio's:
- photo: the story image full bleed, fading to black, the headline in white.
- story: a plain background, the headline small, the story's first
  paragraphs as the feed splits them.

Both carry the Trace logo, an "n/N" counter and "read full story at
yourtrace.online". The story slide's palette varies from post to post;
every palette keeps strong contrast so the text reads on a phone.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 1080, 1350
MARGIN = 80
ASSETS = Path(__file__).resolve().parent.parent / "assets" / "instagram"
FOOTER = "read full story at yourtrace.online"
USER_AGENT = "Mozilla/5.0 (compatible; TraceBot/1.0; +https://yourtrace.online)"
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
# The story slide's text block: between the logo row and the footer.
STORY_TOP, STORY_BOTTOM, LABEL_GAP = 210, H - 180, 60
KICKER = (249, 24, 128)  # the brief's "Top in X" pink

RGB = tuple[int, int, int]


@dataclass(frozen=True)
class Palette:
    name: str
    background: RGB
    text: RGB
    label: RGB
    badge: RGB
    muted: RGB


PALETTES = (
    # The original look: warm paper, near-black text.
    Palette("paper", (250, 250, 249), (17, 24, 39), (120, 113, 108), (234, 234, 231), (120, 113, 108)),
    Palette("ink", (17, 17, 17), (245, 245, 244), (168, 162, 158), (245, 245, 244), (168, 162, 158)),
    Palette("navy", (12, 27, 51), (241, 245, 249), (148, 170, 199), (241, 245, 249), (148, 170, 199)),
)


@dataclass
class SlideStory:
    headline: str
    paragraphs: list[str]
    image: Image.Image
    kicker: str = ""  # "Top in AI", above the headline on the photo slide


@lru_cache(maxsize=None)
def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ASSETS / name), size)


def _bold(size: int) -> ImageFont.FreeTypeFont:
    return _font("Inter-Bold.ttf", size)


def _semibold(size: int) -> ImageFont.FreeTypeFont:
    return _font("Inter-SemiBold.ttf", size)


def _serif(size: int) -> ImageFont.FreeTypeFont:
    return _font("DMSerifDisplay-Regular.ttf", size)


@lru_cache(maxsize=1)
def _logo() -> Image.Image:
    return Image.open(ASSETS / "trace-logo.png").convert("RGBA").resize((42, 42), Image.LANCZOS)


def fetch_image(url: str, timeout: int = 20, min_side: int = 400) -> Image.Image | None:
    """Download a story image, or None when it is missing, broken, tiny or huge."""
    if not url.startswith(("http://", "https://")):
        return None
    try:
        response = requests.get(url, timeout=timeout, headers={"User-Agent": USER_AGENT}, stream=True)
        response.raise_for_status()
        data = response.raw.read(MAX_IMAGE_BYTES + 1, decode_content=True)
        if len(data) > MAX_IMAGE_BYTES:
            return None
        image = Image.open(io.BytesIO(data))
        # Check the header before decoding: a small file can unpack to gigabytes.
        # 16-bit and float images turn white when converted, so skip those too.
        if image.width * image.height > MAX_IMAGE_PIXELS or image.mode in {"I", "I;16", "I;16B", "I;16L", "F"}:
            return None
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((2400, 2400))
    except Exception:
        return None
    return image if min(image.size) >= min_side else None


@lru_cache(maxsize=1)
def _missing_glyph() -> bytes:
    # A supplementary private-use code point no font maps: draws the "no glyph" box.
    return bytes(_bold(40).getmask("\U0010fffd"))


@lru_cache(maxsize=4096)
def _has_glyph(char: str) -> bool:
    return char.isspace() or bytes(_bold(40).getmask(char)) != _missing_glyph()


def drawable(text: str) -> bool:
    """Whether Inter has every character (no emoji, CJK or Arabic boxes)."""
    return all(_has_glyph(char) for char in text)


def without_missing_glyphs(text: str) -> str:
    """Drop characters Inter can't draw, such as an emoji in a headline."""
    return " ".join("".join(char for char in text if _has_glyph(char)).split())


def _wrap(text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if line and font.getlength(candidate) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def _fit(text: str, width: int, sizes: range, max_lines: int) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """Largest size whose wrap fits in max_lines; the smallest size otherwise."""
    for size in sizes:
        font = _bold(size)
        lines = _wrap(text, font, width)
        if len(lines) <= max_lines and all(font.getlength(line) <= width for line in lines):
            return font, lines
    font = _bold(sizes[-1])
    return font, _wrap(text, font, width)


def _cover(image: Image.Image) -> Image.Image:
    """The photo filling the slide above the headline, on black.

    The bottom fifth is solid black under the fade anyway, so the photo only
    has to cover the top 80%: a wide 1200x630 article image keeps more of its
    width. Cropping keeps a little more of the top than the bottom.
    """
    area_h = round(H * 0.8)
    scale = max(W / image.width, area_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = (resized.width - W) // 2
    top = round((resized.height - area_h) * 0.4)
    slide = Image.new("RGB", (W, H), (0, 0, 0))
    slide.paste(resized.crop((left, top, left + W, top + area_h)), (0, 0))
    return slide


def _ramp(stops: list[tuple[float, int]]) -> Image.Image:
    """Full-slide alpha mask that steps through (position, alpha) stops."""
    column = Image.new("L", (1, H))
    for y in range(H):
        t = y / (H - 1)
        alpha = stops[-1][1]
        for (p0, a0), (p1, a1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                alpha = a0 + (a1 - a0) * (t - p0) / (p1 - p0)
                break
        column.putpixel((0, y), round(alpha))
    return column.resize((W, H))


def _chrome(
    slide: Image.Image, index: int, total: int, badge: RGB, muted: tuple[int, ...], on_photo: bool = False
) -> None:
    """Logo badge top-left, counter top-right, footer bottom-left."""
    tile = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, 55, 55), radius=13, fill=(*badge, 245))
    tile.alpha_composite(_logo(), (7, 7))
    slide.alpha_composite(tile, (MARGIN - 6, 74))

    counter = f"{index}/{total}"
    font = _serif(24)
    if on_photo:
        # A dark pill, so the counter reads on bright photos too.
        width = round(font.getlength(counter)) + 32
        pill = Image.new("RGBA", (width, 44), (0, 0, 0, 0))
        ImageDraw.Draw(pill).rounded_rectangle((0, 0, width - 1, 43), radius=22, fill=(0, 0, 0, 110))
        slide.alpha_composite(pill, (W - MARGIN + 16 - width, 80))
    draw = ImageDraw.Draw(slide)
    draw.text((W - MARGIN, 102), counter, font=font, anchor="rm", fill=muted)
    draw.text((MARGIN, H - 92), FOOTER, font=_serif(26), anchor="ls", fill=muted)


def render_photo_slide(story: SlideStory, index: int, total: int) -> Image.Image:
    slide = _cover(story.image).convert("RGBA")
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    # A light veil behind the logo, then solid black under the headline.
    shade.putalpha(_ramp([(0.0, 110), (0.15, 0), (0.5, 0), (0.62, 150), (0.78, 255), (1.0, 255)]))
    slide.alpha_composite(shade)

    font, lines = _fit(story.headline, W - 2 * MARGIN, range(84, 55, -4), max_lines=3)
    line_height = round(font.size * 1.12)
    draw = ImageDraw.Draw(slide)
    baseline = H - 160 - line_height * (len(lines) - 1)
    if story.kicker:
        draw.text((MARGIN, baseline - font.size - 26), story.kicker, font=_bold(32), anchor="ls", fill=(*KICKER, 255))
    for line in lines:
        draw.text((MARGIN, baseline), line, font=font, anchor="ls", fill=(255, 255, 255, 255))
        baseline += line_height

    _chrome(slide, index, total, badge=(255, 255, 255), muted=(255, 255, 255, 225), on_photo=True)
    return slide.convert("RGB")


def _story_layout(paragraphs: list[str], size: int, width: int) -> tuple[list[list[str]], int]:
    wrapped = [_wrap(p, _bold(size) if i == 0 else _semibold(size), width) for i, p in enumerate(paragraphs)]
    step, gap = round(size * 1.34), round(size * 0.85)
    return wrapped, sum(len(lines) for lines in wrapped) * step + gap * (len(wrapped) - 1)


def fits_story_slide(paragraphs: list[str]) -> bool:
    """Whether at least the first paragraph fits the story slide at the smallest
    size, under a two-line label, with no word wider than the slide."""
    if not paragraphs:
        return False
    width = W - 2 * MARGIN
    room = STORY_BOTTOM - STORY_TOP - 2 * round(30 * 1.3) - LABEL_GAP
    [lines], height = _story_layout(paragraphs[:1], 34, width)
    return height <= room and all(_bold(34).getlength(line) <= width for line in lines)


def render_story_slide(story: SlideStory, index: int, total: int, palette: Palette = PALETTES[0]) -> Image.Image:
    """The headline small, then the story's first paragraphs, the lede in bold.

    Whole paragraphs only: if all of them don't fit at a readable size, the
    last ones are left for the full story in the app.
    """
    slide = Image.new("RGBA", (W, H), (*palette.background, 255))
    draw = ImageDraw.Draw(slide)

    label_font, label_lines = _fit(story.headline, W - 2 * MARGIN, range(36, 29, -2), max_lines=2)
    label_step = round(label_font.size * 1.3)
    width = W - 2 * MARGIN
    top, bottom = STORY_TOP, STORY_BOTTOM
    room = bottom - top - label_step * len(label_lines) - LABEL_GAP

    paragraphs, size, wrapped, height = story.paragraphs, 34, [], 0
    for count in range(len(story.paragraphs), 0, -1):
        paragraphs = story.paragraphs[:count]
        for size in range(46, 33, -2):
            wrapped, height = _story_layout(paragraphs, size, width)
            if height <= room:
                break
        if height <= room:
            break

    y = top + max(0, (room - height) // 2)
    for line in label_lines:
        draw.text((MARGIN, y + label_font.size), line, font=label_font, anchor="ls", fill=(*palette.label, 255))
        y += label_step
    y += LABEL_GAP
    step, gap = round(size * 1.34), round(size * 0.85)
    for i, lines in enumerate(wrapped):
        font = _bold(size) if i == 0 else _semibold(size)
        for line in lines:
            draw.text((MARGIN, y + size), line, font=font, anchor="ls", fill=(*palette.text, 255))
            y += step
        y += gap

    _chrome(slide, index, total, badge=palette.badge, muted=(*palette.muted, 255))
    return slide.convert("RGB")


def render_carousel(stories: list[SlideStory], palette: Palette = PALETTES[0]) -> list[Image.Image]:
    """Photo then story text for each story, numbered across the whole post."""
    total = len(stories) * 2
    slides: list[Image.Image] = []
    for i, story in enumerate(stories):
        slides.append(render_photo_slide(story, 2 * i + 1, total))
        slides.append(render_story_slide(story, 2 * i + 2, total, palette))
    return slides
