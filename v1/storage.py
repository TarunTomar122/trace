"""
V1 Firestore storage helpers for the umbrella-based system.

New collections:
- umbrellas/{umbrella_id}
- retrieval_pool/{item_id}
- query_users/{query_id}

Does NOT modify existing collections: user_profiles, user_preferences, user_patterns, user_feeds, user_interactions
"""
import json
import os
from datetime import datetime, timedelta
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
    """Firestore store for v1 umbrella-based system."""
    
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
    # UMBRELLAS
    # =========================================================================
    
    def get_umbrella(self, umbrella_id: str) -> Optional[dict[str, Any]]:
        """Get an umbrella by ID."""
        doc = self.db.collection("umbrellas").document(umbrella_id).get()
        return _serialize_firestore(doc.to_dict()) if doc.exists else None
    
    def create_umbrella(self, umbrella_id: str, data: dict[str, Any]) -> None:
        """Create a new umbrella."""
        data["created_at"] = datetime.utcnow().isoformat()
        self.db.collection("umbrellas").document(umbrella_id).set(data)
    
    def update_umbrella(self, umbrella_id: str, data: dict[str, Any]) -> None:
        """Update an existing umbrella."""
        self.db.collection("umbrellas").document(umbrella_id).update(data)
    
    def get_all_umbrellas(self) -> list[dict[str, Any]]:
        """Get all umbrellas."""
        docs = self.db.collection("umbrellas").stream()
        return [_serialize_firestore(doc.to_dict()) for doc in docs]
    
    def umbrella_exists(self, umbrella_id: str) -> bool:
        """Check if an umbrella exists."""
        return self.db.collection("umbrellas").document(umbrella_id).get().exists
    
    # =========================================================================
    # RETRIEVAL POOL
    # =========================================================================
    
    def get_retrieval_pool(self, umbrella_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Get items from retrieval pool, optionally filtered by umbrella."""
        query = self.db.collection("retrieval_pool")
        if umbrella_id:
            query = query.where("umbrella_id", "==", umbrella_id)
        docs = query.stream()
        return [_serialize_firestore(doc.to_dict()) for doc in docs]
    
    def add_to_pool(self, item_id: str, data: dict[str, Any]) -> None:
        """Add an item to the retrieval pool."""
        data["fetched_at"] = datetime.utcnow().isoformat()
        self.db.collection("retrieval_pool").document(item_id).set(data, merge=True)
    
    def get_pool_item(self, item_id: str) -> Optional[dict[str, Any]]:
        """Get a single item from the retrieval pool."""
        doc = self.db.collection("retrieval_pool").document(item_id).get()
        return _serialize_firestore(doc.to_dict()) if doc.exists else None
    
    def pool_url_exists(self, url: str) -> bool:
        """Check if a URL already exists in the pool."""
        docs = self.db.collection("retrieval_pool").where("url", "==", url).limit(1).stream()
        return any(True for _ in docs)
    
    def clean_old_pool_items(self, max_age_days: int = 3) -> int:
        """Delete pool items older than max_age_days. Returns count of deleted items."""
        cutoff = (datetime.utcnow() - timedelta(days=max_age_days)).isoformat()
        docs = self.db.collection("retrieval_pool").where("fetched_at", "<", cutoff).stream()
        
        deleted = 0
        for doc in docs:
            doc.reference.delete()
            deleted += 1
        
        return deleted
    
    # =========================================================================
    # QUERY USERS
    # =========================================================================
    
    def get_query_users(self, query_id: str) -> Optional[dict[str, Any]]:
        """Get users subscribed to a specific query."""
        doc = self.db.collection("query_users").document(query_id).get()
        return _serialize_firestore(doc.to_dict()) if doc.exists else None
    
    def add_user_to_query(self, query_id: str, user_id: str, query_text: str, umbrella_id: str) -> None:
        """Add a user to a query. Creates the query_users doc if it doesn't exist."""
        from firebase_admin import firestore
        
        doc_ref = self.db.collection("query_users").document(query_id)
        doc = doc_ref.get()
        
        if doc.exists:
            doc_ref.update({
                "users": firestore.ArrayUnion([user_id]),
                "user_count": firestore.Increment(1)
            })
        else:
            doc_ref.set({
                "query_id": query_id,
                "query_text": query_text,
                "umbrella_id": umbrella_id,
                "users": [user_id],
                "user_count": 1,
                "last_searched": None
            })
    
    def remove_user_from_query(self, query_id: str, user_id: str) -> None:
        """Remove a user from a query."""
        from firebase_admin import firestore
        
        doc_ref = self.db.collection("query_users").document(query_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            if user_id in data.get("users", []):
                doc_ref.update({
                    "users": firestore.ArrayRemove([user_id]),
                    "user_count": firestore.Increment(-1)
                })
    
    def get_active_queries(self, min_users: int = 1) -> list[dict[str, Any]]:
        """Get all queries with at least min_users subscribers."""
        docs = self.db.collection("query_users").where("user_count", ">=", min_users).stream()
        return [_serialize_firestore(doc.to_dict()) for doc in docs]
    
    def update_query_last_searched(self, query_id: str) -> None:
        """Update the last_searched timestamp for a query."""
        self.db.collection("query_users").document(query_id).update({
            "last_searched": datetime.utcnow().strftime("%Y-%m-%d")
        })
    
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


def get_store() -> FirestoreStore:
    """Get the FirestoreStore instance."""
    return FirestoreStore()

