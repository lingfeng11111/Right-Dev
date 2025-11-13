import * as vscode from 'vscode';

export enum DevServerStatus {
    Idle = 'idle',
    Detecting = 'detecting',
    Installing = 'installing',
    Starting = 'starting',
    Running = 'running',
    Error = 'error',
    Stopped = 'stopped'
}

export class StatusBarProvider implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private currentStatus: DevServerStatus = DevServerStatus.Idle;
    private currentPort: number | null = null;
    private currentProjectType: string = '';

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'right-dev.showMenu';
        this.updateStatus(DevServerStatus.Idle);
        this.statusBarItem.show();
    }

    public updateStatus(status: DevServerStatus, port?: number, projectType?: string): void {
        this.currentStatus = status;
        if (port !== undefined) {
            this.currentPort = port;
        }
        if (projectType) {
            this.currentProjectType = projectType;
        }

        this.updateStatusBarText();
    }

    private updateStatusBarText(): void {
        let text = '';
        let tooltip = '';
        let backgroundColor: vscode.ThemeColor | undefined;

        switch (this.currentStatus) {
            case DevServerStatus.Idle:
                text = '$(play) Right Dev';
                tooltip = '点击启动开发服务器';
                break;
            
            case DevServerStatus.Detecting:
                text = '$(sync~spin) 检测项目类型...';
                tooltip = '正在检测项目类型';
                break;
            
            case DevServerStatus.Installing:
                text = '$(sync~spin) 安装依赖...';
                tooltip = '正在安装项目依赖';
                break;
            
            case DevServerStatus.Starting:
                text = '$(sync~spin) 启动服务...';
                tooltip = '正在启动开发服务器';
                break;
            
            case DevServerStatus.Running:
                const portText = this.currentPort ? ` @${this.currentPort}` : '';
                const projectText = this.currentProjectType ? ` ${this.currentProjectType}` : '';
                text = `$(play-circle)${projectText}${portText}`;
                tooltip = `开发服务器运行中${portText}\n点击显示菜单`;
                backgroundColor = undefined; // 使用默认颜色
                break;
            
            case DevServerStatus.Error:
                text = '$(error) 启动失败';
                tooltip = '开发服务器启动失败，点击查看详情';
                backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            
            case DevServerStatus.Stopped:
                text = '$(stop) 已停止';
                tooltip = '开发服务器已停止';
                break;
        }

        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = tooltip;
        if (backgroundColor) {
            this.statusBarItem.backgroundColor = backgroundColor;
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    public show(): void {
        this.statusBarItem.show();
    }

    public hide(): void {
        this.statusBarItem.hide();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }

    public getStatus(): DevServerStatus {
        return this.currentStatus;
    }

    public isRunning(): boolean {
        return this.currentStatus === DevServerStatus.Running;
    }
}