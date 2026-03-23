import { AgentResult, Portfolio, Project } from '../core/types.js';
import { DEFAULT_PORTFOLIO } from '../core/constants.js';
import { filesystemTool } from '../tools/filesystem.js';

const PORTFOLIO_FILE = 'portfolio.json';

class PortfolioAgent {
  private portfolio: Portfolio | null = null;

  async loadPortfolio(): Promise<Portfolio> {
    if (this.portfolio) {
      return this.portfolio;
    }

    try {
      const content = await filesystemTool.readFile(PORTFOLIO_FILE);
      this.portfolio = JSON.parse(content);
    } catch {
      this.portfolio = {
        id: 'default',
        ...DEFAULT_PORTFOLIO,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.savePortfolio();
    }

    return this.portfolio;
  }

  async savePortfolio(): Promise<boolean> {
    if (!this.portfolio) return false;
    
    this.portfolio.updatedAt = new Date().toISOString();
    await filesystemTool.writeFile(PORTFOLIO_FILE, JSON.stringify(this.portfolio, null, 2));
    return true;
  }

  async addProject(githubUrl: string): Promise<AgentResult> {
    try {
      const portfolio = await this.loadPortfolio();
      const projectData = await this.extractProjectData(githubUrl);
      
      const project: Project = {
        id: `project-${Date.now()}`,
        name: projectData.name,
        description: projectData.description,
        url: githubUrl,
        githubUrl: githubUrl,
        tags: projectData.tags,
        order: portfolio.projects.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      portfolio.projects.push(project);
      await this.savePortfolio();

      return {
        success: true,
        message: `Proyecto "${project.name}" agregado correctamente`,
        data: project
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async extractProjectData(githubUrl: string): Promise<{ name: string; description: string; tags: string[] }> {
    const urlParts = githubUrl.replace('https://', '').replace('http://', '').split('/');
    const repoName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'new-project';
    
    const name = repoName.toLowerCase().replace(/[-_]/g, '-');
    const description = `Proyecto desde ${githubUrl}`;
    const tags = ['github', 'project'];

    return { name, description, tags };
  }

  async updateBio(bio: string): Promise<AgentResult> {
    try {
      const portfolio = await this.loadPortfolio();
      portfolio.profile.bio = bio;
      await this.savePortfolio();

      return {
        success: true,
        message: 'Bio actualizada correctamente',
        data: { bio }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateContact(type: string, value: string): Promise<AgentResult> {
    try {
      const portfolio = await this.loadPortfolio();
      (portfolio.profile.contact as any)[type] = value;
      await this.savePortfolio();

      return {
        success: true,
        message: `Contacto ${type} actualizado`,
        data: { type, value }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async deleteProject(projectName: string): Promise<AgentResult> {
    try {
      const portfolio = await this.loadPortfolio();
      const index = portfolio.projects.findIndex(p => 
        p.name.toLowerCase().includes(projectName.toLowerCase())
      );

      if (index === -1) {
        return { success: false, error: 'Proyecto no encontrado' };
      }

      const deleted = portfolio.projects.splice(index, 1)[0];
      
      portfolio.projects.forEach((p, i) => {
        p.order = i;
      });

      await this.savePortfolio();

      return {
        success: true,
        message: `Proyecto "${deleted.name}" eliminado`,
        data: { deleted }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async reorderProjects(): Promise<AgentResult> {
    return { success: true, message: 'Proyectos reordenados (orden automático)' };
  }

  async getStatus(): Promise<Portfolio> {
    return await this.loadPortfolio();
  }

  getProjects(): Project[] {
    return this.portfolio?.projects || [];
  }

  getProfile(): any {
    return this.portfolio?.profile;
  }
}

export const portfolioAgent = new PortfolioAgent();
export default PortfolioAgent;