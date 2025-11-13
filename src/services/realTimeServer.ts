import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as chokidar from 'chokidar';
import * as mime from 'mime';

/**
 * Real-Time 热重载HTTP服务器
 * 基于Live Server原理实现，支持HTML/JS/CSS等文件的热重载
 */
export class RealTimeServer {
    private server: http.Server | null = null;
    private wss: WebSocket.Server | null = null;
    private clients: Set<WebSocket> = new Set();
    private watcher: chokidar.FSWatcher | null = null;
    private rootPath: string;
    private port: number;
    private entryFile: string;
    private isRunning: boolean = false;

    constructor(rootPath: string, port: number = 5500, entryFile: string = 'index.html') {
        this.rootPath = rootPath;
        this.port = port;
        this.entryFile = entryFile;
    }

    /**
     * 启动实时服务器
     */
    public async start(): Promise<number> {
        if (this.isRunning) {
            throw new Error('Real-time server is already running');
        }

        try {
            // 1. 创建HTTP服务器
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            // 2. 创建WebSocket服务器
            this.wss = new WebSocket.Server({ server: this.server });
            this.wss.on('connection', (ws: WebSocket) => {
                this.clients.add(ws);
                ws.on('close', () => this.clients.delete(ws));
                ws.on('error', (error: Error) => {
                    console.error('WebSocket error:', error);
                    this.clients.delete(ws);
                });
            });

            // 3. 设置文件监听
            this.setupFileWatcher();

            // 4. 启动服务器
            return new Promise((resolve, reject) => {
                this.server!.listen(this.port, (err?: Error) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isRunning = true;
                        const actualPort = (this.server!.address() as any).port;
                        console.log(`Real-time server started on port ${actualPort}`);
                        resolve(actualPort);
                    }
                });
            });

        } catch (error) {
            console.error('Failed to start real-time server:', error);
            throw error;
        }
    }

    /**
     * 处理HTTP请求
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        try {
            let filePath = path.join(this.rootPath, req.url === '/' ? this.entryFile : (req.url || ''));
            
            // 安全检查：确保文件在根目录内
            if (!filePath.startsWith(this.rootPath)) {
                res.writeHead(403, { 'Content-Type': 'text/plain' });
                res.end('Forbidden');
                return;
            }

            // 如果文件不存在，尝试回退到index.html（SPA支持）
            if (!fs.existsSync(filePath)) {
                const fallbackPath = path.join(this.rootPath, 'index.html');
                if (fs.existsSync(fallbackPath)) {
                    filePath = fallbackPath;
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                    return;
                }
            }

            // 读取文件内容
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal server error');
                    return;
                }

                // 注入WebSocket客户端脚本
                if (path.extname(filePath).toLowerCase() === '.html') {
                    const contentType = mime.getType(filePath) || 'text/html';
                    const injectedScript = this.getWebSocketClientScript();
                    const htmlContent = data.toString().replace('</body>', `${injectedScript}</body>`);
                    
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(htmlContent);
                } else {
                    // 非HTML文件直接返回
                    const contentType = mime.getType(filePath) || 'application/octet-stream';
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                }
            });

        } catch (error) {
            console.error('Request handling error:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
        }
    }

    /**
     * 获取WebSocket客户端脚本
     */
    private getWebSocketClientScript(): string {
        return `
<script>
(function() {
    const ws = new WebSocket('ws://localhost:${this.port}');
    ws.onmessage = function(event) {
        if (event.data === 'reload') {
            location.reload();
        }
    };
    ws.onopen = function() {
        console.log('Real-time reload connected');
    };
    ws.onclose = function() {
        console.log('Real-time reload disconnected');
    };
})();
</script>`;
    }

    /**
     * 设置文件监听器
     */
    private setupFileWatcher(): void {
        this.watcher = chokidar.watch(this.rootPath, {
            ignored: /node_modules|\.git|\.DS_Store/,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });

        this.watcher.on('change', (filePath: string) => {
            console.log(`File changed: ${filePath}`);
            this.broadcastReload();
        });

        this.watcher.on('error', (error: Error) => {
            console.error('File watcher error:', error);
        });
    }

    /**
     * 向所有客户端广播重载指令
     */
    private broadcastReload(): void {
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send('reload');
            }
        });
    }

    /**
     * 停止服务器
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        try {
            // 关闭文件监听器
            if (this.watcher) {
                this.watcher.close();
                this.watcher = null;
            }

            // 关闭WebSocket服务器
            if (this.wss) {
                this.wss.close();
                this.wss = null;
            }

            // 关闭HTTP服务器
            if (this.server) {
                this.server.close();
                this.server = null;
            }

            // 清空客户端集合
            this.clients.clear();

            this.isRunning = false;
            console.log('Real-time server stopped');

        } catch (error) {
            console.error('Error stopping real-time server:', error);
            throw error;
        }
    }

    /**
     * 获取服务器运行状态
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 获取当前端口
     */
    public getPort(): number {
        return this.port;
    }

    /**
     * 获取服务器地址
     */
    public getUrl(): string {
        return `http://localhost:${this.port}`;
    }
}