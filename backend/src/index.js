import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const fastify = Fastify({ logger: true });

await fastify.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});

const DB_PATH = process.env.DATABASE_URL || './kwitt.db';

function loadPortfolio() {
  const portfolioPath = join(__dirname, '../../portfolio.json');
  
  if (existsSync(portfolioPath)) {
    const content = readFileSync(portfolioPath, 'utf-8');
    return JSON.parse(content);
  }
  
  return {
    profile: {
      name: 'Tu Nombre',
      bio: 'Una breve descripción sobre ti...',
      contact: {
        email: 'tu@email.com',
        github: 'tugithub',
        twitter: 'tutwitter'
      }
    },
    projects: []
  };
}

function savePortfolio(data: any) {
  const portfolioPath = join(__dirname, '../../portfolio.json');
  writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
}

fastify.get('/api/portfolio', async (request, reply) => {
  const portfolio = loadPortfolio();
  return portfolio;
});

fastify.get('/api/portfolio/profile', async (request, reply) => {
  const portfolio = loadPortfolio();
  return portfolio.profile;
});

fastify.get('/api/portfolio/projects', async (request, reply) => {
  const portfolio = loadPortfolio();
  return portfolio.projects;
});

fastify.put('/api/portfolio/profile', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  portfolio.profile = { ...portfolio.profile, ...request.body };
  savePortfolio(portfolio);
  return portfolio.profile;
});

fastify.post('/api/portfolio/projects', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  const project = {
    id: `project-${Date.now()}`,
    ...request.body,
    order: portfolio.projects.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  portfolio.projects.push(project);
  savePortfolio(portfolio);
  return project;
});

fastify.delete('/api/portfolio/projects/:id', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  portfolio.projects = portfolio.projects.filter((p: any) => p.id !== id);
  savePortfolio(portfolio);
  return { success: true };
});

fastify.put('/api/portfolio/projects/reorder', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  portfolio.projects = request.body;
  portfolio.projects.forEach((p: any, i: number) => p.order = i);
  savePortfolio(portfolio);
  return portfolio.projects;
});

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();