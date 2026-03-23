# Kwitt - AI-Powered Portfolio OS

An intelligent portfolio management system controlled via Telegram using natural language and AI agents. Create and deploy professional portfolios without writing code!

## 🌟 Features

- **AI Agents (v2.0)**: Python LangGraph agents that create complete portfolios from natural language prompts
- **Auto-Deploy**: Automatically creates GitHub repo and deploys to Vercel
- **Auto-Repair**: Agents analyze errors and retry automatically
- **Telegram Bot Control**: Manage your portfolio with natural language commands
- **Modern Frontend**: Next.js 14 with stunning GSAP animations and glassmorphism design
- **Docker Ready**: Full containerization with docker-compose
- **Backward Compatible**: Legacy mode available without AI

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+ (for agents)
- Docker & Docker Compose
- Telegram Bot Token (from @BotFather)
- GitHub Token (with repo scope)
- Vercel API Token

### 1. Clone and Configure

```bash
git clone https://github.com/EstebanDevJR/Kwitt.git
cd Kwitt
cp .env.example .env
```

### 2. Edit `.env`

```env
# Telegram (required)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# GitHub (required for deploy)
GITHUB_TOKEN=your_github_pat_with_repo_scope

# Vercel (required for deploy)
VERCEL_API_TOKEN=your_vercel_token

# OpenAI/AI (optional, uses opencode.ai by default)
OPENAI_API_KEY=your_key_if_having
OPENCODE_MODEL=minimax-m2.5-free

# Enable AI agents (default: true)
AGENTS_ENABLED=true
```

### 3. Run with Docker

```bash
docker-compose -f infra/docker-compose.yml up -d

# View logs
docker-compose -f infra/docker-compose.yml logs -f bot
```

### 4. Manual Development

```bash
# Terminal 1: Start agents
cd agents
pip install -r requirements.txt
python -m src.server

# Terminal 2: Start bot
cd bot
npm install
npm run dev
```

## 📖 Commands (v2.0)

Send these to your Telegram bot:

| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `/ayuda` | Show help |
| `/agents` | Check agents status |

### Portfolio Creation (AI)

| Example | Description |
|---------|-------------|
| "crea un portafolio para dev fullstack" | Creates full portfolio |
| "quiero un portafolio oscuro profesional" | Dark themed portfolio |
| "hazme un portafolio minimal" | Minimal style |

### Portfolio Updates (AI)

| Example | Description |
|---------|-------------|
| "agrega proyecto github.com/user/repo" | Add project |
| "cambia el tema a claro" | Change theme |
| "actualiza mi bio a desarrollador fullstack" | Update bio |

## 🏗️ Architecture

```
kwitt/
├── bot/                    # Telegram Bot (Node.js)
│   └── src/
│       ├── index.js        # Entry point
│       ├── handlers/
│       │   ├── agents.js   # AI agents integration
│       │   └── message.js  # Router (dual mode)
│       └── data/           # Portfolio data layer
├── agents/                 # AI Agents (Python + LangGraph)
│   └── src/
│       ├── agents/
│       │   ├── intake.py   # Parse prompts → JSON
│       │   ├── creative.py # Execute OpenCode
│       │   ├── deploy.py   # GitHub + Vercel
│       │   └── monitor.py  # Auto-repair
│       ├── orchestrator.py # LangGraph workflow
│       └── server.py       # FastAPI REST
├── frontend/              # Next.js 14 portfolio
├── infra/                  # Docker configs
└── data/                   # Portfolio data
```

### Agent Workflow

```
User → Telegram Bot → Intake Agent (LLM)
                           ↓
                    PortfolioSpec (JSON)
                           ↓
                    Creative Agent (OpenCode)
                           ↓
                    Files Created
                           ↓
                    Monitor Agent (auto-repair if error)
                           ↓
                    Deploy Agent (GitHub + Vercel)
                           ↓
                    URL Final
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | From @BotFather |
| `TELEGRAM_CHAT_ID` | No | Restrict to user |
| `GITHUB_TOKEN` | Yes* | For auto-deploy |
| `VERCEL_API_TOKEN` | Yes* | For auto-deploy |
| `AGENTS_ENABLED` | No | Default: true |
| `OPENCODE_MODEL` | No | Default: minimax-m2.5-free |

*Required only for auto-deploy feature

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| bot | 3002 | Telegram bot |
| agents | 8000 | Python LangGraph API |
| frontend | 3000 | Next.js portfolio |
| backend | 3001 | Backend API |

## 🛠️ Tech Stack

- **Bot**: Node.js, Telegram Bot API, Fastify
- **Agents**: Python 3.11, LangGraph, FastAPI
- **Frontend**: Next.js 14, Tailwind CSS 3.4, GSAP 3.12
- **AI**: OpenCode, LangChain (OpenAI/Anthropic compatible)
- **DevOps**: Docker, Docker Compose

## 🔄 Legacy Mode

If you prefer not to use AI agents, set:

```env
AGENTS_ENABLED=false
```

This enables the legacy mode with pattern matching intent parsing.

## 📄 License

MIT - Created by EstebanDevJR
