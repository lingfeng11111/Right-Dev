import * as vscode from 'vscode';
import detectPort from 'detect-port';
import { ProjectInfo } from '../detectors/projectDetector';

export class PortDetector {
    private readonly defaultTimeout = 5000; // 5秒，减少等待时间
    private readonly portPattern = /localhost:(\d+)|127\.0\.0\.1:(\d+)|:(\d+)(?=\s|$)|port\s+(\d+)/gi;

    public async waitForPort(
        terminal: vscode.Terminal,
        preferredPort?: number,
        timeout: number = this.defaultTimeout
    ): Promise<number | null> {
        try {
            // 并行执行多种端口检测方法，提高速度
            const [portFromOutput, availablePort, commonPort] = await Promise.all([
                this.detectPortFromTerminal(terminal, timeout),
                this.findAvailablePort(preferredPort),
                this.scanCommonPorts()
            ]);

            // 按优先级返回第一个可用的端口
            return portFromOutput || availablePort || commonPort || null;
        } catch (error) {
            console.error('端口检测失败:', error);
            return null;
        }
    }

    private async detectPortFromTerminal(
        terminal: vscode.Terminal,
        timeout: number
    ): Promise<number | null> {
        // 由于VSCode API限制，我们使用简化的方法
        // 在实际实现中，我们会通过其他方式检测端口
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(null);
            }, Math.min(timeout, 2000)); // 最多等待2秒
        });
    }

    private extractPortFromOutput(output: string): number | null {
        const matches = output.match(this.portPattern);
        if (!matches) {
            return null;
        }

        for (const match of matches) {
            // 提取端口号
            const portMatch = match.match(/(\d{4,5})/);
            if (portMatch) {
                const port = parseInt(portMatch[1], 10);
                if (this.isValidPort(port)) {
                    return port;
                }
            }
        }

        return null;
    }

    private async findAvailablePort(preferredPort?: number): Promise<number | null> {
        try {
            // 如果指定了首选端口，先尝试该端口
            if (preferredPort) {
                const availablePort = await detectPort(preferredPort);
                if (availablePort === preferredPort) {
                    return preferredPort;
                }
            }

            // 并行检测常用端口，提高速度
            const commonPorts = [3000, 5173, 8000, 8080, 8001, 8002, 8003, 8004, 8005];
            
            const portPromises = commonPorts.map(async (port) => {
                try {
                    const availablePort = await detectPort(port);
                    return availablePort === port ? port : null;
                } catch {
                    return null;
                }
            });

            const results = await Promise.all(portPromises);
            const availablePort = results.find(port => port !== null);
            
            if (availablePort) {
                return availablePort;
            }

            // 随机选择一个端口
            const randomPort = Math.floor(Math.random() * 1000) + 4000;
            return await detectPort(randomPort);

        } catch (error) {
            console.error('检测可用端口失败:', error);
            return null;
        }
    }

    private async scanCommonPorts(): Promise<number | null> {
        const commonPorts = [
            3000, 3001, 3002, 3003, 3004, 3005, // React/Vite 常用端口
            5173, 5174, 5175, // Vite 默认端口
            8000, 8001, 8002, 8003, 8004, 8005, // PHP/Laravel 常用端口
            8080, 8081, 8082, 8083, 8084, 8085, // 通用端口
            9000, 9001, 9002, 9003, 9004, 9005  // 其他端口
        ];

        // 并行扫描常用端口，提高速度
        const portPromises = commonPorts.map(async (port) => {
            try {
                const availablePort = await detectPort(port);
                return availablePort === port ? port : null;
            } catch {
                return null;
            }
        });

        const results = await Promise.all(portPromises);
        return results.find(port => port !== null) || null;

        return null;
    }

    private isValidPort(port: number): boolean {
        return port >= 1024 && port <= 65535;
    }

    public async isPortAvailable(port: number): Promise<boolean> {
        try {
            const availablePort = await detectPort(port);
            return availablePort === port;
        } catch (error) {
            return false;
        }
    }

    public async waitForPortToBeReady(
        port: number,
        timeout: number = 5000,
        checkInterval: number = 200  // 减少检查间隔到200ms
    ): Promise<boolean> {
        return new Promise((resolve) => {
            let elapsed = 0;
            
            const checkIntervalId = setInterval(async () => {
                elapsed += checkInterval;
                
                if (elapsed >= timeout) {
                    clearInterval(checkIntervalId);
                    resolve(false);
                    return;
                }

                try {
                    const isAvailable = await this.isPortAvailable(port);
                    if (!isAvailable) {
                        // 端口被占用，说明服务可能已经启动
                        clearInterval(checkIntervalId);
                        resolve(true);
                    }
                } catch (error) {
                    // 检查出错，可能是服务已经启动
                    clearInterval(checkIntervalId);
                    resolve(true);
                }
            }, checkInterval);
        });
    }

    public async findAlternativePort(
        originalPort: number,
        maxAttempts: number = 10
    ): Promise<number | null> {
        for (let i = 1; i <= maxAttempts; i++) {
            const alternativePort = originalPort + i;
            if (await this.isPortAvailable(alternativePort)) {
                return alternativePort;
            }
        }
        return null;
    }
}