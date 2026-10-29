"""Tell Bing and the other IndexNow engines about new or changed pages.

The key file is served by the web app (frontend/public/<key>.txt);
frontend/scripts/submit-indexnow.mjs is the same call for one-off submissions.
Off unless TRACE_INDEXNOW=1. That flag is for the Trace VPS only: the URLs
and key are yourtrace.online's, so a self-hosted copy must leave it unset.
"""

from __future__ import annotations

import os
from typing import Callable

import requests

SITE_URL = "https://www.yourtrace.online"
KEY = "2c58d696e16d6fa0fdae3dd716584637"
ENDPOINT = "https://api.indexnow.org/indexnow"


def submit(paths: list[str], log: Callable[[str], None] = print) -> bool:
    """POST these site paths to IndexNow; never raises. True when accepted."""
    if os.getenv("TRACE_INDEXNOW") != "1" or not paths:
        return False
    body = {
        "host": SITE_URL.removeprefix("https://"),
        "key": KEY,
        "keyLocation": f"{SITE_URL}/{KEY}.txt",
        "urlList": [f"{SITE_URL}{path}" for path in paths],
    }
    try:
        response = requests.post(ENDPOINT, json=body, timeout=10)
    except requests.RequestException as exc:
        log(f"IndexNow failed: {exc}")
        return False
    # 200 = accepted, 202 = accepted and the key is still being checked.
    ok = response.status_code in (200, 202)
    log(f"IndexNow {'accepted' if ok else 'refused'} {len(paths)} URL(s): HTTP {response.status_code}")
    return ok
