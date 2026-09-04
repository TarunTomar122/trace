"""Compatibility patches for google-cloud-firestore."""

from __future__ import annotations


def disable_broken_firestore_stream_retry() -> None:
    """Make query streams raise the real error instead of crashing.

    google-cloud-firestore's ``_retry_query_after_exception`` accesses
    ``transport.run_query._retry``, an attribute that only unary callables
    have. On any mid-stream exception this raises AttributeError and masks
    the actual error. Returning False propagates the original exception so
    callers can retry at their own layer (checkpoint resume, systemd timers).
    Safe across versions: patching to "never retry" only changes error
    reporting, not query behavior.
    """
    from google.cloud.firestore_v1.query import Query

    def _no_retry(self, exc, retry, transaction):  # noqa: ANN001
        _ = exc, retry, transaction
        return False

    Query._retry_query_after_exception = _no_retry
