import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PathUtils } from '../utils/pathUtils';

export interface ProjectInfo {
    type: string;
    name: string;
    startCommand: string;
    port: number;
    dependencies: string[];
    configFiles: string[];
    entryFile?: string; // 新增：入口文件路径
    directOpen?: boolean; // 新增：直接打开模式标记
    useRealTimeServer?: boolean; // 新增：使用RealTimeServer标记
}

export class ProjectDetector {
    private readonly maxSearchDepth = 5;
    
    // 项目类型定义
    private readonly projectTypes = [
        {
            type: 'vite',
            name: 'Vite',
            configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
            packageJsonIndicators: ['"vite"'],
            startCommand: 'npm run dev -- --port=0',
            defaultPort: 5173,
            dependencies: ['vite']
        },
        {
            type: 'cra',
            name: 'Create React App',
            configFiles: [],
            packageJsonIndicators: ['"react-scripts"'],
            startCommand: 'npm start -- --port=0',
            defaultPort: 3000,
            dependencies: ['react-scripts']
        },
        {
            type: 'next',
            name: 'Next.js',
            configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
            packageJsonIndicators: ['"next"'],
            startCommand: 'npm run dev -- --port=0',
            defaultPort: 3000,
            dependencies: ['next']
        },
        {
            type: 'vue-cli',
            name: 'Vue CLI',
            configFiles: ['vue.config.js'],
            packageJsonIndicators: ['"@vue/cli-service"'],
            startCommand: 'npm run serve -- --port=0',
            defaultPort: 8080,
            dependencies: ['@vue/cli-service']
        },
        {
            type: 'laravel',
            name: 'Laravel',
            configFiles: ['artisan'],
            packageJsonIndicators: [],
            composerJsonIndicators: ['"laravel/framework"'],
            startCommand: 'php artisan serve --port=0',
            defaultPort: 8000,
            dependencies: []
        },
        {
            type: 'symfony',
            name: 'Symfony',
            configFiles: ['symfony.lock', 'bin/console'],
            packageJsonIndicators: [],
            composerJsonIndicators: ['"symfony/framework-bundle"'],
            startCommand: 'symfony server:start --port=0',
            defaultPort: 8000,
            dependencies: []
        },
        {
            type: 'php',
            name: 'PHP',
            configFiles: ['index.php'],
            packageJsonIndicators: [],
            composerJsonIndicators: [],
            startCommand: 'php -S localhost:0',
            defaultPort: 8000,
            dependencies: []
        }
    ];

