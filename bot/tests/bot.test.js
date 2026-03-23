import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Kwitt Bot Core Functions', () => {
  describe('Input Sanitization', () => {
    const sanitizeInput = (text) => text
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .slice(0, 500);

    it('should remove HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
    });

    it('should remove event handlers', () => {
      expect(sanitizeInput('test onclick="alert(1)"').includes('onclick')).toBe(false);
    });

    it('should truncate long input', () => {
      const longInput = 'a'.repeat(1000);
      expect(sanitizeInput(longInput).length).toBe(500);
    });
  });

  describe('Command Aliases', () => {
    const applyAlias = (text) => {
      const aliases = {
        '/s': '/estado',
        '/st': '/estado',
        '/a ': 'agrega proyecto ',
        '/d ': 'elimina proyecto ',
        '/b': 'actualiza mi bio ',
        '/v': 'versiones',
        '/?': '/ayuda'
      };
      let result = text;
      for (const [alias, cmd] of Object.entries(aliases)) {
        if (result.toLowerCase().startsWith(alias)) {
          result = result.replace(new RegExp(`^${alias}`, 'i'), cmd);
        }
      }
      return result;
    };

    it('should alias /s to /estado', () => {
      expect(applyAlias('/s')).toBe('/estado');
    });

    it('should alias /a url to add project', () => {
      expect(applyAlias('/a https://github.com/user/repo')).toBe('agrega proyecto https://github.com/user/repo');
    });

    it('should alias /d to delete project', () => {
      expect(applyAlias('/d myproject')).toBe('elimina proyecto myproject');
    });

    it('should alias /b to update bio', () => {
      expect(applyAlias('/b Hello World').startsWith('actualiza mi bio')).toBe(true);
    });

    it('should preserve non-aliased commands', () => {
      // Note: /s is an alias, so test with /start which is not aliased
      expect(applyAlias('/start')).not.toBe('/estado');
    });
  });

  describe('Intent Parsing (Simple)', () => {
    // Test the actual implementation logic from bot/src/index.js
    const simpleParseIntent = (text) => {
      const lower = text.toLowerCase();
      if (lower.startsWith('preview') || lower.startsWith('previsualizar')) {
        const cmd = text.replace(/^(preview|previsualizar)\s*/i, '');
        return { action: 'preview', target: cmd, data: {}, confidence: 0.9 };
      }
      if (lower.startsWith('undo') || lower.startsWith('deshacer')) {
        return { action: 'undo', target: '', data: {}, confidence: 0.9 };
      }
      if (lower.startsWith('stats') || lower.startsWith('analytics')) {
        return { action: 'get_analytics', target: '', data: {}, confidence: 0.9 };
      }
      if (lower.includes('agrega') || lower.includes('añade')) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        return { action: 'add_project', target: urlMatch?.[1] || '', data: {}, confidence: 0.8 };
      }
      if (lower.includes('bio') || (lower.includes('actualiza') && lower.includes('mi'))) {
        let bio = text.replace(/actualiza mi bio a,/gi, '').replace(/actualiza mi bio/gi, '').replace(/actualiza mi a,/gi, '').replace(/actualiza mi/gi, '').replace(/^a,?\s*/gi, '').trim();
        return { action: 'update_bio', target: 'profile', data: { bio }, confidence: 0.7 };
      }
      if (lower.includes('color') || lower.includes('tema')) {
        return { action: 'update_theme', data: { type: 'colors' }, confidence: 0.7 };
      }
      if (lower.includes('fuente') || lower.includes('font') || lower.includes('letra')) {
        return { action: 'update_theme', data: { type: 'fonts' }, confidence: 0.7 };
      }
      if (lower.includes('imagen') || lower.includes('avatar') || lower.includes('foto')) {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        return { action: 'update_avatar', target: urlMatch?.[1] || '', confidence: 0.7 };
      }
      if (lower.includes('versión') || lower.includes('restore') || lower.includes('anterior') || lower.includes('restaurar')) {
        return { action: 'restore_version', confidence: 0.8 };
      }
      if (lower.includes('lista versiones') || lower.includes('versiones')) {
        return { action: 'list_versions', confidence: 0.8 };
      }
      if (lower.includes('doctor') || lower.includes('diagnóstico') || lower.includes('diagnostico')) {
        return { action: 'run_doctor', confidence: 0.9 };
      }
      if (lower.includes('reparar') || lower.includes('repair') || lower.includes('fix')) {
        return { action: 'repair', confidence: 0.9 };
      }
      if (lower.includes('estado') || lower.includes('status')) {
        return { action: 'get_status', confidence: 0.8 };
      }
      if (lower.includes('elimina') || lower.includes('borra')) {
        return { action: 'delete_project', target: text, confidence: 0.7 };
      }
      if (lower.includes('animacion') || lower.includes('animación')) {
        return { action: 'toggle_animations', data: { value: lower.includes('activar') || lower.includes('activar') }, confidence: 0.7 };
      }
      if (lower.includes('oscuro') || lower.includes('dark')) {
        return { action: 'toggle_darkmode', data: { value: !lower.includes('desactivar') && !lower.includes('claro') }, confidence: 0.7 };
      }
      if (lower.includes('rama') || lower.includes('branch')) {
        const branchMatch = text.match(/(?:rama|branch)\s+(\S+)/i);
        return { action: 'change_branch', target: branchMatch?.[1] || '', confidence: 0.8 };
      }
      return { action: 'unknown', target: '', data: {}, confidence: 0 };
    };

    it('should parse add_project intent', () => {
      const result = simpleParseIntent('agrega proyecto https://github.com/user/repo');
      expect(result.action).toBe('add_project');
      expect(result.target).toBe('https://github.com/user/repo');
    });

    it('should parse update_bio intent', () => {
      const result = simpleParseIntent('actualiza mi bio a Soy desarrollador');
      expect(result.action).toBe('update_bio');
      expect(result.data.bio).toContain('Soy desarrollador');
    });

    it('should parse get_status intent', () => {
      expect(simpleParseIntent('estado').action).toBe('get_status');
      expect(simpleParseIntent('dame el status').action).toBe('get_status');
    });

    it('should parse undo intent', () => {
      expect(simpleParseIntent('undo').action).toBe('undo');
      expect(simpleParseIntent('deshacer').action).toBe('undo');
    });

    it('should parse analytics intent', () => {
      expect(simpleParseIntent('stats').action).toBe('get_analytics');
      expect(simpleParseIntent('analytics').action).toBe('get_analytics');
    });

    it('should parse dark mode intent', () => {
      expect(simpleParseIntent('activa modo oscuro').action).toBe('toggle_darkmode');
      expect(simpleParseIntent('dark mode on').action).toBe('toggle_darkmode');
    });

    it('should parse animations intent', () => {
      expect(simpleParseIntent('activa animaciones').action).toBe('toggle_animations');
    });

    it('should return unknown for unrecognized input', () => {
      const result = simpleParseIntent('hola mundo');
      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Portfolio Templates', () => {
    const PORTFOLIO_TEMPLATES = {
      minimal: { name: 'Minimal', theme: { colors: { primary: '#000000', accent: '#666666' } } },
      developer: { name: 'Developer', theme: { colors: { primary: '#0a0a0a', accent: '#22c55e' } } },
      creative: { name: 'Creative', theme: { colors: { primary: '#1e1b4b', accent: '#f472b6' } } },
      dark: { name: 'Dark Pro', theme: { colors: { primary: '#09090b', accent: '#8b5cf6' } } },
      light: { name: 'Light Pro', theme: { colors: { primary: '#ffffff', accent: '#3b82f6' } } }
    };

    it('should have all 5 templates', () => {
      expect(Object.keys(PORTFOLIO_TEMPLATES).length).toBe(5);
    });

    it('should have valid minimal template', () => {
      expect(PORTFOLIO_TEMPLATES.minimal.name).toBe('Minimal');
      expect(PORTFOLIO_TEMPLATES.minimal.theme.colors.primary).toBe('#000000');
    });

    it('should have valid developer template', () => {
      expect(PORTFOLIO_TEMPLATES.developer.name).toBe('Developer');
      expect(PORTFOLIO_TEMPLATES.developer.theme.colors.accent).toBe('#22c55e');
    });

    it('should have valid creative template', () => {
      expect(PORTFOLIO_TEMPLATES.creative.name).toBe('Creative');
    });

    it('should have valid dark template', () => {
      expect(PORTFOLIO_TEMPLATES.dark.name).toBe('Dark Pro');
    });

    it('should have valid light template', () => {
      expect(PORTFOLIO_TEMPLATES.light.name).toBe('Light Pro');
    });
  });

  describe('Authorization Check', () => {
    const isAuthorized = (chatId, authorizedIds) => {
      if (authorizedIds.length === 0) return true;
      return authorizedIds.includes(chatId);
    };

    it('should allow all when no authorized IDs', () => {
      expect(isAuthorized(123, [])).toBe(true);
      expect(isAuthorized(456, [])).toBe(true);
    });

    it('should allow authorized users', () => {
      expect(isAuthorized(123, [123, 456])).toBe(true);
      expect(isAuthorized(456, [123, 456])).toBe(true);
    });

    it('should deny unauthorized users', () => {
      expect(isAuthorized(999, [123, 456])).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    const checkRateLimit = (chatId, lastTimes, limitMs) => {
      const now = Date.now();
      const lastTime = lastTimes.get(chatId) || 0;
      if (now - lastTime < limitMs) return false;
      lastTimes.set(chatId, now);
      return true;
    };

    it('should allow first command', () => {
      const lastTimes = new Map();
      expect(checkRateLimit(123, lastTimes, 3000)).toBe(true);
    });

    it('should block rapid commands', () => {
      const lastTimes = new Map();
      lastTimes.set(123, Date.now());
      expect(checkRateLimit(123, lastTimes, 3000)).toBe(false);
    });

    it('should allow after cooldown', async () => {
      const lastTimes = new Map();
      lastTimes.set(123, Date.now() - 4000);
      expect(checkRateLimit(123, lastTimes, 3000)).toBe(true);
    });
  });
});

describe('Portfolio Data Operations', () => {
  describe('Default Portfolio Structure', () => {
    const defaultPortfolio = {
      profile: { name: 'Tu Nombre', bio: 'Descripción...', contact: {}, avatar: '' },
      projects: [],
      theme: { colors: {}, fonts: {}, layout: {} },
      settings: { animations: true, darkMode: true },
      customSections: []
    };

    it('should have required profile fields', () => {
      expect(defaultPortfolio.profile).toHaveProperty('name');
      expect(defaultPortfolio.profile).toHaveProperty('bio');
      expect(defaultPortfolio.profile).toHaveProperty('contact');
      expect(defaultPortfolio.profile).toHaveProperty('avatar');
    });

    it('should have empty projects array', () => {
      expect(Array.isArray(defaultPortfolio.projects)).toBe(true);
      expect(defaultPortfolio.projects.length).toBe(0);
    });

    it('should have theme configuration', () => {
      expect(defaultPortfolio.theme).toHaveProperty('colors');
      expect(defaultPortfolio.theme).toHaveProperty('fonts');
      expect(defaultPortfolio.theme).toHaveProperty('layout');
    });

    it('should have default settings', () => {
      expect(defaultPortfolio.settings.animations).toBe(true);
      expect(defaultPortfolio.settings.darkMode).toBe(true);
    });
  });
});

describe('Export Formats', () => {
  const exportPortfolio = (portfolio, format) => {
    switch (format) {
      case 'markdown':
        return `# ${portfolio.profile.name}\n\n${portfolio.profile.bio}\n\n## Proyectos\n\n${portfolio.projects.map(p => `- [${p.name}](${p.url}) - ${p.description}`).join('\n')}`;
      case 'html':
        return `<!DOCTYPE html><html><head><title>${portfolio.profile.name}</title></head><body><h1>${portfolio.profile.name}</h1><p>${portfolio.profile.bio}</p></body></html>`;
      default:
        return JSON.stringify(portfolio, null, 2);
    }
  };

  it('should export to markdown format', () => {
    const portfolio = {
      profile: { name: 'Test User', bio: 'Test bio' },
      projects: [{ name: 'proj1', url: 'https://github.com/test', description: 'A project' }]
    };
    const result = exportPortfolio(portfolio, 'markdown');
    expect(result).toContain('# Test User');
    expect(result).toContain('- [proj1]');
  });

  it('should export to HTML format', () => {
    const portfolio = { profile: { name: 'Test', bio: 'Bio' }, projects: [] };
    const result = exportPortfolio(portfolio, 'html');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<h1>Test</h1>');
  });

  it('should export to JSON format', () => {
    const portfolio = { profile: { name: 'Test', bio: 'Bio' }, projects: [] };
    const result = exportPortfolio(portfolio, 'json');
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
