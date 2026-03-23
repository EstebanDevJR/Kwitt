import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const fastify = Fastify({ logger: true });

await fastify.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
});

function getPortfolioPath() {
  return '/app/data/portfolio.json';
}

function ensureDataDir() {
  const dir = '/app/data';
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const portfolioPath = getPortfolioPath();
  if (!existsSync(portfolioPath)) {
    const defaultPortfolio = {
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
    writeFileSync(portfolioPath, JSON.stringify(defaultPortfolio, null, 2));
  }
}

function loadPortfolio() {
  ensureDataDir();
  const portfolioPath = getPortfolioPath();
  
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

function savePortfolio(data) {
  const portfolioPath = getPortfolioPath();
  writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
}

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// GET /api/portfolio
fastify.get('/api/portfolio', async () => {
  return loadPortfolio();
});

// GET /api/portfolio/profile
fastify.get('/api/portfolio/profile', async () => {
  return loadPortfolio().profile;
});

// PUT /api/portfolio/profile
fastify.put('/api/portfolio/profile', async (request, reply) => {
  const portfolio = loadPortfolio();
  portfolio.profile = { ...portfolio.profile, ...request.body };
  savePortfolio(portfolio);
  return portfolio.profile;
});

// PATCH /api/portfolio/profile
fastify.patch('/api/portfolio/profile', async (request, reply) => {
  const portfolio = loadPortfolio();
  
  if (request.body.name) portfolio.profile.name = request.body.name;
  if (request.body.bio) portfolio.profile.bio = request.body.bio;
  if (request.body.contact) {
    portfolio.profile.contact = { ...portfolio.profile.contact, ...request.body.contact };
  }
  
  savePortfolio(portfolio);
  return portfolio.profile;
});

// GET /api/portfolio/projects
fastify.get('/api/portfolio/projects', async () => {
  return loadPortfolio().projects;
});

// GET /api/portfolio/projects/:id
fastify.get('/api/portfolio/projects/:id', async (request, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const project = portfolio.projects.find(p => p.id === id);
  
  if (!project) {
    return reply.code(404).send({ error: 'Proyecto no encontrado' });
  }
  
  return project;
});

// POST /api/portfolio/projects
fastify.post('/api/portfolio/projects', async (request, reply) => {
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

// PUT /api/portfolio/projects/:id
fastify.put('/api/portfolio/projects/:id', async (request, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const index = portfolio.projects.findIndex(p => p.id === id);
  
  if (index === -1) {
    return reply.code(404).send({ error: 'Proyecto no encontrado' });
  }
  
  portfolio.projects[index] = {
    ...portfolio.projects[index],
    ...request.body,
    updatedAt: new Date().toISOString()
  };
  
  savePortfolio(portfolio);
  return portfolio.projects[index];
});

// DELETE /api/portfolio/projects/:id
fastify.delete('/api/portfolio/projects/:id', async (request, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const index = portfolio.projects.findIndex(p => p.id === id);
  
  if (index === -1) {
    return reply.code(404).send({ error: 'Proyecto no encontrado' });
  }
  
  const deleted = portfolio.projects.splice(index, 1)[0];
  
  portfolio.projects.forEach((p, i) => {
    p.order = i;
  });
  
  savePortfolio(portfolio);
  return { success: true, deleted };
});

// PUT /api/portfolio/projects/reorder
fastify.put('/api/portfolio/projects/reorder', async (request, reply) => {
  const portfolio = loadPortfolio();
  portfolio.projects = request.body;
  portfolio.projects.forEach((p, i) => p.order = i);
  savePortfolio(portfolio);
  return portfolio.projects;
});

// POST /api/portfolio/sync
fastify.post('/api/portfolio/sync', async (request, reply) => {
  savePortfolio(request.body);
  return { success: true, message: 'Portfolio sincronizado' };
});

// INICIO
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