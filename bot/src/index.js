import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_URL = process.env.API_URL || 'http://localhost:3001';

const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const portfolioPath = '/app/data/portfolio.json';

function loadPortfolio() {
  if (existsSync(portfolioPath)) {
    return JSON.parse(readFileSync(portfolioPath, 'utf-8'));
  }
  return {
    profile: { name: 'Tu Nombre', bio: 'Descripción...', contact: {}, avatar: '' },
    projects: [],
    theme: { colors: {}, fonts: {}, layout: {} },
    settings: { animations: true, darkMode: true },
    customSections: []
  };
}

function savePortfolio(data) {
  writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
}

async function sendMessage(chatId, text, parseMode = 'Markdown') {
  try {
    await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
    });
  } catch (e) {
    console.error('Error sending message:', e);
  }
}

async function parseIntent(message) {
  if (!OPENAI_API_KEY) {
    return simpleParseIntent(message);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
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
- "agrega sección [título]" → action: "add_section", data: {title, content}
- "activa animaciones" → action: "toggle_animations", data: {value: true}
- "activa modo oscuro" → action: "toggle_darkmode", data: {value: true}
- "versión anterior" → action: "restore_version"
- "lista versiones" → action: "list_versions"
- "doctor" → action: "run_doctor"
- "reparar" → action: "repair"
- "estado" → action: "get_status"

Responde SOLO con JSON:
{
  "action": "add_project|update_bio|update_theme|update_avatar|add_section|toggle_animations|toggle_darkmode|restore_version|list_versions|run_doctor|repair|get_status|delete_project|unknown",
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

function simpleParseIntent(text) {
  const lower = text.toLowerCase();
  
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
  
  if (lower.includes('versión') || lower.includes('restore') || lower.includes('anterior')) {
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
  
  return { action: 'unknown', target: '', data: {}, confidence: 0 };
}

function createVersion(data) {
  const versionsDir = '/app/data/versions';
  const fs = require('fs');
  
  if (!existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString();
  const versionFile = join(versionsDir, `${timestamp}.json`);
  
  fs.writeFileSync(versionFile, JSON.stringify({
    timestamp,
    data,
    type: 'auto'
  }, null, 2));
}

function getVersions() {
  const versionsDir = '/app/data/versions';
  const fs = require('fs');
  
  if (!existsSync(versionsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(versionsDir).filter(f => f.endsWith('.json'));
  return files.map(f => ({
    file: f,
    timestamp: f.replace('.json', '')
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function restoreVersion(timestamp) {
  const versionsDir = '/app/data/versions';
  const fs = require('fs');
  
  const versionFile = join(versionsDir, `${timestamp}.json`);
  
  if (!existsSync(versionFile)) {
    throw new Error('Versión no encontrada');
  }
  
  const version = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
  
  const current = loadPortfolio();
  createVersion({ ...current, _restoredFrom: timestamp });
  
  savePortfolio(version.data);
  return version.data;
}

async function handleAddProject(chatId, githubUrl) {
  if (!githubUrl.includes('github.com')) {
    await sendMessage(chatId, '❌ URL de GitHub inválida');
    return;
  }
  
  const portfolio = loadPortfolio();
  const urlParts = githubUrl.replace('https://', '').replace('http://', '').split('/').filter(Boolean);
  const name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'new-project';
  
  const project = {
    id: `project-${Date.now()}`,
    name: name.toLowerCase().replace(/[-_]/g, '-'),
    description: `Proyecto desde ${githubUrl}`,
    url: githubUrl,
    githubUrl: githubUrl,
    tags: ['github', 'project'],
    imageUrl: '',
    order: portfolio.projects.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  createVersion(portfolio);
  portfolio.projects.push(project);
  savePortfolio(portfolio);
  
  await sendMessage(chatId, `✅ Proyecto "${project.name}" agregado`);
}

async function handleUpdateBio(chatId, bio) {
  const portfolio = loadPortfolio();
  createVersion(portfolio);
  portfolio.profile.bio = bio;
  savePortfolio(portfolio);
  await sendMessage(chatId, `✅ Bio actualizada:\n\n"${bio}"`);
}

async function handleUpdateTheme(chatId, type, values) {
  const portfolio = loadPortfolio();
  createVersion(portfolio);
  
  portfolio.theme = portfolio.theme || {};
  
  if (type === 'colors') {
    portfolio.theme.colors = { ...portfolio.theme.colors, ...values };
  } else if (type === 'fonts') {
    portfolio.theme.fonts = { ...portfolio.theme.fonts, ...values };
  }
  
  savePortfolio(portfolio);
  await sendMessage(chatId, `✅ Tema actualizado (${type})`);
}

async function handleUpdateAvatar(chatId, imageUrl) {
  const portfolio = loadPortfolio();
  createVersion(portfolio);
  portfolio.profile.avatar = imageUrl;
  savePortfolio(portfolio);
  await sendMessage(chatId, `✅ Avatar actualizado`);
}

async function handleToggleAnimations(chatId, enable) {
  const portfolio = loadPortfolio();
  createVersion(portfolio);
  portfolio.settings = portfolio.settings || {};
  portfolio.settings.animations = enable;
  savePortfolio(portfolio);
  await sendMessage(chatId, `✅ Animaciones ${enable ? 'activadas' : 'desactivadas'}`);
}

async function handleToggleDarkMode(chatId, enable) {
  const portfolio = loadPortfolio();
  createVersion(portfolio);
  portfolio.settings = portfolio.settings || {};
  portfolio.settings.darkMode = enable;
  savePortfolio(portfolio);
  await sendMessage(chatId, `✅ Modo oscuro ${enable ? 'activado' : 'desactivado'}`);
}

async function handleDeleteProject(chatId, projectName) {
  const portfolio = loadPortfolio();
  const nameToDelete = projectName.replace(/elimina|borra|proyecto/gi, '').trim().toLowerCase();
  
  const index = portfolio.projects.findIndex(p => 
    p.name.toLowerCase().includes(nameToDelete) || 
    nameToDelete.includes(p.name.toLowerCase())
  );
  
  if (index === -1) {
    await sendMessage(chatId, `❌ Proyecto "${nameToDelete}" no encontrado`);
    return;
  }
  
  createVersion(portfolio);
  const deleted = portfolio.projects.splice(index, 1)[0];
  portfolio.projects.forEach((p, i) => p.order = i);
  savePortfolio(portfolio);
  
  await sendMessage(chatId, `✅ Proyecto "${deleted.name}" eliminado`);
}

async function handleRestoreVersion(chatId) {
  const versions = getVersions();
  
  if (versions.length === 0) {
    await sendMessage(chatId, '❌ No hay versiones disponibles');
    return;
  }
  
  const latest = versions[0];
  const restored = restoreVersion(latest.timestamp);
  
  await sendMessage(chatId, `✅ Restaurado a la versión anterior\n\n📅 ${new Date(latest.timestamp).toLocaleString()}`);
}

async function handleListVersions(chatId) {
  const versions = getVersions();
  
  if (versions.length === 0) {
    await sendMessage(chatId, '❌ No hay versiones guardadas');
    return;
  }
  
  const list = versions.slice(0, 10).map((v, i) => 
    `${i + 1}. ${new Date(v.timestamp).toLocaleString()}`
  ).join('\n');
  
  await sendMessage(chatId, `📜 *Últimas versiones:*\n\n${list}\n\nUsa "restaurar" para revertir`);
}

async function handleRunDoctor(chatId) {
  const portfolio = loadPortfolio();
  const versions = getVersions();
  
  let issues = [];
  
  if (!portfolio.profile?.name || portfolio.profile.name === 'Tu Nombre') {
    issues.push('⚠️ Perfil no configurado');
  }
  
  if (versions.length === 0) {
    issues.push('⚠️ Sin backups de seguridad');
  }
  
  if (!portfolio.settings?.animations) {
    issues.push('ℹ️ Animaciones desactivadas');
  }
  
  if (issues.length === 0) {
    await sendMessage(chatId, '✅ *Diagnóstico del Sistema*\n\nTodo parece funcionar correctamente.\n\n📁 Proyectos: ' + portfolio.projects.length);
  } else {
    await sendMessage(chatId, '🔍 *Diagnóstico:*\n\n' + issues.join('\n'));
  }
}

async function handleRepair(chatId) {
  const portfolio = loadPortfolio();
  createVersion(portfolio);
  
  if (!portfolio.settings) {
    portfolio.settings = { animations: true, darkMode: true };
  }
  
  if (!portfolio.theme) {
    portfolio.theme = { colors: {}, fonts: {}, layout: {} };
  }
  
  savePortfolio(portfolio);
  await sendMessage(chatId, '✅ *Reparación completada*\n\nConfiguración restaurada');
}

async function handleGetStatus(chatId) {
  const portfolio = loadPortfolio();
  const versions = getVersions();
  
  const status = `📊 *Estado del Portfolio*

*👤 Perfil:*
- Nombre: ${portfolio.profile?.name || 'No configurado'}
- Bio: ${portfolio.profile?.bio?.substring(0, 50) || 'No configurada'}...

*📁 Proyectos:* ${portfolio.projects?.length || 0}

*🎨 Tema:*
- Modo oscuro: ${portfolio.settings?.darkMode ? '✅' : '❌'}
- Animaciones: ${portfolio.settings?.animations ? '✅' : '❌'}

*💾 Respaldos:* ${versions.length}

Usa los comandos para hacer cambios.`;
  
  await sendMessage(chatId, status);
}

async function handleHelp(chatId) {
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
• "activa modo oscuro"

*Sistema:*
• "doctor" - Diagnóstico del sistema
• "reparar" - Reparar configuración
• "lista versiones" - Ver backups
• "restaurar" - Restaurar versión anterior

*Versiones:*
• "versión anterior" - Restaurar backup
• "lista versiones" - Ver historial`;
  
  await sendMessage(chatId, helpText);
}

async function handleMessage(chatId, text) {
  if (AUTHORIZED_CHAT_ID && chatId !== parseInt(AUTHORIZED_CHAT_ID)) {
    await sendMessage(chatId, '⛔ No autorizado');
    return;
  }
  
  console.log(`📩 Mensaje de ${chatId}: ${text}`);
  
  if (text.startsWith('/start')) {
    await handleGetStatus(chatId);
    return;
  }
  
  if (text.startsWith('/ayuda') || text.startsWith('/help')) {
    await handleHelp(chatId);
    return;
  }
  
  if (text.startsWith('/estado')) {
    await handleGetStatus(chatId);
    return;
  }
  
  if (text.startsWith('/doctor')) {
    await handleRunDoctor(chatId);
    return;
  }
  
  if (text.startsWith('/reparar')) {
    await handleRepair(chatId);
    return;
  }
  
  if (text.startsWith('/versiones')) {
    await handleListVersions(chatId);
    return;
  }
  
  try {
    const intent = await parseIntent(text);
    
    if (!intent.action || intent.action === 'unknown' || intent.confidence < 0.5) {
      await sendMessage(chatId, '🤔 No entendí. Usa "/ayuda" para ver comandos.');
      return;
    }
    
    switch (intent.action) {
      case 'add_project':
        await handleAddProject(chatId, intent.target);
        break;
        
      case 'update_bio':
        const bio = intent.data?.bio || text;
        await handleUpdateBio(chatId, bio);
        break;
        
      case 'update_theme':
        await handleUpdateTheme(chatId, intent.data?.type || 'colors', intent.data || {});
        break;
        
      case 'update_avatar':
        await handleUpdateAvatar(chatId, intent.target);
        break;
        
      case 'toggle_animations':
        await handleToggleAnimations(chatId, intent.data?.value ?? true);
        break;
        
      case 'toggle_darkmode':
        await handleToggleDarkMode(chatId, intent.data?.value ?? true);
        break;
        
      case 'delete_project':
        await handleDeleteProject(chatId, text);
        break;
        
      case 'restore_version':
        await handleRestoreVersion(chatId);
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
        
      case 'get_status':
        await handleGetStatus(chatId);
        break;
        
      default:
        await sendMessage(chatId, '🤔 Acción no reconocida. Usa "/ayuda"');
    }
    
  } catch (error) {
    console.error('Error:', error);
    await sendMessage(chatId, '❌ Error: ' + error.message);
  }
}

async function pollMessages() {
  let offset = 0;
  
  console.log('🤖 Kwitt Bot iniciado con versionado...');
  
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

pollMessages();