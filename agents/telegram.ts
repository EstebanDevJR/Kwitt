import { AgentResult, TelegramMessage } from '../core/types.js';
import { telegramTool } from '../tools/telegram.js';

class TelegramAgent {
  async sendMessage(chatId: number, text: string): Promise<AgentResult> {
    try {
      await telegramTool.sendMarkdown(chatId, text);
      return { success: true, message: 'Mensaje enviado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendHTML(chatId: number, text: string): Promise<AgentResult> {
    try {
      await telegramTool.sendHTML(chatId, text);
      return { success: true, message: 'Mensaje HTML enviado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async parseUpdate(update: any): Promise<TelegramMessage | null> {
    return telegramTool.parseMessage(update);
  }

  async startPolling(offset?: number): Promise<any> {
    return await telegramTool.getUpdates(offset);
  }

  async setWebhook(url: string): Promise<AgentResult> {
    try {
      await telegramTool.setWebhook(url);
      return { success: true, message: 'Webhook configurado' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  isConfigured(): boolean {
    return telegramTool.isConfigured();
  }
}

export const telegramAgent = new TelegramAgent();
export default TelegramAgent;