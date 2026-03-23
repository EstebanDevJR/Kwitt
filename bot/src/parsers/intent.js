import { config, ALIASES, TEMPLATES } from '../config.js';

function sanitize(text) {
  return text.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '').slice(0, 500);
}

function applyAliases(text) {
  let result = text;
  for (const [alias, cmd] of Object.entries(ALIASES)) {
    if (result.toLowerCase().startsWith(alias)) {
      result = result.replace(new RegExp(`^${alias}`, 'i'), cmd);
    }
  }
  return result;
}

function simpleParse(text) {
  const lower = text.toLowerCase();
  
  if (lower.startsWith('preview')) return { action: 'preview', target: text.replace(/^preview\s*/i, ''), confidence: 0.9 };
  if (lower.startsWith('undo') || lower.startsWith('deshacer')) return { action: 'undo', confidence: 0.9 };
  if (lower.startsWith('stats') || lower.startsWith('analytics')) return { action: 'analytics', confidence: 0.9 };
  if (lower.startsWith('export')) { const f = lower.includes('markdown') ? 'markdown' : lower.includes('html') ? 'html' : 'json'; return { action: 'export', data: { format: f }, confidence: 0.9 }; }
  if (lower.startsWith('import')) return { action: 'import', target: text.replace(/^import\s*/i, ''), confidence: 0.7 };
  
  // Natural profile editing
  if (lower.startsWith('me llamo ') || lower.startsWith('mi nombre es ')) return { action: 'update_name', target: text.replace(/^(me llamo|mi nombre es)\s*/i, ''), confidence: 0.9 };
  if (lower.startsWith('mi bio es ')) return { action: 'update_bio', data: { bio: text.replace(/^mi bio es\s*/i, '') }, confidence: 0.9 };
  if (lower.startsWith('mi foto ') || lower.startsWith('mi avatar ')) { const url = text.match(/(https?:\/\/[^\s]+)/); return { action: 'update_avatar', target: url?.[1] || '', confidence: 0.9 }; }
  if (lower.startsWith('mi email ')) return { action: 'update_contact', data: { tipo: 'email', valor: text.replace(/^mi email\s*/i, '') }, confidence: 0.9 };
  if (lower.startsWith('mi github ')) return { action: 'update_contact', data: { tipo: 'github', valor: text.replace(/^mi github\s*/i, '') }, confidence: 0.9 };
  if (lower.startsWith('mi twitter ') || lower.startsWith('mi x ')) return { action: 'update_contact', data: { tipo: 'twitter', valor: text.replace(/^(mi twitter|mi x)\s*/i, '') }, confidence: 0.9 };
  if (lower.startsWith('mi linkedin ')) return { action: 'update_contact', data: { tipo: 'linkedin', valor: text.replace(/^mi linkedin\s*/i, '') }, confidence: 0.9 };
  
  // Projects
  if (lower.includes('agrega') || lower.includes('añade')) { const url = text.match(/(https?:\/\/[^\s]+)/); return { action: 'add_project', target: url?.[1] || '', confidence: 0.8 }; }
  if (lower.includes('elimina') || lower.includes('borra')) return { action: 'delete_project', target: text, confidence: 0.7 };
  
  // Bio fallback
  if (lower.includes('bio') || (lower.includes('actualiza') && lower.includes('mi'))) {
    const bio = text.replace(/actualiza mi bio a,?\s*/gi, '').replace(/actualiza mi bio/gi, '').replace(/^a,?\s*/gi, '').trim();
    return { action: 'update_bio', data: { bio }, confidence: 0.7 };
  }
  
  // Themes
  if (lower.includes('tema')) {
    const template = Object.keys(TEMPLATES).find(t => lower.includes(t));
    return { action: 'apply_template', data: { template: template || 'minimal' }, confidence: 0.8 };
  }
  
  // Settings
  if (lower.includes('color')) return { action: 'update_theme', data: { type: 'colors' }, confidence: 0.7 };
  if (lower.includes('imagen') || lower.includes('avatar')) { const url = text.match(/(https?:\/\/[^\s]+)/); return { action: 'update_avatar', target: url?.[1] || '', confidence: 0.7 }; }
  if (lower.includes('animacion')) return { action: 'toggle_animations', data: { value: lower.includes('activar') || !lower.includes('desactivar') }, confidence: 0.7 };
  if (lower.includes('oscuro') || lower.includes('dark')) return { action: 'toggle_darkmode', data: { value: !lower.includes('desactivar') && !lower.includes('claro') }, confidence: 0.7 };
  
  // System
  if (lower.includes('versión') || lower.includes('restaurar')) return { action: 'restore_version', confidence: 0.8 };
  if (lower.includes('lista versiones') || lower.includes('versiones')) return { action: 'list_versions', confidence: 0.8 };
  if (lower.includes('doctor')) return { action: 'doctor', confidence: 0.9 };
  if (lower.includes('reparar')) return { action: 'repair', confidence: 0.9 };
  if (lower.includes('estado') || lower.includes('status')) return { action: 'status', confidence: 0.8 };
  
  return { action: 'unknown', confidence: 0 };
}

async function parseWithAI(text) {
  const { apiKey } = config.openai;
  if (!apiKey) return simpleParse(text);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: 'Parse user intent. Actions: status, analytics, add_project, update_bio, update_name, update_avatar, update_contact, delete_project, apply_template, toggle_animations, toggle_darkmode, restore_version, list_versions, doctor, repair, export, import, undo. Reply JSON only.' }, { role: 'user', content: text }],
        temperature: 0.3, max_tokens: 100
      })
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) return JSON.parse(content);
  } catch (e) { console.error('OpenAI error:', e); }
  return simpleParse(text);
}

export const intent = {
  sanitize,
  applyAliases,
  parse(text) {
    return { ...simpleParse(text), raw: sanitize(applyAliases(text)) };
  },
};
