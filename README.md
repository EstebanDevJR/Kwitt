# Kwitt - AI-Powered Portfolio OS

An intelligent portfolio management system controlled via Telegram using natural language.

## 🌟 Features

- **Telegram Bot Control**: Manage your portfolio with natural language commands
- **AI-Powered Intent Detection**: Automatically understands your requests
- **Automated Git Workflow**: Commits and pushes changes automatically
- **Modern Frontend**: Next.js with stunning GSAP animations
- **Multi-Agent Architecture**: Specialized agents collaborate for complex tasks

## 🏗️ Architecture

```
kwitt/
├── agents/        # AI agents (Orchestrator, Intent, Portfolio, Code, Git, etc.)
├── tools/         # Tool system (Filesystem, Git, Telegram, LLM)
├── backend/       # REST API with SQLite
├── frontend/      # Next.js portfolio with GSAP
├── bot/           # Telegram bot integration
├── orchestrator/  # Agent coordination layer
├── core/          # Shared types and constants
└── infra/         # Docker and deployment configs
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Telegram Bot Token (from @BotFather)
- OpenAI API Key
- GitHub Personal Access Token

### Installation

```bash
# Clone the repository
git clone https://github.com/EstebanDevJR/Kwitt.git
cd Kwitt

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Start backend with Docker
docker-compose up -d

# Install frontend dependencies
cd frontend && npm install

# Start frontend
npm run dev
```

### Telegram Commands

- `agrega proyecto [github-url]` - Add a new project
- `actualiza mi bio [texto]` - Update your bio
- `cambia mi contacto [info]` - Update contact info
- `elimina proyecto [nombre]` - Remove a project
- `reordena proyectos` - Change project order
- `hazlo más moderno` - Enhance with animations

## 🛠️ Tech Stack

- **Backend**: Fastify, SQLite, Drizzle ORM
- **Frontend**: Next.js 14, Tailwind CSS, GSAP
- **AI**: OpenAI GPT-4o
- **Bot**: Telegram Bot API
- **DevOps**: Docker, Docker Compose

## 📄 License

MIT