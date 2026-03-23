import fetch from 'node-fetch';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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
const COMMANDS_DIR = join(DATA_DIR, 'commands');
const MAX_VERSIONS = 20;
const MAX_COMMAND_HISTORY = 50;

const lastCommandTime = new Map<number, number>();
const pendingCommands = new Map<number, boolean>();
const commandHistory = new Map<number, Array<{intent: Intent; timestamp: number; action: string}>>();

interface Intent {
  action: string;
  target: string;
  data: Record<string, any>;
  confidence: number;
}

console.log(`🚀 Kwitt Bot starting...`);
console.log(`📁 Data directory: ${DATA_DIR}`);
console.log(`🐳 Docker mode: ${IS_DOCKER}`);
console.log(`🔧 Local mode: ${USE_LOCAL_MODE}`);
console.log(`🌿 Git branch: ${GIT_BRANCH}`);
console.log(`📡 Webhook: ${WEBHOOK_URL ? 'enabled' : 'disabled'}`);

function sanitizeInput(text: string): string {
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .slice(0, 500);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadPortfolio(): any {
  ensureDir(DATA_DIR);
  ensureDir(VERSIONS_DIR);
  ensureDir(COMMANDS_DIR);
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
  ensureDir(VERSIONS_DIR);
  if (createVersion) {
    createVersionSnapshot(data);
  }
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

function createVersionSnapshot(data: any): void {
  const timestamp = new Date().toISOString();
  const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
  writeFileSync(versionFile, JSON.stringify({
    timestamp,
    data: JSON.parse(JSON.stringify(data)),
    type: 'auto'
  }, null, 2));

  const files = readdirSync(VERSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      time: statSync(join(VERSIONS_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > MAX_VERSIONS) {
    files.slice(MAX_VERSIONS).forEach(f => {
      unlinkSync(join(VERSIONS_DIR, f.name));
    });
  }
}

function saveCommandToHistory(chatId: number, intent: Intent, action: string): void {
  const history = commandHistory.get(chatId) || [];
  history.unshift({
    intent,
    timestamp: Date.now(),
    action
  });
  if (history.length > MAX_COMMAND_HISTORY) {
    history.pop();
  }
  commandHistory.set(chatId, history);
}

function getCommandHistory(chatId: number): Array<{intent: Intent; timestamp: number; action: string}> {
  return commandHistory.get(chatId) || [];
}

async function sendMessage(chatId: number, text: string, parseMode = 'Markdown', replyMarkup?: any) {
  try {
    const body: any = { chat_id: chatId, text, parse_mode: parseMode };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
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
      [
        { text: '📊 Estado', callback_data: 'status' },
        { text: '➕ Proyecto', callback_data: 'add_project_prompt' }
      ],
      [
        { text: '🎨 Temas', callback_data: 'themes' },
        { text: '💾 Versiones', callback_data: 'versions' }
      ],
      [
        { text: '🔧 Doctor', callback_data: 'doctor' },
        { text: '❓ Ayuda', callback_data: 'help' }
      ]
    ]
  };
}

function getThemesKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🌙 Modo Oscuro', callback_data: 'toggle_darkmode' },
        { text: '✨ Animaciones', callback_data: 'toggle_animations' }
      ],
      [{ text: '🔙 Volver', callback_data: 'back_main' }]
    ]
  };
}

function checkRateLimit(chatId: number): boolean {
  const now = Date.now();
  const lastTime = lastCommandTime.get(chatId) || 0;
  if (now - lastTime < RATE_LIMIT_MS) {
    return false;
  }
  lastCommandTime.set(chatId, now);
  return true;
}

async function runOpenCodeWithRetry(instruction: string, dryRun = false, retries = 2): Promise<{ success: boolean; stdout: string; stderr: string; retries: number }> {
  let lastError = '';
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await runOpenCode(instruction, dryRun);
      if (result.success || i === retries) {
        return { ...result, retries: i };
      }
      lastError = result.stderr;
    } catch (e: any) {
      lastError = e.message;
    }
    if (i < retries) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return { success: false, stdout: '', stderr: lastError, retries };
}

