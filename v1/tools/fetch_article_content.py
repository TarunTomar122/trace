"""
Article Content Fetcher - extracts full text from URLs using botasaurus_requests.

Fetches and extracts clean article text for newsletter summarization.

Usage:
    python v1/tools/fetch_article_content.py --url "https://example.com/article"
"""
import argparse
import re
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# Maximum content length to avoid token blowups (roughly 10k words)
MAX_CONTENT_LENGTH = 50000
# Request timeout in seconds
REQUEST_TIMEOUT = 30


def _clean_text(text: str) -> str:
    """Clean extracted text by removing extra whitespace and noise."""
    # Remove multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove multiple spaces
    text = re.sub(r' {2,}', ' ', text)
    # Remove common noise patterns
    noise_patterns = [
        r'Share this article',
        r'Follow us on',
        r'Subscribe to our newsletter',
        r'Sign up for',
        r'Cookie policy',
        r'Privacy policy',
        r'Terms of service',
        r'Advertisement',
        r'Sponsored content',
    ]
    for pattern in noise_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    return text.strip()


def _extract_text_from_html(html: str) -> str:
    """Extract clean text from HTML using simple parsing."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')

        # Remove script, style, nav, footer, header, aside elements
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside',
                         'noscript', 'iframe', 'form', 'button']):
            tag.decompose()

        # Try to find main content area
        main_content = None
        for selector in ['article', 'main', '[role="main"]', '.post-content',
                         '.article-content', '.entry-content', '.content', '#content']:
            main_content = soup.select_one(selector)
            if main_content:
                break

        if main_content:
            text = main_content.get_text(separator=' ', strip=True)
        else:
            # Fallback to body
            body = soup.find('body')
            if body:
                text = body.get_text(separator=' ', strip=True)
            else:
                text = soup.get_text(separator=' ', strip=True)

        return _clean_text(text)
    except Exception:
        # Fallback: simple regex-based extraction
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'&[a-zA-Z]+;', ' ', text)
        return _clean_text(text)


def _is_paywalled(html: str, text: str) -> bool:
    """Detect if content appears to be paywalled or gated."""
    paywall_indicators = [
        'subscribe to continue reading',
        'subscribe to read',
        'sign up to continue',
        'create an account',
        'paywall',
        'premium content',
        'member-only',
        'subscribers only',
        'already a subscriber',
        'unlock this article',
        'get unlimited access',
    ]
    lower_html = html.lower()
    lower_text = text.lower()

    for indicator in paywall_indicators:
        if indicator in lower_html or indicator in lower_text:
            return True

    # Check if content is suspiciously short (less than 200 chars)
    if len(text) < 200:
        return True

    return False


def fetch_article_content(url: str, timeout: int = REQUEST_TIMEOUT) -> dict:
    """
    Fetch and extract article content from a URL.

    Args:
        url: The article URL to fetch
        timeout: Request timeout in seconds

    Returns:
        Dict with:
        - success: bool
        - content: str (cleaned article text) or None
        - error: str or None
        - url: original URL
        - is_paywalled: bool
        - content_length: int
    """
    result = {
        "success": False,
        "content": None,
        "error": None,
        "url": url,
        "is_paywalled": False,
        "content_length": 0,
    }

    # Validate URL
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            result["error"] = "Invalid URL format"
            return result
    except Exception:
        result["error"] = "Invalid URL"
        return result

    # Skip known problematic domains
    skip_domains = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com',
                    'github.com', 'arxiv.org', 'reddit.com']
    if any(domain in url.lower() for domain in skip_domains):
        result["error"] = f"Unsupported domain for content extraction"
        return result

    try:
        # Try botasaurus_requests first (better at bypassing blocks)
        try:
            from botasaurus_requests import request
            response = request.get(url, timeout=timeout)
            html = response.text
            status_code = response.status_code
        except ImportError:
            # Fallback to regular requests
            import requests
            response = requests.get(
                url,
                timeout=timeout,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                }
            )
            html = response.text
            status_code = response.status_code

        if status_code != 200:
            result["error"] = f"HTTP {status_code}"
            return result

        # Extract text
        text = _extract_text_from_html(html)

        if not text or len(text) < 100:
            result["error"] = "Could not extract meaningful content"
            return result

        # Check for paywall
        if _is_paywalled(html, text):
            result["is_paywalled"] = True
            result["error"] = "Content appears to be paywalled"
            return result

        # Truncate if too long
        if len(text) > MAX_CONTENT_LENGTH:
            text = text[:MAX_CONTENT_LENGTH] + "..."

        result["success"] = True
        result["content"] = text
        result["content_length"] = len(text)
        return result

    except Exception as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            result["error"] = "Request timed out"
        elif "connection" in error_msg.lower():
            result["error"] = "Connection failed"
        else:
            result["error"] = f"Fetch error: {error_msg[:100]}"
        return result


def fetch_multiple_articles(urls: list[str], timeout: int = REQUEST_TIMEOUT) -> list[dict]:
    """
    Fetch content from multiple URLs.

    Args:
        urls: List of article URLs
        timeout: Request timeout per URL

    Returns:
        List of result dicts (same format as fetch_article_content)
    """
    results = []
    for url in urls:
        result = fetch_article_content(url, timeout)
        results.append(result)
    return results


def main():
    parser = argparse.ArgumentParser(description="Fetch article content from URL")
    parser.add_argument("--url", required=True, help="Article URL to fetch")
    parser.add_argument("--timeout", type=int, default=REQUEST_TIMEOUT, help="Request timeout in seconds")
    args = parser.parse_args()

    result = fetch_article_content(args.url, args.timeout)

    if result["success"]:
        print(f"Successfully fetched {result['content_length']} characters")
        print("-" * 40)
        # Print first 1000 chars as preview
        print(result["content"][:1000])
        if len(result["content"]) > 1000:
            print("...")
    else:
        print(f"Failed: {result['error']}")


if __name__ == "__main__":
    main()
