import { Intent, AgentResult } from '../core/types';
import { telegramTool } from '../tools/telegram.js';
import { llmTool } from '../tools/llm.js';
import { cliAgent } from './cli_agent.js';
import { gitAgent } from './git.js';

export class OrchestratorAgent {
  private isProcessing: boolean = false;

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
    const instruction = cliAgent.mapIntentToInstruction(
      intent.action,
      intent.target,
      intent.data
    );

    await telegramTool.sendMessage(chatId, `🔄 Ejecutando: ${intent.action}...`);

    const result = await cliAgent.execute(instruction);

    if (result.success) {
      await telegramTool.sendMessage(chatId, `✅ Acción completada`);

      try {
        await gitAgent.commitAndPush(`kwitt: update via CLI - ${intent.action}`);
        await telegramTool.sendMessage(chatId, '📦 Cambios guardados en Git');
      } catch (gitError) {
        console.error('Git commit failed:', gitError);
      }
    } else {
      await telegramTool.sendMessage(chatId, `❌ Error: ${result.error}`);
    }

    return result;
  }

  getStatus(): { isProcessing: boolean } {
    return {
      isProcessing: this.isProcessing
    };
  }
}

export const orchestrator = new OrchestratorAgent();
export default OrchestratorAgent;
