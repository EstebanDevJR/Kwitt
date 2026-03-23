import fetch from 'node-fetch';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { router } from './handlers/message.js';
import { portfolio } from './data/portfolio.js';

const { telegram, runtime } = config;
const BASE_URL = telegram.baseUrl;

console.log(`🚀 Kwitt Bot starting...`);
console.log(`📁 Data: ${config.paths.dataDir}`);
console.log(`🔧 Mode: ${runtime.localMode ? 'Local' : 'CLI'}`);
console.log(`🌿 Branch: ${runtime.gitBranch}`);
console.log(`👥 Users: ${config.auth.chatIds.length}`);

async function pollMessages() {
  let offset = 0;
  console.log('🤖 Polling...');
  while (true) {
    try {
      const response = await fetch(`${BASE_URL}/getUpdates?offset=${offset}&timeout=60`);
      const data = await response.json();
      if (data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message?.text) {
            await router.handleMessage(update.message.chat.id, update.message.text);
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
  fastify.get('/api/analytics', async () => (await import('./data/portfolio.js')).analytics.get());
  fastify.get('/api/portfolio', async () => portfolio.load());

  fastify.post('/webhook', async (request) => {
    const update = request.body;
    if (update.callback_query) {
      await router.handleCallback(update.callback_query.message.chat.id, update.callback_query.data);
    } else if (update.message?.text) {
      await router.handleMessage(update.message.chat.id, update.message.text);
    }
    return { ok: true };
  });

  if (runtime.webhookUrl) {
    await fetch(`${BASE_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: runtime.webhookUrl })
    });
    console.log(`📡 Webhook: ${runtime.webhookUrl}`);
  }

  await fastify.listen({ port: 3002, host: '0.0.0.0' });
  console.log('🌐 Port 3002');
}

function startScheduledBackups() {
  console.log(`⏰ Backup every ${runtime.backupInterval / 1000}s`);
  setInterval(() => {
    try {
      portfolio.createVersion(portfolio.load());
      console.log('[Backup] OK');
    } catch (e) {
      console.error('[Backup] Error:', e);
    }
  }, runtime.backupInterval);
}

if (runtime.webhookUrl) {
  startWebhookServer();
} else {
  pollMessages();
}
startScheduledBackups();