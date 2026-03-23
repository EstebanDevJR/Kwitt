import { AgentResult } from '../core/types.js';
import { filesystemTool } from '../tools/filesystem.js';

class FrontendAgent {
  private frontendPath: string;

  constructor(frontendPath: string = 'frontend') {
    this.frontendPath = frontendPath;
  }

  async enhanceWithAnimations(): Promise<AgentResult> {
    try {
      const mainPagePath = `${this.frontendPath}/src/app/page.tsx`;
      const exists = await filesystemTool.fileExists(mainPagePath);

      if (!exists) {
        return { success: false, error: 'Frontend not found' };
      }

      const currentContent = await filesystemTool.readFile(mainPagePath);
      
      const enhancedContent = this.injectGSAPAnimations(currentContent);
      await filesystemTool.writeFile(mainPagePath, enhancedContent);

      const globalCssPath = `${this.frontendPath}/src/app/globals.css`;
      const cssExists = await filesystemTool.fileExists(globalCssPath);
      
      if (cssExists) {
        const cssContent = await filesystemTool.readFile(globalCssPath);
        const enhancedCss = this.injectGSAPStyles(cssContent);
        await filesystemTool.writeFile(globalCssPath, enhancedCss);
      }

      return {
        success: true,
        message: 'Frontend mejorado con animaciones GSAP',
        data: { enhanced: true }
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private injectGSAPAnimations(content: string): string {
    const gsapImports = `import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
`;
    
    const useGSAPHook = `useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.from('.hero-title', {
      y: 100,
      opacity: 0,
      duration: 1,
      ease: 'power3.out'
    });
    
    gsap.from('.hero-subtitle', {
      y: 50,
      opacity: 0,
      duration: 1,
      delay: 0.3,
      ease: 'power3.out'
    });
    
    gsap.utils.toArray('.project-card').forEach((card: any, i) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        delay: i * 0.1,
        ease: 'power3.out'
      });
    });
  });
  
  return () => ctx.revert();
}, []);
`;

    const withAnimation = content
      .replace(/^import .* from.*;$/m, (match) => match + '\n' + gsapImports)
      .replace(/export default function.*\{/g, (match) => match + '\n' + useGSAPHook);

    return withAnimation;
  }

  private injectGSAPStyles(css: string): string {
    const additionalStyles = `
/* GSAP Animations */
.hero-title {
  will-change: transform, opacity;
}

.hero-subtitle {
  will-change: transform, opacity;
}

.project-card {
  will-change: transform, opacity;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}
`;
    
    return css + additionalStyles;
  }

  async createPage(component: string, content: string): Promise<AgentResult> {
    try {
      const path = `${this.frontendPath}/src/app/${component}/page.tsx`;
      await filesystemTool.writeFile(path, content);
      return { success: true, message: `Página ${component} creada` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateComponent(componentName: string, code: string): Promise<AgentResult> {
    try {
      const path = `${this.frontendPath}/src/components/${componentName}.tsx`;
      await filesystemTool.writeFile(path, code);
      return { success: true, message: `Componente ${componentName} actualizado` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const frontendAgent = new FrontendAgent();
export default FrontendAgent;