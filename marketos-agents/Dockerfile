FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if required (e.g. build-essential for compiling custom packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python modules (agents, core, schemas, utils, graph, models, api, worker, main)
COPY agents/ ./agents/
COPY core/ ./core/
COPY schemas/ ./schemas/
COPY utils/ ./utils/
COPY graph/ ./graph/
COPY models/ ./models/
COPY api.py ./
COPY main.py ./
COPY worker.py ./

# Expose the API server port for FastAPI and agent pipeline
EXPOSE 8000
EXPOSE 8765

# Command to run FastAPI server on 0.0.0.0 and persistent Kafka worker concurrently
CMD ["sh", "-c", "python -m uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000} & python worker.py"]
