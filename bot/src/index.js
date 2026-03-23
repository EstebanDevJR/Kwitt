import fetch from 'node-fetch';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || process.env.AUTHORIZED_CHAT_IDS || '').split(',').filter(Boolean).map(s => parseInt(s.trim()));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USE_LOCAL_MODE = process.env.LOCAL_MODE === 'true';
const CLI_TIMEOUT = parseInt(process.env.CLI_TIMEOUT || '120000');
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS || '3000');
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const GIT_BRANCH = process.env.GIT_BRANCH || 'main';
const SCHEDULED_BACKUP_INTERVAL = parseInt(process.env.SCHEDULED_BACKUP_INTERVAL || '3600000');

const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const IS_DOCKER = existsSync('/app/.dockerenv') || process.env.DOCKER === 'true';
const DATA_DIR = IS_DOCKER ? '/app/data' : './data';
const PORTFOLIO_FILE = join(DATA_DIR, 'portfolio.json');
const VERSIONS_DIR = join(DATA_DIR, 'versions');
const ANALYTICS_FILE = join(DATA_DIR, 'analytics.json');
const TEMPLATES_FILE = join(DATA_DIR, 'templates.json');
const MAX_VERSIONS = 20;
const MAX_COMMAND_HISTORY = 50;
const MAX_ANALYTICS_DAYS = 30;

const lastCommandTime = new Map<number, number>();
const pendingCommands = new Map<number, boolean>();
const commandHistory = new Map<number, Array<{intent: Intent; timestamp: number; action: string}>>();

const analytics = {
  commands: [] as Array<{action: string; success: boolean; timestamp: number; user: number}>,
  users: new Map<number, {commands: number; lastSeen: number}>()
};

interface Intent {
  action: string;
  target: string;
  data: Record<string, any>;
  confidence: number;
}

interface GitHubRepo {
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  topics: string[];
  html_url: string;
}

const PORTFOLIO_TEMPLATES = {
  minimal: {
    name: 'Minimal',
    theme: { colors: { primary: '#000000', accent: '#666666', surface: '#ffffff' }, fonts: { heading: 'Inter', body: 'Inter' }, layout: { hero: true, projects: true, contact: true } }
  },
  developer: {
    name: 'Developer',
    theme: { colors: { primary: '#0a0a0a', accent: '#22c55e', surface: '#171717' }, fonts: { heading: 'Fira Code', body: 'Inter' }, layout: { hero: true, projects: true, contact: true } }
  },
  creative: {
    name: 'Creative',
    theme: { colors: { primary: '#1e1b4b', accent: '#f472b6', surface: '#fafafa' }, fonts: { heading: 'Poppins', body: 'Poppins' }, layout: { hero: true, projects: true, contact: true } }
  },
  dark: {
    name: 'Dark Pro',
    theme: { colors: { primary: '#09090b', accent: '#8b5cf6', surface: '#18181b' }, fonts: { heading: 'Inter', body: 'Inter' }, layout: { hero: true, projects: true, contact: true } }
  },
  light: {
    name: 'Light Pro',
    theme: { colors: { primary: '#ffffff', accent: '#3b82f6', surface: '#f8fafc' }, fonts: { heading: 'Inter', body: 'Inter' }, layout: { hero: true, projects: true, contact: true } }
  }
};

console.log(`🚀 Kwitt Bot starting...`);
console.log(`📁 Data directory: ${DATA_DIR}`);
console.log(`🐳 Docker mode: ${IS_DOCKER}`);
console.log(`🔧 Local mode: ${USE_LOCAL_MODE}`);
console.log(`🌿 Git branch: ${GIT_BRANCH}`);
console.log(`📡 Webhook: ${WEBHOOK_URL ? 'enabled' : 'disabled'}`);
console.log(`👥 Authorized users: ${AUTHORIZED_CHAT_IDS.length}`);

function sanitizeInput(text: string): string {
  return text.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '').slice(0, 500);
}

