import * as vscode from 'vscode';
import { StartDevCommand } from './commands/startDev';
import { StatusBarProvider } from './providers/statusBarProvider';
import { BrowserService } from './services/browserService';

let startDevCommand: StartDevCommand;
let statusBarProvider: StatusBarProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Right-Dev extension is now active!');

    // 初始化状态栏提供器
    statusBarProvider = new StatusBarProvider();
    context.subscriptions.push(statusBarProvider);

    // 初始化启动命令
    startDevCommand = new StartDevCommand(statusBarProvider);
    
    // 注册命令 - 支持传入URI参数（右键菜单）
    const startCommand = vscode.commands.registerCommand('right-dev.start', (uri?: vscode.Uri) => {
        startDevCommand.execute(uri);
    });

    const stopCommand = vscode.commands.registerCommand('right-dev.stop', () => {
        startDevCommand.stop();
    });

    const restartCommand = vscode.commands.registerCommand('right-dev.restart', () => {
        startDevCommand.restart();
    });

    // 注册状态栏菜单命令
    const showMenuCommand = vscode.commands.registerCommand('right-dev.showMenu', async () => {
        const options = ['停止服务', '重启服务', '打开浏览器'];
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: '选择操作'
        });
        
        if (selected) {
            switch (selected) {
                case '停止服务':
                    startDevCommand.stop();
                    break;
                case '重启服务':
                    startDevCommand.restart();
                    break;
                case '打开浏览器':
                    // 获取当前端口并打开浏览器 - 只使用端口号，不添加文件名
                    if (startDevCommand.currentPort) {
                        const browserService = new BrowserService();
                        browserService.openBrowser(startDevCommand.currentPort);
                    } else {
                        vscode.window.showWarningMessage('没有正在运行的服务');
                    }
                    break;
            }
        }
    });

    // 添加到订阅
    context.subscriptions.push(
        startCommand,
        stopCommand,
        restartCommand,
        showMenuCommand,
        statusBarProvider
    );

    // 设置上下文变量
    vscode.commands.executeCommand('setContext', 'right-dev.isRunning', false);
}

export function deactivate() {
    console.log('Right-Dev extension is now deactivated!');
    
    if (startDevCommand) {
        startDevCommand.dispose();
    }
    
    if (statusBarProvider) {
        statusBarProvider.dispose();
    }
}