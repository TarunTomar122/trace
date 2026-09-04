"""Validation shared by the local store, API, and migration tools."""

from __future__ import annotations

from pathlib import Path


def _segments(value: str, *, allow_wildcard: bool = False) -> list[str]:
    if not isinstance(value, str) or not value or "\x00" in value:
        raise ValueError("path must be a non-empty string")
    pieces = value.split("/")
    if any(not piece or piece in {".", ".."} for piece in pieces):
        raise ValueError("path contains an invalid segment")
    if not allow_wildcard and any(piece == "*" for piece in pieces):
        raise ValueError("wildcards are not allowed here")
    return pieces


def validate_document_path(path: str) -> str:
    pieces = _segments(path)
    if len(pieces) < 2 or len(pieces) % 2:
        raise ValueError("document path must contain collection/document pairs")
    return "/".join(pieces)


def validate_path_prefix(prefix: str) -> str:
    return "/".join(_segments(prefix))


def validate_collection_name(collection: str) -> str:
    pieces = _segments(collection)
    if len(pieces) != 1:
        raise ValueError("collection must be one path segment")
    return pieces[0]


def validate_local_file_path(path: str | Path) -> Path:
    raw = str(path)
    if not raw or "\x00" in raw:
        raise ValueError("local file path must be non-empty")
    candidate = Path(path).expanduser()
    if ".." in candidate.parts:
        raise ValueError("parent traversal is not allowed in local file paths")
    if candidate.name in {"", ".", ".."}:
        raise ValueError("local file path must name a file")
    return candidate
