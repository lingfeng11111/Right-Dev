import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface OpenLocalhostConfig {
    projectType?: string;
    customScript?: string;
    port?: number;
    autoInstall?: boolean;
    sourcePath?: string;
    documentRoot?: string;
    browser?: string;
    timeout?: number;
}

export class ConfigUtils {
    private readonly configFileName = '.openlocalhost.json';

    public async loadConfig(workspacePath: string): Promise<OpenLocalhostConfig | null> {
        // 搜索配置文件的优先级:
        // 1. 项目根目录
        // 2. PHP路径
        // 3. 文档根目录

        const searchPaths = [
            workspacePath,
            path.join(workspacePath, 'public'),
            path.join(workspacePath, 'www'),
            path.join(workspacePath, 'htdocs'),
            path.join(workspacePath, 'web'),
            path.join(workspacePath, 'dist'),
            path.join(workspacePath, 'build')
        ];

        for (const searchPath of searchPaths) {
            const configPath = path.join(searchPath, this.configFileName);
            if (await fs.pathExists(configPath)) {
                try {
                    const config = await fs.readJson(configPath);
                    return this.validateConfig(config);
                } catch (error) {
                    console.error(`读取配置文件失败: ${configPath}`, error);
                    // 继续搜索下一个路径
                }
            }
        }

        return null;
    }

    public async saveConfig(workspacePath: string, config: OpenLocalhostConfig): Promise<void> {
        const configPath = path.join(workspacePath, this.configFileName);
        
        try {
            await fs.writeJson(configPath, config, { spaces: 2 });
        } catch (error) {
            console.error('保存配置文件失败:', error);
            throw new Error(`无法保存配置文件: ${error}`);
        }
    }

    public async createDefaultConfig(workspacePath: string, projectType: string): Promise<OpenLocalhostConfig> {
        const defaultConfig: OpenLocalhostConfig = {
            projectType: projectType,
            autoInstall: true,
            timeout: 10000
        };

        // 根据项目类型添加特定配置
        switch (projectType) {
            case 'vite':
                defaultConfig.port = 5173;
                defaultConfig.customScript = 'npm run dev -- --port=0';
                break;
            case 'cra':
                defaultConfig.port = 3000;
                defaultConfig.customScript = 'npm start -- --port=0';
                break;
            case 'next':
                defaultConfig.port = 3000;
                defaultConfig.customScript = 'npm run dev -- --port=0';
                break;
            case 'vue-cli':
                defaultConfig.port = 8080;
                defaultConfig.customScript = 'npm run serve -- --port=0';
                break;
            case 'laravel':
                defaultConfig.port = 8000;
                defaultConfig.customScript = 'php artisan serve --port=0';
                defaultConfig.documentRoot = 'public';
                break;
            case 'symfony':
                defaultConfig.port = 8000;
                defaultConfig.customScript = 'symfony server:start --port=0';
                defaultConfig.documentRoot = 'public';
                break;
            case 'php':
                defaultConfig.port = 8000;
                defaultConfig.customScript = 'php -S localhost:0';
                break;
        }

        return defaultConfig;
    }

    private validateConfig(config: any): OpenLocalhostConfig {
        const validatedConfig: OpenLocalhostConfig = {};

        if (typeof config.projectType === 'string') {
            validatedConfig.projectType = config.projectType;
        }

        if (typeof config.customScript === 'string') {
            validatedConfig.customScript = config.customScript;
        }

        if (typeof config.port === 'number' && config.port > 0 && config.port < 65536) {
            validatedConfig.port = config.port;
        }

        if (typeof config.autoInstall === 'boolean') {
            validatedConfig.autoInstall = config.autoInstall;
        }

        if (typeof config.sourcePath === 'string') {
            validatedConfig.sourcePath = config.sourcePath;
        }

        if (typeof config.documentRoot === 'string') {
            validatedConfig.documentRoot = config.documentRoot;
        }

        if (typeof config.browser === 'string') {
            validatedConfig.browser = config.browser;
        }

        if (typeof config.timeout === 'number' && config.timeout > 0) {
            validatedConfig.timeout = config.timeout;
        }

        return validatedConfig;
    }

    public getPluginConfig(): OpenLocalhostConfig {
        const config = vscode.workspace.getConfiguration('right-dev');
        
        return {
            autoInstall: config.get('autoInstall', true),
            port: this.parsePortRange(config.get('portRange', '3000-3999')),
            browser: config.get('browser', 'default'),
            timeout: config.get('timeout', 10000),
            customScript: config.get('customScript', '')
        };
    }