function applyAlias(text: string): string {
  const aliases: Record<string, string> = {
    '/s': '/estado',
    '/st': '/estado',
    '/a ': 'agrega proyecto ',
    '/d ': 'elimina proyecto ',
    '/b': 'actualiza mi bio ',
    '/t': 'tema ',
    '/v': 'versiones',
    '/?': '/ayuda'
  };
  let result = text;
  for (const [alias, cmd] of Object.entries(aliases)) {
    if (result.toLowerCase().startsWith(alias)) {
      result = result.replace(new RegExp(`^${alias}`, 'i'), cmd);
    }
  }
  return result;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadPortfolio(): any {
  ensureDir(DATA_DIR);
  if (existsSync(PORTFOLIO_FILE)) {
    return JSON.parse(readFileSync(PORTFOLIO_FILE, 'utf-8'));
  }
  const defaultPortfolio = {
    profile: { name: 'Tu Nombre', bio: 'Descripción...', contact: {}, avatar: '' },
    projects: [],
    theme: { colors: {}, fonts: {}, layout: {} },
    settings: { animations: true, darkMode: true },
    customSections: []
  };
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(defaultPortfolio, null, 2));
  return defaultPortfolio;
}

function savePortfolio(data: any, createVersion = true): void {
  ensureDir(DATA_DIR);
  if (createVersion) {
    createVersionSnapshot(data);
  }
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

function createVersionSnapshot(data: any): void {
  ensureDir(VERSIONS_DIR);
  const timestamp = new Date().toISOString();
  const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
  writeFileSync(versionFile, JSON.stringify({ timestamp, data: JSON.parse(JSON.stringify(data)), type: 'auto' }, null, 2));
  const files = readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')).map(f => ({ name: f, time: statSync(join(VERSIONS_DIR, f)).mtime.getTime() })).sort((a, b) => b.time - a.time);
  if (files.length > MAX_VERSIONS) {
    files.slice(MAX_VERSIONS).forEach(f => { unlinkSync(join(VERSIONS_DIR, f.name)); });
  }
}

function loadAnalytics(): void {
  if (existsSync(ANALYTICS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(ANALYTICS_FILE, 'utf-8'));
      analytics.commands = data.commands || [];
      analytics.users = new Map(data.users);
    } catch (e) {
      console.error('[Analytics] Load error:', e);
    }
  }
}

function saveAnalytics(): void {
  try {
    const data = {
      commands: analytics.commands.slice(-1000),
      users: Array.from(analytics.users.entries())
    };
    writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Analytics] Save error:', e);
  }
}

function trackCommand(action: string, success: boolean, userId: number): void {
  analytics.commands.push({ action, success, timestamp: Date.now(), user: userId });
  if (analytics.commands.length > 1000) {
    analytics.commands = analytics.commands.slice(-1000);
  }
  const userStats = analytics.users.get(userId) || { commands: 0, lastSeen: 0 };
  userStats.commands++;
  userStats.lastSeen = Date.now();
  analytics.users.set(userId, userStats);
  saveAnalytics();
}

function getAnalytics() {
  const now = Date.now();
  const last24h = analytics.commands.filter(c => now - c.timestamp < 86400000);
  const last7d = analytics.commands.filter(c => now - c.timestamp < 604800000);
  
  const actionCounts = last24h.reduce((acc, c) => { acc[c.action] = (acc[c.action] || 0) + 1; return acc; }, {} as Record<string, number>);
  const successRate = last24h.length > 0 ? (last24h.filter(c => c.success).length / last24h.length * 100).toFixed(1) : '0';
  
  return {
    totalCommands: analytics.commands.length,
    last24h: last24h.length,
    last7d: last7d.length,
    successRate,
    topActions: Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    uniqueUsers: analytics.users.size,
    activeUsers: Array.from(analytics.users.values()).filter(u => now - u.lastSeen < 86400000).length
  };
}

function exportPortfolio(format: string): string {
  const portfolio = loadPortfolio();
  switch (format) {
    case 'markdown':
      return `# ${portfolio.profile.name}\n\n${portfolio.profile.bio}\n\n## Proyectos\n\n${portfolio.projects.map(p => `- [${p.name}](${p.url}) - ${p.description}`).join('\n')}\n\n## Contacto\n\n${Object.entries(portfolio.profile.contact).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}`;
    case 'html':
      return `<!DOCTYPE html><html><head><title>${portfolio.profile.name}</title></head><body><h1>${portfolio.profile.name}</h1><p>${portfolio.profile.bio}</p><h2>Proyectos</h2>${portfolio.projects.map(p => `<p><a href="${p.url}">${p.name}</a> - ${p.description}</p>`).join('')}</body></html>`;
    default:
      return JSON.stringify(portfolio, null, 2);
  }
}

