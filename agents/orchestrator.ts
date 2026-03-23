import { Intent, AgentResult } from '../core/types';
import { telegramTool } from '../tools/telegram.js';
import { llmTool } from '../tools/llm.js';

export class OrchestratorAgent {
  private isProcessing: boolean = false;
  private messageQueue: any[] = [];

  async processMessage(chatId: number, text: string): Promise<AgentResult> {
    if (this.isProcessing) {
      return { success: false, error: 'Already processing a message' };
    }

    this.isProcessing = true;

    try {
      const intent = await llmTool.parseIntent(text);
      
      if (intent.action === 'unknown' || intent.confidence < 0.5) {
        await telegramTool.sendMessage(chatId, 
          '🤔 No pude entender tu mensaje. ¿Podrías reformularlo?\n\n' +
          'Puedes decir cosas como:\n' +
          '- "agrega proyecto github.com/user/repo"\n' +
          '- "actualiza mi bio soy desarrollador"\n' +
          '- "hazlo más moderno"'
        );
        return { success: true, message: 'Intent not understood' };
      }

      const result = await this.executeIntent(intent, chatId);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeIntent(intent: Intent, chatId: number): Promise<AgentResult> {
    switch (intent.action) {
      case 'add_project':
        return await this.handleAddProject(intent, chatId);
      case 'update_bio':
        return await this.handleUpdateBio(intent, chatId);
      case 'update_contact':
        return await this.handleUpdateContact(intent, chatId);
      case 'delete_project':
        return await this.handleDeleteProject(intent, chatId);
      case 'reorder_projects':
        return await this.handleReorderProjects(intent, chatId);
      case 'enhance_frontend':
        return await this.handleEnhanceFrontend(intent, chatId);
      case 'get_status':
        return await this.handleGetStatus(chatId);
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  private async handleAddProject(intent: Intent, chatId: number): Promise<AgentResult> {
    await telegramTool.sendMessage(chatId, '🔄 Agregando proyecto...');
    
    const portfolioAgent = await import('./portfolio.js');
    const result = await portfolioAgent.addProject(intent.target);
    
    if (result.success) {
      await telegramTool.sendMessage(chatId, `✅ ${result.message}`);
      
      const gitAgent = await import('./git.js');
      await gitAgent.commitAndPush('feat: add new project to portfolio');
      
      await telegramTool.sendMessage(chatId, '📦 Cambios guardados en Git');
    } else {
      await telegramTool.sendMessage(chatId, `❌ Error: ${result.error}`);
    }
    
    return result;
  }

  private async handleUpdateBio(intent: Intent, chatId: number): Promise<AgentResult> {
    const bio = intent.data?.bio || intent.target;
    
    const portfolioAgent = await import('./portfolio.js');
    const result = await portfolioAgent.updateBio(bio);
    
    if (result.success) {
      await telegramTool.sendMessage(chatId, `✅ ${result.message}`);
      
      const gitAgent = await import('./git.js');
      await gitAgent.commitAndPush('chore: update portfolio bio');
    }
    
    return result;
  }

  private async handleUpdateContact(intent: Intent, chatId: number): Promise<AgentResult> {
    const contactType = intent.data?.tipo || intent.target;
    const contactValue = intent.data?.valor || '';
    
    const portfolioAgent = await import('./portfolio.js');
    const result = await portfolioAgent.updateContact(contactType, contactValue);
    
    if (result.success) {
      await telegramTool.sendMessage(chatId, `✅ ${result.message}`);
      
      const gitAgent = await import('./git.js');
      await gitAgent.commitAndPush('chore: update contact info');
    }
    
    return result;
  }

  private async handleDeleteProject(intent: Intent, chatId: number): Promise<AgentResult> {
    const projectName = intent.target;
    
    const portfolioAgent = await import('./portfolio.js');
    const result = await portfolioAgent.deleteProject(projectName);
    
    if (result.success) {
      await telegramTool.sendMessage(chatId, `✅ ${result.message}`);
      
      const gitAgent = await import('./git.js');
      await gitAgent.commitAndPush(`chore: remove project "${projectName}"`);
    }
    
    return result;
  }

  private async handleReorderProjects(intent: Intent, chatId: number): Promise<AgentResult> {
    await telegramTool.sendMessage(chatId, '🔄 Reordenando proyectos...');
    
    const portfolioAgent = await import('./portfolio.js');
    const result = await portfolioAgent.reorderProjects();
    
    if (result.success) {
      await telegramTool.sendMessage(chatId, `✅ ${result.message}`);
    }
    
    return result;
  }

  private async handleEnhanceFrontend(intent: Intent, chatId: number): Promise<AgentResult> {
    await telegramTool.sendMessage(chatId, '🎨 Mejorando el frontend con animaciones...');
    
    const frontendAgent = await import('./frontend.js');
    const result = await frontendAgent.enhanceWithAnimations();
    
    if (result.success) {
      await telegramTool.sendMessage(chatId, `✨ ${result.message}`);
      
      const gitAgent = await import('./git.js');
      await gitAgent.commitAndPush('feat: enhance frontend with GSAP animations');
    }
    
    return result;
  }

  private async handleGetStatus(chatId: number): Promise<AgentResult> {
    const portfolioAgent = await import('./portfolio.js');
    const status = await portfolioAgent.getStatus();
    
    const statusText = `📊 *Estado del Portfolio*\n\n` +
      `*Nombre:* ${status.profile.name}\n` +
      `*Bio:* ${status.profile.bio}\n` +
      `*Proyectos:* ${status.projects.length}\n\n` +
      `_Para hacer cambios, envíame un comando_`;
    
    await telegramTool.sendMarkdown(chatId, statusText);
    
    return { success: true, data: status };
  }

  getStatus(): { isProcessing: boolean; queueLength: number } {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.messageQueue.length
    };
  }
}

export const orchestrator = new OrchestratorAgent();
export default OrchestratorAgent;