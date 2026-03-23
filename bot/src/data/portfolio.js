import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { config, DEFAULT_PORTFOLIO } from '../config.js';

const { paths, runtime } = config;
const DATA_DIR = paths.dataDir;
const PORTFOLIO_FILE = join(DATA_DIR, 'portfolio.json');
const VERSIONS_DIR = join(DATA_DIR, 'versions');
const ANALYTICS_FILE = join(DATA_DIR, 'analytics.json');
const MAX_VERSIONS = 20;

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const portfolio = {
  load() {
    ensureDir(DATA_DIR);
    if (existsSync(PORTFOLIO_FILE)) {
      return JSON.parse(readFileSync(PORTFOLIO_FILE, 'utf-8'));
    }
    const defaultData = JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));
    writeFileSync(PORTFOLIO_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  },

  save(data, createVersion = true) {
    ensureDir(DATA_DIR);
    if (createVersion) this.createVersion(data);
    writeFileSync(PORTFOLIO_FILE, JSON.stringify(data, null, 2));
  },

  createVersion(data) {
    ensureDir(VERSIONS_DIR);
    const timestamp = new Date().toISOString();
    const versionFile = join(VERSIONS_DIR, `${timestamp}.json`);
    writeFileSync(versionFile, JSON.stringify({ timestamp, data: JSON.parse(JSON.stringify(data)), type: 'auto' }, null, 2));
    this.cleanOldVersions();
  },

  cleanOldVersions() {
    const files = readdirSync(VERSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f, time: statSync(join(VERSIONS_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    if (files.length > MAX_VERSIONS) {
      files.slice(MAX_VERSIONS).forEach(f => unlinkSync(join(VERSIONS_DIR, f.name)));
    }
  },

  getVersions() {
    if (!existsSync(VERSIONS_DIR)) return [];
    return readdirSync(VERSIONS_DIR).filter(f => f.endsWith('.json'));
  },

  restoreLatest() {
    const files = this.getVersions().sort().reverse();
    if (files.length > 0) {
      const latest = JSON.parse(readFileSync(join(VERSIONS_DIR, files[0]), 'utf-8'));
      this.save(latest.data, false);
      return true;
    }
    return false;
  },

  executeAction(intent) {
    const p = this.load();
    switch (intent.action) {
      case 'update_name':
        p.profile.name = intent.target;
        break;
      case 'update_bio':
        p.profile.bio = intent.data?.bio || intent.target;
        break;
      case 'update_avatar':
        p.profile.avatar = intent.target;
        break;
      case 'update_contact':
        if (!p.profile.contact) p.profile.contact = {};
        p.profile.contact[intent.data?.tipo || 'email'] = intent.data?.valor || intent.target;
        break;
      case 'toggle_animations':
        p.settings = p.settings || {};
        p.settings.animations = intent.data?.value ?? true;
        break;
      case 'toggle_darkmode':
        p.settings = p.settings || {};
        p.settings.darkMode = intent.data?.value ?? true;
        break;
      case 'add_project':
        const urlParts = intent.target.replace(/https?:\/\//, '').split('/').filter(Boolean);
        const name = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'new-project';
        p.projects = p.projects || [];
        p.projects.push({
          id: `project-${Date.now()}`,
          name: name.toLowerCase().replace(/[-_]/g, '-'),
          description: `Proyecto desde ${intent.target}`,
          url: intent.target,
          githubUrl: intent.target,
          tags: ['github'],
          imageUrl: '',
          order: p.projects.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        break;
      case 'delete_project':
        const nameToDelete = (intent.target || '').toLowerCase().replace(/elimina|borra|proyecto/gi, '').trim();
        const idx = p.projects?.findIndex(proj => 
          proj.name.toLowerCase().includes(nameToDelete) || nameToDelete.includes(proj.name.toLowerCase())
        );
        if (idx !== -1) p.projects.splice(idx, 1);
        break;
      case 'apply_template':
        const { TEMPLATES } = require('../config.js');
        const templateKey = intent.data?.template;
        if (TEMPLATES[templateKey]) p.theme = TEMPLATES[templateKey];
        break;
      case 'restore_version':
        this.restoreLatest();
        return '✅ Restaurado';
      default:
        return `Acción ${intent.action} no soportada`;
    }
    this.save(p);
    return `✅ ${intent.action} completado`;
  }
};

const analytics = {
  commands: [],
  users: new Map(),

  load() {
    if (existsSync(ANALYTICS_FILE)) {
      try {
        const data = JSON.parse(readFileSync(ANALYTICS_FILE, 'utf-8'));
        this.commands = data.commands || [];
        this.users = new Map(data.users);
      } catch (e) { console.error('[Analytics] Load error:', e); }
    }
  },

  save() {
    try {
      const data = { commands: this.commands.slice(-1000), users: Array.from(this.users.entries()) };
      writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('[Analytics] Save error:', e); }
  },

  track(action, success, userId) {
    this.commands.push({ action, success, timestamp: Date.now(), user: userId });
    if (this.commands.length > 1000) this.commands = this.commands.slice(-1000);
    const userStats = this.users.get(userId) || { commands: 0, lastSeen: 0 };
    userStats.commands++;
    userStats.lastSeen = Date.now();
    this.users.set(userId, userStats);
    this.save();
  },

  get() {
    const now = Date.now();
    const last24h = this.commands.filter(c => now - c.timestamp < 86400000);
    const last7d = this.commands.filter(c => now - c.timestamp < 604800000);
    const actionCounts = last24h.reduce((acc, c) => { acc[c.action] = (acc[c.action] || 0) + 1; return acc; }, {});
    const successRate = last24h.length > 0 ? (last24h.filter(c => c.success).length / last24h.length * 100).toFixed(1) : '0';
    return {
      totalCommands: this.commands.length,
      last24h: last24h.length,
      last7d: last7d.length,
      successRate,
      topActions: Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
      uniqueUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => now - u.lastSeen < 86400000).length
    };
  }
};

analytics.load();

export function exportPortfolio(format) {
  const p = portfolio.load();
  switch (format) {
    case 'markdown':
      return `# ${p.profile.name}\n\n${p.profile.bio}\n\n## Proyectos\n\n${p.projects?.map(proj => `- [${proj.name}](${proj.url}) - ${proj.description}`).join('\n') || ''}\n\n## Contacto\n\n${Object.entries(p.profile.contact || {}).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}`;
    case 'html':
      return `<!DOCTYPE html><html><head><title>${p.profile.name}</title></head><body><h1>${p.profile.name}</h1><p>${p.profile.bio}</p><h2>Proyectos</h2>${p.projects?.map(proj => `<p><a href="${proj.url}">${proj.name}</a> - ${proj.description}</p>`).join('') || ''}</body></html>`;
    default:
      return JSON.stringify(p, null, 2);
  }
}

export { analytics };