function importPortfolio(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);
    savePortfolio(data);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchGitHubRepo(url: string): Promise<GitHubRepo | null> {
  const match = url.match(/github\.com[/:]([\w-]+)\/([^\s/]+)/);
  if (!match) return null;
  
  const [owner, repo] = match.slice(1);
  try {
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
    if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      name: data.name,
      description: data.description || '',
      language: data.language || 'Unknown',
      stars: data.stargazers_count,
      forks: data.forks_count,
      topics: data.topics || [],
      html_url: data.html_url
    };
  } catch (e) {
    console.error('[GitHub] Fetch error:', e);
    return null;
  }
}

function saveCommandToHistory(chatId: number, intent: Intent, action: string): void {
  const history = commandHistory.get(chatId) || [];
  history.unshift({ intent, timestamp: Date.now(), action });
  if (history.length > MAX_COMMAND_HISTORY) history.pop();
  commandHistory.set(chatId, history);
}

function getCommandHistory(chatId: number): Array<{intent: Intent; timestamp: number; action: string}> {
  return commandHistory.get(chatId) || [];
}

async function sendMessage(chatId: number, text: string, parseMode = 'Markdown', replyMarkup?: any) {
  try {
    const body: any = { chat_id: chatId, text, parse_mode: parseMode };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Error sending message:', e);
  }
}

function getMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 Estado', callback_data: 'status' }, { text: '➕ Proyecto', callback_data: 'add_project_prompt' }],
      [{ text: '🎨 Temas', callback_data: 'themes' }, { text: '💾 Versiones', callback_data: 'versions' }],
      [{ text: '📈 Stats', callback_data: 'analytics' }, { text: '❓ Ayuda', callback_data: 'help' }]
    ]
  };
}

function getThemesKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🖤 Minimal', callback_data: 'template_minimal' }, { text: '💻 Developer', callback_data: 'template_developer' }],
      [{ text: '🎨 Creative', callback_data: 'template_creative' }, { text: '🌙 Dark Pro', callback_data: 'template_dark' }],
      [{ text: '☀️ Light Pro', callback_data: 'template_light' }, { text: '🔙 Volver', callback_data: 'back_main' }]
    ]
  };
}

function getExportKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📄 JSON', callback_data: 'export_json' }, { text: '📝 Markdown', callback_data: 'export_markdown' }, { text: '🌐 HTML', callback_data: 'export_html' }]
    ]
  };
}

function checkRateLimit(chatId: number): boolean {
  const now = Date.now();
  const lastTime = lastCommandTime.get(chatId) || 0;
  if (now - lastTime < RATE_LIMIT_MS) return false;
  lastCommandTime.set(chatId, now);
  return true;
}

function isAuthorized(chatId: number): boolean {
  if (AUTHORIZED_CHAT_IDS.length === 0) return true;
  return AUTHORIZED_CHAT_IDS.includes(chatId);
}

async function runOpenCodeWithRetry(instruction: string, dryRun = false, retries = 2): Promise<{ success: boolean; stdout: string; stderr: string; retries: number }> {
  let lastError = '';
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await runOpenCode(instruction, dryRun);
      if (result.success || i === retries) return { ...result, retries: i };
      lastError = result.stderr;
    } catch (e: any) { lastError = e.message; }
    if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return { success: false, stdout: '', stderr: lastError, retries };
}

async function runOpenCode(instruction: string, dryRun = false): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cmd = dryRun ? `opencode run --dry-run "${instruction.replace(/"/g, '\\"')}"` : `opencode run "${instruction.replace(/"/g, '\\"')}"`;
    console.log(`[CLI] ${cmd}`);
    const child = spawn(cmd, { shell: true, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => { resolve({ success: code === 0, stdout, stderr }); });
    child.on('error', (error) => { resolve({ success: false, stdout, stderr: error.message }); });
    setTimeout(() => { child.kill('SIGTERM'); resolve({ success: false, stdout, stderr: 'Timeout' }); }, CLI_TIMEOUT);
  });
}

