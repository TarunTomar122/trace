"""
V1 Firestore storage helpers for the topics-based system.
"""
import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()


def _serialize_firestore(obj: Any) -> Any:
    """Recursively convert Firestore types to JSON-serializable types."""
    if obj is None:
        return obj
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialize_firestore(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_firestore(i) for i in obj]
    return obj


class FirestoreStore:
    """Firestore store for v1 topics-based system."""
    
    def __init__(self) -> None:
        from firebase_admin import credentials, firestore, initialize_app
        import firebase_admin
        
        if not firebase_admin._apps:
            # Option 1: JSON string directly (for GitHub Actions)
            service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
            # Option 2: File path (for local development)
            service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
            
            if service_account_json:
                # Parse JSON string directly
                cred = credentials.Certificate(json.loads(service_account_json))
                initialize_app(cred)
            elif service_account_path:
                # Load from file path
                cred = credentials.Certificate(service_account_path)
                initialize_app(cred)
            else:
                raise ValueError("Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH")
        
        self.db = firestore.client()
    
    # =========================================================================
    # USER PROFILES (READ ONLY - for reading user interests)
    # =========================================================================
    
    def get_all_user_profiles(self) -> list[dict[str, Any]]:
        """Get all user profiles. Used to scan for interests."""
        docs = self.db.collection("user_profiles").stream()
        return [{"uid": doc.id, **_serialize_firestore(doc.to_dict())} for doc in docs]
    
    def get_user_profile(self, user_id: str) -> Optional[dict[str, Any]]:
        """Get a single user profile."""
        doc = self.db.collection("user_profiles").document(user_id).get()
        if doc.exists:
            return {"uid": doc.id, **_serialize_firestore(doc.to_dict())}
        return None
    
    def get_onboarded_users(self) -> list[dict[str, Any]]:
        """Get all users with active subscriptions (trial or paid)."""
        # Get users with trial or active subscription status
        trial_docs = self.db.collection("user_profiles").where("subscriptionStatus", "==", "trial").stream()
        active_docs = self.db.collection("user_profiles").where("subscriptionStatus", "==", "active").stream()

        users = []
        for doc in trial_docs:
            users.append({"uid": doc.id, **_serialize_firestore(doc.to_dict())})
        for doc in active_docs:
            users.append({"uid": doc.id, **_serialize_firestore(doc.to_dict())})

        return users

    # =========================================================================
    # TRENDING NEWS (for trending news integration)
    # =========================================================================

    def get_trending_news_for_date(self, date: str) -> Optional[dict[str, Any]]:
        """Get all trending news for a specific date.

        Args:
            date: Date string in YYYY-MM-DD format

        Returns:
            Dictionary with trending news data or None if not found
        """
        doc = self.db.collection("trending_news").document(date).get()
        if doc.exists:
            return _serialize_firestore(doc.to_dict())
        return None

    def get_trending_news_for_topic(self, topic_id: str, date: str) -> list[dict[str, Any]]:
        """Get trending news for a specific topic on a given date.

        Args:
            topic_id: Normalized topic ID (e.g., 'machine-learning')
            date: Date string in YYYY-MM-DD format

        Returns:
            List of news articles for the topic (empty if none found)
        """
        news_doc = self.get_trending_news_for_date(date)
        if not news_doc:
            return []
        topics = news_doc.get("topics", {}) or {}
        return topics.get(topic_id, [])

    def save_trending_news_for_date(
        self,
        date: str,
        news_by_topic: dict[str, list[dict[str, Any]]],
        generated_at: Optional[str] = None,
    ) -> None:
        """Save trending news for a date.

        Args:
            date: Date string in YYYY-MM-DD format
            news_by_topic: Dict mapping topic_id to list of news articles
            generated_at: ISO datetime string (defaults to now)
        """
        if generated_at is None:
            generated_at = datetime.now(timezone.utc).isoformat()

        topic_count = len(news_by_topic)
        total_articles = sum(len(articles) for articles in news_by_topic.values())

        doc_data = {
            "date": date,
            "generated_at": generated_at,
            "topics": news_by_topic,
            "topic_count": topic_count,
            "total_articles": total_articles,
        }

        self.db.collection("trending_news").document(date).set(doc_data)


    # =========================================================================
    # ARTICLE CONTENT CACHE (for newsletter summarization)
    # =========================================================================

    def get_cached_content(self, url: str, max_age_days: int = 7) -> Optional[dict[str, Any]]:
        """Get cached article content if available and not expired.

        Args:
            url: The article URL
            max_age_days: Maximum age in days before cache is considered stale

        Returns:
            Dict with content and metadata, or None if not cached/expired
        """
        # Create a safe document ID from URL (Firestore doesn't allow / in doc IDs)
        import hashlib
        url_hash = hashlib.sha256(url.encode()).hexdigest()[:32]

        doc = self.db.collection("article_content_cache").document(url_hash).get()
        if not doc.exists:
            return None

        data = doc.to_dict()
        if not data:
            return None

        # Check if cache is expired
        fetched_at = data.get("fetched_at")
        if fetched_at:
            from datetime import datetime, timedelta
            try:
                if isinstance(fetched_at, str):
                    fetch_time = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
                else:
                    fetch_time = fetched_at
                if hasattr(fetch_time, 'timestamp'):
                    age = datetime.now(timezone.utc) - datetime.fromtimestamp(fetch_time.timestamp(), timezone.utc)
                else:
                    age = datetime.now(timezone.utc) - fetch_time.replace(tzinfo=timezone.utc)
                if age > timedelta(days=max_age_days):
                    return None
            except Exception:
                pass  # If we can't parse date, return cached content anyway

        return _serialize_firestore(data)

    def save_cached_content(
        self,
        url: str,
        content: str,
        is_paywalled: bool = False,
        error: Optional[str] = None,
    ) -> None:
        """Save article content to cache.

        Args:
            url: The article URL
            content: Extracted article content
            is_paywalled: Whether the content was detected as paywalled
            error: Any error message if fetch failed
        """
        import hashlib
        url_hash = hashlib.sha256(url.encode()).hexdigest()[:32]

        doc_data = {
            "url": url,
            "url_hash": url_hash,
            "content": content,
            "content_length": len(content) if content else 0,
            "is_paywalled": is_paywalled,
            "error": error,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

        self.db.collection("article_content_cache").document(url_hash).set(doc_data)

    # =========================================================================
    # USER NEWSLETTERS (for daily newsletter feature)
    # =========================================================================

    def get_user_newsletter(self, user_id: str, date: str) -> Optional[dict[str, Any]]:
        """Get a user's newsletter for a specific date.

        Args:
            user_id: User ID
            date: Date string in YYYY-MM-DD format

        Returns:
            Newsletter document or None if not found
        """
        doc = (
            self.db.collection("user_newsletters")
            .document(user_id)
            .collection("daily")
            .document(date)
            .get()
        )
        if doc.exists:
            return _serialize_firestore(doc.to_dict())
        return None

    def save_user_newsletter(
        self,
        user_id: str,
        date: str,
        newsletter_data: dict[str, Any],
    ) -> None:
        """Save a user's newsletter for a specific date.

        Args:
            user_id: User ID
            date: Date string in YYYY-MM-DD format
            newsletter_data: Newsletter content including items, email content, status
        """
        newsletter_data["user_id"] = user_id
        newsletter_data["date"] = date

        (
            self.db.collection("user_newsletters")
            .document(user_id)
            .collection("daily")
            .document(date)
            .set(newsletter_data)
        )

    def update_newsletter_status(
        self,
        user_id: str,
        date: str,
        status: str,
        error: Optional[str] = None,
        sent_at: Optional[str] = None,
    ) -> None:
        """Update newsletter send status.

        Args:
            user_id: User ID
            date: Date string in YYYY-MM-DD format
            status: "draft", "sent", or "failed"
            error: Error message if status is "failed"
            sent_at: ISO datetime when sent
        """
        update_data = {"status": status}
        if error:
            update_data["error"] = error
        if sent_at:
            update_data["sent_at"] = sent_at

        (
            self.db.collection("user_newsletters")
            .document(user_id)
            .collection("daily")
            .document(date)
            .update(update_data)
        )

    def get_newsletter_opted_in_users(self) -> list[dict[str, Any]]:
        """Get all subscribed users who have opted in to newsletters.

        Returns:
            List of user profiles with newsletter opt-in enabled
        """
        users = []

        # Get trial users
        trial_docs = (
            self.db.collection("user_profiles")
            .where("subscriptionStatus", "==", "trial")
            .stream()
        )
        for doc in trial_docs:
            data = doc.to_dict()
            # Default to opted in if field doesn't exist
            if data.get("newsletterOptIn", True):
                users.append({"uid": doc.id, **_serialize_firestore(data)})

        # Get active users
        active_docs = (
            self.db.collection("user_profiles")
            .where("subscriptionStatus", "==", "active")
            .stream()
        )
        for doc in active_docs:
            data = doc.to_dict()
            if data.get("newsletterOptIn", True):
                users.append({"uid": doc.id, **_serialize_firestore(data)})

        return users

    # =========================================================
    # FREE NEWSLETTER SUBSCRIBERS
    # =========================================================

    def get_free_newsletter_subscribers(
        self,
    ) -> list[dict[str, Any]]:
        """Get all active free newsletter subscribers.

        Returns:
            List of subscriber dicts with email, subscribedAt, etc.
        """
        docs = (
            self.db.collection("free_newsletter_subscribers")
            .where("active", "==", True)
            .stream()
        )
        return [
            {"email": doc.id, **_serialize_firestore(doc.to_dict())}
            for doc in docs
        ]

    def get_all_free_newsletter_emails(
        self,
    ) -> set[str]:
        """Get deduplicated set of emails for free newsletter.

        Combines:
        - free_newsletter_subscribers (landing page signups)
        - unsubscribed users with email (user_profiles with
          no active subscription but with an email)

        Excludes emails of users who already get the paid
        newsletter (trial/active with newsletterOptIn).
        """
        # 1. Paid newsletter emails (to exclude)
        paid_users = self.get_newsletter_opted_in_users()
        paid_emails = {
            u.get("email", "").lower()
            for u in paid_users
            if u.get("email")
        }

        # 2. Free subscribers from landing page
        free_subs = self.get_free_newsletter_subscribers()
        free_emails = {
            s.get("email", "").lower()
            for s in free_subs
            if s.get("email")
        }

        # 3. All user profiles without active sub
        all_docs = (
            self.db.collection("user_profiles").stream()
        )
        for doc in all_docs:
            data = doc.to_dict()
            status = data.get("subscriptionStatus", "")
            email = (data.get("email") or "").lower()
            opted_out = data.get("newsletterOptIn") is False
            if (
                email
                and status not in ("trial", "active")
                and not opted_out
            ):
                free_emails.add(email)

        # Remove anyone already getting paid newsletter
        free_emails -= paid_emails
        # Remove empty strings
        free_emails.discard("")

        return free_emails

    def save_free_newsletter(
        self,
        date: str,
        newsletter_data: dict[str, Any],
    ) -> None:
        """Save the free newsletter for a date."""
        (
            self.db.collection("free_newsletters")
            .document(date)
            .set(newsletter_data)
        )

    def get_free_newsletter(
        self,
        date: str,
    ) -> Optional[dict[str, Any]]:
        """Get the free newsletter for a date."""
        doc = (
            self.db.collection("free_newsletters")
            .document(date)
            .get()
        )
        if doc.exists:
            return _serialize_firestore(doc.to_dict())
        return None


def get_store() -> FirestoreStore:
    """Get the FirestoreStore instance."""
    return FirestoreStore()

