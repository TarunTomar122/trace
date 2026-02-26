#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
from typing import List

from PIL import Image, ImageDraw, ImageFont

def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = []
    if bold:
        candidates += [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
    else:
        candidates += [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Helvetica.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def cover_resize(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    src_w, src_h = image.size
    scale = max(target_w / src_w, target_h / src_h)
    resized = image.resize((int(src_w * scale), int(src_h * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> List[str]:
    words = text.split()
    lines: List[str] = []
    current = ""
    for word in words:
        test = word if not current else f"{current} {word}"
        if draw.textlength(test, font=font) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def make_vertical_gradient(width: int, height: int, top_alpha: int, bottom_alpha: int) -> Image.Image:
    gradient = Image.new("L", (1, height))
    for y in range(height):
        alpha = int(top_alpha + (bottom_alpha - top_alpha) * (y / max(1, height - 1)))
        gradient.putpixel((0, y), alpha)
    return gradient.resize((width, height))


def load_logo(root: Path) -> Image.Image | None:
    candidates = [
        root / "assets/tc.png",
        root.parent / "trace/assets/images/trace-logo.png",
        root.parent / "frontend/public/trace.png",
    ]
    for path in candidates:
        if path.exists():
            try:
                return Image.open(path).convert("RGBA")
            except OSError:
                continue
    return None


def rounded_logo(logo: Image.Image, size: int, radius: int) -> Image.Image:
    logo_resized = logo.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    logo_resized.putalpha(mask)
    return logo_resized


def render_story(story_path: Path, bg_path: Path, output_dir: Path, width: int, height: int) -> None:
    with story_path.open("r", encoding="utf-8") as f:
        story = json.load(f)

    bg = Image.open(bg_path).convert("RGB")
    canvas = cover_resize(bg, width, height).convert("RGBA")

    # Darken base image slightly to improve text contrast.
    tint = Image.new("RGBA", (width, height), (0, 0, 0, 70))
    canvas = Image.alpha_composite(canvas, tint)

    # Stronger lower gradient for headline area.
    gradient_mask = make_vertical_gradient(width, height, top_alpha=0, bottom_alpha=220)
    lower_overlay = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    lower_overlay.putalpha(gradient_mask)
    canvas = Image.alpha_composite(canvas, lower_overlay)

    draw = ImageDraw.Draw(canvas)

    scale = height / 1920.0
    font_tag = load_font(max(22, int(46 * scale)), bold=False)
    font_headline = load_font(max(46, int(90 * scale)), bold=True)
    font_brand = load_font(max(24, int(44 * scale)), bold=True)

    margin_x = max(28, int(64 * scale))
    margin_top = max(28, int(52 * scale))

    # Brand lockup: logo + TRACE text.
    logo = load_logo(story_path.parent.parent)
    logo_size = max(40, int(80 * scale))
    text_x = margin_x
    if logo is not None:
        logo_radius = max(8, int(14 * scale))
        logo_resized = rounded_logo(logo, logo_size, logo_radius)
        canvas.alpha_composite(logo_resized, (margin_x, margin_top))
        text_x = margin_x + logo_size + max(10, int(16 * scale))
    brand_text = "TRACE"
    text_bbox = draw.textbbox((0, 0), brand_text, font=font_brand)
    text_h = text_bbox[3] - text_bbox[1]
    text_y = margin_top + (logo_size - text_h) // 2
    draw.text((text_x, text_y), brand_text, fill=(255, 255, 255, 235), font=font_brand)

    # Tag above headline.
    tag_text = story.get("tag", "TOP STORY").upper()
    tag_y = int(height * 0.68)
    draw.text((margin_x, tag_y), tag_text, fill=(238, 238, 238, 220), font=font_tag)

    # Headline block.
    headline = story.get("headline", "")
    lines = wrap_text(draw, headline, font_headline, width - 2 * margin_x)
    line_height = int(font_headline.size * 1.02)
    headline_y = tag_y + max(24, int(64 * scale))
    for i, line in enumerate(lines[:4]):
        draw.text((margin_x, headline_y + i * line_height), line, fill=(255, 255, 255, 255), font=font_headline)

    # Red accent bar at bottom (style cue from examples).
    bar_h = max(10, int(18 * scale))
    draw.rectangle((0, height - bar_h, width, height), fill=(194, 22, 22, 255))

    output_dir.mkdir(parents=True, exist_ok=True)
    image_out = output_dir / "story_001.png"
    caption_out = output_dir / "story_001_caption.txt"

    canvas.convert("RGB").save(image_out, format="PNG")

    caption = story.get("caption", "")
    cta = "Read your Trace at yourtrace.online for more such insightful stories."
    with caption_out.open("w", encoding="utf-8") as f:
        f.write(caption.strip())
        f.write("\n\n")
        f.write(cta)

    print(f"Generated image: {image_out}")
    print(f"Generated caption: {caption_out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a single IG-style news story post.")
    parser.add_argument("--story", default="input/story_001.json", help="Path to story JSON")
    parser.add_argument("--background", default="assets/background.jpg", help="Path to background image")
    parser.add_argument("--output-dir", default="output", help="Output directory")
    parser.add_argument(
        "--format",
        choices=["square", "story"],
        default="square",
        help="square=1080x1080, story=1080x1920",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    background = root / args.background
    resolved = root / "assets/resolved_story_001.jpg"
    if args.background == "assets/background.jpg" and resolved.exists():
        background = resolved
    width, height = (1080, 1080) if args.format == "square" else (1080, 1920)
    render_story(root / args.story, background, root / args.output_dir, width, height)


if __name__ == "__main__":
    main()
