FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl bash unzip

RUN curl -fsSL https://opencode.ai/install | bash

ENV PATH="/root/.opencode/bin:$PATH"

COPY package*.json ./

RUN npm install

COPY src ./src

CMD ["node", "src/index.js"]