import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = '/app/data';
const PORTFOLIO_FILE = join(DATA_DIR, 'portfolio.json');
const VERSIONS_DIR = join(DATA_DIR, 'versions');
const MAX_VERSIONS = 20;

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
      contact: { email: 'tu@email.com', github: 'tugithub', twitter: 'tutwitter' }
    },
    projects: []
  };
  
  savePortfolio(defaultPortfolio);
  return defaultPortfolio;
}

function savePortfolio(data, createSnapshot = true) {
  ensureDir(DATA_DIR);
  
  if (createSnapshot) {
    createVersion(data);
  }
  
  writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
}

function createVersion(data) {
  ensureDir(VERSIONS_DIR);
  
  const timestamp = new Date().toISOString();
  const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
  
  const version = {
    timestamp,
    data: JSON.parse(JSON.stringify(data)),
    type: 'auto'
  };
  
  writeFileSync(versionFile, JSON.stringify(version, null, 2));
  
  const files = readdirSync(VERSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({
      name: f,
      time: statSync(join(VERSIONS_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length > MAX_VERSIONS) {
    files.slice(MAX_VERSIONS).forEach(f => {
      const fs = require('fs');
      fs.unlinkSync(join(VERSIONS_DIR, f.name));
    });
  }
}

function getVersions() {
  ensureDir(VERSIONS_DIR);
  
  const files = readdirSync(VERSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const content = JSON.parse(readFileSync(join(VERSIONS_DIR, f), 'utf-8'));
      return {
        file: f,
        timestamp: content.timestamp,
        type: content.type
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return files;
}

function restoreVersion(timestamp) {
  ensureDir(VERSIONS_DIR);
  
  const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
  
  if (!existsSync(versionFile)) {
    const files = readdirSync(VERSIONS_DIR);
    const match = files.find(f => f.includes(timestamp));
    
    if (match) {
      return restoreVersion(match.replace('.json', ''));
    }
    throw new Error('Versión no encontrada');
  }
  
  const version = JSON.parse(readFileSync(versionFile, 'utf-8'));
  
  const current = loadPortfolio();
  createVersion({ ...current, _restoredFrom: timestamp }, 'restore');
  
  savePortfolio(version.data, false);
  
  return version.data;
}

function getLatestVersion() {
  const versions = getVersions();
  if (versions.length === 0) {
    return null;
  }
  return versions[0];
}

export {
  loadPortfolio,
  savePortfolio,
  createVersion,
  getVersions,
  restoreVersion,
  getLatestVersion,
  DATA_DIR,
  PORTFOLIO_FILE,
  VERSIONS_DIR
};
