import { AgentResult } from '../core/types.js';
import { cliRunner, CLIOptions } from '../core/cli_runner.js';

export interface CLIInstruction {
  action: string;
  target?: string;
  data?: Record<string, any>;
  description: string;
}

export class CLIAgent {
  private defaultOptions: CLIOptions = {
    timeout: 120000,
    dryRun: false
  };

  async execute(
    instruction: string | CLIInstruction,
    options: Partial<CLIOptions> = {}
  ): Promise<AgentResult> {
    const finalOptions = { ...this.defaultOptions, ...options };

    const instructionStr = typeof instruction === 'string'
      ? instruction
      : instruction.description;

    if (!instructionStr || instructionStr.trim() === '') {
      return {
        success: false,
        error: 'Empty instruction provided'
      };
    }

    try {
      const result = await cliRunner.runOpenCode(instructionStr, finalOptions);

      if (result.success) {
        return {
          success: true,
          message: 'CLI execution completed',
          data: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode
          }
        };
      } else {
        return {
          success: false,
          error: result.error || `CLI exited with code ${result.exitCode}`,
          data: {
            stdout: result.stdout,
            stderr: result.stderr
          }
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeDryRun(instruction: string): Promise<AgentResult> {
    return this.execute(instruction, { dryRun: true });
  }

  mapIntentToInstruction(
    action: string,
    target: string,
    data?: Record<string, any>
  ): string {
    const mappings: Record<string, (target: string, data?: Record<string, any>) => string> = {
      add_project: (target) =>
        `Add a new project to the portfolio from GitHub repository ${target}. Extract the project name, description, and relevant tech stack tags. Update the portfolio.json file and ensure the frontend displays the new project correctly.`,

      update_bio: (target, data) =>
        `Update the portfolio bio to: "${data?.bio || target}". Save the changes to portfolio.json in the data directory.`,

      update_contact: (target, data) =>
        `Update the contact information in portfolio.json. Set ${data?.tipo || target} to ${data?.valor || ''}.`,

      delete_project: (target) =>
        `Delete the project "${target}" from portfolio.json. Update the project order for remaining projects.`,

      enhance_frontend: () =>
        `Enhance the frontend with modern GSAP animations. Add scroll-triggered animations to the hero section and project cards. Update the relevant component files.`,

      update_theme: (target, data) =>
        `Update the portfolio theme. ${data?.colors ? `Set colors: ${JSON.stringify(data.colors)}` : ''} ${data?.fonts ? `Set fonts: ${JSON.stringify(data.fonts)}` : ''}. Save to portfolio.json.`,

      update_avatar: (target) =>
        `Update the profile avatar in portfolio.json to use the image at URL: ${target}.`,

      toggle_animations: (target, data) =>
        `${data?.value ? 'Enable' : 'Disable'} animations in portfolio.json settings.`,

      toggle_darkmode: (target, data) =>
        `${data?.value ? 'Enable' : 'Disable'} dark mode in portfolio.json settings.`
    };

    const mapper = mappings[action];
    if (mapper) {
      return mapper(target, data);
    }

    return `Execute the action: ${action} with target "${target}" and data ${JSON.stringify(data || {})}`;
  }

  getLogs(): string[] {
    return cliRunner.getLogs();
  }
}

export const cliAgent = new CLIAgent();
export default CLIAgent;
