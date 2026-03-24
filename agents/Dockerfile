FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://opencode.ai/install -o /tmp/install.sh && \
    head -c 100 /tmp/install.sh | grep -q "bin/bash" && \
    chmod +x /tmp/install.sh && \
    bash /tmp/install.sh && \
    rm /tmp/install.sh && \
    mv /root/.opencode/bin/opencode /usr/local/bin/ && \
    chmod +x /usr/local/bin/opencode

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

RUN mkdir -p /app/workspace

ENV PYTHONPATH=/app/src
ENV WORKSPACE=/app/workspace
ENV PATH="/root/.opencode/bin:/usr/local/bin:$PATH"
ENV OPENCODE_BIN=/usr/local/bin/opencode

EXPOSE 8000

CMD ["uvicorn", "src.server:app", "--host", "0.0.0.0", "--port", "8000"]