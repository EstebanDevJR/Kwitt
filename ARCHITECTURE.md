# Kwitt Architecture

## 🎯 Current Architecture: Modular Bot + CLI Execution

Kwitt uses a **modular Telegram bot** with optional CLI-driven code execution via OpenCode.

```
┌─────────────────────────────────────────┐
│         Telegram Bot                     │
│   (Receives user input)                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Intent Parser                    │
│   (Parses intent - AI or pattern match)  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Message Router                    │
│   (Routes to handlers or CLI executor)    │
└─────────────────┬───────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────┐      ┌─────▼──────┐
    │Actions │      │CLI Executor│
    │Handler │      │(OpenCode)   │
    └────┬────┘      └─────┬──────┘
         │                 │
    ┌────▼────┐      ┌─────▼──────┐
    │Data     │      │Git Commit  │
    │Portfolio│      │& Push      │
    └─────────┘      └────────────┘
```

## 🔥 Execution Modes

### Local Mode (`LOCAL_MODE=true`)
- Bot executes changes directly without CLI
- Fast, no external dependencies
- Uses `data/portfolio.js` for all operations

### CLI Mode (default)
- Bot routes intent to OpenCode CLI for code changes
- Enables complex frontend modifications
- Uses `cli/executor.js` to run `opencode run`

## Intent → Action Mapping

| User says | Intent | Action |
|-----------|--------|--------|
| "agrega proyecto github.com/user/repo" | add_project | Execute via CLI or add directly |
| "mi bio es soy desarrollador" | update_bio | Update portfolio.bio |
| "me llamo Juan" | update_name | Update portfolio.profile.name |
| "tema dark" | apply_template | Apply dark theme |
| "undo" | undo | Restore latest backup |
| "stats" | analytics | Show command statistics |

## 📁 Project Structure

```
kwitt/
├── bot/                    # Telegram Bot
│   ├── src/
│   │   ├── index.js        # Entry point (~80 lines)
│   │   ├── config.js       # Configuration & constants
│   │   ├── data/           # Data layer
│   │   │   └── portfolio.js    # Portfolio CRUD, versions, analytics
│   │   ├── parsers/        # Intent parsing
│   │   │   └── intent.js       # AI + pattern matching
│   │   ├── handlers/       # Action handlers
│   │   │   ├── actions.js      # Status, help, themes, export...
│   │   │   └── message.js     # Message router & callbacks
│   │   ├── cli/           # CLI execution
│   │   │   └── executor.js    # runOpenCode, commitToGit
│   │   └── keyboards/     # Inline keyboards
│   │       └── index.js
│   └── tests/             # Jest tests
├── frontend/              # Next.js app
│   └── src/
│       └── app/
│           ├── page.tsx       # Glassmorphism portfolio
│           └── globals.css   # GSAP animations
├── data/                  # Portfolio data
│   ├── portfolio.json
│   ├── analytics.json
│   └── versions/          # Auto-backups
└── infra/                 # Docker configs
```

## 🧩 Module Responsibilities

### `config.js`
- Environment variables parsing
- Templates (minimal, developer, creative, dark, light)
- Command aliases
- Default portfolio structure

### `data/portfolio.js`
- `portfolio.load()` / `portfolio.save()`
- Version snapshots
- Analytics tracking
- Export (JSON/Markdown/HTML)

### `parsers/intent.js`
- Sanitize input
- Apply aliases
- Parse intent (AI or fallback to patterns)

### `handlers/actions.js`
- Status, help, themes, export handlers
- Callback query handling
- Doctor diagnostics

### `handlers/message.js`
- Authorization & rate limiting
- Command routing
- Undo/restore logic

### `cli/executor.js`
- runOpenCode with retry logic
- commitToGit automation
- Local mode fallback

## 🛠️ Safe Execution Layer

Features:
- **Timeout control** (default 120s via `CLI_TIMEOUT`)
- **Dry-run mode**: Preview without applying
- **Retry logic**: 2 retries on failure
- **Rate limiting**: Prevents command spam

## 📊 Data Model

```json
{
  "profile": {
    "name": "string",
    "bio": "string",
    "contact": { "email": "string", "github": "string", "twitter": "string" },
    "avatar": "string"
  },
  "projects": [{
    "id": "string",
    "name": "string",
    "description": "string",
    "url": "string",
    "githubUrl": "string",
    "tags": ["string"],
    "order": "number"
  }],
  "theme": { "colors": {}, "fonts": {}, "layout": {} },
  "settings": { "animations": "boolean", "darkMode": "boolean" }
}
```

## 🚀 Running

```bash
# Bot only
cd bot && npm run dev

# Frontend
cd frontend && npm run dev

# Docker
docker-compose up -d
```