# Right-Dev VSCode Extension

![Right-Dev Icon](Right-dev.png)

Right-Dev is a VSCode extension that enables one-click development server startup and browser opening. Simply right-click on any project folder to automatically start the development server and open your project in the browser.

## Features

### Core Functionality
- **Smart Project Detection**: Automatically identifies project types by scanning up to 5 directory levels (Vite, Create React App, Next.js, Vue CLI, Laravel, Symfony, plain PHP)
- **Auto Dependency Installation**: Detects and automatically installs missing dependencies
- **Automatic Server Startup**: Uses VSCode terminal to run development servers in the background
- **Port Detection**: Intelligently detects service ports with 10-second timeout and retry mechanism
- **Browser Auto-Open**: Automatically opens browser when service becomes available

### Supported Project Types
- **Frontend Frameworks**: Vite, Create React App, Next.js, Vue CLI, Webpack, Parcel
- **PHP Frameworks**: Laravel, Symfony
- **Plain PHP**: Projects containing index.php

### Configuration Options
- **Project Structure Support**: Compatible with source/configuration separation
- **Status Bar Integration**: Real-time service status display with stop/restart capabilities
- **Custom Configuration**: Support for `.openlocalhost.json` configuration files
- **Extension Settings**: Auto-install, port range, custom scripts

## Usage

### Installation
Install from VSCode Extension Marketplace by searching for "Right-Dev"

### Basic Usage
1. Right-click on a project folder in the Explorer
2. Select **"Start Dev & Open"**
3. Wait for status bar to show running status (e.g., "Vite @5173")
4. Browser automatically opens with your project

### Extension Settings
Search for `right-dev` in VSCode settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `autoInstall` | `true` | Auto-install missing dependencies |
| `portRange` | `"3000-3999"` | Port range configuration |
| `customScript` | `""` | Custom startup script |
| `timeout` | `10000` | Service startup timeout (ms) |
| `autoOpenBrowser` | `true` | Auto-open browser |
| `browser` | `"default"` | Specify browser (chrome/firefox/edge/safari) |

### Project Configuration
Create `.openlocalhost.json` in project root:

```json
{
  "projectType": "vite",
  "customScript": "npm run dev -- --port=0",
  "port": 3000,
  "autoInstall": true,
  "sourcePath": "./src",
  "documentRoot": "./dist",
  "browser": "chrome",
  "timeout": 10000
}
```

## Project Type Detection

The extension automatically detects projects by characteristic files:

| Project Type | Characteristic Files | Default Command |
|--------------|---------------------|-----------------|
| Vite | `vite.config.*` | `npm run dev -- --port=0` |
| Create React App | `package.json` + `react-scripts` | `npm start -- --port=0` |
| Next.js | `next.config.*` | `npm run dev -- --port=0` |
| Vue CLI | `vue.config.js` | `npm run serve -- --port=0` |
| Laravel | `artisan` + `composer.json` | `php artisan serve --port=0` |
| Symfony | `symfony.lock` + `composer.json` | `symfony server:start --port=0` |
| Plain PHP | `index.php` | `php -S localhost:0` |

## Commands

Access via Command Palette (`Ctrl+Shift+P`):
- `Right Dev: Start Dev & Open` - Start development server
- `Right Dev: Stop Dev Server` - Stop development server  
- `Right Dev: Restart Dev Server` - Restart development server

## Right-Click Menu

Available in:
- **Explorer**: Right-click on folders
- **Editor**: Right-click on JavaScript/TypeScript/PHP files

## Repository

[https://github.com/lingfeng11111/Right-Dev](https://github.com/lingfeng11111/Right-Dev)

## License

MIT License - see [LICENSE](LICENSE) file for details

---

# Right-Dev VSCode 扩展

Right-Dev 是一个VSCode扩展，实现一键启动开发服务器并打开浏览器的功能。只需右键点击项目文件夹即可自动启动开发服务器并在浏览器中打开项目。

## 功能特性

### 核心功能
- **智能项目检测**：自动扫描最多5层目录，识别项目类型（Vite、Create React App、Next.js、Vue CLI、Laravel、Symfony、纯PHP）
- **自动依赖安装**：检测并自动安装缺失的依赖包
- **自动服务启动**：使用VSCode终端在后台运行对应的开发服务器
- **端口检测**：智能检测服务端口号，10秒超时自动重试机制
- **自动打开浏览器**：服务可用时自动打开浏览器

### 支持的项目类型
- **前端框架**：Vite、Create React App、Next.js、Vue CLI、Webpack、Parcel
- **PHP框架**：Laravel、Symfony
- **纯PHP**：包含index.php的项目

### 配置选项
- **项目结构支持**：兼容源码与配置分离的项目结构
- **状态栏集成**：实时显示服务状态，支持停止和重启
- **自定义配置**：支持`.openlocalhost.json`配置文件
- **扩展设置**：自动安装、端口范围、自定义脚本等

## 使用方法

### 安装
在VSCode扩展市场中搜索"Right-Dev"并安装

### 基本使用
1. 在资源管理器中右键点击项目文件夹
2. 选择**"Start Dev & Open"**
3. 等待状态栏显示运行状态（如"Vite @5173"）
4. 浏览器自动打开项目

### 扩展设置
在VSCode设置中搜索`right-dev`：

| 设置项 | 默认值 | 说明 |
|---------|---------|-------------|
| `autoInstall` | `true` | 自动安装缺失的依赖包 |
| `portRange` | `"3000-3999"` | 端口范围配置 |
| `customScript` | `""` | 自定义启动脚本 |
| `timeout` | `10000` | 服务启动超时时间（毫秒） |
| `autoOpenBrowser` | `true` | 自动打开浏览器 |
| `browser` | `"default"` | 指定浏览器（chrome/firefox/edge/safari） |

### 项目配置
在项目根目录创建`.openlocalhost.json`：

```json
{
  "projectType": "vite",
  "customScript": "npm run dev -- --port=0",
  "port": 3000,
  "autoInstall": true,
  "sourcePath": "./src",
  "documentRoot": "./dist",
  "browser": "chrome",
  "timeout": 10000
}
```

## 项目类型检测

扩展通过特征文件自动检测项目：

| 项目类型 | 特征文件 | 默认命令 |
|--------------|---------------------|-----------------|
| Vite | `vite.config.*` | `npm run dev -- --port=0` |
| Create React App | `package.json` + `react-scripts` | `npm start -- --port=0` |
| Next.js | `next.config.*` | `npm run dev -- --port=0` |
| Vue CLI | `vue.config.js` | `npm run serve -- --port=0` |
| Laravel | `artisan` + `composer.json` | `php artisan serve --port=0` |
| Symfony | `symfony.lock` + `composer.json` | `symfony server:start --port=0` |
| 纯PHP | `index.php` | `php -S localhost:0` |

## 命令

通过命令面板（`Ctrl+Shift+P`）访问：
- `Right Dev: Start Dev & Open` - 启动开发服务器
- `Right Dev: Stop Dev Server` - 停止开发服务器  
- `Right Dev: Restart Dev Server` - 重启开发服务器

## 右键菜单

可在以下位置使用：
- **资源管理器**：右键点击文件夹
- **编辑器**：右键点击JavaScript/TypeScript/PHP文件

## 代码仓库

[https://github.com/lingfeng11111/Right-Dev](https://github.com/lingfeng11111/Right-Dev)

## 许可证

MIT许可证 - 详见[LICENSE](LICENSE)文件