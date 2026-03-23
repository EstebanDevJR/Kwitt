# Kwitt Architecture

## 🧠 CLI-Driven System (Refactored)

Kwitt now uses a **CLI-driven approach** where agents are **decision-makers**, NOT executors. All code changes go through **OpenCode CLI**.

```
┌─────────────────────────────────────────┐
│         Telegram Bot                     │
│   (Receives user input)                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Orchestrator Agent               │
│   (Routes tasks to CLI Agent)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Intent Agent                     │
│   (Parses intent → CLI instruction)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         CLI Agent                        │
│   (Executes OpenCode CLI)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         CLI Runner (core)                │
│   (Safe execution, timeout, logging)     │
└─────────────────┬───────────────────────┘
                  │
         opencode run "<instruction>"
                  │
┌─────────────────▼───────────────────────┐
│         Git Agent                        │
│   (Commit & Push changes)                │
└─────────────────────────────────────────┘
```

## 🔥 Core Principle

**Agents become decision-makers, NOT executors.**

All code changes must go through CLI execution (OpenCode or similar).

## Intent → Instruction Mapping

| User says | Intent | CLI Instruction for OpenCode |
|-----------|--------|------------------------------|
| "agrega proyecto github.com/user/repo" | add_project | "Add a new project to portfolio from GitHub repository. Extract name, description, and tags. Update frontend accordingly." |
| "actualiza mi bio a soy desarrollador" | update_bio | "Update the portfolio bio to: 'soy desarrollador'. Save to portfolio.json." |
| "hazlo más moderno" | enhance_frontend | "Enhance the frontend with modern animations. Add GSAP scroll animations to the hero and project cards." |

## 📁 Project Structure

```
kwitt/
├── agents/              # Agent system (decision-makers only)
│   ├── orchestrator.ts  # Routes tasks to CLI Agent
│   ├── intent.ts        # Parses user intent
│   ├── cli_agent.ts     # Executes OpenCode CLI
│   ├── git.ts          # Git operations
│   ├── telegram.ts     # Telegram wrapper
│   └── index.ts
├── core/                # Core utilities
│   ├── cli_runner.ts   # Safe CLI execution layer
│   ├── types.ts       # TypeScript types
│   └── constants.ts
├── tools/               # External tools
│   ├── llm.ts         # OpenAI integration
│   ├── git.ts         # Git tool
│   ├── telegram.ts    # Telegram tool
│   └── filesystem.ts # Filesystem tool
├── backend/            # REST API
├── frontend/           # Next.js app
├── bot/                # Telegram Bot
└── infra/              # Docker configs
```

## 🛠️ Safe Execution Layer (cli_runner.ts)

Features:
- **Timeout control** (default 120s)
- **Dry-run mode**: `opencode run --dry-run "<instruction>"`
- **Logging**: All commands logged to `./logs/`
- **Error handling**: Captures stdout/stderr

## 🚀 Deployment

### Development
```bash
npm run dev:backend   # Puerto 3001
npm run dev:frontend  # Puerto 3000
npm run dev:bot       # Telegram Bot
```

### Docker
```bash
docker-compose up -d
```

## 📊 Data Model

```json
{
  "profile": {
    "name": "string",
    "bio": "string", 
    "contact": {
      "email": "string",
      "github": "string",
      "twitter": "string"
    }
  },
  "projects": [{
    "id": "string",
    "name": "string",
    "description": "string",
    "url": "string",
    "tags": ["string"]
  }]
}
```
