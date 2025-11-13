import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectInfo } from '../detectors/projectDetector';
import { PathUtils } from '../utils/pathUtils';

export class DependencyService {
    public async checkDependencies(workspacePath: string, projectInfo: ProjectInfo): Promise<boolean> {
        try {
            // 标准化工作路径，处理特殊字符
            const normalizedWorkspacePath = PathUtils.normalizeFilePath(workspacePath);
            
            // 如果路径包含特殊字符，记录日志
            if (PathUtils.hasSpecialCharacters(workspacePath)) {
                console.log(`依赖服务工作路径包含特殊字符: ${workspacePath}`);
                console.log(`标准化后的路径: ${normalizedWorkspacePath}`);
            }
            
            // 检查 Node.js 项目
            if (this.isNodeProject(projectInfo)) {
                return await this.checkNodeDependencies(normalizedWorkspacePath);
            }
            
            // 检查 PHP 项目
            if (this.isPhpProject(projectInfo)) {
                return await this.checkPhpDependencies(normalizedWorkspacePath, projectInfo);
            }
            
            return false;
        } catch (error) {
            console.error('检查依赖失败:', error);
            return false;
        }
    }

    public async installDependencies(workspacePath: string, projectInfo: ProjectInfo): Promise<boolean> {
        try {
            // 标准化工作路径
            const normalizedWorkspacePath = PathUtils.normalizeFilePath(workspacePath);
            
            // 检查 Node.js 项目
            if (this.isNodeProject(projectInfo)) {
                return await this.installNodeDependencies(normalizedWorkspacePath);
            }
            
            // 检查 PHP 项目
            if (this.isPhpProject(projectInfo)) {
                // 裸PHP项目不需要安装依赖
                if (projectInfo.type === 'php') {
                    return true; // 跳过安装
                }
                return await this.installPhpDependencies(normalizedWorkspacePath);
            }
            
            return true;
        } catch (error) {
            console.error('安装依赖失败:', error);
            return false;
        }
    }

    private isNodeProject(projectInfo: ProjectInfo): boolean {
        const nodeProjectTypes = ['vite', 'cra', 'next', 'vue-cli'];
        return nodeProjectTypes.includes(projectInfo.type);
    }

    private isPhpProject(projectInfo: ProjectInfo): boolean {
        const phpProjectTypes = ['laravel', 'symfony', 'php'];
        return phpProjectTypes.includes(projectInfo.type);
    }

    private async checkNodeDependencies(workspacePath: string): Promise<boolean> {
        const nodeModulesPath = path.join(workspacePath, 'node_modules');
        const packageLockPath = path.join(workspacePath, 'package-lock.json');
        const yarnLockPath = path.join(workspacePath, 'yarn.lock');
        
        // 使用安全的路径检查方法
        // 检查 node_modules 是否存在
        if (!await PathUtils.safePathExists(nodeModulesPath)) {
            return true; // 需要安装
        }
        
        // 检查 lock 文件是否存在
        const hasPackageLock = await PathUtils.safePathExists(packageLockPath);
        const hasYarnLock = await PathUtils.safePathExists(yarnLockPath);
        const hasLockFile = hasPackageLock || hasYarnLock;
        
        if (!hasLockFile) {
            return true; // 没有 lock 文件，可能需要安装
        }
        
        // 检查 node_modules 是否为空
        try {
            const nodeModulesContents = await fs.readdir(nodeModulesPath);
            return nodeModulesContents.length === 0;
        } catch (error) {
            console.error('读取 node_modules 目录失败:', error);
            return true; // 如果无法读取，认为需要安装
        }
    }

    private async checkPhpDependencies(workspacePath: string, projectInfo: ProjectInfo): Promise<boolean> {
        // 裸PHP项目不需要检查Composer依赖
        if (projectInfo.type === 'php') {
            return false; // 不需要安装
        }
        
        const vendorPath = path.join(workspacePath, 'vendor');
        const composerLockPath = path.join(workspacePath, 'composer.lock');
        
        // 使用安全的路径检查方法
        // 检查 vendor 是否存在
        if (!await PathUtils.safePathExists(vendorPath)) {
            return true; // 需要安装
        }
        
        // 检查 composer.lock 是否存在
        if (!await PathUtils.safePathExists(composerLockPath)) {
            return true; // 没有 lock 文件，可能需要安装
        }
        
        // 检查 vendor 是否为空
        try {
            const vendorContents = await fs.readdir(vendorPath);
            return vendorContents.length === 0;
        } catch (error) {
            console.error('读取 vendor 目录失败:', error);
            return true; // 如果无法读取，认为需要安装
        }
    }

