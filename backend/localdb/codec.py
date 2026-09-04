"""Deterministic JSON encoding for Firestore-shaped document data."""

from __future__ import annotations

import base64
import datetime as _datetime
import decimal
import hashlib
import json
import math
from typing import Any


def denormalise_value(value: Any) -> Any:
    """Expose stored Firestore values in the JSON-friendly shape callers use."""

    if isinstance(value, list):
        return [denormalise_value(item) for item in value]
    if isinstance(value, dict):
        marker = value.get("__localdb_type__")
        if marker in {"timestamp", "date"} and isinstance(value.get("value"), str):
            return value["value"]
        if marker == "reference" and isinstance(value.get("path"), str):
            return value["path"]
        if marker == "bytes" and isinstance(value.get("base64"), str):
            return value["base64"]
        return {key: denormalise_value(item) for key, item in value.items()}
    return value


def normalise_value(value: Any) -> Any:
    """Return JSON-safe data with stable tags for common Firestore values."""

    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        if math.isfinite(value):
            return value
        return {
            "__localdb_type__": (
                "nan" if math.isnan(value) else "positive_infinity" if value > 0 else "negative_infinity"
            )
        }
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("document field names must be strings")
            result[key] = normalise_value(item)
        return result
    if isinstance(value, (list, tuple)):
        return [normalise_value(item) for item in value]
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {
            "__localdb_type__": "bytes",
            "base64": base64.b64encode(bytes(value)).decode("ascii"),
        }
    if isinstance(value, _datetime.datetime):
        return {"__localdb_type__": "timestamp", "value": value.isoformat()}
    if isinstance(value, _datetime.date):
        return {"__localdb_type__": "date", "value": value.isoformat()}
    if isinstance(value, decimal.Decimal):
        return {"__localdb_type__": "decimal", "value": str(value)}

    value_type = type(value).__name__
    if value_type == "DocumentReference" and hasattr(value, "path"):
        return {"__localdb_type__": "reference", "path": str(value.path)}
    if value_type == "GeoPoint" and hasattr(value, "latitude") and hasattr(value, "longitude"):
        return {
            "__localdb_type__": "geopoint",
            "latitude": float(value.latitude),
            "longitude": float(value.longitude),
        }

    raise TypeError(f"unsupported document value type: {value_type}")


def canonical_json(value: Any) -> str:
    return json.dumps(
        normalise_value(value),
        ensure_ascii=True,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def stable_document_hash(path: str, data: Any) -> str:
    payload = canonical_json({"path": path, "data": data}).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
