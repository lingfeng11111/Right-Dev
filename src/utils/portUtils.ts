import * as net from 'net';
import detectPort from 'detect-port';

export class PortUtils {
    private static readonly MIN_PORT = 1024;
    private static readonly MAX_PORT = 65535;

    /**
     * 检查端口是否被占用
     */
    public static async isPortInUse(port: number, host: string = 'localhost'): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.once('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            
            server.once('listening', () => {
                server.close();
                resolve(false);
            });
            
            server.listen(port, host);
        });
    }

    /**
     * 查找可用端口
     */
    public static async findAvailablePort(
        preferredPort?: number,
        host: string = 'localhost'
    ): Promise<number> {
        // 如果指定了首选端口，先尝试该端口
        if (preferredPort) {
            const isInUse = await this.isPortInUse(preferredPort, host);
            if (!isInUse) {
                return preferredPort;
            }
        }

        // 使用 detect-port 库查找可用端口
        try {
            const availablePort = await detectPort(preferredPort || this.MIN_PORT);
            return availablePort;
        } catch (error) {
            console.error('查找可用端口失败:', error);
            // 如果 detect-port 失败，手动扫描端口
            return await this.scanForAvailablePort(preferredPort);
        }
    }

    /**
     * 扫描查找可用端口
     */
    private static async scanForAvailablePort(preferredPort?: number): Promise<number> {
        const startPort = preferredPort || this.MIN_PORT;
        const maxScanPorts = 100; // 最多扫描100个端口

        for (let port = startPort; port < startPort + maxScanPorts && port <= this.MAX_PORT; port++) {
            const isInUse = await this.isPortInUse(port);
            if (!isInUse) {
                return port;
            }
        }

        // 如果都没找到，随机选择一个端口
        const randomPort = Math.floor(Math.random() * (this.MAX_PORT - this.MIN_PORT)) + this.MIN_PORT;
        return randomPort;
    }

    /**
     * 获取常用端口列表
     */
    public static getCommonPorts(): number[] {
        return [
            3000, 3001, 3002, 3003, 3004, 3005, // React/Vite/Next.js
            5173, 5174, 5175, // Vite
            8080, 8081, 8082, 8083, 8084, 8085, // Vue CLI/通用
            8000, 8001, 8002, 8003, 8004, 8005, // PHP/Laravel/Symfony
            9000, 9001, 9002, 9003, 9004, 9005, // 其他
            4000, 4001, 4002, 4003, 4004, 4005, // 其他
            5000, 5001, 5002, 5003, 5004, 5005  // 其他
        ];
    }

    /**
     * 从常用端口中查找可用端口
     */
    public static async findAvailablePortFromCommon(): Promise<number> {
        const commonPorts = this.getCommonPorts();
        
        for (const port of commonPorts) {
            const isInUse = await this.isPortInUse(port);
            if (!isInUse) {
                return port;
            }
        }

        // 如果常用端口都不可用，随机查找
        return await this.findAvailablePort();
    }

    /**
     * 验证端口号是否有效
     */
    public static isValidPort(port: number): boolean {
        return Number.isInteger(port) && port >= this.MIN_PORT && port <= this.MAX_PORT;
    }

    /**
     * 等待端口就绪
     */
    public static async waitForPort(
        port: number,
        timeout: number = 10000,
        checkInterval: number = 500
    ): Promise<boolean> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const isInUse = await this.isPortInUse(port);
            if (isInUse) {
                return true;
            }
            
            await this.sleep(checkInterval);
        }
        
        return false;
    }

    /**
     * 等待端口释放
     */
    public static async waitForPortRelease(
        port: number,
        timeout: number = 10000,
        checkInterval: number = 500
    ): Promise<boolean> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const isInUse = await this.isPortInUse(port);
            if (!isInUse) {
                return true;
            }
            
            await this.sleep(checkInterval);
        }
        
        return false;
    }

    /**
     * 获取端口范围
     */
    public static parsePortRange(range: string): number[] {
        const ports: number[] = [];
        
        // 处理范围格式: "3000-3010"
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(p => parseInt(p.trim(), 10));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let port = start; port <= end; port++) {
                    if (this.isValidPort(port)) {
                        ports.push(port);
                    }
                }
            }
        }
        // 处理列表格式: "3000,3001,3002"
        else if (range.includes(',')) {
            const portNumbers = range.split(',').map(p => parseInt(p.trim(), 10));
            for (const port of portNumbers) {
                if (!isNaN(port) && this.isValidPort(port)) {
                    ports.push(port);
                }
            }
        }
        // 处理单个端口
        else {
            const port = parseInt(range.trim(), 10);
            if (!isNaN(port) && this.isValidPort(port)) {
                ports.push(port);
            }
        }
        
        return ports;
    }

    /**
     * 从端口范围中查找可用端口
     */
    public static async findAvailablePortInRange(range: string): Promise<number | null> {
        const ports = this.parsePortRange(range);
        
        for (const port of ports) {
            const isInUse = await this.isPortInUse(port);
            if (!isInUse) {
                return port;
            }
        }
        
        return null;
    }

    /**
     * 获取本地IP地址
     */
    public static getLocalIPAddress(): string {
        const interfaces = require('os').networkInterfaces();
        
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        
        return 'localhost';
    }

    /**
     * 延迟函数
     */
    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 生成随机端口
     */
    public static generateRandomPort(): number {
        return Math.floor(Math.random() * (this.MAX_PORT - this.MIN_PORT)) + this.MIN_PORT;
    }

    /**
     * 获取下一个可用端口
     */
    public static async getNextAvailablePort(
        currentPort: number,
        maxAttempts: number = 100
    ): Promise<number | null> {
        for (let i = 1; i <= maxAttempts; i++) {
            const nextPort = currentPort + i;
            if (nextPort > this.MAX_PORT) {
                break;
            }
            
            const isInUse = await this.isPortInUse(nextPort);
            if (!isInUse) {
                return nextPort;
            }
        }
        
        return null;
    }

    /**
     * 获取上一个可用端口
     */
    public static async getPreviousAvailablePort(
        currentPort: number,
        maxAttempts: number = 100
    ): Promise<number | null> {
        for (let i = 1; i <= maxAttempts; i++) {
            const prevPort = currentPort - i;
            if (prevPort < this.MIN_PORT) {
                break;
            }
            
            const isInUse = await this.isPortInUse(prevPort);
            if (!isInUse) {
                return prevPort;
            }
        }
        
        return null;
    }

    /**
     * 批量检查端口
     */
    public static async checkPorts(ports: number[]): Promise<{ available: number[]; inUse: number[] }> {
        const results = await Promise.all(
            ports.map(async port => ({
                port,
                inUse: await this.isPortInUse(port)
            }))
        );
        
        return {
            available: results.filter(r => !r.inUse).map(r => r.port),
            inUse: results.filter(r => r.inUse).map(r => r.port)
        };
    }

    /**
     * 获取系统端口信息
     */
    public static async getPortInfo(port: number): Promise<{
        port: number;
        inUse: boolean;
        service?: string;
        processId?: number;
    }> {
        const isInUse = await this.isPortInUse(port);
        
        const info: any = {
            port: port,
            inUse: isInUse
        };

        // 这里可以扩展获取更详细的端口信息
        // 例如通过执行系统命令获取进程信息等

        return info;
    }
}