async function runOpenCode(instruction: string, dryRun = false): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const cmd = dryRun
      ? `opencode run --dry-run "${instruction.replace(/"/g, '\\"')}"`
      : `opencode run "${instruction.replace(/"/g, '\\"')}"`;
    console.log(`[CLI] ${cmd}`);
    const child = spawn(cmd, { shell: true, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });
    child.on('error', (error) => {
      resolve({ success: false, stdout, stderr: error.message });
    });
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ success: false, stdout, stderr: 'Timeout' });
    }, CLI_TIMEOUT);
  });
}

async function commitToGit(message: string): Promise<boolean> {
  try {
    if (!existsSync('.git')) {
      console.log('[Git] Not a git repository');
      return false;
    }
    execSync('git add data/portfolio.json', { encoding: 'utf-8' });
    execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
    if (GIT_BRANCH !== 'main' && GIT_BRANCH !== 'master') {
      execSync(`git push origin ${GIT_BRANCH}`, { encoding: 'utf-8' });
    } else {
      execSync('git push', { encoding: 'utf-8' });
    }
    console.log(`[Git] Committed: ${message}`);
    return true;
  } catch (e) {
    console.error('[Git] Commit failed:', e);
    return false;
  }
}

function mapIntentToInstruction(intent: Intent): string {
  const { action, target, data } = intent;
  const mappings: Record<string, string> = {
    add_project: `Add a new project to the portfolio from GitHub repository ${target}. Extract the project name, description, and relevant tech stack tags. Update the portfolio data file and ensure the frontend displays the new project correctly.`,
    update_bio: `Update the portfolio bio to: "${data?.bio || target}". Save the changes to portfolio.json in the data directory.`,
    update_theme: `Update the portfolio theme in portfolio.json. ${data?.colors ? `Set colors: ${JSON.stringify(data.colors)}` : ''} ${data?.fonts ? `Set fonts: ${JSON.stringify(data.fonts)}` : ''}.`,
    update_avatar: `Update the profile avatar in portfolio.json to use the image at URL: ${target}.`,
    toggle_animations: `${data?.value ? 'Enable' : 'Disable'} animations in portfolio.json settings.`,
    toggle_darkmode: `${data?.value ? 'Enable' : 'Disable'} dark mode in portfolio.json settings.`,
    delete_project: `Delete the project "${target}" from portfolio.json. Update the project order for remaining projects.`,
    restore_version: `Restore portfolio.json to the most recent backup version from the versions directory.`
  };
  return mappings[action] || `Execute action: ${action} with target "${target}"`;
}

