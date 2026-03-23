import Fastify from 'fastify';
import cors from '@fastify/cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = '/app/data';
const PORTFOLIO_FILE = join(DATA_DIR, 'portfolio.json');
const VERSIONS_DIR = join(DATA_DIR, 'versions');
const MAX_VERSIONS = 20;

const fastify = Fastify({ logger: true });

await fastify.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
});

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadPortfolio() {
  ensureDir(DATA_DIR);
  
  if (existsSync(PORTFOLIO_FILE)) {
    return JSON.parse(readFileSync(PORTFOLIO_FILE, 'utf-8'));
  }
  
  const defaultPortfolio = {
    profile: {
      name: 'Tu Nombre',
      bio: 'Una breve descripción sobre ti...',
      contact: { email: 'tu@email.com', github: 'tugithub', twitter: 'tutwitter' },
      avatar: ''
    },
    projects: [],
    theme: { colors: {}, fonts: {}, layout: {} },
    settings: { animations: true, darkMode: true },
    customSections: []
  };
  
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(defaultPortfolio, null, 2));
  return defaultPortfolio;
}

function savePortfolio(data) {
  ensureDir(DATA_DIR);
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

function createVersion(data, type = 'auto') {
  ensureDir(VERSIONS_DIR);
  
  const timestamp = new Date().toISOString();
  const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
  
  writeFileSync(versionFile, JSON.stringify({
    timestamp,
    data,
    type
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

function statSync(path) {
  const fs = require('fs');
  return fs.statSync(path);
}

function getVersions() {
  ensureDir(VERSIONS_DIR);
  
  return readdirSync(VERSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      file: f,
      timestamp: f.replace('.json', '')
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function restoreVersion(timestamp) {
  ensureDir(VERSIONS_DIR);
  
  const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
  
  if (!existsSync(versionFile)) {
    throw new Error('Versión no encontrada');
  }
  
  const version = JSON.parse(readFileSync(versionFile, 'utf-8'));
  
  const current = loadPortfolio();
  createVersion({ ...current, _restoredFrom: timestamp }, 'restore');
  
  savePortfolio(version.data);
  return version.data;
}

// Routes
fastify.get('/health', async () => ({ status: 'ok' }));

fastify.get('/api/portfolio', async () => loadPortfolio());

fastify.get('/api/portfolio/profile', async () => loadPortfolio().profile);

fastify.get('/api/portfolio/projects', async () => loadPortfolio().projects);

fastify.get('/api/portfolio/theme', async () => loadPortfolio().theme || {});

fastify.get('/api/portfolio/settings', async () => loadPortfolio().settings || {});

fastify.put('/api/portfolio/profile', async (request) => {
  const portfolio = loadPortfolio();
  createVersion(portfolio, 'edit');
  portfolio.profile = { ...portfolio.profile, ...request.body };
  savePortfolio(portfolio);
  return portfolio.profile;
});

fastify.patch('/api/portfolio/profile', async (request) => {
  const portfolio = loadPortfolio();
  
  if (request.body.name) portfolio.profile.name = request.body.name;
  if (request.body.bio) portfolio.profile.bio = request.body.bio;
  if (request.body.contact) portfolio.profile.contact = { ...portfolio.profile.contact, ...request.body.contact };
  if (request.body.avatar) portfolio.profile.avatar = request.body.avatar;
  
  savePortfolio(portfolio);
  return portfolio.profile;
});

fastify.put('/api/portfolio/theme', async (request) => {
  const portfolio = loadPortfolio();
  createVersion(portfolio, 'theme');
  portfolio.theme = { ...portfolio.theme, ...request.body };
  savePortfolio(portfolio);
  return portfolio.theme;
});

fastify.put('/api/portfolio/settings', async (request) => {
  const portfolio = loadPortfolio();
  createVersion(portfolio, 'settings');
  portfolio.settings = { ...portfolio.settings, ...request.body };
  savePortfolio(portfolio);
  return portfolio.settings;
});

fastify.post('/api/portfolio/projects', async (request) => {
  const portfolio = loadPortfolio();
  createVersion(portfolio, 'add_project');
  
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

fastify.delete('/api/portfolio/projects/:id', async (request) => {
  const portfolio = loadPortfolio();
  const { id } = request.params;
  const index = portfolio.projects.findIndex(p => p.id === id);
  
  if (index === -1) {
    return { error: 'Proyecto no encontrado' };
  }
  
  createVersion(portfolio, 'delete_project');
  portfolio.projects.splice(index, 1);
  portfolio.projects.forEach((p, i) => p.order = i);
  savePortfolio(portfolio);
  return { success: true };
});

fastify.get('/api/portfolio/versions', async () => getVersions());

fastify.post('/api/portfolio/versions/restore', async (request) => {
  const { timestamp } = request.body;
  if (!timestamp) {
    return { error: 'Timestamp requerido' };
  }
  const restored = restoreVersion(timestamp);
  return { success: true, data: restored };
});

fastify.post('/api/portfolio/versions/create', async (request) => {
  const portfolio = loadPortfolio();
  const { type } = request.body || {};
  createVersion(portfolio, type || 'manual');
  return { success: true };
});

fastify.post('/api/portfolio/sync', async (request) => {
  savePortfolio(request.body);
  return { success: true };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Backend with versioning running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();