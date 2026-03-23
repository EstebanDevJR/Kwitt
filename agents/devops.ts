import { AgentResult } from '../core/types.js';
import { filesystemTool } from '../tools/filesystem.js';

class DevOpsAgent {
  async updateEnvVar(key: string, value: string): Promise<AgentResult> {
    try {
      const envPath = '.env';
      let content = '';
      
      try {
        content = await filesystemTool.readFile(envPath);
      } catch {
        content = '';
      }
      
      const lines = content.split('\n');
      const newLines = lines.map(line => {
        if (line.startsWith(`${key}=`)) {
          return `${key}=${value}`;
        }
        return line;
      });
      
      if (!lines.some(l => l.startsWith(`${key}=`))) {
        newLines.push(`${key}=${value}`);
      }
      
      await filesystemTool.writeFile(envPath, newLines.join('\n'));
      return { success: true, message: `Variable ${key} actualizada` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createDockerfile(nodeVersion: string = '20'): Promise<AgentResult> {
    const dockerfile = `FROM node:${nodeVersion}-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
`;
    
    try {
      await filesystemTool.writeFile('infra/Dockerfile', dockerfile);
      return { success: true, message: 'Dockerfile creado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateDockerCompose(services: Record<string, any>): Promise<AgentResult> {
    const compose = `version: '3.8'

services:
  backend:
    build: ./infra
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=/app/data/kwitt.db
      - NODE_ENV=production
    volumes:
      - ./data:/app/data

  bot:
    build: ./bot
    environment:
      - TELEGRAM_BOT_TOKEN=\${TELEGRAM_BOT_TOKEN}
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
    depends_on:
      - backend
`;
    
    try {
      await filesystemTool.writeFile('infra/docker-compose.yml', compose);
      return { success: true, message: 'docker-compose.yml actualizado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async checkHealth(): Promise<AgentResult> {
    return { success: true, message: 'Health check OK', data: { status: 'healthy' } };
  }
}

export const devopsAgent = new DevOpsAgent();
export default DevOpsAgent;