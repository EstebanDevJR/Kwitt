import fetch from 'node-fetch';
import { TelegramMessage } from '../core/types.js';

class TelegramTool {
  private token: string;
  private baseUrl: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async sendMessage(chatId: number | string, text: string, parseMode: string = 'Markdown'): Promise<any> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    return await response.json();
  }

  async sendMarkdown(chatId: number | string, text: string): Promise<any> {
    return this.sendMessage(chatId, text, 'Markdown');
  }

  async sendHTML(chatId: number | string, text: string): Promise<any> {
    return this.sendMessage(chatId, text, 'HTML');
  }

  async editMessageText(chatId: number | string, messageId: number, text: string): Promise<any> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    const response = await fetch(`${this.baseUrl}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown'
      })
    });

    return await response.json();
  }

  async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    const response = await fetch(`${this.baseUrl}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });

    const result = await response.json();
    return result.ok;
  }

  async getUpdates(offset?: number, limit: number = 100): Promise<any> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    let url = `${this.baseUrl}/getUpdates?limit=${limit}`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url);
    return await response.json();
  }

  async setWebhook(url: string): Promise<boolean> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    const response = await fetch(`${this.baseUrl}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const result = await response.json();
    return result.ok;
  }

  async getMe(): Promise<any> {
    if (!this.token) {
      throw new Error('Telegram bot token not configured');
    }

    const response = await fetch(`${this.baseUrl}/getMe`);
    return await response.json();
  }

  parseMessage(update: any): TelegramMessage | null {
    if (!update.message || !update.message.text) {
      return null;
    }

    return {
      chatId: update.message.chat.id,
      text: update.message.text,
      messageId: update.message.message_id,
      from: {
        id: update.message.from.id,
        firstName: update.message.from.first_name || 'User',
        username: update.message.from.username
      }
    };
  }

  isConfigured(): boolean {
    return !!this.token;
  }
}

export const telegramTool = new TelegramTool();
export default TelegramTool;