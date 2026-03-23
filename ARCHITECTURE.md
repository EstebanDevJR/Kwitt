# Kwitt Architecture

## 🧠 Multi-Agent System

Kwitt utiliza una arquitectura de agentes múltiples donde cada agente tiene una responsabilidad específica:

```
┌─────────────────────────────────────────┐
│         Orchestrator Agent              │
│   (Coordina flujo y selecciona agentes)│
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐        ┌────▼────┐
   │Intent   │        │Telegram │
   │Agent    │        │Agent    │
   └────┬────┘        └────┬────┘
        │                   │
        └─────────┬────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐        ┌────▼────┐
   │Portfolio│        │Git      │
   │Agent    │        │Agent    │
   └────┬────┘        └─────────┘
        │
   ┌────▼────┐        ┌─────────┐
   │Frontend │        │Code     │
   │Agent    │        │Agent    │
   └─────────┘        └─────────┘
```

## 🔧 Tools System

### FilesystemTool
- `readFile(path)`: Lee archivos
- `writeFile(path, content)`: Escribe archivos
- `listFiles(path)`: Lista directorio
- `searchCode(query)`: Busca en código

### GitTool
- `gitCommit(message)`: Crea commit
- `gitPush()`: Push a remote
- `gitDiff()`: Muestra cambios
- `gitStatus()`: Estado del repositorio

### TelegramTool
- `sendMessage(chatId, text)`: Envía mensaje
- `getUpdates()`: Recibe actualizaciones
- `parseMessage(update)`: Parsea mensaje

### LLMTool
- `generateText(prompt)`: Genera texto
- `parseIntent(message)`: Parsea intención

## 🔁 Execution Flow

```
1. Usuario envía mensaje a Telegram
2. Telegram Agent recibe mensaje
3. Orchestrator envía a Intent Agent
4. Intent Agent usa LLM para parsear
5. Orchestrator selecciona agentes apropiados
6. Agents ejecutan tareas (Portfolio, Git, Frontend)
7. Git Agent hace commit y push
8. Telegram Agent responde al usuario
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

## 🎨 Frontend Animations

El frontend usa GSAP para animaciones:

- **Hero**: Animación de entrada con `gsap.from()`
- **Scroll**: ScrollTrigger para animaciones al hacer scroll
- **Projects**: Stagger animation para tarjetas de proyectos
- **Contact**: Fade-in para elementos de contacto

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

## 📁 Project Structure

```
kwitt/
├── agents/           # Sistema de agentes IA
│   ├── orchestrator.ts
│   ├── intent.ts
│   ├── portfolio.ts
│   ├── git.ts
│   ├── frontend.ts
│   ├── code.ts
│   ├── telegram.ts
│   └── devops.ts
├── tools/            # Herramientas del sistema
│   ├── filesystem.ts
│   ├── git.ts
│   ├── telegram.ts
│   └── llm.ts
├── core/             # Tipos y constantes
├── backend/          # API REST
├── frontend/         # Next.js app
├── bot/              # Telegram Bot
└── infra/            # Docker configs
```