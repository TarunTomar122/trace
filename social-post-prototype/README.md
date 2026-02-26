# Social Post Prototype

Single-story Instagram-style post generator for Trace.

## What it creates
- `output/story_001.png` (default square image, 1080x1080)
- `output/story_001_caption.txt` (caption draft)

## Use real feed story (v3)
```bash
python3 build_story_from_feed.py --user-id TTK4PNFSO2PxTBrSCvvXBmHsCIE2
python3 resolve_story_image.py
python3 generate_post.py --format square
```

Optional story format:
```bash
python3 generate_post.py --format story
```

Optional section/item selection:
```bash
python3 build_story_from_feed.py --user-id TTK4PNFSO2PxTBrSCvvXBmHsCIE2 --section trending --item-index 1
python3 resolve_story_image.py
python3 generate_post.py --format square
```

## Edit content manually
Update `input/story_001.json`:
- `tag`
- `headline`
- `caption`
- `source_note`

## Swap background image
Replace `assets/background.jpg` or pass a custom path:
```bash
python3 generate_post.py --background assets/my_bg.jpg
```

## Image resolution order
`resolve_story_image.py` tries:
1. feed `thumbnail` URL from the selected item
2. article `og:image` from the source URL
3. fallback to `assets/background.jpg` if both fail

## Branding
The post renderer uses the Trace logo from:
- `trace/assets/images/trace-logo.png` (preferred)
- fallback: `frontend/public/trace.png`


## Publish to Instagram (direct script)
After generating image + caption, publish with:
```bash
python3 publish_to_instagram.py --user-id TTK4PNFSO2PxTBrSCvvXBmHsCIE2
```

Optional: use an already-public image URL (skip upload):
```bash
python3 publish_to_instagram.py \
  --user-id TTK4PNFSO2PxTBrSCvvXBmHsCIE2 \
  --image-url "https://your-public-image-url.com/story_001.png"
```

Notes:
- Script reads IG access token + IG user id from `user_integrations/{uid}.instagram`.
- If `--image-url` is not provided, it uploads `output/story_001.png` to Firebase Storage and uses a signed URL.
- Requires Firebase service account env vars to be present.
