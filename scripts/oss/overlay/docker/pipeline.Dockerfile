# Pipeline scheduler: builds the trending + pulse feeds on a timer.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend backend
COPY v1 v1
COPY v2 v2
COPY v3 v3
COPY docker/pipeline-loop.sh /usr/local/bin/pipeline-loop.sh
RUN chmod +x /usr/local/bin/pipeline-loop.sh
ENV PYTHONUNBUFFERED=1 \
    TRACE_DB=local \
    TRACE_LOCALDB_PATH=/data/documents.sqlite3
VOLUME /data
CMD ["pipeline-loop.sh"]
