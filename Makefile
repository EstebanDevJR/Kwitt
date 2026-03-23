.PHONY: help install dev backend frontend bot docker-up docker-down docker-build clean test

help:
	@echo "🚀 Kwitt - Comandos disponibles:"
	@echo ""
	@echo "  make install      - Instalar todas las dependencias"
	@echo "  make dev          - Iniciar todos los servicios en desarrollo"
	@echo "  make backend      - Iniciar solo el backend"
	@echo "  make frontend     - Iniciar solo el frontend"
	@echo "  make bot          - Iniciar solo el bot de Telegram"
	@echo "  make docker-up    - Iniciar servicios con Docker"
	@echo "  make docker-down  - Detener servicios Docker"
	@echo "  make docker-build - Construir imágenes Docker"
	@echo "  make clean        - Limpiar node_modules y build"

install:
	cd backend && npm install
	cd frontend && npm install
	cd bot && npm install

dev: install
	@echo "🚀 Iniciando servicios..."
	@echo "Backend: http://localhost:3001"
	@echo "Frontend: http://localhost:3000"
	cd backend && npm run dev & \
	cd frontend && npm run dev & \
	cd bot && npm run dev

backend:
	cd backend && npm run dev

frontend:
	cd frontend && npm run dev

bot:
	cd bot && npm run dev

docker-up:
	docker-compose -f infra/docker-compose.yml up -d
	@echo "✅ Servicios iniciados"
	@echo "  - Backend: http://localhost:3001"
	@echo "  - Frontend: http://localhost:3000"

docker-down:
	docker-compose -f infra/docker-compose.yml down

docker-build:
	docker-compose -f infra/docker-compose.yml build

clean:
	rm -rf backend/node_modules frontend/node_modules bot/node_modules
	rm -rf frontend/.next backend/dist

test:
	@echo "🧪 Ejecutando tests..."
	@echo "No hay tests configurados aún"