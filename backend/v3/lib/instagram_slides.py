"""Render Instagram carousel slides for Trace stories, in the site's look.

1080x1350 (4:5) JPEG slides, drawn like yourtrace.online after its redesign:
the display serif for headlines, a highlighter mark behind section labels,
plain backgrounds, rounded photos.

- cover: "4 big things this morning" and the post's headlines, first.
- photo: the "Top in X" label, the headline large, the story photo below.
- story: the label and headline small, then the story's first paragraphs as
  the feed splits them, and its source.

Every slide carries the wordmark ("Trace", then the logo) and an "n/N"
counter. A post uses one theme throughout (see theme_for): one of three light
ones in the morning, rotating by day, and the dark one in the evening.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from datetime import date as Date
from functools import lru_cache
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 1080, 1350
MARGIN = 80
ASSETS = Path(__file__).resolve().parent.parent / "assets" / "instagram"
FOOTER = "Read the full story at yourtrace.online"
USER_AGENT = "Mozilla/5.0 (compatible; TraceBot/1.0; +https://yourtrace.online)"
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
# Vertical layout: the wordmark row, where content starts, and where it must
# stop so the footer (and the story slide's source line) stay clear.
TOP_ROW_Y, CONTENT_TOP, CONTENT_BOTTOM = 86, 190, H - 150
FOOTER_BASELINE = H - 64

RGB = tuple[int, int, int]


@dataclass(frozen=True)
class Theme:
    name: str
    background: RGB
    ink: RGB  # headlines and the wordmark
    text: RGB  # story paragraphs
    muted: RGB  # counter, footer, dates, numbers
    line: RGB  # rules between items
    mark: RGB = (255, 239, 95)  # the site's highlighter behind labels
    mark_ink: RGB = (10, 10, 10)
    dark: bool = False  # the logo is drawn light


THEMES = (
    Theme("paper", (255, 255, 255), (10, 10, 10), (50, 50, 50), (118, 118, 118), (229, 229, 229)),
    Theme("lavender", (237, 239, 253), (10, 10, 10), (47, 50, 64), (95, 100, 128), (213, 217, 245)),
    Theme("sky", (227, 247, 252), (8, 65, 79), (31, 74, 85), (70, 110, 120), (195, 233, 242), mark_ink=(8, 65, 79)),
    Theme("ink", (11, 11, 12), (255, 255, 255), (212, 212, 212), (154, 154, 154), (42, 42, 44), dark=True),
)
MORNING_THEMES = THEMES[:3]
EVENING_THEME = THEMES[3]
# The old name, kept for callers and records that still say "palette".
PALETTES = THEMES


def theme_for(date: str, slot: str) -> Theme:
    """Evening posts are always dark; morning posts rotate the light themes by day.

    TikTok's extra carousels: t1 (early afternoon) takes the next light theme
    after the morning's, t2 (late afternoon) is dark.
    """
    if slot in ("pm", "t2"):
        return EVENING_THEME
    try:
        day = Date.fromisoformat(date).toordinal()
    except ValueError:
        day = 0
    return MORNING_THEMES[(day + (slot == "t1")) % len(MORNING_THEMES)]


@dataclass
class SlideStory:
    headline: str
    paragraphs: list[str]
    image: Image.Image
    kicker: str = ""  # "Top in AI", above the headline
    source: str = ""  # the lead outlet, under the story text
    source_count: int = 1


@dataclass
class Cover:
    """The first slide: what this post holds."""
    date_label: str  # "Tuesday, October 20"
    when: str  # "morning" or "evening"
    headlines: list[str] = field(default_factory=list)


@lru_cache(maxsize=None)
def _font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ASSETS / name), size)


def _serif(size: int) -> ImageFont.FreeTypeFont:
    return _font("RobotoSerif-Display-500.ttf", size)


def _serif_bold(size: int) -> ImageFont.FreeTypeFont:
    return _font("RobotoSerif-Display-700.ttf", size)


def _sans(size: int) -> ImageFont.FreeTypeFont:
    return _font("Inter-Regular.ttf", size)


def _sans_semibold(size: int) -> ImageFont.FreeTypeFont:
    return _font("Inter-SemiBold.ttf", size)


def _hand(size: int) -> ImageFont.FreeTypeFont:
    return _font("Caveat-SemiBold.ttf", size)


@lru_cache(maxsize=2)
def _logo(dark: bool) -> Image.Image:
    logo = Image.open(ASSETS / "trace-logo.png").convert("RGBA").resize((42, 42), Image.LANCZOS)
    if dark:
        # Line art on transparency: flip the colour, keep the shape.
        rgb = ImageOps.invert(logo.convert("RGB"))
        rgb.putalpha(logo.getchannel("A"))
        logo = rgb
    return logo


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


# Headlines are drawn in the serif and story text in Inter: a character must
# exist in both, or it would show as a "no glyph" box.
_GLYPH_FONTS = ("RobotoSerif-Display-500.ttf", "Inter-Regular.ttf")


@lru_cache(maxsize=None)
def _missing_glyph(name: str) -> bytes:
    # A supplementary private-use code point no font maps: draws the "no glyph" box.
    return bytes(_font(name, 40).getmask("\U0010fffd"))


@lru_cache(maxsize=4096)
def _has_glyph(char: str) -> bool:
    return char.isspace() or all(bytes(_font(n, 40).getmask(char)) != _missing_glyph(n) for n in _GLYPH_FONTS)


def drawable(text: str) -> bool:
    """Whether the slide fonts have every character (no emoji, CJK or Arabic boxes)."""
    return all(_has_glyph(char) for char in text)


def without_missing_glyphs(text: str) -> str:
    """Drop characters the slide fonts can't draw, such as an emoji in a headline."""
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