async function commitToGit(message: string): Promise<boolean> {
  try {
    if (!existsSync('.git')) { console.log('[Git] Not a git repository'); return false; }
    execSync('git add data/portfolio.json', { encoding: 'utf-8' });
    execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
    execSync(GIT_BRANCH !== 'main' && GIT_BRANCH !== 'master' ? `git push origin ${GIT_BRANCH}` : 'git push', { encoding: 'utf-8' });
    console.log(`[Git] Committed: ${message}`); return true;
  } catch (e) { console.error('[Git] Commit failed:', e); return false; }
}

function mapIntentToInstruction(intent: Intent): string {
  const { action, target, data } = intent;
  const mappings: Record<string, string> = {
    add_project: `Add a new project from GitHub ${target}. Extract name, description, tech stack. Update portfolio.`,
    update_bio: `Update portfolio bio to: "${data?.bio || target}".`,
    update_theme: `Update theme: ${data?.colors ? `colors: ${JSON.stringify(data.colors)}` : ''} ${data?.fonts ? `fonts: ${JSON.stringify(data.fonts)}` : ''}.`,
    update_avatar: `Update avatar to: ${target}.`,
    toggle_animations: `${data?.value ? 'Enable' : 'Disable'} animations.`,
    toggle_darkmode: `${data?.value ? 'Enable' : 'Disable'} dark mode.`,
    delete_project: `Delete project "${target}" from portfolio.`,
    restore_version: `Restore to latest backup.`,
    apply_template: `Apply template "${data?.template}" to portfolio.`
  };
  return mappings[action] || `Execute: ${action}`;
}

function simpleMapIntentToInstruction(intent: Intent): string {
  const { action, target, data } = intent;
  const portfolio = loadPortfolio();
  switch (action) {
    case 'add_project':
      const urlParts = target.replace('https://', '').replace('http://', '').split('/').filter(Boolean);
      const name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'new-project';
      const project = { id: `project-${Date.now()}`, name: name.toLowerCase().replace(/[-_]/g, '-'), description: `Proyecto desde ${target}`, url: target, githubUrl: target, tags: ['github'], imageUrl: '', order: portfolio.projects.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      portfolio.projects.push(project);
      savePortfolio(portfolio);
      return `Added "${project.name}"`;
    case 'update_bio': portfolio.profile.bio = data?.bio || target; savePortfolio(portfolio); return `Bio updated`;
    case 'update_theme': portfolio.theme = portfolio.theme || {}; if (data?.colors) portfolio.theme.colors = { ...portfolio.theme.colors, ...data.colors }; if (data?.fonts) portfolio.theme.fonts = { ...portfolio.theme.fonts, ...data.fonts }; savePortfolio(portfolio); return 'Theme updated';
    case 'update_avatar': portfolio.profile.avatar = target; savePortfolio(portfolio); return 'Avatar updated';
    case 'toggle_animations': portfolio.settings = portfolio.settings || {}; portfolio.settings.animations = data?.value ?? true; savePortfolio(portfolio); return `Animations ${portfolio.settings.animations ? 'enabled' : 'disabled'}`;
    case 'toggle_darkmode': portfolio.settings = portfolio.settings || {}; portfolio.settings.darkMode = data?.value ?? true; savePortfolio(portfolio); return `Dark mode ${portfolio.settings.darkMode ? 'enabled' : 'disabled'}`;
    case 'delete_project':
      const nameToDelete = target.replace(/elimina|borra|proyecto/gi, '').trim().toLowerCase();
      const index = portfolio.projects.findIndex(p => p.name.toLowerCase().includes(nameToDelete) || nameToDelete.includes(p.name.toLowerCase()));
      if (index !== -1) { const deleted = portfolio.projects.splice(index, 1)[0]; portfolio.projects.forEach((p: any, i: number) => { p.order = i; }); savePortfolio(portfolio); return `Deleted "${deleted.name}"`; }
      return 'Project not found';
    case 'restore_version':
      const files = readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      if (files.length > 0) { const latest = JSON.parse(readFileSync(join(VERSIONS_DIR, files[0]), 'utf-8')); savePortfolio(latest.data, false); return 'Restored to latest' }
      return 'No versions';
    case 'apply_template':
      const templateKey = data?.template as keyof typeof PORTFOLIO_TEMPLATES;
      if (PORTFOLIO_TEMPLATES[templateKey]) { portfolio.theme = PORTFOLIO_TEMPLATES[templateKey].theme; savePortfolio(portfolio); return `Applied template: ${PORTFOLIO_TEMPLATES[templateKey].name}`; }
      return 'Template not found';
    case 'export': return exportPortfolio(data?.format || 'json');
    case 'import': return importPortfolio(target) ? 'Imported successfully' : 'Import failed';
    default: return `Action ${action} not supported`;
  }
}

async function parseIntent(message: string): Promise<Intent> {
  if (!OPENAI_API_KEY) return simpleParseIntent(message);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: `Eres agente de intención de Kwitt.

Acciones disponibles:
- "agrega proyecto [url]" → add_project
- "actualiza mi bio [texto]" → update_bio
- "tema minimal/developer/creative/dark/light" → apply_template
- "exporta json/markdown/html" → export
- "importa [json]" → import
- "stats" / "analytics" → get_analytics
- "undo" → undo
- others: update_theme, update_avatar, toggle_animations, toggle_darkmode, delete_project, restore_version, list_versions, run_doctor, repair, get_status

Responde SOLO con JSON: {"action": "...", "target": "...", "data": {}, "confidence": 0.0-1.0}` }, { role: 'user', content: message }],
        temperature: 0.3, max_tokens: 500
      })
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) { try { return JSON.parse(content); } catch { return simpleParseIntent(message); } }
  } catch (e) { console.error('OpenAI error:', e); }
  return simpleParseIntent(message);
}

