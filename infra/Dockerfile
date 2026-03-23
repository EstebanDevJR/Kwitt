FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY bot/package.json ./bot/

RUN npm install

COPY . .

EXPOSE 3001 3000

CMD ["sh", "-c", "echo 'Kwitt ready'"]