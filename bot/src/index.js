import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const API_URL = process.env.API_URL || 'http://localhost:3001';

const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const portfolioPath = join(__dirname, '../../portfolio.json');

function loadPortfolio() {
  if (existsSync(portfolioPath)) {
    return JSON.parse(readFileSync(portfolioPath, 'utf-8'));
  }
  return {
    profile: { name: 'Tu Nombre', bio: 'Descripción...', contact: {} },
    projects: []
  };
}

function savePortfolio(data: any) {
  writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

async function parseIntent(message: string) {
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
          content: `Eres el agente de intención de Kwitt. Analiza el mensaje y responde SOLO con JSON:
{
  "action": "add_project|update_bio|update_contact|delete_project|reorder_projects|enhance_frontend|get_status|unknown",
  "target": "objetivo o URL",
  "data": {},
  "confidence": 0.0-1.0
}`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.3
    })
  });
  
  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { action: 'unknown', target: '', data: {}, confidence: 0 };
  }
}

async function handleAddProject(chatId: number, githubUrl: string) {
  const portfolio = loadPortfolio();
  const urlParts = githubUrl.replace('https://', '').split('/');
  const name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'new-project';
  
  const project = {
    id: `project-${Date.now()}`,
    name: name.toLowerCase().replace(/[-_]/g, '-'),
    description: `Proyecto desde ${githubUrl}`,
    url: githubUrl,
    githubUrl: githubUrl,
    tags: ['github', 'project'],
    order: portfolio.projects.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  portfolio.projects.push(project);
  savePortfolio(portfolio);
  
  await sendMessage(chatId, `✅ Proyecto "${project.name}" agregado`);
}

async function handleUpdateBio(chatId: number, bio: string) {
  const portfolio = loadPortfolio();
  portfolio.profile.bio = bio;
  savePortfolio(portfolio);
  await sendMessage(chatId, '✅ Bio actualizada correctamente');
}

async function handleGetStatus(chatId: number) {
  const portfolio = loadPortfolio();
  const status = `📊 *Estado del Portfolio*\n\n*Nombre:* ${portfolio.profile.name}\n*Bio:* ${portfolio.profile.bio}\n*Proyectos:* ${portfolio.projects.length}`;
  await sendMessage(chatId, status);
}

async function handleMessage(chatId: number, text: string) {
  if (AUTHORIZED_CHAT_ID && chatId !== parseInt(AUTHORIZED_CHAT_ID)) {
    await sendMessage(chatId, '⛔ No autorizado');
    return;
  }
  
  if (text.startsWith('/start')) {
    await sendMessage(chatId, `👋 ¡Hola! Soy Kwitt, tu asistente de portfolio.\n\nComandos disponibles:\n- agrega proyecto [url]\n- actualiza mi bio [texto]\n- estado\n- ayuda`);
    return;
  }
  
  if (text.startsWith('/ayuda') || text.startsWith('/help')) {
    await sendMessage(chatId, `📖 *Comandos disponibles:*

• \`agrega proyecto [url-github]\` - Añadir proyecto
• \`actualiza mi bio [texto]\` - Actualizar bio  
• \`cambia mi contacto [tipo] [valor]\` - Actualizar contacto
• \`elimina proyecto [nombre]\` - Eliminar proyecto
• \`estado\` - Ver estado del portfolio
• \`hazlo más moderno\` - Añadir animaciones GSAP`);
    return;
  }
  
  if (text.startsWith('/estado')) {
    await handleGetStatus(chatId);
    return;
  }
  
  try {
    const intent = await parseIntent(text);
    
    if (intent.confidence < 0.5) {
      await sendMessage(chatId, '🤔 No pude entender. Intenta de otra forma.');
      return;
    }
    
    switch (intent.action) {
      case 'add_project':
        await handleAddProject(chatId, intent.target);
        break;
      case 'update_bio':
        await handleUpdateBio(chatId, intent.data?.bio || intent.target);
        break;
      case 'get_status':
        await handleGetStatus(chatId);
        break;
      default:
        await sendMessage(chatId, '🤔 Acción no reconocida. Usa /ayuda para ver comandos.');
    }
  } catch (error) {
    console.error('Error:', error);
    await sendMessage(chatId, '❌ Hubo un error procesando tu mensaje');
  }
}

async function pollMessages() {
  let offset = 0;
  
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
            console.log(`📩 Mensaje de ${chatId}: ${text}`);
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

console.log('🤖 Kwitt Bot iniciado...');
pollMessages();