function simpleParseIntent(text: string): Intent {
  const lower = text.toLowerCase();
  if (lower.startsWith('preview') || lower.startsWith('previsualizar')) return { action: 'preview', target: text.replace(/^(preview|previsualizar)\s*/i, ''), data: {}, confidence: 0.9 };
  if (lower.startsWith('undo') || lower.startsWith('deshacer')) return { action: 'undo', target: '', data: {}, confidence: 0.9 };
  if (lower.startsWith('stats') || lower.startsWith('analytics')) return { action: 'get_analytics', target: '', data: {}, confidence: 0.9 };
  if (lower.startsWith('export') || lower.startsWith('exporta')) {
    const format = lower.includes('markdown') ? 'markdown' : lower.includes('html') ? 'html' : 'json';
    return { action: 'export', target: '', data: { format }, confidence: 0.9 };
  }
  if (lower.startsWith('import') || lower.startsWith('importa')) return { action: 'import', target: text.replace(/^(import|importa)\s*/i, ''), data: {}, confidence: 0.7 };
  if (lower.includes('agrega') || lower.includes('añade')) { const urlMatch = text.match(/(https?:\/\/[^\s]+)/); return { action: 'add_project', target: urlMatch?.[1] || '', data: {}, confidence: 0.8 }; }
  if (lower.includes('bio') || (lower.includes('actualiza') && lower.includes('mi'))) { const bio = text.replace(/actualiza mi bio a,?\s*/gi, '').replace(/actualiza mi bio/gi, '').replace(/^a,?\s*/gi, '').trim(); return { action: 'update_bio', target: 'profile', data: { bio }, confidence: 0.7 }; }
  if (lower.includes('tema')) { const template = Object.keys(PORTFOLIO_TEMPLATES).find(t => lower.includes(t)); return { action: 'apply_template', target: '', data: { template: template || 'minimal' }, confidence: 0.8 }; }
  if (lower.includes('color') || lower.includes('tema')) return { action: 'update_theme', data: { type: 'colors' }, confidence: 0.7 };
  if (lower.includes('imagen') || lower.includes('avatar') || lower.includes('foto')) { const urlMatch = text.match(/(https?:\/\/[^\s]+)/); return { action: 'update_avatar', target: urlMatch?.[1] || '', confidence: 0.7 }; }
  if (lower.includes('versión') || lower.includes('restore') || lower.includes('anterior') || lower.includes('restaurar')) return { action: 'restore_version', confidence: 0.8 };
  if (lower.includes('lista versiones') || lower.includes('versiones')) return { action: 'list_versions', confidence: 0.8 };
  if (lower.includes('doctor') || lower.includes('diagnóstico')) return { action: 'run_doctor', confidence: 0.9 };
  if (lower.includes('reparar') || lower.includes('repair') || lower.includes('fix')) return { action: 'repair', confidence: 0.9 };
  if (lower.includes('estado') || lower.includes('status')) return { action: 'get_status', confidence: 0.8 };
  if (lower.includes('elimina') || lower.includes('borra')) return { action: 'delete_project', target: text, confidence: 0.7 };
  if (lower.includes('animacion') || lower.includes('animación')) return { action: 'toggle_animations', data: { value: lower.includes('activar') || lower.includes('desactivar') === false }, confidence: 0.7 };
  if (lower.includes('oscuro') || lower.includes('dark')) return { action: 'toggle_darkmode', data: { value: !lower.includes('desactivar') && !lower.includes('claro') }, confidence: 0.7 };
  if (lower.includes('rama') || lower.includes('branch')) { const branchMatch = text.match(/(?:rama|branch)\s+(\S+)/i); return { action: 'change_branch', target: branchMatch?.[1] || '', confidence: 0.8 }; }
  return { action: 'unknown', target: '', data: {}, confidence: 0 };
}

