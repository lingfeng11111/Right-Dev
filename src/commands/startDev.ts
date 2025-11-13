import * as vscode from 'vscode';
import * as path from 'path';
import { StatusBarProvider, DevServerStatus } from '../providers/statusBarProvider';
import { ProjectDetector } from '../detectors/projectDetector';
import { DependencyService } from '../services/dependencyService';
import { TerminalService } from '../services/terminalService';
import { BrowserService } from '../services/browserService';
import { PortDetector } from '../detectors/portDetector';
import { ConfigUtils } from '../utils/configUtils';
import { PathUtils } from '../utils/pathUtils';
import { RealTimeServer } from '../services/realTimeServer';

export class StartDevCommand {
    private statusBarProvider: StatusBarProvider;
    private projectDetector: ProjectDetector;
    private dependencyService: DependencyService;
    private terminalService: TerminalService;
    private browserService: BrowserService;
    private portDetector: PortDetector;
    private configUtils: ConfigUtils;

    private isRunning: boolean = false;
    private currentTerminal: vscode.Terminal | null = null;
    public currentPort: number | null = null; // 改为public，供外部访问
    private currentProjectType: string = '';
    private realTimeServer: RealTimeServer | null = null; // RealTimeServer实例

    constructor(statusBarProvider: StatusBarProvider) {
        this.statusBarProvider = statusBarProvider;
        this.projectDetector = new ProjectDetector();
        this.dependencyService = new DependencyService();
        this.terminalService = new TerminalService();
        this.browserService = new BrowserService();
        this.portDetector = new PortDetector();
        this.configUtils = new ConfigUtils();
    }

