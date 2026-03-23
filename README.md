# Kwitt - AI-Powered Portfolio OS

An intelligent portfolio management system controlled via Telegram using natural language. Manage your developer portfolio without touching code - just message the bot!

## 🌟 Features

- **Telegram Bot Control**: Manage your portfolio with natural language commands
- **AI-Powered Intent Detection**: Automatically understands your requests using GPT-4o (or falls back to pattern matching)
- **Automated Git Workflow**: Commits and pushes changes automatically
- **Modern Frontend**: Next.js 14 with stunning GSAP animations and glassmorphism design
- **Modular Architecture**: Clean separation of concerns (parsers, handlers, data layer, CLI executor)
- **Docker Ready**: Full containerization with docker-compose

## 🏗️ Architecture

```
kwitt/
├── bot/                # Telegram bot (modular architecture)
│   └── src/
│       ├── index.js       # Entry point (~80 lines)
│       ├── config.js      # Configuration & constants
│       ├── data/          # Data layer
│       │   └── portfolio.js
│       ├── parsers/       # Intent parsing
│       │   └── intent.js
│       ├── handlers/      # Action handlers & router
│       │   ├── actions.js
│       │   └── message.js
│       ├── cli/           # CLI executor
│       │   └── executor.js
│       └── keyboards/     # Inline keyboards
│           └── index.js
├── frontend/           # Next.js 14 portfolio with GSAP
├── data/              # Portfolio data & versions
└── infra/             # Docker configs
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (optional)
- Telegram Bot Token (from @BotFather)
- OpenAI API Key (optional - bot works without it)

### Local Development

```bash
# 1. Clone and enter directory
git clone https://github.com/EstebanDevJR/Kwitt.git
cd Kwitt

# 2. Install dependencies
cd bot && npm install
cd ../frontend && npm install

# 3. Configure environment
copy .env.example .env
# Edit .env with your credentials

# 4. Start the bot
cd bot && npm run dev
```

### Docker

```bash
# Configure .env first
copy .env.example .env

# Start all services
docker-compose -f infra/docker-compose.yml up -d

# View logs
docker-compose -f infra/docker-compose.yml logs -f
```

## 📖 Commands

Send these to your Telegram bot:

| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `/ayuda` | Show help |
| `/estado` | View portfolio status |
| `me llamo [nombre]` | Set your name |
| `mi bio es [texto]` | Set your bio |
| `agrega proyecto [url]` | Add GitHub project |
| `elimina [proyecto]` | Delete project |
| `tema dark/light` | Change theme |
| `mi email es [email]` | Update email |
| `mi twitter es @user` | Update Twitter |
| `undo` | Undo last change |
| `versiones` | View backups |
| `restaurar` | Restore latest backup |
| `doctor` | Run diagnostics |
| `stats` | View analytics |

### Aliases

| Shortcut | Command |
|----------|---------|
| `/s` | `/estado` |
| `/a [url]` | `agrega proyecto [url]` |
| `/b [texto]` | `actualiza mi bio [texto]` |
| `/d [nombre]` | `elimina proyecto [nombre]` |

## 🛠️ Tech Stack

- **Bot**: Node.js, Telegram Bot API, Fastify (webhook mode)
- **Frontend**: Next.js 14, Tailwind CSS 3.4, GSAP 3.12
- **AI**: OpenAI GPT-4o (optional)
- **DevOps**: Docker, Docker Compose

## 🌐 API Endpoints

When using webhook mode:

```
GET  /health          - Health check
GET  /api/portfolio   - Get portfolio
GET  /api/analytics   - Get analytics
POST /webhook         - Telegram webhook
```

## 🤖 Running without AI

The bot works without OpenAI - it uses pattern matching:

```env
# In .env - leave OPENAI_API_KEY empty
OPENAI_API_KEY=
```

## 📝 Configuration

Required in `.env`:

```env
# Telegram (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token

# Optional - restrict to specific users
TELEGRAM_CHAT_ID=123456789

# Optional - for AI intent parsing
OPENAI_API_KEY=sk-...

# Optional - for Git automation
GITHUB_TOKEN=ghp_...
GIT_BRANCH=main

# Optional - run commands locally instead of via CLI
LOCAL_MODE=true

# Optional - webhook mode
WEBHOOK_URL=https://your-domain.com/webhook
```

## 📄 License

MIT - Created by EstebanDevJR