    private async installNodeDependencies(workspacePath: string): Promise<boolean> {
        try {
            // 检测包管理器
            const packageManager = await this.detectPackageManager(workspacePath);
            
            let command: string;
            if (packageManager === 'yarn') {
                command = 'yarn install';
            } else {
                command = 'npm install';
            }
            
            // 显示进度通知
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: '正在安装依赖包...',
                cancellable: false
            };
            
            return await vscode.window.withProgress(progressOptions, async () => {
                // 为终端转义工作路径
                const escapedWorkspacePath = PathUtils.escapePathForTerminal(workspacePath);
                
                const terminal = vscode.window.createTerminal({
                    name: 'Right Dev - Install Dependencies',
                    cwd: workspacePath, // VSCode API 接受原始路径，它会内部处理
                    hideFromUser: false
                });
                
                return new Promise<boolean>((resolve) => {
                    const disposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
                        if (closedTerminal === terminal) {
                            disposable.dispose();
                            resolve(true);
                        }
                    });
                    
                    terminal.sendText(command);
                    terminal.sendText('exit');
                });
            });
            
        } catch (error) {
            console.error('安装 Node.js 依赖失败:', error);
            
            const action = await vscode.window.showErrorMessage(
                '依赖安装失败，是否手动安装？',
                '手动安装',
                '重试',
                '取消'
            );
            
            if (action === '手动安装') {
                const terminal = vscode.window.createTerminal({
                    name: 'Right Dev - Manual Install',
                    cwd: workspacePath // VSCode API 接受原始路径
                });
                terminal.show();
            } else if (action === '重试') {
                return await this.installNodeDependencies(workspacePath);
            }
            
            return false;
        }
    }

    private async installPhpDependencies(workspacePath: string): Promise<boolean> {
        try {
            // 显示进度通知
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: '正在安装 Composer 依赖...',
                cancellable: false
            };
            
            return await vscode.window.withProgress(progressOptions, async () => {
                const terminal = vscode.window.createTerminal({
                    name: 'Right Dev - Composer Install',
                    cwd: workspacePath, // VSCode API 接受原始路径
                    hideFromUser: false
                });
                
                return new Promise<boolean>((resolve) => {
                    const disposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
                        if (closedTerminal === terminal) {
                            disposable.dispose();
                            resolve(true);
                        }
                    });
                    
                    terminal.sendText('composer install');
                    terminal.sendText('exit');
                });
            });
            
        } catch (error) {
            console.error('安装 PHP 依赖失败:', error);
            
            const action = await vscode.window.showErrorMessage(
                'Composer 依赖安装失败，是否手动安装？',
                '手动安装',
                '重试',
                '取消'
            );
            
            if (action === '手动安装') {
                const terminal = vscode.window.createTerminal({
                    name: 'Right Dev - Manual Composer Install',
                    cwd: workspacePath // VSCode API 接受原始路径
                });
                terminal.show();
            } else if (action === '重试') {
                return await this.installPhpDependencies(workspacePath);
            }
            
            return false;
        }
    }

    private async detectPackageManager(workspacePath: string): Promise<'npm' | 'yarn'> {
        const yarnLockPath = path.join(workspacePath, 'yarn.lock');
        const packageLockPath = path.join(workspacePath, 'package-lock.json');
        
        // 使用安全的路径检查方法
        const hasYarnLock = await PathUtils.safePathExists(yarnLockPath);
        const hasPackageLock = await PathUtils.safePathExists(packageLockPath);
        
        if (hasYarnLock) {
            return 'yarn';
        } else if (hasPackageLock) {
            return 'npm';
        } else {
            // 默认使用 npm
            return 'npm';
        }
    }
}