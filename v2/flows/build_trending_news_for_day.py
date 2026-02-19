#!/usr/bin/env python3
"""
V2 wrapper for building trending news for a day.

The implementation currently lives in v1 and is imported here so the
pipeline entrypoints can run fully from v2 paths.
"""

from __future__ import annotations

from v1.flows.build_trending_news_for_day import (  # noqa: F401
    build_trending_news_for_day,
    main,
)


if __name__ == "__main__":
    main()
