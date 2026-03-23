# Kwitt - AI-Powered Portfolio OS

An intelligent portfolio management system controlled via Telegram using natural language. Manage your developer portfolio without touching code - just message the bot!

## 🌟 Features

- **Telegram Bot Control**: Manage your portfolio with natural language commands
- **AI-Powered Intent Detection**: Automatically understands your requests using GPT-4o
- **Automated Git Workflow**: Commits and pushes changes automatically
- **Modern Frontend**: Next.js 14 with stunning GSAP animations
- **Multi-Agent Architecture**: Specialized agents collaborate for complex tasks
- **Docker Ready**: Full containerization with docker-compose

## 🏗️ Architecture

```
kwitt/
├── agents/        # AI agents (Orchestrator, Intent, Portfolio, Code, Git, etc.)
├── tools/         # Tool system (Filesystem, Git, Telegram, LLM)
├── backend/       # REST API with Fastify
├── frontend/      # Next.js 14 portfolio with GSAP animations
├── bot/           # Telegram bot with polling
├── core/          # Shared types and constants
└── infra/        # Docker and deployment configs
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional)
- Telegram Bot Token (from @BotFather)
- OpenAI API Key (for AI intent parsing)

### Local Development

```bash
# 1. Clone and enter directory
git clone https://github.com/EstebanDevJR/Kwitt.git
cd Kwitt

# 2. Install dependencies (Windows)
scripts\setup.bat

# Or manually:
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd bot && npm install && cd ..

# 3. Copy and configure environment
copy .env.example .env
# Edit .env with your credentials

# 4. Start services (3 terminals)
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Bot
cd bot && npm run dev
```

### Docker

```bash
# Configure .env first
copy .env.example .env
# Edit with your TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, etc.

# Start all services
docker-compose -f infra/docker-compose.yml up -d

# View logs
docker-compose -f infra/docker-compose.yml logs -f

# Stop
docker-compose -f infra/docker-compose.yml down
```

## 📖 Commands

Send these to your Telegram bot:

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Start the bot | `/start` |
| `/ayuda` | Show help | `/ayuda` |
| `/estado` | View portfolio status | `/estado` |
| `/bio [text]` | Update bio | `/bio Full stack developer` |
| `agrega proyecto [url]` | Add GitHub project | `agrega proyecto https://github.com/user/repo` |
| `actualiza mi bio [text]` | Update bio | `actualiza mi bio Passionate developer` |
| `elimina [project]` | Delete project | `elimina my-project` |
| `hazlo más moderno` | Add GSAP animations | `hazlo más moderno` |
| `mi email es [email]` | Update email | `mi email es me@example.com` |
| `mi twitter es @user` | Update Twitter | `mi twitter es @username` |

## 🛠️ Tech Stack

- **Backend**: Fastify, Node.js
- **Frontend**: Next.js 14, Tailwind CSS 3.4, GSAP 3.12
- **AI**: OpenAI GPT-4o
- **Bot**: Telegram Bot API
- **DevOps**: Docker, Docker Compose

## 🌐 API Endpoints

```
GET    /api/portfolio           - Get full portfolio
GET    /api/portfolio/profile   - Get profile
PUT    /api/portfolio/profile   - Update profile
GET    /api/portfolio/projects  - List projects
POST   /api/portfolio/projects  - Create project
PUT    /api/portfolio/projects/:id - Update project
DELETE /api/portfolio/projects/:id - Delete project
GET    /health                  - Health check
```

## 📁 Project Structure

```
kwitt/
├── agents/           # AI agents
│   ├── orchestrator.ts    # Main coordinator
│   ├── intent.ts          # Intent parsing
│   ├── portfolio.ts       # Portfolio management
│   ├── git.ts            # Git operations
│   ├── frontend.ts       # Frontend modifications
│   ├── code.ts          # Code editing
│   ├── telegram.ts      # Telegram integration
│   └── devops.ts       # DevOps tasks
├── tools/            # Tool system
│   ├── filesystem.ts
│   ├── git.ts
│   ├── telegram.ts
│   └── llm.ts
├── backend/          # Fastify API (port 3001)
├── frontend/        # Next.js app (port 3000)
├── bot/             # Telegram bot
├── infra/           # Docker configs
└── portfolio.json   # Your portfolio data
```

## 🤖 Running without AI

If you don't have an OpenAI key, the bot will use simple pattern matching:

```env
# In .env - leave OPENAI_API_KEY empty
OPENAI_API_KEY=
```

## 📝 Configuration

Required in `.env`:

```env
# Telegram (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# OpenAI (get from platform.openai.com)
OPENAI_API_KEY=sk-...

# Optional - for Git automation
GITHUB_TOKEN=ghp_...
GITHUB_REPO=https://github.com/user/repo.git
```

## 🔧 Make Commands (Linux/Mac)

```bash
make install      # Install all dependencies
make dev          # Start all services
make backend      # Start backend only
make frontend     # Start frontend only
make bot          # Start bot only
make docker-up    # Start with Docker
make docker-down  # Stop Docker
```

## 📄 License

MIT - Created by EstebanDevJR