import * as fs from 'fs-extra';
import * as path from 'path';

export class FileUtils {
    public static async findFileUpwards(
        startPath: string,
        fileName: string,
        maxDepth: number = 5
    ): Promise<string | null> {
        let currentPath = startPath;
        
        for (let depth = 0; depth < maxDepth; depth++) {
            const filePath = path.join(currentPath, fileName);
            
            if (await fs.pathExists(filePath)) {
                return filePath;
            }
            
            // 移动到父目录
            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) {
                // 已经到达根目录
                break;
            }
            currentPath = parentPath;
        }
        
        return null;
    }

    public static async findFilesInDirectory(
        dirPath: string,
        pattern: RegExp
    ): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const entries = await fs.readdir(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                const stat = await fs.stat(fullPath);
                
                if (stat.isFile() && pattern.test(entry)) {
                    files.push(fullPath);
                } else if (stat.isDirectory()) {
                    // 递归搜索子目录
                    const subFiles = await this.findFilesInDirectory(fullPath, pattern);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.error(`搜索目录失败: ${dirPath}`, error);
        }
        
        return files;
    }

    public static async getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;
        
        try {
            const entries = await fs.readdir(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                const stat = await fs.stat(fullPath);
                
                if (stat.isFile()) {
                    totalSize += stat.size;
                } else if (stat.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                }
            }
        } catch (error) {
            console.error(`计算目录大小失败: ${dirPath}`, error);
        }
        
        return totalSize;
    }

    public static formatFileSize(bytes: number): string {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    public static async isDirectoryEmpty(dirPath: string): Promise<boolean> {
        try {
            const files = await fs.readdir(dirPath);
            return files.length === 0;
        } catch (error) {
            return true; // 如果目录不存在或无法读取，认为它是空的
        }
    }

    public static async ensureDirectoryExists(dirPath: string): Promise<void> {
        await fs.ensureDir(dirPath);
    }

    public static async deleteDirectory(dirPath: string): Promise<void> {
        await fs.remove(dirPath);
    }

    public static async copyDirectory(
        srcPath: string,
        destPath: string,
        options?: {
            overwrite?: boolean;
            filter?: (src: string, dest: string) => boolean;
        }
    ): Promise<void> {
        await fs.copy(srcPath, destPath, options);
    }

    public static async moveFile(
        srcPath: string,
        destPath: string
    ): Promise<void> {
        await fs.move(srcPath, destPath);
    }

    public static async readJsonFile<T = any>(filePath: string): Promise<T | null> {
        try {
            return await fs.readJson(filePath);
        } catch (error) {
            console.error(`读取JSON文件失败: ${filePath}`, error);
            return null;
        }
    }

    public static async writeJsonFile(
        filePath: string,
        data: any,
        options?: {
            spaces?: number;
            encoding?: string;
        }
    ): Promise<void> {
        await fs.writeJson(filePath, data, options);
    }

    public static async watchFile(
        filePath: string,
        onChange: (eventType: string, filename: string | null) => void
    ): Promise<fs.FSWatcher> {
        return fs.watch(filePath, (eventType, filename) => {
            onChange(eventType, filename);
        });
    }

    public static async getFileStats(filePath: string): Promise<fs.Stats | null> {
        try {
            return await fs.stat(filePath);
        } catch (error) {
            return null;
        }
    }

    public static async isFile(filePath: string): Promise<boolean> {
        const stats = await this.getFileStats(filePath);
        return stats ? stats.isFile() : false;
    }

    public static async isDirectory(filePath: string): Promise<boolean> {
        const stats = await this.getFileStats(filePath);
        return stats ? stats.isDirectory() : false;
    }

    public static async getFileExtension(filePath: string): Promise<string> {
        return path.extname(filePath).toLowerCase();
    }

    public static async getFileName(filePath: string): Promise<string> {
        return path.basename(filePath);
    }

    public static async getFileNameWithoutExtension(filePath: string): Promise<string> {
        return path.basename(filePath, path.extname(filePath));
    }

    public static async getDirectoryName(filePath: string): Promise<string> {
        return path.dirname(filePath);
    }

    public static async joinPath(...paths: string[]): Promise<string> {
        return path.join(...paths);
    }

    public static async resolvePath(...paths: string[]): Promise<string> {
        return path.resolve(...paths);
    }

    public static async getRelativePath(from: string, to: string): Promise<string> {
        return path.relative(from, to);
    }

    public static async isAbsolutePath(filePath: string): Promise<boolean> {
        return path.isAbsolute(filePath);
    }

    public static async normalizePath(filePath: string): Promise<string> {
        return path.normalize(filePath);
    }

    public static async createTempDirectory(prefix?: string): Promise<string> {
        return await fs.mkdtemp(prefix || 'right-dev-');
    }

    public static async createTempFile(options?: {
        prefix?: string;
        suffix?: string;
    }): Promise<string> {
        const tempDir = await this.createTempDirectory(options?.prefix);
        const fileName = `temp${options?.suffix || '.tmp'}`;
        return path.join(tempDir, fileName);
    }

    public static async safeReadFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string | null> {
        try {
            return await fs.readFile(filePath, encoding);
        } catch (error) {
            console.error(`安全读取文件失败: ${filePath}`, error);
            return null;
        }
    }

    public static async safeWriteFile(
        filePath: string,
        data: string | Buffer,
        encoding: BufferEncoding = 'utf8'
    ): Promise<boolean> {
        try {
            await fs.writeFile(filePath, data, encoding);
            return true;
        } catch (error) {
            console.error(`安全写入文件失败: ${filePath}`, error);
            return false;
        }
    }

    public static async appendToFile(
        filePath: string,
        data: string,
        encoding: BufferEncoding = 'utf8'
    ): Promise<void> {
        await fs.appendFile(filePath, data, encoding);
    }

    public static async truncateFile(filePath: string, length: number = 0): Promise<void> {
        await fs.truncate(filePath, length);
    }

    public static async getFileHash(filePath: string): Promise<string | null> {
        try {
            const crypto = require('crypto');
            const data = await fs.readFile(filePath);
            return crypto.createHash('md5').update(data).digest('hex');
        } catch (error) {
            console.error(`计算文件哈希失败: ${filePath}`, error);
            return null;
        }
    }

    public static async compareFiles(file1: string, file2: string): Promise<boolean> {
        const hash1 = await this.getFileHash(file1);
        const hash2 = await this.getFileHash(file2);
        
        if (!hash1 || !hash2) {
            return false;
        }
        
        return hash1 === hash2;
    }

    public static async backupFile(filePath: string, backupDir?: string): Promise<string | null> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = path.basename(filePath);
            const backupPath = backupDir 
                ? path.join(backupDir, `${fileName}.${timestamp}.backup`)
                : `${filePath}.${timestamp}.backup`;
            
            await fs.copy(filePath, backupPath);
            return backupPath;
        } catch (error) {
            console.error(`备份文件失败: ${filePath}`, error);
            return null;
        }
    }

    public static async restoreFile(backupPath: string, originalPath: string): Promise<boolean> {
        try {
            await fs.copy(backupPath, originalPath);
            return true;
        } catch (error) {
            console.error(`恢复文件失败: ${backupPath} -> ${originalPath}`, error);
            return false;
        }
    }
}