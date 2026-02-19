#!/usr/bin/env python3
"""
V2 wrapper for appending trending news to a user's feed.

The implementation currently lives in v1 and is imported here so v2
pipeline modules can depend on v2 paths consistently.
"""

from __future__ import annotations

from v1.flows.add_trending_news_to_feed import (  # noqa: F401
    add_trending_news_to_feed,
    main,
)


if __name__ == "__main__":
    main()