def _fit(
    text: str, width: int, sizes: range, max_lines: int, face=_serif
) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    """Largest size whose wrap fits in max_lines; the smallest size otherwise."""
    for size in sizes:
        font = face(size)
        lines = _wrap(text, font, width)
        if len(lines) <= max_lines and all(font.getlength(line) <= width for line in lines):
            return font, lines
    font = face(sizes[-1])
    return font, _wrap(text, font, width)


def _canvas(theme: Theme) -> Image.Image:
    return Image.new("RGBA", (W, H), (*theme.background, 255))


def _top_row(slide: Image.Image, index: int, total: int, theme: Theme) -> None:
    """The wordmark ("Trace", then the logo) top-left and "n/N" top-right."""
    draw = ImageDraw.Draw(slide)
    word = _serif_bold(46)
    draw.text((MARGIN, TOP_ROW_Y), "Trace", font=word, anchor="lm", fill=(*theme.ink, 255))
    slide.alpha_composite(_logo(theme.dark), (MARGIN + round(word.getlength("Trace")) + 10, TOP_ROW_Y - 21))
    draw.text((W - MARGIN, TOP_ROW_Y), f"{index}/{total}", font=_sans(28), anchor="rm", fill=(*theme.muted, 255))


def _footer(slide: Image.Image, theme: Theme) -> None:
    ImageDraw.Draw(slide).text((MARGIN, FOOTER_BASELINE), FOOTER, font=_sans(28), anchor="ls", fill=(*theme.muted, 255))