async function handleCLICommand(chatId: number, intent: Intent, dryRun = false, saveHistory = true) {
  const instruction = mapIntentToInstruction(intent);
  const modeText = dryRun ? '🔍 (PREVIEW)' : '🔄';
  await sendMessage(chatId, `${modeText} Ejecutando: ${intent.action}...`);

  if (saveHistory && !dryRun) saveCommandToHistory(chatId, intent, intent.action);

  let success = false;
  if (USE_LOCAL_MODE) {
    const result = simpleMapIntentToInstruction(intent);
    await sendMessage(chatId, dryRun ? `📝 Preview: ${result}` : `✅ ${result}`);
    success = true;
  } else {
    const result = await runOpenCodeWithRetry(instruction, dryRun);
    await sendMessage(chatId, dryRun ? `📝 Preview completado` : `✅ ${intent.action} completado`);
    success = result.success;
  }
  
  if (!dryRun && success) {
    await commitToGit(`kwitt: ${intent.action}`);
    trackCommand(intent.action, true, chatId);
  } else if (!dryRun) {
    trackCommand(intent.action, false, chatId);
  }
}

async function handleUndo(chatId: number) {
  const history = getCommandHistory(chatId);
  if (history.length === 0) { await sendMessage(chatId, '❌ No hay comandos para deshacer'); return; }
  const lastCmd = history[0];
  await sendMessage(chatId, `⏪ Deshaciendo: ${lastCmd.action}...`);
  await handleCLICommand(chatId, { action: 'restore_version', target: '', data: {}, confidence: 1.0 }, false, false);
  commandHistory.set(chatId, history.slice(1));
  await sendMessage(chatId, '✅ Comando deshecho');
}

async function handleGetStatus(chatId: number) {
  const portfolio = loadPortfolio();
  const versions = existsSync(VERSIONS_DIR) ? readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')) : [];
  const status = `📊 *Estado del Portfolio*

*👤 Perfil:* ${portfolio.profile?.name || 'No configurado'}
*📁 Proyectos:* ${portfolio.projects?.length || 0}
*🎨 Dark:* ${portfolio.settings?.darkMode ? '✅' : '❌'} *✨ Anim:* ${portfolio.settings?.animations ? '✅' : '❌'}
*💾 Respaldos:* ${versions.length}

*🔧 Modo:* ${USE_LOCAL_MODE ? 'Local' : 'CLI'} *🌿 Rama:* ${GIT_BRANCH}`;
  await sendMessage(chatId, status, 'Markdown', getMainKeyboard());
}

async function handleAnalytics(chatId: number) {
  const stats = getAnalytics();
  const msg = `📈 *Analytics (24h)*

*Comandos:* ${stats.last24h}
*Éxito:* ${stats.successRate}%
*Usuarios únicos:* ${stats.uniqueUsers}
*Usuarios activos:* ${stats.activeUsers}

*Top acciones:*
${stats.topActions.slice(0, 5).map(([a, c]) => `• ${a}: ${c}`).join('\n')}`;
  await sendMessage(chatId, msg, 'Markdown');
}