function simpleMapIntentToInstruction(intent: Intent): string {
  const { action, target, data } = intent;
  const portfolio = loadPortfolio();
  switch (action) {
    case 'add_project':
      const urlParts = target.replace('https://', '').replace('http://', '').split('/').filter(Boolean);
      const name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'new-project';
      const project = {
        id: `project-${Date.now()}`,
        name: name.toLowerCase().replace(/[-_]/g, '-'),
        description: `Proyecto desde ${target}`,
        url: target,
        githubUrl: target,
        tags: ['github', 'project'],
        imageUrl: '',
        order: portfolio.projects.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      portfolio.projects.push(project);
      savePortfolio(portfolio);
      return `Added project "${project.name}" to portfolio`;
    case 'update_bio':
      portfolio.profile.bio = data?.bio || target;
      savePortfolio(portfolio);
      return `Updated bio to: "${portfolio.profile.bio}"`;
    case 'update_theme':
      portfolio.theme = portfolio.theme || {};
      if (data?.colors) portfolio.theme.colors = { ...portfolio.theme.colors, ...data.colors };
      if (data?.fonts) portfolio.theme.fonts = { ...portfolio.theme.fonts, ...data.fonts };
      savePortfolio(portfolio);
      return `Updated theme settings`;
    case 'update_avatar':
      portfolio.profile.avatar = target;
      savePortfolio(portfolio);
      return `Updated avatar to: ${target}`;
    case 'toggle_animations':
      portfolio.settings = portfolio.settings || {};
      portfolio.settings.animations = data?.value ?? true;
      savePortfolio(portfolio);
      return `Animations ${portfolio.settings.animations ? 'enabled' : 'disabled'}`;
    case 'toggle_darkmode':
      portfolio.settings = portfolio.settings || {};
      portfolio.settings.darkMode = data?.value ?? true;
      savePortfolio(portfolio);
      return `Dark mode ${portfolio.settings.darkMode ? 'enabled' : 'disabled'}`;
    case 'delete_project':
      const nameToDelete = target.replace(/elimina|borra|proyecto/gi, '').trim().toLowerCase();
      const index = portfolio.projects.findIndex(p => p.name.toLowerCase().includes(nameToDelete) || nameToDelete.includes(p.name.toLowerCase()));
      if (index !== -1) {
        const deleted = portfolio.projects.splice(index, 1)[0];
        portfolio.projects.forEach((p: any, i: number) => { p.order = i; });
        savePortfolio(portfolio);
        return `Deleted project "${deleted.name}"`;
      }
      return `Project not found`;
    case 'restore_version':
      const files = readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')).sort().reverse();
      if (files.length > 0) {
        const latest = JSON.parse(readFileSync(join(VERSIONS_DIR, files[0]), 'utf-8'));
        savePortfolio(latest.data, false);
        return `Restored to version: ${files[0].replace('.json', '')}`;
      }
      return 'No versions available';
    case 'undo':
      return 'Undo not available in local mode';
    default:
      return `Action ${action} not supported in local mode`;
  }
}

async function parseIntent(message: string): Promise<Intent> {
  if (!OPENAI_API_KEY) {
    return simpleParseIntent(message);
  }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Eres el agente de intención de Kwitt. Analiza el mensaje del usuario para modificar el portfolio.

El usuario puede pedir:
- "agrega proyecto [url]" → action: "add_project", target: url
- "actualiza mi bio [texto]" → action: "update_bio", target: "profile", data: {bio}
- "cambia el color a azul" → action: "update_theme", data: {colors: {accent: '#0000ff'}}
- "cambia la fuente a Roboto" → action: "update_theme", data: {fonts: {heading: 'Roboto'}}
- "agrega mi foto [url]" → action: "update_avatar", target: url
- "activa animaciones" → action: "toggle_animations", data: {value: true}
- "desactiva animaciones" → action: "toggle_animations", data: {value: false}
- "activa modo oscuro" → action: "toggle_darkmode", data: {value: true}
- "desactiva modo oscuro" → action: "toggle_darkmode", data: {value: false}
- "versión anterior" → action: "restore_version"
- "lista versiones" → action: "list_versions"
- "doctor" → action: "run_doctor"
- "reparar" → action: "repair"
- "estado" → action: "get_status"
- "elimina proyecto [nombre]" → action: "delete_project", target: nombre
- "preview [comando]" → action: "preview", target: comando original
- "undo" → action: "undo", target: ""
- "cambia rama [nombre]" → action: "change_branch", target: nombre

Responde SOLO con JSON:
{
  "action": "add_project|update_bio|update_theme|update_avatar|toggle_animations|toggle_darkmode|restore_version|list_versions|run_doctor|repair|get_status|delete_project|preview|undo|change_branch|unknown",
  "target": "",
  "data": {},
  "confidence": 0.0-1.0
}`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return simpleParseIntent(message);
      }
    }
  } catch (e) {
    console.error('OpenAI error:', e);
  }
  return simpleParseIntent(message);
}

function simpleParseIntent(text: string): Intent {
  const lower = text.toLowerCase();
  const isPreview = lower.startsWith('preview') || lower.startsWith('previsualizar');
  if (isPreview) {
    const cmd = text.replace(/^preview\s*/i, '').replace(/^previsualizar\s*/i, '').trim();
    return { action: 'preview', target: cmd, data: {}, confidence: 0.9 };
  }
  if (lower.startsWith('undo') || lower.startsWith('deshacer')) {
    return { action: 'undo', target: '', data: {}, confidence: 0.9 };
  }
  if (lower.includes('agrega') || lower.includes('añade')) {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    return { action: 'add_project', target: urlMatch?.[1] || '', data: {}, confidence: 0.8 };
  }
  if (lower.includes('bio') || (lower.includes('actualiza') && lower.includes('mi'))) {
    let bio = text.replace(/actualiza mi bio a,/gi, '').replace(/actualiza mi bio/gi, '').replace(/actualiza mi a,/gi, '').replace(/actualiza mi/gi, '').replace(/^a,?\s*/gi, '').trim();
    return { action: 'update_bio', target: 'profile', data: { bio }, confidence: 0.7 };
  }
  if (lower.includes('color') || lower.includes('tema')) {
    return { action: 'update_theme', data: { type: 'colors' }, confidence: 0.7 };
  }
  if (lower.includes('fuente') || lower.includes('font') || lower.includes('letra')) {
    return { action: 'update_theme', data: { type: 'fonts' }, confidence: 0.7 };
  }
  if (lower.includes('imagen') || lower.includes('avatar') || lower.includes('foto')) {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    return { action: 'update_avatar', target: urlMatch?.[1] || '', confidence: 0.7 };
  }
  if (lower.includes('versión') || lower.includes('restore') || lower.includes('anterior') || lower.includes('restaurar')) {
    return { action: 'restore_version', confidence: 0.8 };
  }
  if (lower.includes('lista versiones') || lower.includes('versiones')) {
    return { action: 'list_versions', confidence: 0.8 };
  }
  if (lower.includes('doctor') || lower.includes('diagnóstico') || lower.includes('diagnostico')) {
    return { action: 'run_doctor', confidence: 0.9 };
  }
  if (lower.includes('reparar') || lower.includes('repair') || lower.includes('fix')) {
    return { action: 'repair', confidence: 0.9 };
  }
  if (lower.includes('estado') || lower.includes('status')) {
    return { action: 'get_status', confidence: 0.8 };
  }
  if (lower.includes('elimina') || lower.includes('borra')) {
    return { action: 'delete_project', target: text, confidence: 0.7 };
  }
  if (lower.includes('animacion') || lower.includes('animación')) {
    return { action: 'toggle_animations', data: { value: lower.includes('activar') || lower.includes('activar') }, confidence: 0.7 };
  }
  if (lower.includes('oscuro') || lower.includes('dark')) {
    return { action: 'toggle_darkmode', data: { value: !lower.includes('desactivar') && !lower.includes('claro') }, confidence: 0.7 };
  }
  if (lower.includes('rama') || lower.includes('branch')) {
    const branchMatch = text.match(/(?:rama|branch)\s+(\S+)/i);
    return { action: 'change_branch', target: branchMatch?.[1] || '', confidence: 0.8 };
  }
  return { action: 'unknown', target: '', data: {}, confidence: 0 };
}

async function handleCLICommand(chatId: number, intent: Intent, dryRun = false, saveHistory = true) {
  const instruction = mapIntentToInstruction(intent);
  const modeText = dryRun ? '🔍 (PREVIEW)' : '🔄';
  await sendMessage(chatId, `${modeText} Ejecutando: ${intent.action}...`);

  if (saveHistory && !dryRun) {
    saveCommandToHistory(chatId, intent, intent.action);
  }

  if (USE_LOCAL_MODE) {
    const result = simpleMapIntentToInstruction(intent);
    await sendMessage(chatId, dryRun ? `📝 Preview: ${result}` : `✅ ${result}`);
    if (!dryRun) await commitToGit(`kwitt: ${intent.action} via local mode`);
    return;
  }

  const result = await runOpenCodeWithRetry(instruction, dryRun);
  if (result.success) {
    await sendMessage(chatId, dryRun ? `📝 Preview completado` : `✅ ${intent.action} completado`);
    if (!dryRun) await commitToGit(`kwitt: ${intent.action} via CLI`);
  } else {
    const retryText = result.retries > 0 ? ` (retry ${result.retries})` : '';
    await sendMessage(chatId, `⚠️ Error${retryText}: ${result.stderr || 'Unknown error'}`);
  }
}

async function handleUndo(chatId: number) {
  const history = getCommandHistory(chatId);
  if (history.length === 0) {
    await sendMessage(chatId, '❌ No hay comandos para deshacer');
    return;
  }
  const lastCmd = history[0];
  const undoIntent: Intent = {
    action: 'restore_version',
    target: '',
    data: {},
    confidence: 1.0
  };
  await sendMessage(chatId, `⏪ Deshaciendo: ${lastCmd.action}...`);
  await handleCLICommand(chatId, undoIntent, false, false);
  commandHistory.set(chatId, history.slice(1));
  await sendMessage(chatId, '✅ Comando deshecho');
}

async function handleChangeBranch(chatId: number, branchName: string) {
  if (!branchName) {
    await sendMessage(chatId, `🌿 Rama actual: ${GIT_BRANCH}\n\nUsa "cambia rama nombre-rama" para cambiar`);
    return;
  }
  await sendMessage(chatId, `🌿 Cambiando a rama: ${branchName}...`);
  await commitToGit(`kwitt: switch to branch ${branchName}`);
  await sendMessage(chatId, `✅ Cambiado a rama: ${branchName}`);
}

async function handleGetStatus(chatId: number) {
  const portfolio = loadPortfolio();
  const versions = existsSync(VERSIONS_DIR) ? readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')) : [];
  const history = getCommandHistory(chatId);
  const status = `📊 *Estado del Portfolio*

*👤 Perfil:*
- Nombre: ${portfolio.profile?.name || 'No configurado'}
- Bio: ${portfolio.profile?.bio?.substring(0, 50) || 'No configurada'}...

*📁 Proyectos:* ${portfolio.projects?.length || 0}

*🎨 Tema:*
- Modo oscuro: ${portfolio.settings?.darkMode ? '✅' : '❌'}
- Animaciones: ${portfolio.settings?.animations ? '✅' : '❌'}

*💾 Respaldos:* ${versions.length}
*📜 Historial:* ${history.length} comandos

*🔧 Modo:* ${USE_LOCAL_MODE ? 'Local (Fallback)' : 'CLI'}
*🌿 Rama:* ${GIT_BRANCH}

Usa "preview [comando]" para previsualizar o "undo" para deshacer.`;
  await sendMessage(chatId, status, 'Markdown', getMainKeyboard());
}

async function handleListVersions(chatId: number) {
  if (!existsSync(VERSIONS_DIR)) {
    await sendMessage(chatId, '❌ No hay versiones guardadas');
    return;
  }
  const files = readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    await sendMessage(chatId, '❌ No hay versiones guardadas');
    return;
  }
  const list = files.slice(0, 10).map((f, i) => `${i + 1}. ${new Date(f.replace('.json', '')).toLocaleString()}`).join('\n');
  await sendMessage(chatId, `📜 *Últimas versiones:*\n\n${list}\n\nUsa "restaurar" para revertir`);
}

async function handleRunDoctor(chatId: number) {
  const portfolio = loadPortfolio();
  const versions = existsSync(VERSIONS_DIR) ? readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json')) : [];
  let issues: string[] = [];
  if (!portfolio.profile?.name || portfolio.profile.name === 'Tu Nombre') {
    issues.push('⚠️ Perfil no configurado');
  }
  if (versions.length === 0) {
    issues.push('⚠️ Sin backups de seguridad');
  }
  if (!portfolio.settings?.animations) {
    issues.push('ℹ️ Animaciones desactivadas');
  }
  if (!OPENAI_API_KEY) {
    issues.push('ℹ️ Sin OpenAI (modo fallback)');
  }
  if (USE_LOCAL_MODE) {
    issues.push('ℹ️ Modo local activo');
  }
  issues.push(`🌿 Rama: ${GIT_BRANCH}`);
  if (issues.length === 0) {
    await sendMessage(chatId, '✅ *Diagnóstico del Sistema*\n\nTodo parece funcionar correctamente.\n\n📁 Proyectos: ' + portfolio.projects.length);
  } else {
    await sendMessage(chatId, '🔍 *Diagnóstico:*\n\n' + issues.join('\n'));
  }
}

async function handleHelp(chatId: number) {
  const helpText = `📖 *Comandos disponibles*

*Gestión de Portfolio:*
• "agrega proyecto [url]" - Añadir proyecto
• "actualiza mi bio [texto]" - Actualizar bio
• "elimina proyecto [nombre]" - Eliminar proyecto
• "estado" - Ver estado completo

*Personalización:*
• "cambia el color a [color]" - Cambiar color
• "cambia la fuente a [fuente]" - Cambiar fuente
• "agrega mi foto [url]" - Actualizar avatar
• "activa animaciones" / "desactiva"
• "activa modo oscuro" / "desactiva"

*Sistema:*
• "doctor" - Diagnóstico del sistema
• "reparar" - Reparar configuración
• "lista versiones" - Ver backups
• "restaurar" - Restaurar versión anterior
• "preview [comando]" - Previsualizar cambio
• "undo" - Deshacer último comando
• "cambia rama [nombre]" - Cambiar rama git

*Keyboard:* Usa los botones para acciones rápidas`;
  await sendMessage(chatId, helpText, 'Markdown', getMainKeyboard());
}

async function handleRepair(chatId: number) {
  const portfolio = loadPortfolio();
  if (!portfolio.settings) portfolio.settings = { animations: true, darkMode: true };
  if (!portfolio.theme) portfolio.theme = { colors: {}, fonts: {}, layout: {} };
  if (!portfolio.profile.contact) portfolio.profile.contact = {};
  savePortfolio(portfolio);
  await sendMessage(chatId, '✅ *Reparación completada*\n\nConfiguración restaurada');
}

async function handleCallback(chatId: number, callbackData: string) {
  switch (callbackData) {
    case 'status':
      await handleGetStatus(chatId);
      break;
    case 'add_project_prompt':
      await sendMessage(chatId, '📎 Envía la URL del proyecto de GitHub:\n\n"agrega proyecto github.com/user/repo"');
      break;
    case 'themes':
      await sendMessage(chatId, '🎨 *Temas:*', 'Markdown', getThemesKeyboard());
      break;
    case 'versions':
      await handleListVersions(chatId);
      break;
    case 'doctor':
      await handleRunDoctor(chatId);
      break;
    case 'help':
      await handleHelp(chatId);
      break;
    case 'toggle_darkmode':
      await handleCLICommand(chatId, { action: 'toggle_darkmode', target: '', data: { value: true }, confidence: 1.0 }, false);
      break;
    case 'toggle_animations':
      await handleCLICommand(chatId, { action: 'toggle_animations', target: '', data: { value: true }, confidence: 1.0 }, false);
      break;
    case 'back_main':
      await sendMessage(chatId, '📊 *Menú Principal:*', 'Markdown', getMainKeyboard());
      break;
  }
  await fetch(`${BASE_URL}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: '' })
  });
}

