import * as path from 'path';
import * as fs from 'fs-extra';

export class PathUtils {
    /**
     * 处理包含特殊字符的路径
     * 对路径进行编码/解码以确保兼容性
     */
    public static encodeSpecialPath(filePath: string): string {
        // 对路径中的特殊字符进行编码处理
        return filePath
            .replace(/ /g, '%20')  // 空格
            .replace(/\(/g, '%28') // 左括号
            .replace(/\)/g, '%29') // 右括号
            .replace(/\+/g, '%2B') // 加号
            .replace(/\#/g, '%23') // 井号
            .replace(/\$/g, '%24') // 美元符号
            .replace(/\&/g, '%26') // &符号
            .replace(/\'/g, '%27') // 单引号
            .replace(/\;/g, '%3B') // 分号
            .replace(/\=/g, '%3D') // 等号
            .replace(/\?/g, '%3F') // 问号
            .replace(/\@/g, '%40') // @符号
            .replace(/\[/g, '%5B') // 左方括号
            .replace(/\]/g, '%5D') // 右方括号
            .replace(/\{/g, '%7B') // 左花括号
            .replace(/\}/g, '%7D') // 右花括号
            .replace(/\|/g, '%7C') // 竖线
            .replace(/\\/g, '%5C') // 反斜杠
            .replace(/\^/g, '%5E') // 脱字符
            .replace(/\~/g, '%7E') // 波浪号
            .replace(/\`/g, '%60'); // 反引号
    }

    /**
     * 解码特殊字符路径
     */
    public static decodeSpecialPath(encodedPath: string): string {
        try {
            return decodeURIComponent(encodedPath);
        } catch (error) {
            console.error('解码路径失败:', error);
            return encodedPath;
        }
    }

    /**
     * 安全地处理文件系统路径
     * 确保路径在各种操作系统和环境中都能正常工作
     */
    public static normalizeFilePath(filePath: string): string {
        // 首先标准化路径
        let normalizedPath = path.normalize(filePath);
        
        // 确保使用正确的路径分隔符
        if (process.platform === 'win32') {
            normalizedPath = normalizedPath.replace(/\//g, '\\');
        } else {
            normalizedPath = normalizedPath.replace(/\\/g, '/');
        }
        
        return normalizedPath;
    }

    /**
     * 检查路径是否包含特殊字符
     */
    public static hasSpecialCharacters(filePath: string): boolean {
        const specialChars = /[ \(\)\+\#\$\&\'\;\=\?\@\[\]\{\}\|\\\/\^\~\`]/;
        return specialChars.test(filePath);
    }

    /**
     * 为终端命令转义路径
     * 确保包含特殊字符的路径在终端命令中能正确执行
     */
    public static escapePathForTerminal(filePath: string): string {
        // 如果路径包含空格或特殊字符，需要用引号包裹
        if (this.hasSpecialCharacters(filePath)) {
            // 根据操作系统选择合适的引号
            if (process.platform === 'win32') {
                // Windows 使用双引号
                return `"${filePath}"`;
            } else {
                // Unix-like 系统使用单引号更安全
                return `'${filePath}'`;
            }
        }
        
        return filePath;
    }

    /**
     * 为URL转义路径
     * 用于浏览器打开等场景
     */
    public static escapePathForUrl(filePath: string): string {
        // 将文件路径转换为URL友好的格式
        return encodeURIComponent(filePath).replace(/%2F/g, '/');
    }

    /**
     * 安全地创建目录
     * 处理包含特殊字符的目录路径
     */
    public static async ensureDirectoryExists(dirPath: string): Promise<boolean> {
        try {
            await fs.ensureDir(dirPath);
            return true;
        } catch (error) {
            console.error(`创建目录失败: ${dirPath}`, error);
            return false;
        }
    }

    /**
     * 安全地检查文件是否存在
     * 处理包含特殊字符的文件路径
     */
    public static async safePathExists(filePath: string): Promise<boolean> {
        try {
            return await fs.pathExists(filePath);
        } catch (error) {
            console.error(`检查路径存在性失败: ${filePath}`, error);
            return false;
        }
    }

    /**
     * 安全地读取文件
     * 处理包含特殊字符的文件路径
     */
    public static async safeReadFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string | null> {
        try {
            return await fs.readFile(filePath, encoding);
        } catch (error) {
            console.error(`读取文件失败: ${filePath}`, error);
            return null;
        }
    }

    /**
     * 安全地读取JSON文件
     * 处理包含特殊字符的文件路径
     */
    public static async safeReadJsonFile<T = any>(filePath: string): Promise<T | null> {
        try {
            return await fs.readJson(filePath);
        } catch (error) {
            console.error(`读取JSON文件失败: ${filePath}`, error);
            return null;
        }
    }

    /**
     * 获取路径的详细信息
     * 用于调试和日志记录
     */
    public static getPathInfo(filePath: string): {
        original: string;
        normalized: string;
        hasSpecialChars: boolean;
        escapedForTerminal: string;
        escapedForUrl: string;
        directory: string;
        basename: string;
        extname: string;
    } {
        return {
            original: filePath,
            normalized: this.normalizeFilePath(filePath),
            hasSpecialChars: this.hasSpecialCharacters(filePath),
            escapedForTerminal: this.escapePathForTerminal(filePath),
            escapedForUrl: this.escapePathForUrl(filePath),
            directory: path.dirname(filePath),
            basename: path.basename(filePath),
            extname: path.extname(filePath)
        };
    }

    /**
     * 测试路径处理功能
     * 用于验证路径处理是否正确
     */
    public static testPathHandling(): void {
        const testPaths = [
            '/Users/lingfeng/Desktop/Program/Full-Stack Projects/智云梯(vue+three.js + TensorFlow.js+java+python)',
            '/normal/path/without/special/chars',
            '/path with spaces/file.txt',
            '/path(with)parentheses/file.js',
            '/path[with]brackets/file.ts',
            '/path{with}braces/file.php',
            '/path+with+plus/file.vue',
            '/path#with#hash/file.jsx',
            '/path$with$dollar/file.tsx',
            '/path&with&ampersand/file.html',
            '/path\'with\'quotes/file.css',
            '/path;with;semicolon/file.scss',
            '/path=with=equals/file.less',
            '/path?with?question/file.json',
            '/path@with@at/file.xml',
            '/path\\with\\backslash/file.yaml',
            '/path|with|pipe/file.yml',
            '/path^with^caret/file.md',
            '/path~with~tilde/file.txt',
            '/path`with`backtick/file.log'
        ];

        console.log('=== 路径处理测试 ===');
        testPaths.forEach(testPath => {
            const info = this.getPathInfo(testPath);
            console.log(`原始路径: ${testPath}`);
            console.log(`标准化: ${info.normalized}`);
            console.log(`特殊字符: ${info.hasSpecialChars}`);
            console.log(`终端转义: ${info.escapedForTerminal}`);
            console.log(`URL转义: ${info.escapedForUrl}`);
            console.log('---');
        });
    }
}