async function handleListVersions(chatId: number) {
  if (!existsSync(VERSIONS_DIR)) { await sendMessage(chatId, '❌ No hay versiones'); return; }
  const files = readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) { await sendMessage(chatId, '❌ No hay versiones'); return; }
  const list = files.slice(0, 10).map((f, i) => `${i + 1}. ${new Date(f.replace('.json', '')).toLocaleString()}`).join('\n');
  await sendMessage(chatId, `📜 *Versiones:*\n\n${list}\n\nUsa "restaurar"`);
}

async function handleRunDoctor(chatId: number) {
  const portfolio = loadPortfolio();
  const versions = existsSync(VERSIONS_DIR) ? readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')) : [];
  let issues: string[] = [];
  if (!portfolio.profile?.name || portfolio.profile.name === 'Tu Nombre') issues.push('⚠️ Perfil no configurado');
  if (versions.length === 0) issues.push('⚠️ Sin backups');
  if (!OPENAI_API_KEY) issues.push('ℹ️ Sin OpenAI');
  if (USE_LOCAL_MODE) issues.push('ℹ️ Modo local');
  issues.push(`🌿 Rama: ${GIT_BRANCH}`);
  if (issues.length === 0) await sendMessage(chatId, `✅ *Sistema OK*\n\n📁 Proyectos: ${portfolio.projects.length}`);
  else await sendMessage(chatId, `🔍 *Diagnóstico:*\n\n${issues.join('\n')}`);
}

async function handleHelp(chatId: number) {
  const helpText = `📖 *Comandos*

*Portfolio:* proyecto, bio, estado
*Temas:* tema minimal/developer/creative/dark/light
*Sistema:* undo, doctor, versiones, restaurar
*Datos:* stats, export json|markdown|html
*Alias:* /s, /a, /d, /b`;
  await sendMessage(chatId, helpText, 'Markdown', getMainKeyboard());
}

async function handleRepair(chatId: number) {
  const portfolio = loadPortfolio();
  if (!portfolio.settings) portfolio.settings = { animations: true, darkMode: true };
  if (!portfolio.theme) portfolio.theme = { colors: {}, fonts: {}, layout: {} };
  if (!portfolio.profile.contact) portfolio.profile.contact = {};
  savePortfolio(portfolio);
  await sendMessage(chatId, '✅ Reparación completada');
}

