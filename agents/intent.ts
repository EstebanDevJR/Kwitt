import { AgentResult, Intent } from '../core/types.js';
import { llmTool } from '../tools/llm.js';

class IntentAgent {
  async parseUserMessage(message: string): Promise<Intent> {
    return await llmTool.parseIntent(message);
  }

  async validateIntent(intent: Intent): Promise<AgentResult> {
    if (intent.action === 'unknown') {
      return { success: false, error: 'Unable to determine intent' };
    }
    
    if (intent.confidence < 0.5) {
      return { success: false, error: 'Low confidence' };
    }
    
    return { success: true, data: intent };
  }

  async getActionDescription(action: string): Promise<string> {
    const descriptions: Record<string, string> = {
      add_project: 'Agregar un nuevo proyecto desde GitHub',
      update_bio: 'Actualizar la biografía del perfil',
      update_contact: 'Actualizar información de contacto',
      delete_project: 'Eliminar un proyecto',
      reorder_projects: 'Reordenar proyectos',
      enhance_frontend: 'Mejorar frontend con animaciones',
      get_status: 'Obtener estado del portfolio',
      unknown: 'Acción desconocida'
    };
    
    return descriptions[action] || 'Acción desconocida';
  }
}

export const intentAgent = new IntentAgent();
export default IntentAgent;