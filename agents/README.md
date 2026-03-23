# Kwitt Agents

Agentes Python con LangGraph para creación automática de portafolios.

## Estructura

```
src/
├── agents/
│   ├── state.py          # AgentState + PortfolioSpec (Pydantic)
│   ├── intake.py         # Parser de prompts → JSON (con reintentos)
│   ├── creative.py       # Orquestador OpenCode (con timeouts)
│   ├── deploy.py         # GitHub + Vercel API (reutiliza repos)
│   └── monitor.py        # Auto-repair de errores
├── orchestrator.py       # Workflow principal LangGraph
├── server.py            # FastAPI REST (con persistencia)
├── tools/
│   ├── docker_manager.py # Gestor de contenedores
│   └── job_storage.py   # Persistencia de jobs en archivo
```

## Mejoras Implementadas

### 1. Intake Robusto
- Reintentos automáticos si el LLM falla
- Extracción de JSON robusta (maneja markdown)
- Validación de campos con defaults

### 2. Persistencia de Jobs
- Jobs guardados en `/app/data/jobs/`
- Limpieza automática de jobs >24h
- API para listar/eliminar jobs

### 3. Reutilización de Repo
- Detecta si el repo ya existe
- Reutiliza repo existente si existe
- Solo crea nuevo si no existe

### 4. Timeouts Configurables
- `OPENCODE_TIMEOUT` (default: 300s)
- Mejor logging para debugging

## Instalación

```bash
cd agents
pip install -r requirements.txt
```

## Desarrollo

```bash
# Iniciar servidor
python -m src.server

# O con uvicorn
uvicorn src.server:app --reload --port 8000
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/portfolio/config` | Configuración |
| POST | `/portfolio/create` | Crea portafolio (sync) |
| POST | `/portfolio/create/stream` | Crea portafolio (streaming) |
| POST | `/portfolio/update` | Actualiza portafolio |
| GET | `/portfolio/status/{job_id}` | Estado del job |
| GET | `/portfolio/jobs` | Lista todos los jobs |
| DELETE | `/portfolio/jobs/{job_id}` | Elimina job |

## Variables de Entorno

```bash
# Requeridas
GITHUB_TOKEN=...
VERCEL_API_TOKEN=...

# Opcionales
OPENAI_API_KEY=...
OPENCODE_MODEL=minimax-m2.5-free
OPENAI_BASE_URL=https://opencode.ai/v1
WORKSPACE=/app/workspace
OPENCODE_TIMEOUT=300
JOBS_DIR=/app/data/jobs
```

## Docker

```bash
docker build -t kwitt-agents ./agents
docker run -p 8000:8000 --env-file .env kwitt-agents
```