async function handleCallback(chatId: number, callbackData: string) {
  switch (callbackData) {
    case 'status': await handleGetStatus(chatId); break;
    case 'add_project_prompt': await sendMessage(chatId, '📎 Envía: "agrega proyecto github.com/user/repo"'); break;
    case 'themes': await sendMessage(chatId, '🎨 *Temas:*', 'Markdown', getThemesKeyboard()); break;
    case 'versions': await handleListVersions(chatId); break;
    case 'doctor': await handleRunDoctor(chatId); break;
    case 'help': await handleHelp(chatId); break;
    case 'analytics': await handleAnalytics(chatId); break;
    case 'toggle_darkmode': await handleCLICommand(chatId, { action: 'toggle_darkmode', target: '', data: { value: true }, confidence: 1.0 }, false); break;
    case 'toggle_animations': await handleCLICommand(chatId, { action: 'toggle_animations', target: '', data: { value: true }, confidence: 1.0 }, false); break;
    case 'export_json': await sendMessage(chatId, `📄\`\`\`\n${exportPortfolio('json').slice(0, 4000)}\n\`\`\``, 'Markdown'); break;
    case 'export_markdown': await sendMessage(chatId, exportPortfolio('markdown').slice(0, 4000)); break;
    case 'export_html': await sendMessage(chatId, exportPortfolio('html').slice(0, 4000)); break;
    default:
      if (callbackData.startsWith('template_')) {
        const template = callbackData.replace('template_', '');
        await handleCLICommand(chatId, { action: 'apply_template', target: '', data: { template }, confidence: 1.0 }, false);
      }
      if (callbackData === 'back_main') await sendMessage(chatId, '📊 *Menú:*', 'Markdown', getMainKeyboard());
  }
  await fetch(`${BASE_URL}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: '' }) });
}

async function handleMessage(chatId: number, text: string) {
  const sanitized = applyAlias(sanitizeInput(text));
  if (!isAuthorized(chatId)) { await sendMessage(chatId, '⛔ No autorizado'); return; }
  if (!checkRateLimit(chatId)) { await sendMessage(chatId, '⏳ Espera...'); return; }
  if (pendingCommands.get(chatId)) { await sendMessage(chatId, '⏳ En proceso...'); return; }
  pendingCommands.set(chatId, true);
  
  try {
    console.log(`📩 ${chatId}: ${sanitized}`);
    if (sanitized.startsWith('/start')) { await handleGetStatus(chatId); return; }
    if (sanitized.startsWith('/ayuda') || sanitized.startsWith('/help')) { await handleHelp(chatId); return; }
    if (sanitized.startsWith('/estado') || sanitized.startsWith('/s')) { await handleGetStatus(chatId); return; }
    if (sanitized.startsWith('/doctor')) { await handleRunDoctor(chatId); return; }
    if (sanitized.startsWith('/versiones') || sanitized.startsWith('/v')) { await handleListVersions(chatId); return; }
    if (sanitized.startsWith('/stats') || sanitized.startsWith('/analytics')) { await handleAnalytics(chatId); return; }
    if (sanitized.startsWith('/reparar')) { await handleRepair(chatId); return; }
    if (sanitized.startsWith('/undo') || sanitized.startsWith('/deshacer')) { await handleUndo(chatId); return; }

    const intent = await parseIntent(sanitized);
    if (!intent.action || intent.action === 'unknown' || intent.confidence < 0.5) { await sendMessage(chatId, '🤔 Usa /ayuda'); return; }

    switch (intent.action) {
      case 'get_status': case 'get_analytics': case 'list_versions': case 'run_doctor': case 'repair': case 'undo':
        await ({ get_status: handleGetStatus, get_analytics: handleAnalytics, list_versions: handleListVersions, run_doctor: handleRunDoctor, repair: handleRepair, undo: handleUndo }[intent.action === 'get_analytics' ? 'get_analytics' : intent.action](chatId)); break;
      case 'change_branch': await commitToGit(`kwitt: switch to ${intent.target}`); await sendMessage(chatId, `✅ Rama: ${intent.target}`); break;
      case 'preview': const previewIntent = await parseIntent(intent.target); await handleCLICommand(chatId, previewIntent, true); break;
      case 'export': await sendMessage(chatId, exportPortfolio(intent.data?.format || 'json').slice(0, 4000)); break;
      default: await handleCLICommand(chatId, intent, false);
    }
  } catch (error) {
    console.error('Error:', error);
    await sendMessage(chatId, '❌ Error: ' + (error as Error).message);
  } finally {
    pendingCommands.set(chatId, false);
  }
}

async function pollMessages() {
  let offset = 0;
  console.log('🤖 Polling mode');
  while (true) {
    try {
      const response = await fetch(`${BASE_URL}/getUpdates?offset=${offset}&timeout=60`);
      const data = await response.json();
      if (data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message?.text) await handleMessage(update.message.chat.id, update.message.text);
        }
      }
    } catch (error) { console.error('Poll error:', error); await new Promise(r => setTimeout(r, 5000)); }
  }
}

async function startWebhookServer() {
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });
  fastify.get('/health', async () => ({ status: 'ok', mode: 'webhook' }));
  fastify.get('/api/analytics', async () => getAnalytics());
  fastify.get('/api/portfolio', async () => loadPortfolio());
  fastify.post('/webhook', async (request: any) => {
    const update = request.body;
    if (update.callback_query) await handleCallback(update.callback_query.message.chat.id, update.callback_query.data);
    else if (update.message?.text) await handleMessage(update.message.chat.id, update.message.text);
    return { ok: true };
  });
  if (WEBHOOK_URL) {
    await fetch(`${BASE_URL}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: WEBHOOK_URL }) });
    console.log(`📡 Webhook: ${WEBHOOK_URL}`);
  }
  await fastify.listen({ port: 3002, host: '0.0.0.0' });
  console.log('🌐 Port 3002');
}

function startScheduledBackups() {
  console.log(`⏰ Backups each ${SCHEDULED_BACKUP_INTERVAL / 1000}s`);
  setInterval(() => {
    try { createVersionSnapshot(loadPortfolio()); console.log('[Backup] OK'); } catch (e) { console.error('[Backup] Error:', e); }
  }, SCHEDULED_BACKUP_INTERVAL);
}

loadAnalytics();
if (WEBHOOK_URL) startWebhookServer();
else pollMessages();
startScheduledBackups();
