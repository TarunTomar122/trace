from typing import Any


def is_newsletter_enabled(profile: dict[str, Any]) -> bool:
    """Return true only for an explicit current or legacy opt-in."""
    if "dailyNewsletterEnabled" in profile:
        return profile.get("dailyNewsletterEnabled") is True
    return profile.get("newsletterOptIn") is True
