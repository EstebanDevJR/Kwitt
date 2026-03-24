FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl bash unzip

RUN curl -fsSL https://opencode.ai/install -o /tmp/install.sh && \
    head -c 100 /tmp/install.sh | grep -q "bin/bash" && \
    chmod +x /tmp/install.sh && \
    bash /tmp/install.sh && \
    rm /tmp/install.sh

ENV PATH="/root/.opencode/bin:$PATH"

COPY package*.json ./

RUN npm install

COPY src ./src

CMD ["node", "src/index.js"]