.PHONY: help install dev agents bot docker-up docker-down docker-build clean test

help:
	@echo "🚀 Kwitt v2.0 - Comandos disponibles:"
	@echo ""
	@echo "  make install       - Instalar todas las dependencias"
	@echo "  make dev           - Iniciar todos los servicios en desarrollo"
	@echo "  make dev:agents    - Iniciar solo los agentes"
	@echo "  make dev:bot       - Iniciar solo el bot"
	@echo "  make docker-up     - Iniciar servicios con Docker"
	@echo "  make docker-down   - Detener servicios Docker"
	@echo "  make docker-build  - Construir imágenes Docker"
	@echo "  make clean         - Limpiar dependencias"

install:
	cd bot && npm install
	cd agents && pip install -r requirements.txt

dev: install
	@echo "🚀 Iniciando servicios..."
	@echo "Agentes: http://localhost:8000"
	@echo "Bot: polling de mensajes"
	cd agents && python -m src.server &
	cd bot && npm run dev

dev:agents:
	cd agents && python -m src.server

dev:bot:
	cd bot && npm run dev

docker-up:
	docker-compose -f infra/docker-compose.yml up -d
	@echo "✅ Servicios iniciados"
	@echo "  - Bot: Polling Telegram"
	@echo "  - Agentes: http://localhost:8000"
	@echo "  - OpenCode: Contenedor Docker"

docker-down:
	docker-compose -f infra/docker-compose.yml down

docker-build:
	docker-compose -f infra/docker-compose.yml build

clean:
	rm -rf bot/node_modules
	rm -rf agents/venv
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

test:
	@echo "🧪 Ejecutando tests..."
	cd bot && npm test
