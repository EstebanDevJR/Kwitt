import { AgentResult } from '../core/types.js';
import { gitTool } from '../tools/git.js';

class GitAgent {
  async commitAndPush(message: string): Promise<AgentResult> {
    try {
      if (!gitTool.isConfigured()) {
        return { success: false, error: 'Git not configured' };
      }

      const commitResult = await gitTool.gitCommit(message);
      await gitTool.gitPush();

      return {
        success: true,
        message: `Commit ${commitResult.hash.slice(0, 7)} pushed`,
        data: commitResult
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async commit(message: string): Promise<AgentResult> {
    try {
      if (!gitTool.isConfigured()) {
        return { success: false, error: 'Git not configured' };
      }

      const result = await gitTool.gitCommit(message);
      return { success: true, message: `Committed: ${result.hash.slice(0, 7)}`, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async push(): Promise<AgentResult> {
    try {
      await gitTool.gitPush();
      return { success: true, message: 'Pushed to remote' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getStatus(): Promise<string> {
    return await gitTool.gitStatus();
  }

  async getDiff(): Promise<string> {
    return await gitTool.gitDiff();
  }
}

export const gitAgent = new GitAgent();
export default GitAgent;