    public async detectProjectType(workspacePath: string, htmlOpenMode?: string): Promise<ProjectInfo | null> {
        // 标准化路径，处理特殊字符
        const normalizedPath = PathUtils.normalizeFilePath(workspacePath);
        
        // 如果路径包含特殊字符，记录日志用于调试
        if (PathUtils.hasSpecialCharacters(workspacePath)) {
            console.log(`检测到包含特殊字符的路径: ${workspacePath}`);
            console.log(`标准化后的路径: ${normalizedPath}`);
        }
        
        // 首先检查是否是单文件项目（HTML或PHP）
        const singleFileProject = await this.detectSingleFileProject(normalizedPath, htmlOpenMode);
        if (singleFileProject) {
            return singleFileProject;
        }
        
        // 检查是否是目录，如果是文件则获取其所在目录
        let searchPath = normalizedPath;
        const pathStat = await PathUtils.safePathExists(normalizedPath) ? await fs.stat(normalizedPath) : null;
        
        if (pathStat && pathStat.isFile()) {
            // 如果是文件，从文件所在目录开始向上查找
            searchPath = path.dirname(normalizedPath);
            console.log(`从文件所在目录开始查找项目: ${searchPath}`);
        }
        
        // 向上遍历目录，最多5层
        let currentPath = searchPath;
        
        for (let depth = 0; depth < this.maxSearchDepth; depth++) {
            const projectInfo = await this.checkProjectTypeInDirectory(currentPath);
            if (projectInfo) {
                return projectInfo;
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

    private async checkProjectTypeInDirectory(dirPath: string): Promise<ProjectInfo | null> {
        // 使用安全的路径检查方法
        if (!await PathUtils.safePathExists(dirPath)) {
            console.log(`目录不存在: ${dirPath}`);
            return null;
        }
        
        // 检查每个项目类型
        for (const projectType of this.projectTypes) {
            const isMatch = await this.checkProjectTypeMatch(dirPath, projectType);
            if (isMatch) {
                const projectInfo: ProjectInfo = {
                    type: projectType.type,
                    name: projectType.name,
                    startCommand: projectType.startCommand,
                    port: projectType.defaultPort,
                    dependencies: projectType.dependencies,
                    configFiles: projectType.configFiles
                };

                // 如果是裸PHP项目，自动寻找入口文件（仅当没有指定entryFile时）
                if (projectType.type === 'php' && !projectInfo.entryFile) {
                    const entryFile = await this.findPhpEntryFile(dirPath);
                    if (entryFile) {
                        projectInfo.entryFile = entryFile;
                        // 修改启动命令，考虑路径转义
                        const escapedDirPath = PathUtils.escapePathForTerminal(dirPath);
                        const escapedEntryFile = PathUtils.escapePathForTerminal(entryFile);
                        projectInfo.startCommand = `php -S localhost:0 -t ${escapedDirPath} ${escapedEntryFile}`;
                    }
                }

                return projectInfo;
            }
        }
        
        return null;
    }

    private async checkProjectTypeMatch(dirPath: string, projectType: any): Promise<boolean> {
        // 检查配置文件
        if (projectType.configFiles && projectType.configFiles.length > 0) {
            for (const configFile of projectType.configFiles) {
                const configPath = path.join(dirPath, configFile);
                if (await PathUtils.safePathExists(configPath)) {
                    return true;
                }
            }
        }

        // 检查 package.json
        const packageJsonPath = path.join(dirPath, 'package.json');
        if (await PathUtils.safePathExists(packageJsonPath)) {
            try {
                const packageJson = await PathUtils.safeReadJsonFile(packageJsonPath);
                if (!packageJson) {
                    console.log(`无法读取 package.json: ${packageJsonPath}`);
                    return false;
                }
                
                // 检查 package.json 中的依赖
                if (projectType.packageJsonIndicators) {
                    const allDependencies = {
                        ...packageJson.dependencies,
                        ...packageJson.devDependencies
                    };
                    
                    for (const indicator of projectType.packageJsonIndicators) {
                        const packageName = indicator.replace(/"/g, '');
                        if (allDependencies[packageName]) {
                            return true;
                        }
                    }
                }
            } catch (error) {
                console.error('读取 package.json 失败:', error);
            }
        }

        // 检查 composer.json
        const composerJsonPath = path.join(dirPath, 'composer.json');
        if (await PathUtils.safePathExists(composerJsonPath) && projectType.composerJsonIndicators) {
            try {
                const composerJson = await PathUtils.safeReadJsonFile(composerJsonPath);
                if (!composerJson) {
                    console.log(`无法读取 composer.json: ${composerJsonPath}`);
                    return false;
                }
                
                const dependencies = composerJson.require || {};
                
                for (const indicator of projectType.composerJsonIndicators) {
                    const packageName = indicator.replace(/"/g, '');
                    if (dependencies[packageName]) {
                        return true;
                    }
                }
            } catch (error) {
                console.error('读取 composer.json 失败:', error);
            }
        }

        // 特殊处理：如果是裸PHP项目类型，检查是否有任意.php文件
        if (projectType.type === 'php') {
            return await this.hasAnyPhpFile(dirPath);
        }

        return false;
    }

    /**
     * 检查目录下是否有任意.php文件（用于裸PHP项目识别）
     */
    private async hasAnyPhpFile(dirPath: string): Promise<boolean> {
        try {
            // 使用安全的方法检查目录是否存在
            if (!await PathUtils.safePathExists(dirPath)) {
                return false;
            }
            
            const files = await fs.readdir(dirPath);
            return files.some(file => file.endsWith('.php'));
        } catch (error) {
            console.error('读取目录失败:', error);
            return false;
        }
    }

    public async getProjectInfo(workspacePath: string): Promise<ProjectInfo | null> {
        // 标准化路径
        const normalizedPath = PathUtils.normalizeFilePath(workspacePath);
        
        const projectInfo = await this.detectProjectType(normalizedPath);
        if (!projectInfo) {
            return null;
        }

        // 尝试读取更详细的信息
        const packageJsonPath = path.join(normalizedPath, 'package.json');
        if (await PathUtils.safePathExists(packageJsonPath)) {
            try {
                const packageJson = await PathUtils.safeReadJsonFile(packageJsonPath);
                if (packageJson && packageJson.name) {
                    projectInfo.name = packageJson.name;
                }
            } catch (error) {
                console.error('读取项目信息失败:', error);
            }
        }

        return projectInfo;
    }

    /**
     * 寻找PHP入口文件
     * 优先级：index.php > main.php > app.php > 第一个找到的.php文件
     */
    private async findPhpEntryFile(dirPath: string): Promise<string | null> {
        try {
            // 使用安全的方法检查目录
            if (!await PathUtils.safePathExists(dirPath)) {
                return null;
            }
            
            const files = await fs.readdir(dirPath);
            const phpFiles = files.filter(file => file.endsWith('.php'));
            
            if (phpFiles.length === 0) {
                return null;
            }

            // 优先级顺序
            const priorityFiles = ['index.php', 'main.php', 'app.php'];
            
            // 检查优先级文件
            for (const priorityFile of priorityFiles) {
                if (phpFiles.includes(priorityFile)) {
                    return priorityFile;
                }
            }

            // 返回第一个找到的.php文件
            return phpFiles[0];
        } catch (error) {
            console.error('寻找PHP入口文件失败:', error);
            return null;
        }
    }

    /**
     * 检测单文件项目（HTML、PHP等）
     * 支持直接右键单个文件启动服务
     */
    private async detectSingleFileProject(filePath: string, htmlOpenMode?: string): Promise<ProjectInfo | null> {
        try {
            // 检查路径是否存在且是文件
            const pathStat = await fs.stat(filePath);
            if (!pathStat.isFile()) {
                return null;
            }

            const ext = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);

            // HTML文件支持
            if (ext === '.html' || ext === '.htm') {
                const dirPath = path.dirname(filePath);
                
                // 使用用户选择的模式或配置中的默认模式
                const config = vscode.workspace.getConfiguration('right-dev');
                const openMode = htmlOpenMode || config.get<string>('htmlOpenMode', 'server');
                
                if (openMode === 'direct') {
                    // 直接打开模式
                    return {
                        type: 'html-direct',
                        name: `HTML Direct - ${fileName}`,
                        startCommand: `echo "直接打开模式: ${fileName}"`, // 占位命令
                        port: 0, // 不使用端口
                        dependencies: [],
                        configFiles: [],
                        entryFile: fileName,
                        directOpen: true // 标记为直接打开
                    };
                } else {
                    // 服务器模式（默认）- 使用内置RealTimeServer
                    return {
                        type: 'html',
                        name: `HTML - ${fileName}`,
                        startCommand: `real-time-server`, // 特殊标记，由RealTimeServer处理
                        port: 5500, // RealTimeServer默认端口
                        dependencies: [], // 不需要外部依赖
                        configFiles: [],
                        entryFile: fileName,
                        useRealTimeServer: true // 标记使用RealTimeServer
                    };
                }
            }

            // PHP文件支持
            if (ext === '.php') {
                const dirPath = path.dirname(filePath);
                return {
                    type: 'php',
                    name: `PHP - ${fileName}`,
                    startCommand: `php -S localhost:0 -t ${PathUtils.escapePathForTerminal(dirPath)} ${PathUtils.escapePathForTerminal(fileName)}`,
                    port: 8000,
                    dependencies: [],
                    configFiles: [],
                    entryFile: fileName
                };
            }

            // JavaScript文件支持（简单的HTTP服务器）
            if (ext === '.js' && fileName !== 'package.json') {
                const dirPath = path.dirname(filePath);
                return {
                    type: 'js',
                    name: `JavaScript - ${fileName}`,
                    startCommand: `npx http-server ${PathUtils.escapePathForTerminal(dirPath)} -p 0 -o ${PathUtils.escapePathForTerminal(fileName)}`,
                    port: 8080,
                    dependencies: ['http-server'],
                    configFiles: [],
                    entryFile: fileName
                };
            }

            return null;
        } catch (error) {
            console.error('检测单文件项目失败:', error);
            return null;
        }
    }

    /**
     * 智能项目根目录查找
     * 从给定路径开始，先向下查找node_modules等特征文件，然后向上查找项目特征文件
     */
    public async findProjectRoot(startPath: string): Promise<string | null> {
        const normalizedPath = PathUtils.normalizeFilePath(startPath);
        
        // 如果是文件，从文件所在目录开始
        let searchPath = normalizedPath;
        const pathStat = await PathUtils.safePathExists(normalizedPath) ? await fs.stat(normalizedPath).catch(() => null) : null;
        
        if (pathStat && pathStat.isFile()) {
            searchPath = path.dirname(normalizedPath);
        }

        // 首先尝试向下查找 - 查找包含node_modules等特征文件的子目录
        const childProjectRoot = await this.findChildProjectRoot(searchPath);
        if (childProjectRoot) {
            console.log(`找到子项目根目录: ${childProjectRoot}`);
            return childProjectRoot;
        }

        // 向上遍历查找项目根目录
        let currentPath = searchPath;
        
        for (let depth = 0; depth < this.maxSearchDepth; depth++) {
            // 检查当前目录是否有项目特征文件
            const hasProjectFiles = await this.hasProjectCharacteristics(currentPath);
            if (hasProjectFiles) {
                return currentPath;
            }

            // 移动到父目录
            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) {
                break;
            }
            currentPath = parentPath;
        }

        return null;
    }

    /**
     * 向下查找项目根目录
     * 查找包含node_modules、package.json等特征文件的最深层子目录
     */
    private async findChildProjectRoot(dirPath: string): Promise<string | null> {
        try {
            if (!await PathUtils.safePathExists(dirPath)) {
                return null;
            }

            const stat = await fs.stat(dirPath);
            if (!stat.isDirectory()) {
                return null;
            }

            // 获取所有子目录
            const items = await fs.readdir(dirPath);
            const subDirs = items.filter(item => {
                const itemPath = path.join(dirPath, item);
                try {
                    const itemStat = fs.statSync(itemPath);
                    return itemStat.isDirectory() && !item.startsWith('.') && item !== 'node_modules';
                } catch {
                    return false;
                }
            });

            // 递归查找每个子目录
            for (const subDir of subDirs) {
                const subDirPath = path.join(dirPath, subDir);
                
                // 检查当前子目录是否是项目根目录
                if (await this.hasProjectCharacteristics(subDirPath)) {
                    // 继续向下查找，看是否有更深层级的项目
                    const deeperRoot = await this.findChildProjectRoot(subDirPath);
                    return deeperRoot || subDirPath;
                }
                
                // 递归查找更深层的项目
                const deeperRoot = await this.findChildProjectRoot(subDirPath);
                if (deeperRoot) {
                    return deeperRoot;
                }
            }

            return null;
        } catch (error) {
            console.error(`向下查找项目根目录失败: ${error}`);
            return null;
        }
    }

    /**
     * 检查目录是否有项目特征文件
     */
    private async hasProjectCharacteristics(dirPath: string): Promise<boolean> {
        const characteristicFiles = [
            'package.json',
            'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
            'next.config.js', 'next.config.ts', 'next.config.mjs',
            'vue.config.js',
            'artisan',
            'symfony.lock', 'bin/console',
            'composer.json',
            'index.php', 'main.php', 'app.php'
        ];

        for (const file of characteristicFiles) {
            const filePath = path.join(dirPath, file);
            if (await PathUtils.safePathExists(filePath)) {
                return true;
            }
        }

        return false;
    }

    public getSupportedProjectTypes(): string[] {
        return this.projectTypes.map(type => type.type);
    }
}