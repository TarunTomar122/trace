#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from v1.storage import FirestoreStore


DEFAULT_GRAPH_VERSION = os.getenv("INSTAGRAM_GRAPH_VERSION", "v23.0")
DEFAULT_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "anybrew-7c6c1.firebasestorage.app")


def load_caption(path: Path) -> str:
    txt = path.read_text(encoding="utf-8").strip()
    if not txt:
        raise ValueError(f"Caption file is empty: {path}")
    return txt


def get_instagram_integration(user_id: str) -> dict[str, Any]:
    store = FirestoreStore()
    doc = store.db.collection("user_integrations").document(user_id).get()
    if not doc.exists:
        raise ValueError(f"user_integrations/{user_id} not found")
    data = doc.to_dict() or {}
    ig = data.get("instagram") if isinstance(data.get("instagram"), dict) else {}
    access_token = (ig.get("accessToken") or "").strip()
    ig_user_id = (ig.get("instagramUserId") or "").strip()
    if not access_token or not ig_user_id:
        raise ValueError("Instagram integration missing accessToken or instagramUserId")
    return {
        "access_token": access_token,
        "ig_user_id": ig_user_id,
        "instagram_username": ig.get("instagramUsername") or None,
    }


def resolve_ig_user_id_from_token(access_token: str, graph_version: str) -> str:
    url = f"https://graph.facebook.com/{graph_version}/me/accounts"
    response = requests.get(
        url,
        params={
            "fields": "id,name,instagram_business_account{id,username}",
            "access_token": access_token,
        },
        timeout=45,
    )
    data = response.json()
    if response.status_code >= 300:
        raise RuntimeError(f"Failed to resolve IG user id from token: {json.dumps(data)}")
    pages = data.get("data") or []
    for page in pages:
        ig = page.get("instagram_business_account") or {}
        if ig.get("id"):
            return str(ig["id"])
    raise RuntimeError("No instagram_business_account found on pages available to this token")


def ensure_firebase_initialized(bucket_name: str) -> None:
    import firebase_admin
    from firebase_admin import credentials, initialize_app

    if firebase_admin._apps:
        return

    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()

    if service_account_json:
        cred = credentials.Certificate(json.loads(service_account_json))
    elif service_account_path:
        cred = credentials.Certificate(service_account_path)
    else:
        raise ValueError("Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH for image upload")

    options = {"storageBucket": bucket_name} if bucket_name else None
    if options:
        initialize_app(cred, options)
    else:
        initialize_app(cred)


def upload_image_and_get_signed_url(local_image_path: Path, user_id: str, bucket_name: str) -> str:
    from firebase_admin import storage

    if not local_image_path.exists():
        raise ValueError(f"Image not found: {local_image_path}")

    ensure_firebase_initialized(bucket_name)

    blob_name = f"instagram-posts/{user_id}/{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{local_image_path.name}"
    bucket = storage.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(str(local_image_path), content_type="image/png")
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(hours=24),
        method="GET",
    )


def create_media_container(graph_version: str, ig_user_id: str, access_token: str, image_url: str, caption: str) -> str:
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media"
    response = requests.post(
        url,
        data={
            "image_url": image_url,
            "caption": caption,
            "access_token": access_token,
        },
        timeout=45,
    )
    data = response.json()
    if response.status_code >= 300 or not data.get("id"):
        raise RuntimeError(f"Create media failed: {json.dumps(data)}")
    return str(data["id"])


def publish_media(graph_version: str, ig_user_id: str, access_token: str, creation_id: str) -> str:
    url = f"https://graph.facebook.com/{graph_version}/{ig_user_id}/media_publish"
    response = requests.post(
        url,
        data={
            "creation_id": creation_id,
            "access_token": access_token,
        },
        timeout=45,
    )
    data = response.json()
    if response.status_code >= 300 or not data.get("id"):
        raise RuntimeError(f"Publish media failed: {json.dumps(data)}")
    return str(data["id"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish generated post to Instagram")
    parser.add_argument("--user-id", required=True, help="Trace user id with connected Instagram integration")
    parser.add_argument("--caption-file", default="output/story_001_caption.txt", help="Caption file path")
    parser.add_argument("--image", default="output/story_001.png", help="Local image path to upload and publish")
    parser.add_argument("--image-url", default="", help="Optional public image URL; if set, skips upload")
    parser.add_argument("--bucket", default=DEFAULT_BUCKET, help="Firebase Storage bucket for image upload")
    parser.add_argument("--graph-version", default=DEFAULT_GRAPH_VERSION, help="Graph API version, e.g. v23.0")
    parser.add_argument("--access-token", default="", help="Optional manual access token (bypasses Firestore integration lookup)")
    parser.add_argument("--ig-user-id", default="", help="Optional manual Instagram user id")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    caption = load_caption(root / args.caption_file)
    if args.access_token.strip():
        access_token = args.access_token.strip()
        ig_user_id = args.ig_user_id.strip() or resolve_ig_user_id_from_token(access_token, args.graph_version)
        integration = {
            "access_token": access_token,
            "ig_user_id": ig_user_id,
            "instagram_username": None,
        }
    else:
        integration = get_instagram_integration(args.user_id)

    image_url = args.image_url.strip()
    if not image_url:
        image_url = upload_image_and_get_signed_url(root / args.image, args.user_id, args.bucket)

    print(f"Using image URL: {image_url}")
    creation_id = create_media_container(
        graph_version=args.graph_version,
        ig_user_id=integration["ig_user_id"],
        access_token=integration["access_token"],
        image_url=image_url,
        caption=caption,
    )
    media_id = publish_media(
        graph_version=args.graph_version,
        ig_user_id=integration["ig_user_id"],
        access_token=integration["access_token"],
        creation_id=creation_id,
    )

    print("Posted to Instagram successfully")
    print(f"creation_id: {creation_id}")
    print(f"media_id: {media_id}")
    if integration.get("instagram_username"):
        print(f"instagram_username: {integration['instagram_username']}")


if __name__ == "__main__":
    main()
