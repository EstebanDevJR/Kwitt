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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
});

const DB_PATH = process.env.DATABASE_URL || './kwitt.db';

function getPortfolioPath() {
  return join(__dirname, '../portfolio.json');
}

function loadPortfolio() {
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

function savePortfolio(data: any) {
  const portfolioPath = getPortfolioPath();
  writeFileSync(portfolioPath, JSON.stringify(data, null, 2));
}

// ==================== RUTAS ====================

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// GET /api/portfolio - Obtener portfolio completo
fastify.get('/api/portfolio', async (request, reply) => {
  const portfolio = loadPortfolio();
  return portfolio;
});

// GET /api/portfolio/profile - Obtener perfil
fastify.get('/api/portfolio/profile', async (request, reply) => {
  const portfolio = loadPortfolio();
  return portfolio.profile;
});

// PUT /api/portfolio/profile - Actualizar perfil
fastify.put('/api/portfolio/profile', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  portfolio.profile = { ...portfolio.profile, ...request.body };
  savePortfolio(portfolio);
  return portfolio.profile;
});

// PATCH /api/portfolio/profile - Actualizar parcialmente
fastify.patch('/api/portfolio/profile', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  
  if (request.body.name) portfolio.profile.name = request.body.name;
  if (request.body.bio) portfolio.profile.bio = request.body.bio;
  if (request.body.contact) {
    portfolio.profile.contact = { ...portfolio.profile.contact, ...request.body.contact };
  }
  
  savePortfolio(portfolio);
  return portfolio.profile;
});

// GET /api/portfolio/projects - Listar proyectos
fastify.get('/api/portfolio/projects', async (request, reply) => {
  const portfolio = loadPortfolio();
  return portfolio.projects;
});

// GET /api/portfolio/projects/:id - Obtener proyecto específico
fastify.get('/api/portfolio/projects/:id', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const project = portfolio.projects.find((p: any) => p.id === id);
  
  if (!project) {
    return reply.code(404).send({ error: 'Proyecto no encontrado' });
  }
  
  return project;
});

// POST /api/portfolio/projects - Crear proyecto
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

// PUT /api/portfolio/projects/:id - Actualizar proyecto
fastify.put('/api/portfolio/projects/:id', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const index = portfolio.projects.findIndex((p: any) => p.id === id);
  
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

// DELETE /api/portfolio/projects/:id - Eliminar proyecto
fastify.delete('/api/portfolio/projects/:id', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const index = portfolio.projects.findIndex((p: any) => p.id === id);
  
  if (index === -1) {
    return reply.code(404).send({ error: 'Proyecto no encontrado' });
  }
  
  const deleted = portfolio.projects.splice(index, 1)[0];
  
  portfolio.projects.forEach((p: any, i: number) => {
    p.order = i;
  });
  
  savePortfolio(portfolio);
  return { success: true, deleted };
});

// PUT /api/portfolio/projects/reorder - Reordenar proyectos
fastify.put('/api/portfolio/projects/reorder', async (request: any, reply) => {
  const portfolio = loadPortfolio();
  portfolio.projects = request.body;
  portfolio.projects.forEach((p: any, i: number) => p.order = i);
  savePortfolio(portfolio);
  return portfolio.projects;
});

// POST /api/portfolio/sync - Sincronizar todo el portfolio
fastify.post('/api/portfolio/sync', async (request: any, reply) => {
  savePortfolio(request.body);
  return { success: true, message: 'Portfolio sincronizado' };
});

// ==================== INICIO ====================

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
    console.log(`📋 Endpoints disponibles:`);
    console.log(`   GET  /api/portfolio`);
    console.log(`   GET  /api/portfolio/profile`);
    console.log(`   PUT  /api/portfolio/profile`);
    console.log(`   GET  /api/portfolio/projects`);
    console.log(`   POST /api/portfolio/projects`);
    console.log(`   PUT  /api/portfolio/projects/:id`);
    console.log(`   DELETE /api/portfolio/projects/:id`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();