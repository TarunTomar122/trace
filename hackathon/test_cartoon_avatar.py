"""
TEST 1: Cartoon Jensen Huang → GWM-1 Avatar
Can we generate a cartoon caricature and turn it into a callable avatar?
"""
import os
import sys
import time
from runwayml import RunwayML

API_KEY = os.environ.get("RUNWAYML_API_SECRET")
if not API_KEY:
    API_KEY = "key_93ceeb303ca23f79e05c08f8b619be953c91fdc312beacd904a33c97b80e579697b983e3c30413eec4c40f5c67decb9acb9e766f4a5d76964bedbc4e77bca6cf"

client = RunwayML(api_key=API_KEY)
print("=" * 60)
print("TEST 1: Cartoon Jensen → Avatar Pipeline")
print("=" * 60)

# Step 1: Generate cartoon Jensen image
print("\n[1/4] Generating cartoon Jensen Huang via gen4_image...")
image_prompt = (
    "Front-facing cartoon caricature portrait of Jensen Huang, black leather jacket, "
    "grey slicked-back hair, warm confident smile, looking directly at camera, "
    "simple dark gradient background, Pixar 3D style, professional studio lighting, "
    "16:9 aspect ratio, head and shoulders shot, high detail"
)

task = client.text_to_image.create(
    model="gen4_image",
    ratio="1280:720",
    prompt_text=image_prompt,
).wait_for_task_output()

image_url = task.output[0] if task.output else None
if not image_url:
    print("FAILED: No image output")
    sys.exit(1)

print(f"       Image ready: {image_url[:80]}...")

# Step 2: Create avatar from image
print("\n[2/4] Creating GWM-1 avatar from cartoon Jensen...")
avatar = client.avatars.create(
    name="Jensen Huang (Cartoon)",
    reference_image=image_url,
    personality=(
        "You are Jensen Huang, CEO of Nvidia. You speak passionately about GPUs, AI, "
        "and the future of computing. Your catchphrase is 'The more you buy, the more you save.' "
        "You believe AGI is coming within 5 years. Be energetic, optimistic, and technically deep. "
        "Reference Blackwell, CUDA, and the AI computing revolution when relevant."
    ),
    start_script="Hey! Let's talk about AI and GPUs. What do you want to know?",
    voice={"type": "preset", "preset_id": "adam"},
)

avatar_id = avatar.id
print(f"       Avatar created! ID: {avatar_id}")

# Step 3: Poll until avatar is ready
print(f"\n[3/4] Waiting for avatar to be ready...")
max_wait = 120
started = time.time()

while time.time() - started < max_wait:
    av = client.avatars.retrieve(id=avatar_id)
    status = av.status if hasattr(av, 'status') else "unknown"
    print(f"       {status}")
    if status == "READY":
        break
    if status == "FAILED":
        print(f"\nFAILED: {av.failure_reason if hasattr(av, 'failure_reason') else 'Unknown error'}")
        sys.exit(1)
    time.sleep(5)
else:
    print("\n       Avatar still processing — check dev portal manually")
    print(f"       Avatar ID: {avatar_id}")

# Step 4: Summary
print("\n[4/4] Done!")
print("=" * 60)
print(f"Avatar ID:  {avatar_id}")
print(f"Image URL:  {image_url}")
print(f"Name:       Jensen Huang (Cartoon)")
print()
print("Next: Use this avatar_id in the React app or via POST /v1/realtime_sessions")
print("      or just try it in the Runway dev portal → Characters tab")
print("=" * 60)
