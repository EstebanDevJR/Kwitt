import fetch from 'node-fetch';
import { config } from '../config.js';

const { telegram } = config;
const BASE_URL = telegram.baseUrl;
const AGENTS_URL = config.runtime.agentsUrl;

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

async function callAgents(endpoint, body) {
  try {
    const response = await fetch(`${AGENTS_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (e) {
    console.error('Agents error:', e);
    return { status: 'error', message: e.message };
  }
}

export const agents = {
  async handleCreate(chatId, prompt) {
    await send(chatId, '🎨 *Iniciando creación de portafolio*\n\nEsto puede tomar unos minutos. Te notificaré el progreso.');
    
    const result = await callAgents('/portfolio/create', { 
      prompt,
      chat_id: chatId,
      telegram_token: telegram.token
    });
    
    if (result.status === 'error' || result.status === 'failed') {
      await send(chatId, `❌ Error: ${result.message || result.errors?.[0] || 'Unknown error'}`);
      return;
    }
    
    if (result.status === 'awaiting_framework') {
      // Framework selection is handled via Telegram buttons
      return;
    }
  },
  
  async handleUpdate(chatId, prompt) {
    await send(chatId, '✏️ *Iniciando actualización*\n\nTe notificaré el progreso.');
    
    const result = await callAgents('/portfolio/update', { 
      prompt,
      chat_id: chatId,
      telegram_token: telegram.token
    });
    
    if (result.status === 'error' || result.status === 'failed') {
      await send(chatId, `❌ Error: ${result.message || result.errors?.[0] || 'Unknown error'}`);
      return;
    }
  },
  
  async handleStatus(chatId) {
    try {
      const configResult = await callAgents('/portfolio/config', {});
      const required = configResult.required_env || [];
      const msg = required.length > 0 
        ? `⚙️ *Configuración requerida:*\n\n${required.map(e => `• ${e}`).join('\n')}`
        : '✅ *Sistema configurado correctamente*';
      await send(chatId, msg);
    } catch (e) {
      await send(chatId, '⚠️ Agentes no disponibles. Asegúrate de que el servicio esté corriendo.');
    }
  },
  
  async handleFramework(chatId, framework) {
    try {
      // Get the most recent awaiting_framework job for this chat
      const jobs = await callAgents('/portfolio/jobs', {});
      
      let targetJob = null;
      if (Array.isArray(jobs)) {
        // Find the most recent job with awaiting_framework status
        for (const job of jobs.reverse()) {
          const jobData = await callAgents(`/portfolio/status/${job.job_id}`, {});
          if (jobData.status === 'awaiting_framework') {
            targetJob = job.job_id;
            break;
          }
        }
      }
      
      if (!targetJob) {
        await send(chatId, '⚠️ No hay ningún portafolio esperando selección de framework.\n\nPrimero crea uno con: "crea un portafolio para..."');
        return;
      }
      
      const result = await callAgents(`/portfolio/continue/${targetJob}?framework=${framework}`, {});
      
      if (result.status === 'creative') {
        await send(chatId, `✅ Framework *${framework}* seleccionado.\n\n🎨 Creando tu portafolio...`);
      } else {
        await send(chatId, `❌ Error: ${result.message || 'No se pudo continuar'}`);
      }
    } catch (e) {
      await send(chatId, '❌ Error al seleccionar framework. Intenta de nuevo.');
    }
  },
  
  async handleCallback(chatId, data) {
    try {
      if (data.startsWith('fw_')) {
        const parts = data.split('_');
        if (parts.length >= 3) {
          const framework = parts[1];
          const jobId = parts.slice(2).join('_');
          
          const result = await callAgents(`/portfolio/continue/${jobId}?framework=${framework}`, {});
          
          if (result.status === 'creative') {
            await send(chatId, `✅ Framework *${framework}* seleccionado.\n\n🎨 Creando tu portafolio...`);
          }
        }
      }
    } catch (e) {
      console.error('Callback error:', e);
    }
  }
};
