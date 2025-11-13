import * as vscode from 'vscode';
import { ProjectInfo } from '../detectors/projectDetector';
import { PathUtils } from '../utils/pathUtils';

export class TerminalService {
    private terminals: Map<string, vscode.Terminal> = new Map();

    public async createTerminal(
        workspacePath: string,
        projectInfo: ProjectInfo,
        showTerminal: boolean = false
    ): Promise<vscode.Terminal> {
        const terminalName = `Right Dev - ${projectInfo.name}`;
        
        // 标准化工作路径，处理特殊字符
        const normalizedWorkspacePath = PathUtils.normalizeFilePath(workspacePath);
        
        // 如果路径包含特殊字符，记录日志
        if (PathUtils.hasSpecialCharacters(workspacePath)) {
            console.log(`终端服务工作路径包含特殊字符: ${workspacePath}`);
            console.log(`标准化后的路径: ${normalizedWorkspacePath}`);
        }
        
        // 创建新的终端
        const terminal = vscode.window.createTerminal({
            name: terminalName,
            cwd: normalizedWorkspacePath,
            hideFromUser: !showTerminal
        });

        // 保存终端引用
        this.terminals.set(terminalName, terminal);

        // 监听终端关闭事件
        const disposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === terminal) {
                this.terminals.delete(terminalName);
                disposable.dispose();
            }
        });

        // 发送启动命令，确保命令中的路径已经正确转义
        // 注意：projectInfo.startCommand 应该已经在 projectDetector 中处理过路径转义
        terminal.sendText(projectInfo.startCommand);

        // 显示终端（如果需要）
        if (showTerminal) {
            terminal.show();
        }

        return terminal;
    }

    public disposeTerminal(terminal: vscode.Terminal): void {
        try {
            terminal.dispose();
        } catch (error) {
            console.error('关闭终端失败:', error);
        }
    }

    public disposeAllTerminals(): void {
        for (const [name, terminal] of this.terminals) {
            try {
                terminal.dispose();
            } catch (error) {
                console.error(`关闭终端 ${name} 失败:`, error);
            }
        }
        this.terminals.clear();
    }

    public getTerminal(name: string): vscode.Terminal | undefined {
        return this.terminals.get(name);
    }

    public getAllTerminals(): vscode.Terminal[] {
        return Array.from(this.terminals.values());
    }

    public showTerminal(terminal: vscode.Terminal): void {
        terminal.show();
    }

    public hideTerminal(terminal: vscode.Terminal): void {
        // VSCode API 没有直接隐藏终端的方法
        // 可以通过创建时设置 hideFromUser 来控制
    }

    public sendCommand(terminal: vscode.Terminal, command: string): void {
        terminal.sendText(command);
    }

    public async waitForTerminalOutput(
        terminal: vscode.Terminal,
        pattern: RegExp,
        timeout: number = 10000
    ): Promise<string | null> {
        // 由于VSCode API限制，我们使用简化的方法
        // 在实际实现中，我们会通过其他方式检测端口
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(null);
            }, timeout);
        });
    }

    public async waitForTerminalReady(
        terminal: vscode.Terminal,
        timeout: number = 3000  // 减少超时时间到3秒
    ): Promise<boolean> {
        // 简化的就绪检查，减少等待时间
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(true);
            }, 300); // 减少到300ms
        });
    }

    public isTerminalAlive(terminal: vscode.Terminal): boolean {
        // VSCode API 没有直接检查终端状态的方法
        // 可以通过尝试发送命令来间接检查
        try {
            terminal.sendText('');
            return true;
        } catch (error) {
            return false;
        }
    }

    public async executeCommand(
        workspacePath: string,
        command: string,
        showOutput: boolean = false
    ): Promise<string> {
        // 标准化工作路径
        const normalizedWorkspacePath = PathUtils.normalizeFilePath(workspacePath);
        
        // 简化的命令执行，不捕获输出，减少超时时间
        return new Promise((resolve) => {
            const terminal = vscode.window.createTerminal({
                name: 'Right Dev - Execute Command',
                cwd: normalizedWorkspacePath,
                hideFromUser: !showOutput
            });

            terminal.sendText(command);
            
            setTimeout(() => {
                try {
                    terminal.dispose();
                } catch (error) {
                    console.error('命令执行完成:', error);
                }
                resolve('');
            }, 10000); // 减少到10秒超时
        });
    }
}