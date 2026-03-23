import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

export interface FileContent {
  path: string;
  content: string;
  size: number;
}

export interface FileListing {
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

class FilesystemTool {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  async readFile(path: string): Promise<string> {
    const fullPath = resolve(this.basePath, path);
    return await readFile(fullPath, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<boolean> {
    const fullPath = resolve(this.basePath, path);
    const dir = require('path').dirname(fullPath);
    
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    await writeFile(fullPath, content, 'utf-8');
    return true;
  }

  async listFiles(path: string = '.'): Promise<FileListing[]> {
    const fullPath = resolve(this.basePath, path);
    const entries = await readdir(fullPath, { withFileTypes: true });
    
    return entries.map(entry => ({
      path: join(path, entry.name),
      type: entry.isDirectory() ? 'directory' : 'file'
    }));
  }

  async searchCode(query: string, filePattern: string = '*.ts'): Promise<string[]> {
    const results: string[] = [];
    const { glob } = await import('glob');
    const files = await glob(filePattern, { cwd: this.basePath });
    
    for (const file of files.slice(0, 50)) {
      try {
        const content = await this.readFile(file);
        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push(file);
        }
      } catch {
        continue;
      }
    }
    
    return results;
  }

  async fileExists(path: string): Promise<boolean> {
    const fullPath = resolve(this.basePath, path);
    return existsSync(fullPath);
  }

  async getFileInfo(path: string): Promise<{ size: number; exists: boolean }> {
    const fullPath = resolve(this.basePath, path);
    
    if (!existsSync(fullPath)) {
      return { size: 0, exists: false };
    }
    
    const stats = await stat(fullPath);
    return { size: stats.size, exists: true };
  }
}

export const filesystemTool = new FilesystemTool();
export default FilesystemTool;