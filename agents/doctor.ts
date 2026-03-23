import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPortfolio, getVersions, restoreVersion, getLatestVersion, DATA_DIR, VERSIONS_DIR, PORTFOLIO_FILE } from './version.js';

const TEMPLATES_DIR = join(DATA_DIR, 'templates');

const DEFAULT_PORTFOLIO = {
  profile: {
    name: 'Tu Nombre',
    bio: 'Una breve descripción sobre ti...',
    contact: { email: 'tu@email.com', github: 'tugithub', twitter: 'tutwitter' }
  },
  projects: []
};

const DEFAULT_THEME = {
  colors: {
    primary: '#0a0a0a',
    accent: '#6366f1',
    surface: '#1a1a1a'
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter'
  },
  layout: {
    hero: true,
    projects: true,
    contact: true
  }
};

export class DoctorAgent {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  async diagnose() {
    this.issues = [];
    this.fixes = [];
    
    try {
      const portfolio = loadPortfolio();
      
      if (!portfolio.profile || !portfolio.profile.name) {
        this.issues.push({ type: 'data', severity: 'high', message: 'Perfil incompleto' });
      }
      
      if (!portfolio.profile?.bio) {
        this.issues.push({ type: 'data', severity: 'medium', message: 'Bio vacía' });
      }
      
      if (portfolio.projects?.some(p => !p.name || !p.description)) {
        this.issues.push({ type: 'data', severity: 'medium', message: 'Proyectos con datos incompletos' });
      }
      
      const versions = getVersions();
      if (versions.length === 0) {
        this.issues.push({ type: 'backup', severity: 'high', message: 'Sin versiones de respaldo' });
        this.fixes.push({ action: 'create_backup', description: 'Crear respaldo inicial' });
      }
      
      if (versions.length < 3) {
        this.issues.push({ type: 'backup', severity: 'low', message: 'Pocas versiones de respaldo' });
      }
      
    } catch (error) {
      this.issues.push({ type: 'system', severity: 'critical', message: error.message });
    }
    
    return {
      healthy: this.issues.filter(i => i.severity === 'critical').length === 0,
      issues: this.issues,
      fixes: this.fixes
    };
  }

  async repair(issueType = 'all') {
    const results = [];
    
    try {
      if (issueType === 'all' || issueType === 'backup') {
        const versions = getVersions();
        if (versions.length === 0) {
          const portfolio = loadPortfolio();
          const { savePortfolio, createVersion } = await import('./version.js');
          createVersion(portfolio, 'system');
          results.push({ action: 'create_backup', status: 'success' });
        }
      }
      
      if (issueType === 'all' || issueType === 'data') {
        const portfolio = loadPortfolio();
        
        if (!portfolio.profile) {
          portfolio.profile = DEFAULT_PORTFOLIO.profile;
        }
        
        if (!portfolio.profile.contact) {
          portfolio.profile.contact = DEFAULT_PORTFOLIO.profile.contact;
        }
        
        if (!portfolio.projects) {
          portfolio.projects = [];
        }
        
        const { savePortfolio } = await import('./version.js');
        savePortfolio(portfolio, false);
        results.push({ action: 'repair_data', status: 'success' });
      }
      
      if (issueType === 'all' || issueType === 'reset') {
        const { savePortfolio } = await import('./version.js');
        savePortfolio(DEFAULT_PORTFOLIO, false);
        results.push({ action: 'reset_portfolio', status: 'success', message: 'Portfolio reseteado a defaults' });
      }
      
    } catch (error) {
      results.push({ action: 'repair', status: 'error', message: error.message });
    }
    
    return results;
  }

  async getStatus() {
    const diagnosis = await this.diagnose();
    const versions = getVersions();
    const latest = getLatestVersion();
    
    return {
      healthy: diagnosis.healthy,
      issues: diagnosis.issues,
      versionsCount: versions.length,
      lastBackup: latest?.timestamp || null,
      dataDir: DATA_DIR,
      portfolioPath: PORTFOLIO_FILE
    };
  }

  async restoreBackup(timestamp = 'latest') {
    try {
      if (timestamp === 'latest') {
        const latest = getLatestVersion();
        if (!latest) {
          throw new Error('No hay versiones disponibles');
        }
        timestamp = latest.timestamp;
      }
      
      const restored = restoreVersion(timestamp);
      return { status: 'success', message: `Restaurado a versión ${timestamp}`, data: restored };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async listBackups() {
    const versions = getVersions();
    return versions.map(v => ({
      timestamp: v.timestamp,
      type: v.type,
      date: new Date(v.timestamp).toLocaleString()
    }));
  }

  async createManualBackup(type = 'manual') {
    const portfolio = loadPortfolio();
    const { createVersion } = await import('./version.js');
    createVersion({ ...portfolio, _backupType: type }, type);
    return { status: 'success', message: `Backup ${type} creado` };
  }
}

export const doctorAgent = new DoctorAgent();
export default DoctorAgent;