async function handleMessage(chatId: number, text: string) {
  const sanitized = sanitizeInput(text);
  if (AUTHORIZED_CHAT_ID && chatId !== parseInt(AUTHORIZED_CHAT_ID)) {
    await sendMessage(chatId, '⛔ No autorizado');
    return;
  }
  if (!checkRateLimit(chatId)) {
    await sendMessage(chatId, '⏳ Espera un momento antes de enviar otro comando...');
    return;
  }
  if (pendingCommands.get(chatId)) {
    await sendMessage(chatId, '⏳ Comando en proceso...');
    return;
  }
  pendingCommands.set(chatId, true);
  try {
    console.log(`📩 Mensaje de ${chatId}: ${sanitized}`);
    if (sanitized.startsWith('/start')) {
      await handleGetStatus(chatId);
      return;
    }
    if (sanitized.startsWith('/ayuda') || sanitized.startsWith('/help')) {
      await handleHelp(chatId);
      return;
    }
    if (sanitized.startsWith('/estado')) {
      await handleGetStatus(chatId);
      return;
    }
    if (sanitized.startsWith('/doctor')) {
      await handleRunDoctor(chatId);
      return;
    }
    if (sanitized.startsWith('/versiones')) {
      await handleListVersions(chatId);
      return;
    }
    if (sanitized.startsWith('/reparar')) {
      await handleRepair(chatId);
      return;
    }
    if (sanitized.startsWith('/undo') || sanitized.startsWith('/deshacer')) {
      await handleUndo(chatId);
      return;
    }
    const intent = await parseIntent(sanitized);
    if (!intent.action || intent.action === 'unknown' || intent.confidence < 0.5) {
      await sendMessage(chatId, '🤔 No entendí. Usa "/ayuda" para ver comandos.');
      return;
    }
    switch (intent.action) {
      case 'get_status':
        await handleGetStatus(chatId);
        break;
      case 'list_versions':
        await handleListVersions(chatId);
        break;
      case 'run_doctor':
        await handleRunDoctor(chatId);
        break;
      case 'repair':
        await handleRepair(chatId);
        break;
      case 'undo':
        await handleUndo(chatId);
        break;
      case 'change_branch':
        await handleChangeBranch(chatId, intent.target);
        break;
      case 'preview':
        const previewIntent = await parseIntent(intent.target);
        await handleCLICommand(chatId, previewIntent, true);
        break;
      default:
        await handleCLICommand(chatId, intent, false);
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
  console.log('🤖 Kwitt Bot started - Polling mode');
  while (true) {
    try {
      const response = await fetch(`${BASE_URL}/getUpdates?offset=${offset}&timeout=60`);
      const data = await response.json();
      if (data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            await handleMessage(chatId, text);
          }
        }
      }
    } catch (error) {
      console.error('Poll error:', error);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function startWebhookServer() {
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });
  fastify.get('/health', async () => ({ status: 'ok', mode: 'webhook' }));
  fastify.post('/webhook', async (request: any) => {
    const update = request.body;
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const callbackData = update.callback_query.data;
      await handleCallback(chatId, callbackData);
    } else if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      await handleMessage(chatId, text);
    }
    return { ok: true };
  });
  if (WEBHOOK_URL) {
    await fetch(`${BASE_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: WEBHOOK_URL })
    });
    console.log(`📡 Webhook set to: ${WEBHOOK_URL}`);
  }
  await fastify.listen({ port: 3002, host: '0.0.0.0' });
  console.log('🌐 Webhook server running on port 3002');
}

function startScheduledBackups() {
  console.log(`⏰ Scheduled backups every ${SCHEDULED_BACKUP_INTERVAL / 1000}s`);
  setInterval(() => {
    try {
      const portfolio = loadPortfolio();
      createVersionSnapshot(portfolio);
      console.log('[Backup] Automatic backup created');
    } catch (e) {
      console.error('[Backup] Failed:', e);
    }
  }, SCHEDULED_BACKUP_INTERVAL);
}

if (WEBHOOK_URL) {
  startWebhookServer();
} else {
  pollMessages();
}
startScheduledBackups();