    private parsePortRange(portRange: string): number {
        // 解析端口范围，返回范围内的第一个可用端口
        if (portRange.includes('-')) {
            const [start, end] = portRange.split('-').map(p => parseInt(p.trim(), 10));
            if (!isNaN(start) && !isNaN(end)) {
                return start; // 返回范围的起始端口
            }
        } else if (portRange.includes(',')) {
            const ports = portRange.split(',').map(p => parseInt(p.trim(), 10));
            const validPorts = ports.filter(p => !isNaN(p) && p > 0 && p < 65536);
            if (validPorts.length > 0) {
                return validPorts[0]; // 返回列表中的第一个有效端口
            }
        } else {
            const port = parseInt(portRange.trim(), 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
                return port; // 返回单个端口
            }
        }
        
        return 3000; // 默认端口
    }

    public async showConfigEditor(workspacePath: string): Promise<void> {
        const config = await this.loadConfig(workspacePath) || {};
        
        // 创建配置编辑器
        const items = [
            {
                label: '项目类型',
                description: config.projectType || '自动检测',
                key: 'projectType'
            },
            {
                label: '自定义脚本',
                description: config.customScript || '使用默认脚本',
                key: 'customScript'
            },
            {
                label: '端口',
                description: config.port ? config.port.toString() : '自动分配',
                key: 'port'
            },
            {
                label: '自动安装依赖',
                description: config.autoInstall !== false ? '启用' : '禁用',
                key: 'autoInstall'
            },
            {
                label: '源码路径',
                description: config.sourcePath || '项目根目录',
                key: 'sourcePath'
            },
            {
                label: '文档根目录',
                description: config.documentRoot || '项目根目录',
                key: 'documentRoot'
            },
            {
                label: '浏览器',
                description: config.browser || '系统默认',
                key: 'browser'
            },
            {
                label: '超时时间',
                description: config.timeout ? `${config.timeout}ms` : '10s',
                key: 'timeout'
            }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要编辑的配置项',
            title: 'Right Dev 配置编辑器'
        });

        if (selected) {
            await this.editConfigItem(workspacePath, config, selected.key, selected.label);
        }
    }

    private async editConfigItem(
        workspacePath: string,
        config: OpenLocalhostConfig,
        key: string,
        label: string
    ): Promise<void> {
        let newValue: any;

        switch (key) {
            case 'projectType':
                const projectTypes = ['vite', 'cra', 'next', 'vue-cli', 'laravel', 'symfony', 'php'];
                const selected = await vscode.window.showQuickPick(projectTypes, {
                    placeHolder: '选择项目类型'
                });
                newValue = selected;
                break;

            case 'customScript':
                newValue = await vscode.window.showInputBox({
                    prompt: '输入自定义启动脚本',
                    value: config.customScript || '',
                    placeHolder: '例如: npm run dev -- --port=0'
                });
                break;

            case 'port':
                const portInput = await vscode.window.showInputBox({
                    prompt: '输入端口号 (1-65535)',
                    value: config.port ? config.port.toString() : '',
                    placeHolder: '留空表示自动分配',
                    validateInput: (value) => {
                        if (!value) return null;
                        const port = parseInt(value, 10);
                        if (isNaN(port) || port < 1 || port > 65535) {
                            return '请输入有效的端口号 (1-65535)';
                        }
                        return null;
                    }
                });
                newValue = portInput ? parseInt(portInput, 10) : undefined;
                break;

            case 'autoInstall':
                const autoInstall = await vscode.window.showQuickPick(['启用', '禁用'], {
                    placeHolder: '选择是否自动安装依赖'
                });
                newValue = autoInstall === '启用';
                break;

            case 'sourcePath':
                newValue = await vscode.window.showInputBox({
                    prompt: '输入源码路径',
                    value: config.sourcePath || '',
                    placeHolder: '例如: ./src'
                });
                break;

            case 'documentRoot':
                newValue = await vscode.window.showInputBox({
                    prompt: '输入文档根目录',
                    value: config.documentRoot || '',
                    placeHolder: '例如: ./public'
                });
                break;

            case 'browser':
                const browsers = ['default', 'chrome', 'firefox', 'edge', 'safari'];
                const selectedBrowser = await vscode.window.showQuickPick(browsers, {
                    placeHolder: '选择浏览器'
                });
                newValue = selectedBrowser;
                break;

            case 'timeout':
                const timeoutInput = await vscode.window.showInputBox({
                    prompt: '输入超时时间 (毫秒)',
                    value: config.timeout ? config.timeout.toString() : '10000',
                    placeHolder: '例如: 10000',
                    validateInput: (value) => {
                        if (!value) return null;
                        const timeout = parseInt(value, 10);
                        if (isNaN(timeout) || timeout < 1000) {
                            return '请输入有效的超时时间 (至少1000ms)';
                        }
                        return null;
                    }
                });
                newValue = timeoutInput ? parseInt(timeoutInput, 10) : undefined;
                break;

            default:
                return;
        }

        if (newValue !== undefined) {
            config[key as keyof OpenLocalhostConfig] = newValue;
            await this.saveConfig(workspacePath, config);
            vscode.window.showInformationMessage(`配置已更新: ${label}`);
        }
    }
}