import fetch from 'node-fetch';
import { config } from '../config.js';
import { intent } from '../parsers/intent.js';
import { handlers } from './actions.js';
import { executor } from '../cli/executor.js';
import { portfolio, analytics, exportPortfolio } from '../data/portfolio.js';

const { telegram, auth, runtime } = config;
const BASE_URL = telegram.baseUrl;

const lastCommandTime = new Map();
const pendingCommands = new Map();
const commandHistory = new Map();
const MAX_HISTORY = 50;

function isAuthorized(chatId) {
  if (auth.chatIds.length === 0) return true;
  return auth.chatIds.includes(chatId);
}

function checkRateLimit(chatId) {
  const now = Date.now();
  const lastTime = lastCommandTime.get(chatId) || 0;
  if (now - lastTime < runtime.rateLimitMs) return false;
  lastCommandTime.set(chatId, now);
  return true;
}

async function send(chatId, text, parseMode = 'Markdown', replyMarkup) {
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

function saveToHistory(chatId, intentObj) {
  const history = commandHistory.get(chatId) || [];
  history.unshift({ intent: intentObj, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.pop();
  commandHistory.set(chatId, history);
}

function getHistory(chatId) {
  return commandHistory.get(chatId) || [];
}

export const router = {
  async handleMessage(chatId, text) {
    const raw = intent.sanitize(intent.applyAliases(text));
    
    if (!isAuthorized(chatId)) { await send(chatId, '⛔ No autorizado'); return; }
    if (!checkRateLimit(chatId)) { await send(chatId, '⏳ Espera...'); return; }
    if (pendingCommands.get(chatId)) { await send(chatId, '⏳ En proceso...'); return; }
    pendingCommands.set(chatId, true);

    try {
      console.log(`📩 ${chatId}: ${raw}`);
      
      if (raw.startsWith('/start')) { await handlers.status(chatId); return; }
      if (raw.startsWith('/ayuda') || raw.startsWith('/help')) { await handlers.help(chatId); return; }
      if (raw.startsWith('/estado') || raw.startsWith('/s')) { await handlers.status(chatId); return; }
      if (raw.startsWith('/doctor')) { await handlers.doctor(chatId); return; }
      if (raw.startsWith('/versiones') || raw.startsWith('/v')) { await handlers.listVersions(chatId); return; }
      if (raw.startsWith('/stats') || raw.startsWith('/analytics')) { await handlers.analytics(chatId); return; }
      if (raw.startsWith('/reparar')) { await handlers.repair(chatId); return; }
      if (raw.startsWith('/undo') || raw.startsWith('/deshacer')) { await this.handleUndo(chatId); return; }
      if (raw.startsWith('/restaurar')) { await this.handleRestore(chatId); return; }

      const parsed = intent.parse(raw);
      if (!parsed.action || parsed.action === 'unknown' || parsed.confidence < 0.5) {
        await send(chatId, '🤔 Usa /ayuda');
        return;
      }

      await this.dispatch(chatId, parsed);
    } catch (error) {
      console.error('Error:', error);
      await send(chatId, '❌ Error: ' + error.message);
    } finally {
      pendingCommands.set(chatId, false);
    }
  },

  async dispatch(chatId, intentObj) {
    const { action, target, data } = intentObj;
    const intentPayload = { action, target, data, confidence: intentObj.confidence };

    switch (action) {
      case 'status':
      case 'analytics':
      case 'help':
      case 'edit_profile':
      case 'add_project':
      case 'themes':
      case 'list_versions':
      case 'export_menu':
      case 'doctor':
      case 'repair':
        await handlers.handle(chatId, action, data);
        break;
      case 'undo':
        await this.handleUndo(chatId);
        break;
      case 'restore_version':
        await this.handleRestore(chatId);
        break;
      case 'preview':
        const previewParsed = intent.parse(target);
        await executor.executeAndTrack(chatId, { ...previewParsed, action: previewParsed.action }, true);
        await send(chatId, '📝 Preview completado');
        break;
      case 'export':
        const exported = exportPortfolio(data?.format || 'json');
        await send(chatId, exported.slice(0, 4000));
        break;
      case 'change_branch':
        executor.commitToGit(`kwitt: switch to ${target}`);
        await send(chatId, `✅ Rama: ${target}`);
        break;
      default:
        saveToHistory(chatId, intentPayload);
        const result = await executor.executeAndTrack(chatId, intentPayload, false);
        await send(chatId, result.success ? `✅ ${action} completado` : `❌ Error: ${result.stderr || 'Unknown'}`);
    }
  },

  async handleUndo(chatId) {
    const history = getHistory(chatId);
    if (history.length === 0) { await send(chatId, '❌ No hay comandos para deshacer'); return; }
    const lastCmd = history[0].intent;
    await send(chatId, `⏪ Deshaciendo: ${lastCmd.action}...`);
    await executor.executeAndTrack(chatId, { action: 'restore_version', target: '', data: {} }, false);
    commandHistory.set(chatId, history.slice(1));
    await send(chatId, '✅ Comando deshecho');
  },

  async handleRestore(chatId) {
    portfolio.restoreLatest();
    await send(chatId, '✅ Restaurado a la última versión');
  },

  async handleCallback(chatId, callbackData) {
    const toggleActions = ['toggle_darkmode', 'toggle_animations'];
    if (toggleActions.includes(callbackData)) {
      const action = callbackData;
      const intentPayload = { action, target: '', data: { value: true }, confidence: 1.0 };
      await executor.executeAndTrack(chatId, intentPayload, false);
      await handlers.status(chatId);
      return;
    }

    if (callbackData.startsWith('template_')) {
      const template = callbackData.replace('template_', '');
      const intentPayload = { action: 'apply_template', target: '', data: { template }, confidence: 1.0 };
      await executor.executeAndTrack(chatId, intentPayload, false);
      await handlers.status(chatId);
      return;
    }

    if (callbackData === 'back_main') {
      await handlers.status(chatId);
      return;
    }

    await handlers.handle(chatId, callbackData, {});
  }
};