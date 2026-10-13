# Pipeline scheduler: builds the trending + pulse feeds on a timer.
FROM python:3.12-slim
# The pipeline (v1/v2/v3 packages) lives in backend/ and runs from there.
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app/backend
COPY docker/pipeline-loop.sh /usr/local/bin/pipeline-loop.sh
RUN chmod +x /usr/local/bin/pipeline-loop.sh
ENV PYTHONUNBUFFERED=1 \
    TRACE_DB=local \
    TRACE_LOCALDB_PATH=/data/documents.sqlite3
VOLUME /data
CMD ["pipeline-loop.sh"]
