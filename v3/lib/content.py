"""
Article content extraction.

HTTP fetch with Exa fallback for paywalled/JS-heavy sites.
"""

from __future__ import annotations

import os
import re
from typing import Any

import requests
from bs4 import BeautifulSoup

REQUEST_TIMEOUT = 20
EXA_API_URL = "https://api.exa.ai/contents"
EXA_TIMEOUT = 30
MIN_CONTENT_LENGTH = 200

PAYWALL_INDICATORS = (
    "subscribe to continue reading",
    "subscribe to read",
    "already a subscriber",
    "member-only",
    "subscribers only",
    "premium content",
    "unlock this article",
    "create an account to continue",
)

USER_AGENT = "TraceLinkFetcher/1.0 (+https://trace.app)"


def _extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    article = soup.find("article")
    if article:
        text = article.get_text(separator="\n", strip=True)
        if len(text) >= MIN_CONTENT_LENGTH:
            return text

    main = soup.find("main")
    if main:
        text = main.get_text(separator="\n", strip=True)
        if len(text) >= MIN_CONTENT_LENGTH:
            return text

    return soup.get_text(separator="\n", strip=True)


def _is_paywall(text: str) -> bool:
    lower = text.lower()
    return any(p in lower for p in PAYWALL_INDICATORS)


def _fetch_via_http(url: str) -> str:
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        resp.raise_for_status()
        text = _extract_text_from_html(resp.text)
        if len(text) >= MIN_CONTENT_LENGTH and not _is_paywall(text):
            return text
    except Exception:
        pass
    return ""


def _fetch_via_exa(url: str) -> tuple[str, str]:
    """Returns (content, image_url) from Exa."""
    api_key = os.getenv("EXA_API_KEY", "").strip()
    if not api_key:
        return "", ""
    try:
        resp = requests.post(
            EXA_API_URL,
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            json={"ids": [url], "text": True, "highlights": False},
            timeout=EXA_TIMEOUT,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if results:
            result = results[0]
            text = result.get("text", "")
            image = result.get("image", "")
            if len(text) >= MIN_CONTENT_LENGTH:
                return text, image
    except Exception:
        pass
    return "", ""


def fetch_content(url: str) -> dict[str, Any]:
    """
    Fetch article content with HTTP first, Exa fallback.

    Returns dict with:
      content: str  — the article text
      image: str    — og_image or Exa image fallback
      source: str   — "http" or "exa"
    """
    content = _fetch_via_http(url)
    if content:
        return {"content": content, "image": "", "source": "http"}

    exa_content, exa_image = _fetch_via_exa(url)
    if exa_content:
        return {"content": exa_content, "image": exa_image, "source": "exa"}

    return {"content": "", "image": "", "source": "none"}


def fetch_og_image(url: str) -> str:
    """Best-effort OG image extraction."""
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=12,
            allow_redirects=True,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return str(og["content"])
        tw = soup.find("meta", attrs={"name": "twitter:image"})
        if tw and tw.get("content"):
            return str(tw["content"])
    except Exception:
        pass
    return ""
