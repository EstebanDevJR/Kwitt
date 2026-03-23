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

async function sendMessage(chatId: number, text: string, parseMode = 'Markdown') {
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

async function sendKeyboard(chatId: number, text: string, keyboard: any) {
  try {
    await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: keyboard
      })
    });
  } catch (e) {
    console.error('Error sending keyboard:', e);
  }
}

async function parseIntent(message: string) {
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

function simpleParseIntent(text: string): any {
  const lower = text.toLowerCase();
  
  if (lower.includes('agrega') || lower.includes('añade') || lower.includes('agregar')) {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    return { action: 'add_project', target: urlMatch?.[1] || '', data: {}, confidence: 0.8 };
  }
  
  if (lower.includes('bio') || (lower.includes('actualiza') && lower.includes('mi'))) {
    const bioMatch = text.replace(/actualiza mi bio/gi, '').replace(/actualiza mi/gi, '').trim();
    return { action: 'update_bio', target: 'profile', data: { bio: bioMatch || text }, confidence: 0.7 };
  }
  
  if (lower.includes('contacto') || lower.includes('contact')) {
    return { action: 'update_contact', target: 'contact', data: {}, confidence: 0.6 };
  }
  
  if (lower.includes('elimina') || lower.includes('borra') || lower.includes('delete')) {
    return { action: 'delete_project', target: text, data: {}, confidence: 0.7 };
  }
  
  if (lower.includes('estado') || lower.includes('status') || lower.includes('ver')) {
    return { action: 'get_status', target: 'portfolio', data: {}, confidence: 0.8 };
  }
  
  if (lower.includes('moderno') || lower.includes('animacion') || lower.includes('mejorar')) {
    return { action: 'enhance_frontend', target: 'frontend', data: {}, confidence: 0.7 };
  }
  
  return { action: 'unknown', target: '', data: {}, confidence: 0 };
}

async function handleAddProject(chatId: number, githubUrl: string) {
  if (!githubUrl.includes('github.com')) {
    await sendMessage(chatId, '❌ Por favor proporciona una URL de GitHub válida');
    return;
  }
  
  await sendMessage(chatId, '🔄 Agregando proyecto...');
  
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
    order: portfolio.projects.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  portfolio.projects.push(project);
  savePortfolio(portfolio);
  
  await sendMessage(chatId, `✅ Proyecto "${project.name}" agregado\n\n` +
    `📝 *Detalles:*\n` +
    `- Nombre: ${project.name}\n` +
    `- URL: ${project.url}\n` +
    `- Tags: ${project.tags.join(', ')}`);
}

async function handleUpdateBio(chatId: number, bio: string) {
  const portfolio = loadPortfolio();
  portfolio.profile.bio = bio;
  savePortfolio(portfolio);
  
  await sendMessage(chatId, `✅ Bio actualizada\n\n📝 "${bio}"`);
}

async function handleUpdateContact(chatId: number, contactInfo: string) {
  const portfolio = loadPortfolio();
  
  const emailMatch = contactInfo.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const twitterMatch = contactInfo.match(/@?(\w+)/);
  
  if (emailMatch) {
    portfolio.profile.contact.email = emailMatch[1];
  }
  if (twitterMatch) {
    portfolio.profile.contact.twitter = twitterMatch[1];
  }
  
  savePortfolio(portfolio);
  await sendMessage(chatId, '✅ Contacto actualizado');
}

async function handleDeleteProject(chatId: number, projectName: string) {
  const portfolio = loadPortfolio();
  const nameToDelete = projectName.replace(/elimina|borra|proyecto/gi, '').trim().toLowerCase();
  
  const index = portfolio.projects.findIndex(p => 
    p.name.toLowerCase().includes(nameToDelete) || 
    nameToDelete.includes(p.name.toLowerCase())
  );
  
  if (index === -1) {
    await sendMessage(chatId, `❌ No encontré el proyecto "${nameToDelete}"`);
    return;
  }
  
  const deleted = portfolio.projects.splice(index, 1)[0];
  
  portfolio.projects.forEach((p, i) => p.order = i);
  savePortfolio(portfolio);
  
  await sendMessage(chatId, `✅ Proyecto "${deleted.name}" eliminado`);
}

async function handleGetStatus(chatId: number) {
  const portfolio = loadPortfolio();
  
  const projectsList = portfolio.projects.length > 0 
    ? portfolio.projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
    : 'No hay proyectos';
  
  const status = `📊 *Estado del Portfolio*\n\n` +
    `*👤 Nombre:* ${portfolio.profile.name}\n` +
    `*📝 Bio:* ${portfolio.profile.bio}\n\n` +
    `*📁 Proyectos (${portfolio.projects.length}):*\n${projectsList}\n\n` +
    `*📬 Contacto:*\n` +
    `${portfolio.profile.contact.email ? `✉️ ${portfolio.profile.contact.email}\n` : ''}` +
    `${portfolio.profile.contact.github ? `🐙 ${portfolio.profile.contact.github}\n` : ''}` +
    `${portfolio.profile.contact.twitter ? `🐦 @${portfolio.profile.contact.twitter}\n` : ''}`;
  
  await sendMessage(chatId, status);
}

async function handleEnhance(chatId: number) {
  await sendMessage(chatId, '🎨 Mejorando frontend con animaciones GSAP...');
  
  const frontendPath = join(__dirname, '../../frontend/src/app/page.tsx');
  
  if (existsSync(frontendPath)) {
    let content = readFileSync(frontendPath, 'utf-8');
    
    if (!content.includes('gsap')) {
      const enhanced = content.replace(
        "import { useEffect, useRef, useState } from 'react';",
        "import { useEffect, useRef, useState } from 'react';\nimport gsap from 'gsap';\nimport { ScrollTrigger } from 'gsap/ScrollTrigger';"
      ).replace(
        'useEffect(() => {',
        `useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);`
      );
      
      writeFileSync(frontendPath, enhanced);
    }
  }
  
  await sendMessage(chatId, '✨ Frontend mejorado con animaciones GSAP');
}

async function handleHelp(chatId: number) {
  const helpText = `📖 *Guía de Comandos*

*Agregar Proyecto:*
"agrega proyecto https://github.com/user/repo"

*Actualizar Bio:*
"actualiza mi bio [tu nueva bio]"

*Ver Estado:*
"estado" o "muéstrame mi portfolio"

*Eliminar Proyecto:*
"elimina [nombre del proyecto]"

*Mejorar Frontend:*
"hazlo más moderno" o "añade animaciones"

*Contacto:*
"mi email es [email]" o "mi twitter es @user"`;
  
  await sendMessage(chatId, helpText);
}

async function handleMessage(chatId: number, text: string) {
  if (AUTHORIZED_CHAT_ID && chatId !== parseInt(AUTHORIZED_CHAT_ID)) {
    await sendMessage(chatId, '⛔ No autorizado');
    return;
  }
  
  console.log(`📩 Mensaje de ${chatId}: ${text}`);
  
  if (text.startsWith('/start')) {
    const portfolio = loadPortfolio();
    await sendMessage(chatId, `👋 *¡Hola! Soy Kwitt* ✨\n\n` +
      `Tu asistente de portfolio personal.\n\n` +
      `*👤 Perfil:* ${portfolio.profile.name}\n` +
      `*📁 Proyectos:* ${portfolio.projects.length}\n\n` +
      `Envía "/ayuda" para ver comandos disponibles.`);
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
  
  if (text.startsWith('/bio')) {
    const bio = text.replace('/bio', '').trim();
    if (bio) {
      await handleUpdateBio(chatId, bio);
    } else {
      await sendMessage(chatId, 'Usa: /bio [tu nueva bio]');
    }
    return;
  }
  
  try {
    const intent = await parseIntent(text);
    console.log('🎯 Intent:', intent);
    
    if (!intent.action || intent.action === 'unknown' || intent.confidence < 0.5) {
      await sendMessage(chatId, 
        '🤔 No pude entender tu mensaje.\n\n' +
        'Usa "/ayuda" para ver los comandos disponibles.'
      );
      return;
    }
    
    switch (intent.action) {
      case 'add_project':
        await handleAddProject(chatId, intent.target);
        break;
        
      case 'update_bio':
        const bio = intent.data?.bio || intent.target;
        await handleUpdateBio(chatId, bio);
        break;
        
      case 'update_contact':
        await handleUpdateContact(chatId, text);
        break;
        
      case 'delete_project':
        await handleDeleteProject(chatId, text);
        break;
        
      case 'get_status':
        await handleGetStatus(chatId);
        break;
        
      case 'enhance_frontend':
        await handleEnhance(chatId);
        break;
        
      default:
        await sendMessage(chatId, '🤔 Acción no reconocida. Usa /ayuda');
    }
    
  } catch (error) {
    console.error('Error:', error);
    await sendMessage(chatId, '❌ Hubo un error procesando tu mensaje');
  }
}

async function pollMessages() {
  let offset = 0;
  
  console.log('🤖 Kwitt Bot iniciado...');
  console.log(`🔗 API URL: ${API_URL}`);
  
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