    public async execute(resourceUri?: vscode.Uri): Promise<void> {
        try {
            if (this.isRunning) {
                vscode.window.showInformationMessage('开发服务器已经在运行中');
                return;
            }

            // 获取目标路径（支持右键菜单传入的URI）
            let targetPath: string;
            let htmlOpenMode: string | undefined;
            
            if (resourceUri) {
                // 右键菜单触发，使用选中的文件或文件夹路径
                targetPath = resourceUri.fsPath;
                console.log(`右键菜单触发，目标路径: ${targetPath}`);
                
                // 如果是HTML文件，让用户选择打开模式
                const ext = path.extname(targetPath).toLowerCase();
                if (ext === '.html' || ext === '.htm') {
                    console.log(`检测到HTML文件，显示模式选择对话框: ${targetPath}`);
                    
                    const mode = await vscode.window.showQuickPick([
                        { label: 'Real-time模式', description: '启动热重载服务器，支持实时预览', value: 'server' },
                        { label: 'Normal普通模式', description: '直接打开文件，不启动服务器', value: 'direct' }
                    ], {
                        placeHolder: '选择HTML文件打开模式',
                        title: 'HTML文件打开模式'
                    });
                    
                    console.log(`模式选择结果:`, mode);
                    
                    if (!mode) {
                        console.log('用户取消了模式选择');
                        vscode.window.showInformationMessage('已取消HTML文件打开操作');
                        return; // 用户取消选择
                    }
                    
                    htmlOpenMode = mode.value;
                    console.log(`用户选择的HTML打开模式: ${htmlOpenMode}`);
                    vscode.window.showInformationMessage(`您选择了: ${mode.label}`);
                }
            } else {
                // 命令面板触发，获取当前工作目录
                const workspaceFolder = this.getWorkspaceFolder();
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage('请先打开一个工作目录');
                    return;
                }
                targetPath = workspaceFolder;
            }

            // 标准化路径，处理特殊字符
            const normalizedTargetPath = PathUtils.normalizeFilePath(targetPath);
            
            // 如果路径包含特殊字符，显示调试信息
            if (PathUtils.hasSpecialCharacters(targetPath)) {
                console.log(`目标路径包含特殊字符: ${targetPath}`);
                console.log(`标准化后的路径: ${normalizedTargetPath}`);
            }

            // 更新状态为检测中
            this.statusBarProvider.updateStatus(DevServerStatus.Detecting);

            // 检测项目类型
            const projectInfo = await this.projectDetector.detectProjectType(normalizedTargetPath, htmlOpenMode);
            if (!projectInfo) {
                throw new Error('无法识别的项目类型');
            }

            this.currentProjectType = projectInfo.type;

            // 确定项目根目录
            let projectRootPath: string;
            
            if (projectInfo.entryFile) {
                // 单文件项目，使用文件所在目录
                projectRootPath = path.dirname(normalizedTargetPath);
            } else {
                // 多文件项目，尝试找到项目根目录
                const foundRoot = await this.projectDetector.findProjectRoot(normalizedTargetPath);
                projectRootPath = foundRoot || normalizedTargetPath;
            }

            console.log(`项目根目录: ${projectRootPath}`);

            // 检查配置文件
            const config = await this.configUtils.loadConfig(projectRootPath);
            if (config && config.customScript) {
                projectInfo.startCommand = config.customScript;
            }
            if (config && config.port) {
                projectInfo.port = config.port;
            }

            // 检查依赖
            this.statusBarProvider.updateStatus(DevServerStatus.Installing);
            const needsInstall = await this.dependencyService.checkDependencies(projectRootPath, projectInfo);
            
            if (needsInstall && vscode.workspace.getConfiguration('right-dev').get('autoInstall', true)) {
                const installed = await this.dependencyService.installDependencies(projectRootPath, projectInfo);
                if (!installed) {
                    throw new Error('依赖安装失败');
                }
            }

            // 启动服务
            this.statusBarProvider.updateStatus(DevServerStatus.Starting);
            
            // 创建终端，使用项目根目录
            this.currentTerminal = await this.terminalService.createTerminal(projectRootPath, projectInfo);
            
            // 监听端口，使用更短的超时时间
            const port = await this.portDetector.waitForPort(this.currentTerminal, projectInfo.port, 5000);
            if (!port) {
                throw new Error('无法在预期时间内检测到端口');
            }

            this.currentPort = port;
            this.isRunning = true;

            // 更新状态
            this.statusBarProvider.updateStatus(DevServerStatus.Running, port, projectInfo.type);
            vscode.commands.executeCommand('setContext', 'right-dev.isRunning', true);

            // 处理RealTimeServer模式（HTML文件）
            if (projectInfo.useRealTimeServer && projectInfo.type === 'html') {
                // 使用内置RealTimeServer，指定实际的HTML文件作为入口
                try {
                    // 使用用户点击的实际HTML文件作为入口文件
                    const entryFile = projectInfo.entryFile || 'index.html';
                    console.log(`RealTimeServer入口文件: ${entryFile}, 项目根目录: ${projectRootPath}`);
                    
                    this.realTimeServer = new RealTimeServer(projectRootPath, projectInfo.port, entryFile);
                    const actualPort = await this.realTimeServer.start();
                    
                    this.currentPort = actualPort;
                    this.isRunning = true;
                    
                    // 更新状态
                    this.statusBarProvider.updateStatus(DevServerStatus.Running, actualPort, projectInfo.type);
                    vscode.commands.executeCommand('setContext', 'right-dev.isRunning', true);
                    
                    // 打开浏览器 - 只使用端口号，不添加文件名，避免404问题
                    if (vscode.workspace.getConfiguration('right-dev').get('autoOpenBrowser', true)) {
                        await this.browserService.openBrowser(actualPort);
                    }
                    
                    vscode.window.showInformationMessage(`Real-time服务器已启动: http://localhost:${actualPort}`);
                    return; // 直接返回，不执行后续逻辑
                    
                } catch (error) {
                    console.error('RealTimeServer启动失败:', error);
                    throw new Error(`Real-time服务器启动失败: ${error}`);
                }
            }

            // 处理直接打开模式（HTML文件）
            if (projectInfo.directOpen && projectInfo.type === 'html-direct') {
                // 直接打开文件
                const filePath = path.join(projectRootPath, projectInfo.entryFile!);
                await this.browserService.openUrl(`file://${filePath}`);
                vscode.window.showInformationMessage(`已直接打开文件: ${projectInfo.entryFile}`);
                return; // 直接返回，不执行后续的服务器逻辑
            }

            // 打开浏览器 - 只使用端口号，不添加文件名路径
            if (vscode.workspace.getConfiguration('right-dev').get('autoOpenBrowser', true)) {
                await this.browserService.openBrowser(port);
            }

            vscode.window.showInformationMessage(`开发服务器已启动: http://localhost:${port}`);

        } catch (error) {
            this.handleError(error);
        }
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) {
            vscode.window.showInformationMessage('没有正在运行的开发服务器');
            return;
        }

        try {
            // 停止终端服务
            if (this.currentTerminal) {
                this.terminalService.disposeTerminal(this.currentTerminal);
                this.currentTerminal = null;
            }

            // 停止RealTimeServer
            if (this.realTimeServer) {
                this.realTimeServer.stop();
                this.realTimeServer = null;
            }

            this.isRunning = false;
            this.currentPort = null;
            this.currentProjectType = '';

            this.statusBarProvider.updateStatus(DevServerStatus.Stopped);
            vscode.commands.executeCommand('setContext', 'right-dev.isRunning', false);

            vscode.window.showInformationMessage('开发服务器已停止');
        } catch (error) {
            vscode.window.showErrorMessage(`停止服务失败: ${error}`);
        }
    }

    public async restart(): Promise<void> {
        if (this.isRunning) {
            await this.stop();
            // 减少等待时间，确保端口释放
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        await this.execute();
    }

    public dispose(): void {
        if (this.currentTerminal) {
            this.terminalService.disposeTerminal(this.currentTerminal);
            this.currentTerminal = null;
        }
        
        if (this.realTimeServer) {
            this.realTimeServer.stop();
            this.realTimeServer = null;
        }
        
        this.isRunning = false;
    }

    private getWorkspaceFolder(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        
        // 如果有多个工作区，使用第一个
        return workspaceFolders[0].uri.fsPath;
    }

    private handleError(error: any): void {
        console.error('Right-Dev Error:', error);
        
        this.isRunning = false;
        this.statusBarProvider.updateStatus(DevServerStatus.Error);
        vscode.commands.executeCommand('setContext', 'right-dev.isRunning', false);

        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Right-Dev: ${errorMessage}`);
    }
}