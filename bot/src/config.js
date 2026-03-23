import { existsSync } from 'fs';

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    baseUrl: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
  },
  auth: {
    chatIds: (process.env.TELEGRAM_CHAT_ID || process.env.AUTHORIZED_CHAT_IDS || '')
      .split(',')
      .filter(Boolean)
      .map(s => parseInt(s.trim())),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  github: {
    token: process.env.GITHUB_TOKEN,
  },
  runtime: {
    localMode: process.env.LOCAL_MODE === 'true',
    webhookUrl: process.env.WEBHOOK_URL,
    gitBranch: process.env.GIT_BRANCH || 'main',
    cliTimeout: parseInt(process.env.CLI_TIMEOUT || '120000'),
    rateLimitMs: parseInt(process.env.RATE_LIMIT_MS || '3000'),
    backupInterval: parseInt(process.env.SCHEDULED_BACKUP_INTERVAL || '3600000'),
  },
  paths: {
    isDocker: existsSync('/app/.dockerenv') || process.env.DOCKER === 'true',
    dataDir: (existsSync('/app/.dockerenv') || process.env.DOCKER === 'true') ? '/app/data' : './data',
  },
};

export const TEMPLATES = {
  minimal: { name: 'Minimal', colors: { primary: '#000000', accent: '#666666', surface: '#ffffff' }, fonts: { heading: 'Inter', body: 'Inter' } },
  developer: { name: 'Developer', colors: { primary: '#0a0a0a', accent: '#22c55e', surface: '#171717' }, fonts: { heading: 'Fira Code', body: 'Inter' } },
  creative: { name: 'Creative', colors: { primary: '#1e1b4b', accent: '#f472b6', surface: '#fafafa' }, fonts: { heading: 'Poppins', body: 'Poppins' } },
  dark: { name: 'Dark Pro', colors: { primary: '#09090b', accent: '#8b5cf6', surface: '#18181b' }, fonts: { heading: 'Inter', body: 'Inter' } },
  light: { name: 'Light Pro', colors: { primary: '#ffffff', accent: '#3b82f6', surface: '#f8fafc' }, fonts: { heading: 'Inter', body: 'Inter' } },
};

export const ALIASES = {
  '/s': '/estado', '/st': '/estado',
  '/a ': 'agrega proyecto ', '/d ': 'elimina proyecto ',
  '/b': 'actualiza mi bio ', '/t': 'tema ', '/v': 'versiones',
};

export const DEFAULT_PORTFOLIO = {
  profile: { name: 'Tu Nombre', bio: 'Descripción...', contact: {}, avatar: '' },
  projects: [],
  theme: { colors: {}, fonts: {}, layout: {} },
  settings: { animations: true, darkMode: true },
  customSections: [],
};

export const FREE_MODELS = {
  'big-pickle': { name: 'Big Pickle', provider: 'Groq', icon: '🎯' },
  'mimo-v2-omni-free': { name: 'MiMo V2 Omni Free', provider: 'Moonshot', icon: '🤖' },
  'mimo-v2-pro-free': { name: 'MiMo V2 Pro Free', provider: 'Moonshot', icon: '🚀' },
  'minimax-m2.5-free': { name: 'MiniMax M2.5 Free', provider: 'Minimax', icon: '🧠' },
  'nemotron-3-super-free': { name: 'Nemotron 3 Super Free', provider: 'NVIDIA', icon: '⚡' },
};

export const DEFAULT_MODEL = process.env.OPENCODE_MODEL || 'minimax-m2.5-free';
