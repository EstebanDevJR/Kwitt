# Kwitt Architecture v2.0

## 🎯 Arquitectura: Agentes AI con LangGraph

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Telegram Bot (Node.js)                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ handlers/agents.js                                           │    │
│  └────────────────────┬───────────────────────────────────────────┘  │
└──────────────────────┼──────────────────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Agents Service (Python + LangGraph)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Intake       │──│ Creative     │──│ Deploy       │               │
│  │ (parsea)     │  │ (OpenCode)   │  │ (Git+Vercel) │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│         │                 │                 │                         │
│  ┌──────▼──────────────────▼──────────────────▼──────┐              │
│  │              Monitor (Auto-repair)                   │              │
│  └────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Estructura del Proyecto

```
kwitt/
├── bot/                    # Telegram Bot (Node.js)
│   ├── src/
│   │   ├── index.js        # Entry point
│   │   ├── config.js       # Configuración
│   │   └── handlers/
│   │       ├── agents.js   # Integración con agentes
│   │       └── message.js  # Router
│   └── Dockerfile
├── agents/                 # Python LangGraph agents
│   ├── src/
│   │   ├── agents/
│   │   │   ├── state.py        # AgentState + PortfolioSpec
│   │   │   ├── intake.py       # Parser de prompts
│   │   │   ├── creative.py     # Orquestador OpenCode
│   │   │   ├── deploy.py       # GitHub + Vercel
│   │   │   └── monitor.py      # Auto-repair
│   │   ├── orchestrator.py     # Workflow LangGraph
│   │   ├── server.py           # FastAPI REST
│   │   └── tools/
│   │       └── job_storage.py  # Persistencia
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/              # Next.js 14 portfolio
├── skills/                # OpenCode skills (GSAP)
├── infra/                 # Docker configs
│   └── docker-compose.yml
└── data/                  # Portfolio data
```

## Flujo de Usuario

1. Usuario envía: *"Crea un portafolio para dev fullstack"*
2. **Bot** detecta request → `/portfolio/create`
3. **Intake** → LLM estructura → JSON PortfolioSpec
4. **Creative** → OpenCode crea archivos
5. **Monitor** → Si error, reintenta automáticamente
6. **Deploy** → GitHub repo + Vercel deploy → URL

## Variables de Entorno

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | De @BotFather |
| `TELEGRAM_CHAT_ID` | ❌ | Restringir acceso |
| `GITHUB_TOKEN` | ✅* | Para auto-deploy |
| `VERCEL_API_TOKEN` | ✅* | Para auto-deploy |
| `AGENTS_ENABLED` | ❌ | Default: true |
| `OPENCODE_MODEL` | ❌ | Default: minimax-m2.5-free |

*Solo requerido para auto-deploy

## Comandos

```bash
# Docker (recomendado)
make docker-up
make docker-down

# Desarrollo
make install
make dev

# Limpiar
make clean
```
