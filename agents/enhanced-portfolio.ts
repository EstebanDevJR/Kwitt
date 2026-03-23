import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = '/app/data';

function loadPortfolio() {
  const path = join(DATA_DIR, 'portfolio.json');
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf-8'));
  }
  return {
    profile: { name: 'Tu Nombre', bio: 'Descripción...', contact: {}, avatar: '' },
    projects: [],
    theme: {
      colors: { primary: '#0a0a0a', accent: '#6366f1', surface: '#1a1a1a', text: '#ffffff', textMuted: '#9ca3af' },
      fonts: { heading: 'Inter', body: 'Inter' },
      layout: { hero: true, projects: true, contact: true }
    },
    settings: {
      animations: true,
      darkMode: true,
      showEmail: true,
      showGithub: true,
      showTwitter: true
    },
    customSections: []
  };
}

function savePortfolio(data, createVersion = true) {
  const { createVersion: cv } = await import('./version.js');
  if (createVersion) {
    cv(data, 'edit');
  }
  writeFileSync(join(DATA_DIR, 'portfolio.json'), JSON.stringify(data, null, 2));
}

function parseAdvancedIntent(text, intent) {
  const lower = text.toLowerCase();
  const data = intent.data || {};
  const target = intent.target || '';
  
  if (lower.includes('color') || lower.includes('tema') || lower.includes('theme')) {
    return { action: 'update_theme', type: 'colors' };
  }
  
  if (lower.includes('fuente') || lower.includes('font') || lower.includes('letra')) {
    return { action: 'update_theme', type: 'fonts' };
  }
  
  if (lower.includes('imagen') || lower.includes('avatar') || lower.includes('foto')) {
    return { action: 'update_avatar', target: target };
  }
  
  if (lower.includes('sección') || lower.includes('section') || lower.includes('agregar')) {
    return { action: 'add_section', target: target, data };
  }
  
  if (lower.includes('diseño') || lower.includes('layout') || lower.includes('estructura')) {
    return { action: 'update_layout', data };
  }
  
  if (lower.includes('animacion') || lower.includes('animación')) {
    return { action: 'toggle_animations', value: lower.includes('activar') || lower.includes('activar') };
  }
  
  if (lower.includes('dark') || lower.includes('oscuro') || lower.includes('claro')) {
    return { action: 'toggle_darkmode', value: !lower.includes('claro') };
  }
  
  if (lower.includes('project') || lower.includes('proyecto')) {
    return { action: 'update_project', target, data };
  }
  
  return { action: 'unknown' };
}

export class EnhancedPortfolioAgent {
  constructor() {
    this.actions = {
      update_profile: this.updateProfile.bind(this),
      update_theme: this.updateTheme.bind(this),
      update_avatar: this.updateAvatar.bind(this),
      update_layout: this.updateLayout.bind(this),
      add_section: this.addSection.bind(this),
      toggle_animations: this.toggleAnimations.bind(this),
      toggle_darkmode: this.toggleDarkMode.bind(this),
      update_project: this.updateProject.bind(this),
      add_project: this.addProject.bind(this),
      delete_project: this.deleteProject.bind(this)
    };
  }

  async updateProfile(data) {
    const portfolio = loadPortfolio();
    portfolio.profile = { ...portfolio.profile, ...data };
    savePortfolio(portfolio);
    return { success: true, message: 'Perfil actualizado', data: portfolio.profile };
  }

  async updateTheme(type, values) {
    const portfolio = loadPortfolio();
    
    if (!portfolio.theme) {
      portfolio.theme = { colors: {}, fonts: {}, layout: {} };
    }
    
    if (type === 'colors') {
      portfolio.theme.colors = { ...portfolio.theme.colors, ...values };
    } else if (type === 'fonts') {
      portfolio.theme.fonts = { ...portfolio.theme.fonts, ...values };
    } else if (type === 'layout') {
      portfolio.theme.layout = { ...portfolio.theme.layout, ...values };
    }
    
    savePortfolio(portfolio);
    return { success: true, message: `Tema ${type} actualizado`, theme: portfolio.theme };
  }

