import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional


def _serialize_firestore(obj: Any) -> Any:
    """Recursively convert Firestore types to JSON-serializable types."""
    if obj is None:
        return obj
    if hasattr(obj, 'isoformat'):  # datetime-like
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialize_firestore(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_firestore(i) for i in obj]
    return obj


COLLECTIONS = {
    "user_profiles": "user_profiles",
    "user_preferences": "user_preferences",
    "user_patterns": "user_patterns",
    "user_feeds": "user_feeds",
    "user_interactions": "user_interactions",
    "user_seen_urls": "user_seen_urls",
    "retrieval_pool": "retrieval_pool",
    "trending_queries": "trending_queries",
    "user_memory": "user_memory",
    "agent_runs": "agent_runs",
}

MEMORY_COLLECTION_MAP = {
    "preferences.json": COLLECTIONS["user_preferences"],
    "patterns.json": COLLECTIONS["user_patterns"],
}


class BaseStore:
    def read_user_profile(self, user_ref: str) -> str:
        raise NotImplementedError

    def read_memory(self, user_ref: str, file_name: str) -> str:
        raise NotImplementedError

    def write_memory(self, user_ref: str, file_name: str, data: str) -> str:
        raise NotImplementedError

    def read_daily_interactions(self, user_ref: str, date: str) -> str:
        raise NotImplementedError

    def read_daily_activity(self, user_ref: str, date: str) -> str:
        raise NotImplementedError

    def get_seen_urls(self, user_ref: str, days: int = 14) -> str:
        raise NotImplementedError

    def save_feed(self, user_ref: str, date: str, items: str) -> str:
        raise NotImplementedError

    def get_retrieval_pool_entry(self, key: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def set_retrieval_pool_entry(self, key: str, data: Dict[str, Any]) -> None:
        raise NotImplementedError

    def get_trending_queries(self) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def set_trending_queries(self, data: Dict[str, Any]) -> None:
        raise NotImplementedError


class FileStore(BaseStore):
    def __init__(self, users_dir: Optional[str] = None) -> None:
        self.users_dir = Path(users_dir or os.getenv("TRACE_USERS_DIR", "users"))
        self.cache_dir = Path(os.getenv("TRACE_CACHE_DIR", "cache"))

    def _resolve_user_folder(self, user_ref: str) -> Path:
        candidate = Path(user_ref)
        if candidate.is_absolute():
            return candidate
        if str(candidate).startswith(str(self.users_dir)):
            return candidate
        return self.users_dir / candidate

    def _memory_dir(self, user_ref: str) -> Path:
        return self._resolve_user_folder(user_ref) / "memory"

    def _feeds_dir(self, user_ref: str) -> Path:
        return self._resolve_user_folder(user_ref) / "feeds"

    def _daily_dir(self, user_ref: str) -> Path:
        return self._memory_dir(user_ref) / "daily"

    def read_user_profile(self, user_ref: str) -> str:
        file_path = self._memory_dir(user_ref) / "user_profile.json"
        if not file_path.exists():
            return "{}"
        return file_path.read_text()

    def read_memory(self, user_ref: str, file_name: str) -> str:
        file_path = self._memory_dir(user_ref) / file_name
        if not file_path.exists():
            return "{}"
        return file_path.read_text()

    def write_memory(self, user_ref: str, file_name: str, data: str) -> str:
        file_path = self._memory_dir(user_ref) / file_name
        file_path.parent.mkdir(parents=True, exist_ok=True)
        parsed = json.loads(data)
        file_path.write_text(json.dumps(parsed, indent=2))
        return f"Written to {file_name}"

    def read_daily_interactions(self, user_ref: str, date: str) -> str:
        file_path = self._daily_dir(user_ref) / f"{date}_interactions.json"
        if not file_path.exists():
            return "[]"
        return file_path.read_text()

    def read_daily_activity(self, user_ref: str, date: str) -> str:
        file_path = self._daily_dir(user_ref) / f"{date}_activity.json"
        if not file_path.exists():
            return "[]"
        return file_path.read_text()

    def get_seen_urls(self, user_ref: str, days: int = 14) -> str:
        seen_file = self._memory_dir(user_ref) / "seen_urls.json"
        if not seen_file.exists():
            return "[]"
        seen_data = json.loads(seen_file.read_text())
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        recent_urls = [url for url, date in seen_data.items() if date >= cutoff]
        return json.dumps(recent_urls)

    def save_feed(self, user_ref: str, date: str, items: str) -> str:
        parsed_items = json.loads(items)
        feeds_dir = self._feeds_dir(user_ref)
        feeds_dir.mkdir(parents=True, exist_ok=True)
        file_path = feeds_dir / f"{date}_feed.json"
        file_path.write_text(json.dumps(parsed_items, indent=2))

        seen_file = self._memory_dir(user_ref) / "seen_urls.json"
        seen_data: Dict[str, str] = {}
        if seen_file.exists():
            seen_data = json.loads(seen_file.read_text())
        for item in parsed_items:
            if item.get("url"):
                seen_data[item["url"]] = date
        cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        seen_data = {url: d for url, d in seen_data.items() if d >= cutoff}
        seen_file.write_text(json.dumps(seen_data, indent=2))
        return f"Feed with {len(parsed_items)} items saved to {date}_feed.json"

    def get_retrieval_pool_entry(self, key: str) -> Optional[Dict[str, Any]]:
        file_path = self.cache_dir / "retrieval_pool" / f"{key}.json"
        if not file_path.exists():
            return None
        return json.loads(file_path.read_text())

    def set_retrieval_pool_entry(self, key: str, data: Dict[str, Any]) -> None:
        dir_path = self.cache_dir / "retrieval_pool"
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / f"{key}.json"
        file_path.write_text(json.dumps(data, indent=2))

    def get_trending_queries(self) -> Optional[Dict[str, Any]]:
        file_path = self.cache_dir / "trending_queries.json"
        if not file_path.exists():
            return None
        return json.loads(file_path.read_text())

    def set_trending_queries(self, data: Dict[str, Any]) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        file_path = self.cache_dir / "trending_queries.json"
        file_path.write_text(json.dumps(data, indent=2))


class FirestoreStore(BaseStore):
    def __init__(self) -> None:
        from firebase_admin import credentials, firestore, initialize_app

        import firebase_admin
        if not firebase_admin._apps:
            service_account_key = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "").strip()
            service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
            if service_account_key:
                try:
                    cred = credentials.Certificate(json.loads(service_account_key))
                    initialize_app(cred)
                except json.JSONDecodeError:
                    if service_account_path:
                        cred = credentials.Certificate(service_account_path)
                        initialize_app(cred)
                    else:
                        raise
            elif service_account_path:
                cred = credentials.Certificate(service_account_path)
                initialize_app(cred)
            else:
                initialize_app()
        self.db = firestore.client()

    def _doc(self, collection: str, doc_id: str):
        return self.db.collection(collection).document(doc_id)

    def read_user_profile(self, user_ref: str) -> str:
        doc = self._doc(COLLECTIONS["user_profiles"], user_ref).get()
        data = doc.to_dict()
        if data is None:
            print(f"[DEBUG] FirestoreStore.read_user_profile: doc.exists={doc.exists}, doc.id={doc.id}")
            return "{}"
        return json.dumps(_serialize_firestore(data))

    def read_memory(self, user_ref: str, file_name: str) -> str:
        collection = MEMORY_COLLECTION_MAP.get(file_name, COLLECTIONS["user_memory"])
        doc = self._doc(collection, user_ref).get()
        return json.dumps(_serialize_firestore(doc.to_dict() or {}))

    def write_memory(self, user_ref: str, file_name: str, data: str) -> str:
        collection = MEMORY_COLLECTION_MAP.get(file_name, COLLECTIONS["user_memory"])
        parsed = json.loads(data)
        self._doc(collection, user_ref).set(parsed, merge=True)
        return f"Written to {file_name}"

    def read_daily_interactions(self, user_ref: str, date: str) -> str:
        doc = self._doc(COLLECTIONS["user_interactions"], user_ref).collection("daily").document(date).get()
        payload = doc.to_dict() or {}
        return json.dumps(_serialize_firestore(payload.get("items", [])))

    def read_daily_activity(self, user_ref: str, date: str) -> str:
        doc = self._doc(COLLECTIONS["user_interactions"], user_ref).collection("activity").document(date).get()
        payload = doc.to_dict() or {}
        return json.dumps(_serialize_firestore(payload.get("items", [])))

    def get_seen_urls(self, user_ref: str, days: int = 14) -> str:
        doc = self._doc(COLLECTIONS["user_seen_urls"], user_ref).get()
        payload = doc.to_dict() or {}
        urls = payload.get("urls", {})
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        recent_urls = [url for url, date in urls.items() if date >= cutoff]
        return json.dumps(recent_urls)

    def save_feed(self, user_ref: str, date: str, items: str) -> str:
        parsed_items = json.loads(items)
        self._doc(COLLECTIONS["user_feeds"], user_ref).collection("daily").document(date).set(
            {"date": date, "items": parsed_items, "generated_at": datetime.utcnow().isoformat()},
            merge=True,
        )
        seen_doc = self._doc(COLLECTIONS["user_seen_urls"], user_ref)
        seen_payload = seen_doc.get().to_dict() or {"urls": {}}
        urls = seen_payload.get("urls", {})
        for item in parsed_items:
            if item.get("url"):
                urls[item["url"]] = date
        cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        urls = {url: d for url, d in urls.items() if d >= cutoff}
        seen_doc.set({"urls": urls, "updated_at": datetime.utcnow().isoformat()}, merge=True)
        return f"Feed with {len(parsed_items)} items saved for {date}"

    def get_retrieval_pool_entry(self, key: str) -> Optional[Dict[str, Any]]:
        doc = self._doc(COLLECTIONS["retrieval_pool"], key).get()
        return _serialize_firestore(doc.to_dict()) if doc.exists else None

    def set_retrieval_pool_entry(self, key: str, data: Dict[str, Any]) -> None:
        self._doc(COLLECTIONS["retrieval_pool"], key).set(data, merge=True)

    def get_trending_queries(self) -> Optional[Dict[str, Any]]:
        doc = self._doc(COLLECTIONS["trending_queries"], "global").get()
        return _serialize_firestore(doc.to_dict()) if doc.exists else None

    def set_trending_queries(self, data: Dict[str, Any]) -> None:
        self._doc(COLLECTIONS["trending_queries"], "global").set(data, merge=True)


def get_store() -> BaseStore:
    backend = os.getenv("STORAGE_BACKEND", "file").lower()
    if backend == "firestore":
        return FirestoreStore()
    return FileStore()

