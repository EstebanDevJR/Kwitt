import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { config, DEFAULT_MODEL } from '../config.js';
import { portfolio, analytics } from '../data/portfolio.js';

const { runtime } = config;
const RETRIES = 2;
const selectedModel = new Map();

export function getModel(chatId) {
  return selectedModel.get(chatId) || DEFAULT_MODEL;
}

export function setModel(chatId, model) {
  selectedModel.set(chatId, model);
}

function mapIntentToInstruction(intent) {
  const { action, target, data } = intent;
  const mappings = {
    add_project: `Add a new project from GitHub ${target}. Extract name, description, tech stack. Update portfolio.`,
    update_bio: `Update portfolio bio to: "${data?.bio || target}".`,
    update_name: `Update portfolio profile name to: "${target}".`,
    update_theme: `Update theme: ${data?.colors ? `colors: ${JSON.stringify(data.colors)}` : ''} ${data?.fonts ? `fonts: ${JSON.stringify(data.fonts)}` : ''}.`,
    update_avatar: `Update profile avatar to: ${target}.`,
    update_contact: `Update contact ${data?.tipo || 'info'} to: ${data?.valor || target}.`,
    toggle_animations: `${data?.value ? 'Enable' : 'Disable'} animations.`,
    toggle_darkmode: `${data?.value ? 'Enable' : 'Disable'} dark mode.`,
    delete_project: `Delete project "${target}" from portfolio.`,
    restore_version: `Restore to latest backup.`,
    apply_template: `Apply template "${data?.template}" to portfolio.`
  };
  return mappings[action] || `Execute: ${action}`;
}

export const executor = {
  async runOpenCode(instruction, dryRun = false, chatId = null) {
    const modelKey = chatId ? getModel(chatId) : DEFAULT_MODEL;
    const model = `opencode/${modelKey}`;
    return new Promise((resolve) => {
      const modelFlag = `--model ${model}`;
      const cmd = dryRun 
        ? `opencode run --dry-run ${modelFlag} "${instruction.replace(/"/g, '\\"')}"`
        : `opencode run ${modelFlag} "${instruction.replace(/"/g, '\\"')}"`;
      console.log(`[CLI] Model: ${model} | ${cmd}`);
      const child = spawn(cmd, { shell: true, env: { ...process.env } });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });
      child.on('close', (code) => { resolve({ success: code === 0, stdout, stderr, model }); });
      child.on('error', (error) => { resolve({ success: false, stdout, stderr: error.message, model }); });
      setTimeout(() => { child.kill('SIGTERM'); resolve({ success: false, stdout, stderr: 'Timeout', model }); }, runtime.cliTimeout);
    });
  },

  async runWithRetry(instruction, dryRun = false) {
    let lastError = '';
    for (let i = 0; i <= RETRIES; i++) {
      try {
        const result = await this.runOpenCode(instruction, dryRun);
        if (result.success || i === RETRIES) return { ...result, retries: i };
        lastError = result.stderr;
      } catch (e) { lastError = e.message; }
      if (i < RETRIES) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
    return { success: false, stdout: '', stderr: lastError, retries: RETRIES };
  },

  commitToGit(message) {
    try {
      if (!existsSync('.git')) { console.log('[Git] Not a git repo'); return false; }
      execSync('git add data/portfolio.json', { encoding: 'utf-8' });
      execSync(`git commit -m "${message}"`, { encoding: 'utf-8' });
      execSync(runtime.gitBranch !== 'main' && runtime.gitBranch !== 'master' 
        ? `git push origin ${runtime.gitBranch}` 
        : 'git push', 
        { encoding: 'utf-8' });
      console.log(`[Git] Committed: ${message}`);
      return true;
    } catch (e) { console.error('[Git] Commit failed:', e); return false; }
  },

  async execute(chatId, intent, dryRun = false) {
    const instruction = mapIntentToInstruction(intent);
    const model = getModel(chatId);

    if (runtime.localMode) {
      const result = portfolio.executeAction(intent);
      return { success: true, result, model };
    }

    const result = await this.runWithRetry(instruction, dryRun, chatId);
    return result;
  },

  async runWithRetry(instruction, dryRun = false, chatId = null) {
    let lastError = '';
    for (let i = 0; i <= RETRIES; i++) {
      try {
        const result = await this.runOpenCode(instruction, dryRun, chatId);
        if (result.success || i === RETRIES) return { ...result, retries: i };
        lastError = result.stderr;
      } catch (e) { lastError = e.message; }
      if (i < RETRIES) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
    return { success: false, stdout: '', stderr: lastError, retries: RETRIES };
  },

  async executeAndTrack(chatId, intent, dryRun = false) {
    const result = await this.execute(chatId, intent, dryRun);
    if (!dryRun && result.success) {
      this.commitToGit(`kwitt: ${intent.action}`);
      analytics.track(intent.action, true, chatId);
    } else if (!dryRun) {
      analytics.track(intent.action, false, chatId);
    }
    return result;
  }
};