# LocalDB: SQLite-backed, Firestore-compatible document store behind a tiny
# HTTP API. Standard library only - no pip dependencies.
FROM python:3.12-slim
WORKDIR /app
COPY backend/__init__.py backend/__init__.py
COPY backend/localdb backend/localdb
ENV PYTHONUNBUFFERED=1 \
    LOCALDB_PATH=/data/documents.sqlite3 \
    LOCALDB_HOST=0.0.0.0 \
    LOCALDB_PORT=8502
VOLUME /data
EXPOSE 8502
# Needs LOCALDB_API_TOKEN and LOCALDB_ALLOWED_COLLECTIONS (set via compose/.env).
CMD ["sh", "-c", "exec python -m backend.localdb.server --db \"$LOCALDB_PATH\" --host \"$LOCALDB_HOST\" --port \"$LOCALDB_PORT\""]
