import { exec } from 'child_process';
import { promisify } from 'util';
import { GitCommitResult } from '../core/types.js';

const execAsync = promisify(exec);

class GitTool {
  private token: string;
  private repoUrl: string;
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.token = process.env.GITHUB_TOKEN || '';
    this.repoUrl = process.env.GITHUB_REPO || '';
    this.workingDir = workingDir;
  }

  async gitCommit(message: string): Promise<GitCommitResult> {
    try {
      await execAsync('git add -A', { cwd: this.workingDir });
      
      const { stdout } = await execAsync(`git commit -m "${message}"`, { cwd: this.workingDir });
      
      const { stdout: hashStdout } = await execAsync('git rev-parse HEAD', { cwd: this.workingDir });
      const branchStdout = await execAsync('git branch --show-current', { cwd: this.workingDir });
      
      return {
        hash: hashStdout.trim(),
        message,
        branch: branchStdout.trim()
      };
    } catch (error: any) {
      throw new Error(`Git commit failed: ${error.message}`);
    }
  }

  async gitPush(): Promise<boolean> {
    try {
      if (this.token) {
        const remoteUrl = this.repoUrl.replace('https://', `https://${this.token}@`);
        await execAsync(`git remote set-url origin ${remoteUrl}`, { cwd: this.workingDir });
      }
      
      await execAsync('git push', { cwd: this.workingDir });
      return true;
    } catch (error: any) {
      throw new Error(`Git push failed: ${error.message}`);
    }
  }

  async gitPull(): Promise<boolean> {
    try {
      await execAsync('git pull', { cwd: this.workingDir });
      return true;
    } catch (error: any) {
      throw new Error(`Git pull failed: ${error.message}`);
    }
  }

  async gitDiff(files?: string[]): Promise<string> {
    try {
      const fileSpec = files?.join(' ') || '';
      const { stdout } = await execAsync(`git diff ${fileSpec}`, { cwd: this.workingDir });
      return stdout;
    } catch (error: any) {
      return '';
    }
  }

  async gitStatus(): Promise<string> {
    try {
      const { stdout } = await execAsync('git status --short', { cwd: this.workingDir });
      return stdout;
    } catch (error: any) {
      return '';
    }
  }

  async createBranch(branchName: string): Promise<boolean> {
    try {
      await execAsync(`git checkout -b ${branchName}`, { cwd: this.workingDir });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  async checkoutBranch(branchName: string): Promise<boolean> {
    try {
      await execAsync(`git checkout ${branchName}`, { cwd: this.workingDir });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to checkout branch: ${error.message}`);
    }
  }

  isConfigured(): boolean {
    return !!this.token && !!this.repoUrl;
  }
}

export const gitTool = new GitTool();
export default GitTool;