  async updateAvatar(imageUrl) {
    const portfolio = loadPortfolio();
    portfolio.profile.avatar = imageUrl;
    savePortfolio(portfolio);
    return { success: true, message: 'Avatar actualizado', avatar: imageUrl };
  }

  async updateLayout(layout) {
    const portfolio = loadPortfolio();
    portfolio.theme = portfolio.theme || {};
    portfolio.theme.layout = { ...portfolio.theme.layout, ...layout };
    savePortfolio(portfolio);
    return { success: true, message: 'Layout actualizado' };
  }

  async addSection(section) {
    const portfolio = loadPortfolio();
    portfolio.customSections = portfolio.customSections || [];
    portfolio.customSections.push({
      id: `section-${Date.now()}`,
      ...section,
      createdAt: new Date().toISOString()
    });
    savePortfolio(portfolio);
    return { success: true, message: `Sección "${section.title}" agregada` };
  }

  async toggleAnimations(enable) {
    const portfolio = loadPortfolio();
    portfolio.settings = portfolio.settings || {};
    portfolio.settings.animations = enable;
    savePortfolio(portfolio);
    return { success: true, message: `Animaciones ${enable ? 'activadas' : 'desactivadas'}` };
  }

  async toggleDarkMode(enable) {
    const portfolio = loadPortfolio();
    portfolio.settings = portfolio.settings || {};
    portfolio.settings.darkMode = enable;
    savePortfolio(portfolio);
    return { success: true, message: `Modo oscuro ${enable ? 'activado' : 'desactivado'}` };
  }

  async updateProject(projectId, data) {
    const portfolio = loadPortfolio();
    const index = portfolio.projects.findIndex(p => p.id === projectId);
    
    if (index === -1) {
      return { success: false, error: 'Proyecto no encontrado' };
    }
    
    portfolio.projects[index] = { ...portfolio.projects[index], ...data, updatedAt: new Date().toISOString() };
    savePortfolio(portfolio);
    return { success: true, message: 'Proyecto actualizado', project: portfolio.projects[index] };
  }

  async addProject(projectData) {
    const portfolio = loadPortfolio();
    const project = {
      id: `project-${Date.now()}`,
      name: projectData.name || 'Nuevo Proyecto',
      description: projectData.description || '',
      url: projectData.url || '',
      githubUrl: projectData.githubUrl || projectData.url || '',
      tags: projectData.tags || [],
      imageUrl: projectData.imageUrl || '',
      order: portfolio.projects.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    portfolio.projects.push(project);
    savePortfolio(portfolio);
    return { success: true, message: `Proyecto "${project.name}" agregado`, project };
  }

  async deleteProject(projectName) {
    const portfolio = loadPortfolio();
    const index = portfolio.projects.findIndex(p => 
      p.name.toLowerCase().includes(projectName.toLowerCase())
    );
    
    if (index === -1) {
      return { success: false, error: 'Proyecto no encontrado' };
    }
    
    const deleted = portfolio.projects.splice(index, 1)[0];
    portfolio.projects.forEach((p, i) => p.order = i);
    savePortfolio(portfolio);
    return { success: true, message: `Proyecto "${deleted.name}" eliminado` };
  }

  async execute(text, parsedIntent) {
    const action = parseAdvancedIntent(text, parsedIntent);
    
    if (action.action === 'unknown') {
      return { success: false, message: 'Acción no reconocida' };
    }
    
    const handler = this.actions[action.action];
    
    if (!handler) {
      return { success: false, message: 'Handler no encontrado' };
    }
    
    try {
      return await handler(action.data || {}, action.target);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPortfolio() {
    return loadPortfolio();
  }

  async getFullStatus() {
    const portfolio = loadPortfolio();
    const versions = await import('./version.js');
    const versionList = versions.getVersions();
    const doctor = await import('./doctor.js');
    const status = await doctor.doctorAgent.getStatus();
    
    return {
      portfolio,
      versions: versionList.length,
      lastBackup: versionList[0]?.timestamp,
      healthy: status.healthy,
      issues: status.issues
    };
  }
}

export const enhancedPortfolioAgent = new EnhancedPortfolioAgent();
export default EnhancedPortfolioAgent;