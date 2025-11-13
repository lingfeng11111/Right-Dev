import * as vscode from 'vscode';
import open from 'open';

export class BrowserService {
    private readonly defaultBrowser = 'default';
    
    public async openBrowser(port: number, path: string = ''): Promise<void> {
        try {
            const url = `http://localhost:${port}${path}`;
            const browser = this.getConfiguredBrowser();
            
            const options: any = {
                wait: false
            };
            
            if (browser !== 'default') {
                options.app = { name: browser };
            }
            
            await open(url, options);

            console.log(`已打开浏览器: ${url}`);
            
        } catch (error) {
            console.error('打开浏览器失败:', error);
            
            // 显示错误提示
            const action = await vscode.window.showErrorMessage(
                `无法自动打开浏览器，是否手动访问 http://localhost:${port}？`,
                '复制链接',
                '手动打开',
                '忽略'
            );

            if (action === '复制链接') {
                await vscode.env.clipboard.writeText(`http://localhost:${port}${path}`);
                vscode.window.showInformationMessage('链接已复制到剪贴板');
            } else if (action === '手动打开') {
                // 显示终端中的链接
                const terminal = vscode.window.createTerminal('Right Dev - URL');
                terminal.sendText(`echo "开发服务器地址: http://localhost:${port}${path}"`);
                terminal.show();
            }
        }
    }

    public async openUrl(url: string): Promise<void> {
        try {
            const browser = this.getConfiguredBrowser();
            
            const options: any = {
                wait: false
            };
            
            if (browser !== 'default') {
                options.app = { name: browser };
            }
            
            await open(url, options);
            
        } catch (error) {
            console.error('打开URL失败:', error);
            throw error;
        }
    }

    public async openInSpecificBrowser(url: string, browser: string): Promise<void> {
        try {
            const options: any = {
                app: { name: browser },
                wait: false
            };
            
            await open(url, options);
            
        } catch (error) {
            console.error(`在 ${browser} 中打开URL失败:`, error);
            
            // 尝试使用默认浏览器
            try {
                await this.openUrl(url);
            } catch (defaultError) {
                throw new Error(`无法在任何浏览器中打开URL: ${error}`);
            }
        }
    }

    private getConfiguredBrowser(): string {
        const config = vscode.workspace.getConfiguration('right-dev');
        return config.get('browser', this.defaultBrowser);
    }

    public getAvailableBrowsers(): string[] {
        return [
            'default',
            'chrome',
            'firefox',
            'edge',
            'safari'
        ];
    }

    public async validateBrowser(browser: string): Promise<boolean> {
        if (browser === 'default') {
            return true;
        }

        try {
            // 尝试打开一个测试URL
            const options: any = {
                app: { name: browser },
                wait: false
            };
            
            await open('about:blank', options);
            return true;
        } catch (error) {
            console.error(`浏览器 ${browser} 不可用:`, error);
            return false;
        }
    }

    public async showBrowserSelection(): Promise<string | undefined> {
        const browsers = this.getAvailableBrowsers();
        const currentBrowser = this.getConfiguredBrowser();
        
        const items = browsers.map(browser => ({
            label: browser === 'default' ? '系统默认浏览器' : browser,
            description: browser === currentBrowser ? '当前设置' : '',
            value: browser
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要使用的浏览器',
            title: '浏览器设置'
        });

        return selected?.value;
    }

    public async saveBrowserPreference(browser: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('right-dev');
        await config.update('browser', browser, vscode.ConfigurationTarget.Global);
    }

    public async openDevTools(port: number): Promise<void> {
        const devToolsUrl = `http://localhost:${port}`;
        
        try {
            await this.openUrl(devToolsUrl);
        } catch (error) {
            console.error('打开开发者工具失败:', error);
            
            const action = await vscode.window.showErrorMessage(
                '无法打开开发者工具，是否手动访问？',
                '复制链接',
                '忽略'
            );

            if (action === '复制链接') {
                await vscode.env.clipboard.writeText(devToolsUrl);
                vscode.window.showInformationMessage('开发者工具链接已复制');
            }
        }
    }

    public async openMultipleUrls(urls: string[]): Promise<void> {
        for (const url of urls) {
            try {
                await this.openUrl(url);
                // 稍微延迟，避免同时打开太多标签页
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`打开URL失败: ${url}`, error);
            }
        }
    }

    public isValidUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    public formatUrl(port: number, path: string = '', protocol: string = 'http'): string {
        return `${protocol}://localhost:${port}${path}`;
    }
}