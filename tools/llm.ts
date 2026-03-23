import { Intent } from '../core/types.js';
import { ACTIONS } from '../core/constants.js';

class LLMTool {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const messages = [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ];

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async parseIntent(userMessage: string): Promise<Intent> {
    const systemPrompt = `Eres el agente de intención de Kwitt. Analiza el mensaje del usuario y determina qué acción quiere realizar.

El usuario puede pedir:
- "agrega proyecto [url]" o "añade proyecto [url]" → action: "add_project", target: la URL del proyecto
- "actualiza mi bio [texto]" → action: "update_bio", target: "profile", data: { bio: "el texto" }
- "cambia mi contacto [info]" → action: "update_contact", target: "contact", data: { tipo: "email/twitter/github/etc", valor: "el valor" }
- "elimina proyecto [nombre]" → action: "delete_project", target: nombre del proyecto
- "reordena proyectos" → action: "reorder_projects", target: "projects"
- "hazlo más moderno" o "añade animaciones" → action: "enhance_frontend", target: "frontend"
- "estado" o "muéstrame el estado" → action: "get_status", target: "portfolio"

Responde SOLO con JSON en este formato:
{
  "action": "add_project|update_bio|update_contact|delete_project|reorder_projects|enhance_frontend|get_status|unknown",
  "target": "el objetivo o URL",
  "data": {},
  "confidence": 0.0-1.0
}

Si no puedes determinar la acción con confianza > 0.7, usa "unknown".`;

    try {
      const response = await this.generateText(userMessage, systemPrompt);
      const parsed = JSON.parse(response);
      
      return {
        action: parsed.action || ACTIONS.UNKNOWN,
        target: parsed.target || '',
        data: parsed.data || {},
        confidence: parsed.confidence || 0
      };
    } catch (error) {
      return {
        action: ACTIONS.UNKNOWN,
        target: '',
        data: {},
        confidence: 0
      };
    }
  }

  async generateProjectDescription(githubUrl: string): Promise<{ name: string; description: string; tags: string[] }> {
    const prompt = `Analiza este repositorio de GitHub: ${githubUrl}
    
Basándote en el nombre del repositorio, genera:
- name: nombre del proyecto (slug)
- description: descripción corta (1-2 oraciones)
- tags: array de 3-5 tags relevantes

Responde SOLO con JSON:
{
  "name": "nombre-del-proyecto",
  "description": "descripción",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    try {
      const response = await this.generateText(prompt);
      return JSON.parse(response);
    } catch (error) {
      return {
        name: 'new-project',
        description: 'Nuevo proyecto',
        tags: ['project']
      };
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const llmTool = new LLMTool();
export default LLMTool;