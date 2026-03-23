import fetch from 'node-fetch';
import { config } from '../config.js';
import { agents } from './agents.js';

const { telegram, auth, runtime } = config;
const BASE_URL = telegram.baseUrl;
const AGENTS_ENABLED = config.runtime.agentsEnabled;

const pendingCommands = new Map();

function isAuthorized(chatId) {
  if (auth.chatIds.length === 0) return true;
  return auth.chatIds.includes(chatId);
}

function checkRateLimit(chatId) {
  const now = Date.now();
  const lastTime = pendingCommands.get(chatId) || 0;
  if (now - lastTime < runtime.rateLimitMs) return false;
  pendingCommands.set(chatId, now);
  return true;
}

async function send(chatId, text, parseMode = 'Markdown', replyMarkup = null) {
  try {
    const body = { chat_id: chatId, text, parse_mode: parseMode };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error('Send error:', e); }
}

export const router = {
  async handleMessage(chatId, text) {
    const raw = text.toLowerCase().trim();
    
    if (!isAuthorized(chatId)) { await send(chatId, '⛔ No autorizado'); return; }
    
    const now = Date.now();
    const lastTime = pendingCommands.get(chatId) || 0;
    if (now - lastTime < runtime.rateLimitMs) { await send(chatId, '⏳ Espera un momento...'); return; }
    pendingCommands.set(chatId, now);

    try {
      console.log(`📩 [${new Date().toISOString()}] Chat ${chatId}: ${text}`);
      
      if (raw.startsWith('/start')) { await this.showHelp(chatId); return; }
      if (raw.startsWith('/ayuda') || raw.startsWith('/help')) { await this.showHelp(chatId); return; }
      if (raw.startsWith('/status')) { await agents.handleStatus(chatId); return; }
      
      // Framework selection commands
      const frameworks = ['html', 'nextjs', 'react', 'vue', 'astro', 'svelte'];
      for (const fw of frameworks) {
        if (raw === `/${fw}`) {
          await agents.handleFramework(chatId, fw);
          return;
        }
      }
      
      // Framework as parameter: /framework nextjs
      if (raw.startsWith('/framework ')) {
        const fw = raw.split(' ')[1]?.trim();
        if (fw && frameworks.includes(fw)) {
          await agents.handleFramework(chatId, fw);
          return;
        }
        await send(chatId, `❌ Framework inválido. Opciones: ${frameworks.join(', ')}`);
        return;
      }
      
      if (this.isPortfolioRequest(raw)) {
        await agents.handleCreate(chatId, text);
        return;
      }
      
      if (this.isUpdateRequest(raw)) {
        await agents.handleUpdate(chatId, text);
        return;
      }
      
      await this.showHelp(chatId);
      
    } catch (error) {
      console.error('Error:', error);
      await send(chatId, '❌ Error: ' + error.message);
    }
  },

  isPortfolioRequest(text) {
    const patterns = [
      'crea', 'quiero', 'hazme', 'nuevo portafolio', 'crear portafolio',
      'genera', 'build', 'make a portfolio', 'create portfolio'
    ];
    return patterns.some(p => text.startsWith(p) || text.includes(p + ' '));
  },

  isUpdateRequest(text) {
    const patterns = [
      'cambia', 'actualiza', 'modifica', 'agrega', 'elimina', 'cambiar',
      'update', 'change', 'add', 'modify', 'cambia el tema', 'agrega proyecto'
    ];
    return patterns.some(p => text.startsWith(p) || text.includes(p + ' '));
  },

  async showHelp(chatId) {
    const help = `🤖 *Kwitt 2.0* - Portfolio con IA

*Comandos:*
• /start - Iniciar
• /status - Estado
• /framework [opcion] - Seleccionar framework

*Frameworks disponibles:*
• /html - HTML simple
• /nextjs - Next.js ⚛️
• /react - React ⚛️
• /vue - Vue 💚
• /astro - Astro 🚀
• /svelte - Svelte 🔥

*Crear portafolio:*
• "crea un portafolio para dev fullstack"
• "quiero un portafolio oscuro"

*Actualizar:*
• "agrega proyecto github.com/user/repo"
• "cambia el tema a claro"

¿En qué te ayudo?`;
    await send(chatId, help);
  },

  async handleCallback(chatId, callbackData) {
    await agents.handleCallback(chatId, callbackData);
  }
};
