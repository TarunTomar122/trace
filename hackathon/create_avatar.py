"""
Create a GWM-1 avatar from a local image. Outputs avatar ID.
Usage: python3 create_avatar.py path/to/image.jpg
"""
import base64
import json
import os
import sys
import time
import urllib.request
from runwayml import RunwayML

API_KEY = os.environ.get("RUNWAYML_API_SECRET") or "key_93ceeb303ca23f79e05c08f8b619be953c91fdc312beacd904a33c97b80e579697b983e3c30413eec4c40f5c67decb9acb9e766f4a5d76964bedbc4e77bca6cf"
OUTPUT_DIR = "outputs"

client = RunwayML(api_key=API_KEY)


def create_avatar(image_path: str, name: str, personality: str) -> str:
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/png")

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    data_uri = f"data:{mime};base64,{b64}"

    print(f"Creating avatar '{name}' from {image_path} ({len(b64)/1024:.0f} KB)...")
    avatar = client.avatars.create(
        name=name,
        reference_image=data_uri,
        personality=personality,
        start_script="Hey! Let's talk.",
        voice={"type": "runway-live-preset", "preset_id": "adam"},
    )
    avatar_id = avatar.id
    print(f"  Avatar ID: {avatar_id}")
    print(f"  Status:    {avatar.status}")

    print("  Polling until ready...")
    for attempt in range(60):
        av = client.avatars.retrieve(id=avatar_id)
        sys.stdout.write(f"\r  [{av.status}]")
        sys.stdout.flush()

        if av.status == "READY":
            print("\n  READY!")
            if hasattr(av, "processed_image_uri") and av.processed_image_uri:
                img_path = os.path.join(OUTPUT_DIR, f"avatar_{avatar_id[:8]}.png")
                urllib.request.urlretrieve(av.processed_image_uri, img_path)
                print(f"  Processed avatar saved: {img_path}")
            return avatar_id

        if av.status == "FAILED":
            print(f"\n  FAILED: {getattr(av, 'failure_reason', 'unknown')}")
            sys.exit(1)

        time.sleep(8)

    print(f"\n  Timed out. ID: {avatar_id}")
    return avatar_id


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 create_avatar.py <image.jpg> [name] [personality]")
        sys.exit(1)

    image_path = sys.argv[1]
    name = sys.argv[2] if len(sys.argv) > 2 else "My Character"
    personality = sys.argv[3] if len(sys.argv) > 3 else "You are a friendly AI character."

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    avatar_id = create_avatar(image_path, name, personality)

    config = {"avatar_id": avatar_id, "name": name}
    with open(os.path.join(OUTPUT_DIR, "avatar_config.json"), "w") as f:
        json.dump(config, f, indent=2)

    print(f"\nDone! Avatar ID: {avatar_id}")
    print(f"Config saved to {OUTPUT_DIR}/avatar_config.json")


if __name__ == "__main__":
    main()
