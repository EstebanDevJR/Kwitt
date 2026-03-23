import { AgentResult } from '../core/types.js';
import { filesystemTool } from '../tools/filesystem.js';

class CodeAgent {
  async editFile(path: string, oldContent: string, newContent: string): Promise<AgentResult> {
    try {
      const current = await filesystemTool.readFile(path);
      
      if (!current.includes(oldContent)) {
        return { success: false, error: 'Content not found in file' };
      }
      
      const updated = current.replace(oldContent, newContent);
      await filesystemTool.writeFile(path, updated);
      
      return { success: true, message: 'Archivo modificado', data: { path } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createFile(path: string, content: string): Promise<AgentResult> {
    try {
      await filesystemTool.writeFile(path, content);
      return { success: true, message: 'Archivo creado', data: { path } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async searchInFiles(query: string, pattern: string = '*'): Promise<AgentResult> {
    try {
      const results = await filesystemTool.searchCode(query, pattern);
      return { success: true, data: { results, query } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async refactorComponent(componentPath: string, changes: string): Promise<AgentResult> {
    try {
      const current = await filesystemTool.readFile(componentPath);
      await filesystemTool.writeFile(componentPath, changes);
      return { success: true, message: 'Componente refactorizado', data: { path: componentPath } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const codeAgent = new CodeAgent();
export default CodeAgent;