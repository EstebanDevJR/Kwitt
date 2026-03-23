import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface CLIResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export interface CLIOptions {
  timeout?: number;
  dryRun?: boolean;
  workdir?: string;
  logFile?: string;
}

const DEFAULT_TIMEOUT = 120000;
const LOG_DIR = './logs';

export class CLIRunner {
  private logs: string[] = [];

  constructor() {
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  async run(
    command: string,
    options: CLIOptions = {}
  ): Promise<CLIResult> {
    const {
      timeout = DEFAULT_TIMEOUT,
      dryRun = false,
      workdir = process.cwd(),
      logFile
    } = options;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${command}`;

    this.logs.push(logEntry);
    this.writeLog(logEntry, logFile);

    if (dryRun) {
      return {
        success: true,
        stdout: `Dry run: ${command}`,
        stderr: '',
        exitCode: 0
      };
    }

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const args = command.split(' ').slice(1);
      const cmd = command.split(' ')[0];

      const child = spawn(cmd, args, {
        cwd: workdir,
        shell: true,
        env: { ...process.env }
      });

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        resolve({
          success: false,
          stdout,
          stderr,
          exitCode: 124,
          error: `Command timed out after ${timeout}ms`
        });
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        
        const result: CLIResult = {
          success: !killed && code === 0,
          stdout,
          stderr,
          exitCode: code || 0,
          error: killed ? 'Command killed due to timeout' : undefined
        };

        this.logs.push(`[Result] exitCode=${code}, success=${result.success}`);
        this.writeLog(`[Result] ${JSON.stringify(result)}`, logFile);

        resolve(result);
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout,
          stderr,
          exitCode: 1,
          error: error.message
        });
      });
    });
  }

  async runOpenCode(
    instruction: string,
    options: Omit<CLIOptions, 'dryRun'> & { dryRun?: boolean } = {}
  ): Promise<CLIResult> {
    const { dryRun = false } = options;
    
    const sanitizedInstruction = instruction.replace(/"/g, '\\"');
    const command = dryRun
      ? `opencode run --dry-run "${sanitizedInstruction}"`
      : `opencode run "${sanitizedInstruction}"`;

    return this.run(command, options);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  private writeLog(entry: string, logFile?: string): void {
    const file = logFile || join(LOG_DIR, `cli-${new Date().toISOString().split('T')[0]}.log`);
    const stream = createWriteStream(file, { flags: 'a' });
    stream.write(entry + '\n');
    stream.end();
  }
}

export const cliRunner = new CLIRunner();
export default CLIRunner;