def _mark(slide: Image.Image, text: str, x: int, y: int, size: int, theme: Theme) -> int:
    """A label on the highlighter, its top at y; returns the bottom."""
    font = _serif(size)
    height = round(size * 1.3)
    width = round(font.getlength(text))
    draw = ImageDraw.Draw(slide)
    draw.rectangle((x - 10, y, x + width + 10, y + height), fill=(*theme.mark, 255))
    draw.text((x, y + height // 2), text, font=font, anchor="lm", fill=(*theme.mark_ink, 255))
    return y + height


def _lines(slide: Image.Image, lines: list[str], font, x: int, y: int, step: int, fill: RGB) -> int:
    """Draw lines top-down from y (each line's box `step` tall); returns the bottom."""
    draw = ImageDraw.Draw(slide)
    for line in lines:
        draw.text((x, y + step // 2), line, font=font, anchor="lm", fill=(*fill, 255))
        y += step
    return y


def _rounded_photo(image: Image.Image, width: int, height: int, radius: int = 14) -> Image.Image:
    """The photo cropped to fill width x height (keeping a little more of the
    top than the bottom), with rounded corners."""
    scale = max(width / image.width, height / image.height)
    resized = image.resize((max(width, round(image.width * scale)), max(height, round(image.height * scale))), Image.LANCZOS)
    left = (resized.width - width) // 2
    top = round((resized.height - height) * 0.4)
    photo = resized.crop((left, top, left + width, top + height)).convert("RGBA")
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    photo.putalpha(mask)
    return photo


def render_cover(cover: Cover, total: int, theme: Theme) -> Image.Image:
    """The post's front page: the date, "N big things this morning", its headlines."""
    slide = _canvas(theme)
    _top_row(slide, 1, total, theme)
    draw = ImageDraw.Draw(slide)
    y = CONTENT_TOP + 10
    draw.text((MARGIN, y), cover.date_label, font=_sans(30), anchor="lt", fill=(*theme.muted, 255))
    y += 58

    size = 104
    step = round(size * 1.02)
    count = len(cover.headlines)
    first = f"{count} big {'thing' if count == 1 else 'things'}"
    head = _serif(size)
    draw.rectangle((MARGIN - 10, y, MARGIN + round(head.getlength(first)) + 10, y + step), fill=(*theme.mark, 255))
    y = _lines(slide, [first], head, MARGIN, y, step, theme.mark_ink)
    y = _lines(slide, [f"this {cover.when}"], head, MARGIN, y, step, theme.ink) + 46

    # The list: largest size at which every headline fits in two lines and the
    # whole list clears the swipe note.
    num_w, width = 74, W - 2 * MARGIN - 74
    for size in range(38, 27, -2):
        font = _sans(size)
        step = round(size * 1.3)
        wrapped = [_wrap(h, font, width)[:2] for h in cover.headlines]
        height = sum(len(w) * step + 34 for w in wrapped)
        if y + height <= CONTENT_BOTTOM - 40:
            break
    for i, lines in enumerate(wrapped):
        if i:
            draw.line((MARGIN, y, W - MARGIN, y), fill=(*theme.line, 255), width=2)
        y += 17
        draw.text((MARGIN, y + step // 2), str(i + 1), font=_serif(size + 4), anchor="lm", fill=(*theme.muted, 255))
        y = _lines(slide, lines, font, MARGIN + num_w, y, step, theme.ink) + 17

    _swipe_note(slide, theme)
    return slide.convert("RGB")


def _swipe_note(slide: Image.Image, theme: Theme) -> None:
    """A handwritten "swipe for the stories" and a drawn arrow, bottom right, tilted."""
    font = _hand(56)
    text = "swipe for the stories"
    text_w = round(font.getlength(text))
    note = Image.new("RGBA", (text_w + 110, 110), (0, 0, 0, 0))
    draw = ImageDraw.Draw(note)
    draw.text((0, 55), text, font=font, anchor="lm", fill=(*theme.ink, 255))
    # The arrow: a shaft and two strokes for the head, like the site's notes.
    x0, x1, y = text_w + 18, text_w + 92, 58
    ink = (*theme.ink, 255)
    draw.line((x0, y, x1, y - 4), fill=ink, width=5)
    draw.line((x1 - 20, y - 20, x1, y - 4), fill=ink, width=5)
    draw.line((x1 - 18, y + 12, x1, y - 4), fill=ink, width=5)
    note = note.rotate(4, resample=Image.BICUBIC, expand=True)
    slide.alpha_composite(note, (W - MARGIN - note.width + 10, H - 70 - note.height))


def render_photo_slide(story: SlideStory, index: int, total: int, theme: Theme = THEMES[0]) -> Image.Image:
    """The label, the headline large, then the photo filling the rest."""
    slide = _canvas(theme)
    _top_row(slide, index, total, theme)
    width = W - 2 * MARGIN
    y = CONTENT_TOP
    if story.kicker:
        y = _mark(slide, story.kicker, MARGIN, y, 44, theme) + 26
    # Leave the photo at least 360px: long headlines step down in size.
    for size in range(92, 59, -4):
        font, lines = _fit(story.headline, width, range(size, size - 1, -1), max_lines=4)
        step = round(size * 1.04)
        if len(lines) <= 4 and CONTENT_BOTTOM - (y + step * len(lines) + 48) >= 360:
            break
    y = _lines(slide, lines, font, MARGIN, y, step, theme.ink) + 48
    photo_h = max(300, CONTENT_BOTTOM - y)
    slide.alpha_composite(_rounded_photo(story.image, width, photo_h), (MARGIN, CONTENT_BOTTOM - photo_h))
    _footer(slide, theme)
    return slide.convert("RGB")


def _story_layout(paragraphs: list[str], size: int, width: int) -> tuple[list[list[str]], int]:
    wrapped = [_wrap(p, _sans(size), width) for p in paragraphs]
    step, gap = round(size * 1.45), round(size * 0.75)
    return wrapped, sum(len(lines) for lines in wrapped) * step + gap * (len(wrapped) - 1)


# The story slide's text area: under a label and up to three lines of headline,
# above the source line.
_STORY_TEXT_TOP = CONTENT_TOP + 10 + 50 + 24 + 3 * round(60 * 1.08) + 72
_STORY_TEXT_BOTTOM = CONTENT_BOTTOM - 70


def fits_story_slide(paragraphs: list[str]) -> bool:
    """Whether at least the first paragraph fits the story slide at the smallest
    size, under a full label and headline, with no word wider than the slide."""
    if not paragraphs:
        return False
    width = W - 2 * MARGIN
    [lines], height = _story_layout(paragraphs[:1], 32, width)
    return height <= _STORY_TEXT_BOTTOM - _STORY_TEXT_TOP and all(_sans(32).getlength(line) <= width for line in lines)


def render_story_slide(story: SlideStory, index: int, total: int, theme: Theme = THEMES[0]) -> Image.Image:
    """The label and headline small, a rule, then the story's first paragraphs.

    Whole paragraphs only: if all of them don't fit at a readable size, the
    last ones are left for the full story in the app.
    """
    slide = _canvas(theme)
    _top_row(slide, index, total, theme)
    draw = ImageDraw.Draw(slide)
    width = W - 2 * MARGIN
    y = CONTENT_TOP + 10
    if story.kicker:
        y = _mark(slide, story.kicker, MARGIN, y, 38, theme) + 24
    font, lines = _fit(story.headline, width, range(60, 45, -4), max_lines=3)
    y = _lines(slide, lines[:3], font, MARGIN, y, round(font.size * 1.08), theme.ink) + 36
    draw.line((MARGIN, y, W - MARGIN, y), fill=(*theme.line, 255), width=2)
    y += 38

    bottom = _STORY_TEXT_BOTTOM
    paragraphs, size, wrapped, height = story.paragraphs, 32, [], 0
    for count in range(len(story.paragraphs), 0, -1):
        paragraphs = story.paragraphs[:count]
        for size in range(42, 31, -2):
            wrapped, height = _story_layout(paragraphs, size, width)
            if y + height <= bottom:
                break
        if y + height <= bottom:
            break
    step, gap = round(size * 1.45), round(size * 0.75)
    for lines in wrapped:
        y = _lines(slide, lines, _sans(size), MARGIN, y, step, theme.text) + gap

    if story.source:
        source = _sans_semibold(30)
        draw.text((MARGIN, CONTENT_BOTTOM + 8), story.source, font=source, anchor="ls", fill=(*theme.ink, 255))
        if story.source_count > 1:
            draw.text((MARGIN + round(source.getlength(story.source)), CONTENT_BOTTOM + 8),
                      f" · {story.source_count} sources", font=_sans(30), anchor="ls", fill=(*theme.muted, 255))
    _footer(slide, theme)
    return slide.convert("RGB")


def render_carousel(
    stories: list[SlideStory], theme: Theme = THEMES[0], cover: Cover | None = None
) -> list[Image.Image]:
    """The cover (when given), then photo and story text for each story, numbered
    across the whole post, all in one theme."""
    first = 2 if cover else 1
    total = len(stories) * 2 + (1 if cover else 0)
    slides: list[Image.Image] = [render_cover(cover, total, theme)] if cover else []
    for i, story in enumerate(stories):
        slides.append(render_photo_slide(story, first + 2 * i, total, theme))
        slides.append(render_story_slide(story, first + 2 * i + 1, total, theme))
    return slides
