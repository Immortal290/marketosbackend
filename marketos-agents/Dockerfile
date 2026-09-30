FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
ENV PYTHONDONTWRITEBYTECODE=1
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

# Copy startup script and make it executable
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose the API server port
EXPOSE 8000

# Use shell script so ${PORT} is properly expanded at runtime.
# CMD ["sh", "-c", "... ${PORT} ..."] with array syntax does NOT expand
# environment variables — the script form is required.
CMD ["sh", "./start.sh"]

