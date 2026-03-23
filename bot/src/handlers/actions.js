import fetch from 'node-fetch';
import { config, DEFAULT_PORTFOLIO, FREE_MODELS, DEFAULT_MODEL } from '../config.js';
import { portfolio, analytics, exportPortfolio } from '../data/portfolio.js';
import { mainKeyboard, themesKeyboard, exportKeyboard, projectsKeyboard, modelKeyboard } from '../keyboards/index.js';
import { getModel, setModel } from '../cli/executor.js';

const { baseUrl } = config.telegram;
const DEFAULT_NAME = DEFAULT_PORTFOLIO.profile.name;
const DEFAULT_BIO = DEFAULT_PORTFOLIO.profile.bio;

async function send(chatId, text, parseMode = 'Markdown', replyMarkup) {
  try {
    const body = { chat_id: chatId, text, parse_mode: parseMode };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`${baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error('Send error:', e); }
}

async function answerCallback(callbackId) {
  try {
    await fetch(`${baseUrl}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId })
    });
  } catch (e) { console.error('Callback answer error:', e); }
}

export const handlers = {
  async status(chatId) {
    const p = portfolio.load();
    const versions = portfolio.getVersions();
    const hasProfile = p.profile?.name && p.profile.name !== DEFAULT_NAME;
    const hasBio = p.profile?.bio && p.profile.bio !== DEFAULT_BIO;
    
    let msg = `🎯 *Estado de tu Portfolio*\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 *Perfil:* ${hasProfile ? '✅' : '⚠️'} ${p.profile?.name || 'Sin nombre'}\n`;
    msg += `📁 *Proyectos:* ${p.projects?.length || 0}\n`;
    msg += `🎨 *Dark:* ${p.settings?.darkMode ? '✅' : '❌'} *Anim:* ${p.settings?.animations ? '✅' : '❌'}\n`;
    msg += `💾 *Respaldos:* ${versions.length}\n`;
    msg += `🔧 *Modo:* ${config.runtime.localMode ? 'Local' : 'CLI'}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `Usa los botones 👇`;
    
    await send(chatId, msg, 'Markdown', mainKeyboard());
  },

  async analytics(chatId) {
    const { analytics } = await import('../data/portfolio.js');
    const stats = analytics.get();
    
    let msg = `📈 *Estadisticas (24h)*\n\n`;
    msg += `Comandos: ${stats.last24h}\n`;
    msg += `Exito: ${stats.successRate}%\n`;
    msg += `Usuarios: ${stats.activeUsers}\n\n`;
    msg += `*Top acciones:*\n`;
    msg += stats.topActions.slice(0, 5).map(([a, c]) => `• ${a}: ${c}`).join('\n');
    
    await send(chatId, msg, 'Markdown', mainKeyboard());
  },

  async help(chatId) {
    const msg = `📖 *Guia de Comandos*

━━━━━━━━━━━━━━━━━━

🎯 *Portfolio:*
├ "agrega [url]"
├ "mi bio es [texto]"
├ "me llamo [nombre]"
└ "elimina [proyecto]"

🎨 *Temas:*
├ "tema dark/light/minimal"
├ "activa oscuro"
└ "activa animaciones"

💾 *Sistema:*
├ "undo" - Deshacer
├ "doctor" - Diagnostico
├ "versiones" - Respaldos
└ "export json/md/html"

⚡ *Aliases:*
├ /s, /a, /b, /d

💡 Usa los botones para acciones rapidas`;

    await send(chatId, msg, 'Markdown', mainKeyboard());
  },

  async editProfile(chatId) {
    const msg = `✏️ *Editar Perfil*

Envianos:
• "me llamo [nombre]"
• "mi bio es [texto]"
• "mi foto [url]"
• "mi github [user]"
• "mi twitter [user]"`;

    await send(chatId, msg, 'Markdown', mainKeyboard());
  },

  async addProject(chatId) {
    const msg = `➕ *Agregar Proyecto*

Envianos la URL de GitHub:
"agrega github.com/user/repo"

O usa: /a [url]`;

    await send(chatId, msg, 'Markdown', mainKeyboard());
  },

  async themes(chatId) {
    await send(chatId, '🎨 *Elige un Tema:*', 'Markdown', themesKeyboard());
  },

  async listVersions(chatId) {
    const files = portfolio.getVersions();
    if (files.length === 0) {
      await send(chatId, '❌ No hay versiones guardadas', 'Markdown', mainKeyboard());
      return;
    }
    
    let msg = `📜 *Versiones (${files.length}):*\n\n`;
    files.slice(0, 5).forEach((f, i) => {
      const date = new Date(f.replace('.json', '')).toLocaleString();
      msg += `${i + 1}. ${date}\n`;
    });
    msg += `\nUsa "restaurar" para revertir`;
    
    await send(chatId, msg, 'Markdown', mainKeyboard());
  },

  async exportMenu(chatId) {
    await send(chatId, '📤 *Exportar Portfolio:*', 'Markdown', exportKeyboard());
  },

  async export(chatId, format) {
    const data = exportPortfolio(format);
    const formatted = format === 'json' ? `\`\`\`json\n${data.slice(0, 3500)}\n\`\`\`` : data.slice(0, 4000);
    const label = format === 'json' ? 'JSON' : format === 'markdown' ? 'Markdown' : 'HTML';
    await send(chatId, `📄 *Portfolio ${label}:*\n\n${formatted}`, 'Markdown', exportKeyboard());
  },

  async doctor(chatId) {
    const p = portfolio.load();
    const versions = portfolio.getVersions();
    const issues = [];
    
    if (!p.profile?.name || p.profile.name === DEFAULT_NAME) issues.push('⚠️ Perfil sin configurar');
    if (versions.length === 0) issues.push('⚠️ Sin respaldos');
    if (!config.openai.apiKey) issues.push('ℹ️ Sin OpenAI');
    if (config.runtime.localMode) issues.push('ℹ️ Modo local');
    
    if (issues.length === 0) {
      await send(chatId, `✅ *Sistema OK*\n\n📁 ${p.projects.length} proyectos`, 'Markdown', mainKeyboard());
    } else {
      await send(chatId, `🔍 *Diagnostico:*\n\n${issues.join('\n')}`, 'Markdown', mainKeyboard());
    }
  },

  async repair(chatId) {
    const p = portfolio.load();
    if (!p.settings) p.settings = { animations: true, darkMode: true };
    if (!p.theme) p.theme = { colors: {}, fonts: {}, layout: {} };
    if (!p.profile.contact) p.profile.contact = {};
    portfolio.save(p);
    await send(chatId, '✅ Configuracion reparada', 'Markdown', mainKeyboard());
  },

  async modelMenu(chatId) {
    const current = getModel(chatId);
    const currentInfo = FREE_MODELS[current] || FREE_MODELS[DEFAULT_MODEL];
    const msg = `🤖 *Seleccionar Modelo*\n\n`;
    msg += `Actual: ${currentInfo.icon} ${currentInfo.name} (${currentInfo.provider})\n\n`;
    msg += `Elige un modelo gratuito:`;
    await send(chatId, msg, 'Markdown', modelKeyboard());
  },

  async setModel(chatId, modelKey) {
    if (FREE_MODELS[modelKey]) {
      setModel(chatId, modelKey);
      const info = FREE_MODELS[modelKey];
      await send(chatId, `✅ Modelo actualizado a: ${info.icon} ${info.name}`, 'Markdown', mainKeyboard());
    }
  },

  backMain(chatId) {
    this.status(chatId);
  },

  async handle(chatId, action, data) {
    switch (action) {
      case 'status': await this.status(chatId); break;
      case 'analytics': await this.analytics(chatId); break;
      case 'help': await this.help(chatId); break;
      case 'edit_profile': await this.editProfile(chatId); break;
      case 'add_project': await this.addProject(chatId); break;
      case 'themes': await this.themes(chatId); break;
      case 'list_versions': await this.listVersions(chatId); break;
      case 'export_menu': await this.exportMenu(chatId); break;
      case 'export_json': await this.export(chatId, 'json'); break;
      case 'export_md': await this.export(chatId, 'markdown'); break;
      case 'export_html': await this.export(chatId, 'html'); break;
      case 'doctor': await this.doctor(chatId); break;
      case 'repair': await this.repair(chatId); break;
      case 'model_menu': await this.modelMenu(chatId); break;
      case 'back_main': this.backMain(chatId); break;
      default:
        if (action.startsWith('template_')) {
          await portfolio.executeAction({ action: 'apply_template', data: { template: action.replace('template_', '') } });
        }
    }
  }
};
