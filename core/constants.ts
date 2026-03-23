export const APP_NAME = 'Kwitt';
export const APP_VERSION = '1.0.0';

export const TELEGRAM_COMMANDS = {
  ADD_PROJECT: 'agrega proyecto',
  UPDATE_BIO: 'actualiza mi bio',
  UPDATE_CONTACT: 'cambia mi contacto',
  DELETE_PROJECT: 'elimina proyecto',
  REORDER_PROJECTS: 'reordena proyectos',
  ENHANCE: 'hazlo más moderno',
  STATUS: 'estado',
  HELP: 'ayuda'
} as const;

export const ACTIONS = {
  ADD_PROJECT: 'add_project',
  UPDATE_BIO: 'update_bio',
  UPDATE_CONTACT: 'update_contact',
  DELETE_PROJECT: 'delete_project',
  REORDER_PROJECTS: 'reorder_projects',
  ENHANCE_FRONTEND: 'enhance_frontend',
  GET_STATUS: 'get_status',
  UNKNOWN: 'unknown'
} as const;

export const DEFAULT_PORTFOLIO = {
  profile: {
    name: 'Your Name',
    bio: 'A passionate developer building amazing things.',
    contact: {
      email: 'your@email.com',
      github: 'yourgithub',
      twitter: 'yourtwitter'
    }
  },
  projects: []
};

export const ERROR_MESSAGES = {
  INVALID_INTENT: 'No pude entender tu mensaje. Intenta con palabras más claras.',
  PROJECT_NOT_FOUND: 'No encontré ese proyecto en tu portfolio.',
  GIT_ERROR: 'Hubo un problema con Git. Revisa la configuración.',
  DATABASE_ERROR: 'Hubo un problema con la base de datos.',
  LLM_ERROR: 'Hubo un problema con el servicio de IA.'
} as const;

export const SUCCESS_MESSAGES = {
  PROJECT_ADDED: '✅ Proyecto agregado correctamente.',
  BIO_UPDATED: '✅ Bio actualizada correctamente.',
  CONTACT_UPDATED: '✅ Contacto actualizado correctamente.',
  PROJECT_DELETED: '✅ Proyecto eliminado correctamente.',
  PROJECTS_REORDERED: '✅ Proyectos reordenados correctamente.',
  FRONTEND_ENHANCED: '✨ Portfolio mejorado con nuevas animaciones.',
  GIT_COMMITED: '📦 Cambios guardados en Git.',
  GIT_PUSHED: '🚀 Cambios subidos a GitHub.'
} as const;