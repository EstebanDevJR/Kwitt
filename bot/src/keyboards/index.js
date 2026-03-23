import { TEMPLATES } from '../config.js';

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 Estado', callback_data: 'status' }, { text: '✏️ Editar', callback_data: 'edit_profile' }, { text: '➕ Proyecto', callback_data: 'add_project' }],
      [{ text: '🎨 Temas', callback_data: 'themes' }, { text: '🔄 Dark', callback_data: 'toggle_darkmode' }, { text: '✨ Anim', callback_data: 'toggle_animations' }],
      [{ text: '💾 Versiones', callback_data: 'list_versions' }, { text: '📈 Stats', callback_data: 'analytics' }, { text: '🔧 Doctor', callback_data: 'doctor' }],
      [{ text: '❓ Ayuda', callback_data: 'help' }, { text: '📤 Export', callback_data: 'export_menu' }],
    ]
  };
}

export function themesKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🖤 Minimal', callback_data: 'template_minimal' }, { text: '💻 Dev', callback_data: 'template_developer' }],
      [{ text: '🎨 Creative', callback_data: 'template_creative' }, { text: '🌙 Dark', callback_data: 'template_dark' }],
      [{ text: '☀️ Light', callback_data: 'template_light' }, { text: '🔙 Atras', callback_data: 'back_main' }],
    ]
  };
}

export function exportKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📄 JSON', callback_data: 'export_json' }, { text: '📝 MD', callback_data: 'export_md' }, { text: '🌐 HTML', callback_data: 'export_html' }],
      [{ text: '🔙 Atras', callback_data: 'back_main' }],
    ]
  };
}

export function projectsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔙 Atras', callback_data: 'back_main' }],
    ]
  };
}
