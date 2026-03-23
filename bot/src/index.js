import fetch from 'node-fetch';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { router } from './handlers/message.js';

const { telegram, runtime } = config;
const BASE_URL = telegram.baseUrl;

console.log(`🚀 Kwitt Bot starting...`);
console.log(`📁 Data: ${config.paths.dataDir}`);
console.log(`🤖 Agents: ${runtime.agentsEnabled ? 'Enabled' : 'Disabled'}`);
console.log(`👥 Users: ${config.auth.chatIds.length}`);

async function pollMessages() {
  let offset = 0;
  console.log('🤖 Polling...');
  while (true) {
    try {
      const response = await fetch(`${BASE_URL}/getUpdates?offset=${offset}&timeout=60`);
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message?.text) {
            await router.handleMessage(update.message.chat.id, update.message.text);
          }
          if (update.callback_query) {
            await router.handleCallback(update.callback_query.message.chat.id, update.callback_query.data);
            // Answer callback query to remove loading state
            await fetch(`${BASE_URL}/answerCallbackQuery`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callback_query_id: update.callback_query.id })
            });
          }
        }
      }
    } catch (error) {
      console.error('[Poll] Error:', error.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function startWebhookServer() {
  const fastify = Fastify({ logger: true });
  await fastify.register(cors, { origin: true });

  fastify.get('/health', async () => ({ status: 'ok', mode: 'webhook' }));
  fastify.get('/api/status', async () => ({ status: 'ok', agents: runtime.agentsEnabled }));

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

if (runtime.webhookUrl) {
  startWebhookServer();
} else {
  pollMessages();
}
