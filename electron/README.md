# 💻 服务器监控系统 - Windows 桌面客户端

基于 Electron 开发的 Windows 桌面客户端，提供原生桌面体验，支持自动更新和系统托盘运行。

## ✨ 功能特性

- 🖥️ **桌面应用**：独立的 Windows 桌面应用，无需打开浏览器
- 🔄 **自动更新**：支持自动检测和安装更新，保持最新版本
- 🔔 **系统托盘**：最小化到系统托盘，后台静默运行
- ⚡ **快速启动**：一键启动，快速访问服务器监控面板
- 🎨 **原生体验**：支持窗口缩放、全屏、快捷键等原生功能
- 🔐 **配置持久化**：服务器地址等配置自动保存到本地
- 📱 **单实例运行**：防止同时运行多个应用实例
- 🌙 **深色主题**：与 Web 版一致的玻璃拟态设计风格

## 🚀 快速开始

### 前置要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- Windows 操作系统（构建 Windows 版本）

### 安装依赖

```bash
cd electron
npm install
```

### 开发模式运行

```bash
npm run dev
```

开发模式会自动打开开发者工具，方便调试。

### 生产模式运行

```bash
npm start
```

### 打包构建

```bash
# 构建所有 Windows 版本（安装包 + 便携版）
npm run build:win

# 仅构建 64 位版本
npm run build:win64

# 仅构建便携版
npm run build:portable
```

构建产物会输出到 `dist` 目录。

## 📦 打包产物

构建完成后，`dist` 目录会包含以下文件：

| 文件 | 说明 |
|------|------|
| `服务器监控系统-1.0.0-x64.exe` | NSIS 安装包，标准 Windows 安装程序 |
| `服务器监控系统-1.0.0-x64-portable.exe` | 便携版，单文件 exe，无需安装 |
| `latest.yml` | 自动更新版本信息文件 |
| `服务器监控系统-1.0.0-x64.exe.blockmap` | 增量更新块映射文件 |

### NSIS 安装包特性

- 支持自定义安装目录
- 自动创建桌面快捷方式
- 自动创建开始菜单快捷方式
- 支持一键安装（可配置）
- 支持静默安装

### 便携版特性

- 单文件 exe，无需安装
- 双击即可运行
- 配置保存在用户数据目录
- 适合 U 盘携带使用

## ⚙️ 配置说明

### 应用配置

应用配置保存在用户数据目录下的 `config.json` 文件中：

- **Windows**: `%APPDATA%/服务器监控系统/config.json`

配置项：

```json
{
  "serverUrl": "http://localhost:3000",
  "autoStart": false,
  "minimizeToTray": true,
  "autoUpdate": true
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| serverUrl | string | http://localhost:3000 | 服务器监控系统地址 |
| autoStart | boolean | false | 是否开机自启 |
| minimizeToTray | boolean | true | 关闭窗口时是否最小化到托盘 |
| autoUpdate | boolean | true | 是否启用自动更新 |

### 修改服务器地址

1. 启动应用后，如果连接失败会显示错误页面
2. 在错误页面的输入框中输入正确的服务器地址
3. 点击"连接"按钮保存配置并重新加载

或者：

1. 点击系统托盘图标
2. 选择"服务器设置"查看当前地址
3. 在连接失败页面进行修改

## 🔄 自动更新

客户端内置自动更新功能，基于 `electron-updater` 实现。

### 更新流程

1. 应用启动后 3 秒自动检查更新
2. 发现新版本时自动下载
3. 下载完成后提示用户重启安装
4. 用户确认后自动重启并安装更新

### 手动检查更新

- 点击菜单：帮助 → 检查更新
- 点击系统托盘菜单：检查更新

### 配置更新服务器

在 `package.json` 的 `build.publish` 中配置更新服务器地址：

```json
"publish": {
  "provider": "generic",
  "url": "https://your-update-server.com/releases/"
}
```

支持的更新提供者：
- `generic` - 通用静态文件服务器
- `github` - GitHub Releases
- `s3` - Amazon S3
- `bintray` - Bintray

详细配置请参考 [UPDATE.md](./UPDATE.md)。

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| F5 | 刷新页面 |
| F11 | 切换全屏 |
| F12 | 切换开发者工具 |
| Ctrl+R | 重新加载 |
| Ctrl+Q | 退出应用 |
| Ctrl++ | 放大页面 |
| Ctrl+- | 缩小页面 |
| Ctrl+0 | 重置缩放 |

## 🎨 应用图标

应用需要以下图标文件：

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `assets/icon.ico` | 256x256 | 应用图标、安装包图标 |
| `assets/icon.png` | 512x512 | 系统托盘图标、关于对话框 |

请将你的图标文件放入 `assets` 目录。如果没有图标，应用会使用 Electron 默认图标。

图标制作建议：
- 使用 PNG 格式，背景透明
- 提供多种尺寸（16x16, 32x32, 48x48, 64x64, 128x128, 256x256）
- ICO 文件可以包含多种尺寸
- 推荐使用 [IconMaker](https://github.com/electron/electron-icon-maker) 工具生成

## 📁 目录结构

```
electron/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本
├── error.html           # 连接错误页面
├── package.json         # 项目配置
├── README.md            # 说明文档（本文件）
├── UPDATE.md            # 自动更新配置说明
└── assets/              # 资源文件
    ├── icon.ico         # 应用图标
    ├── icon.png         # 托盘图标
    └── README.md        # 图标资源说明
```

## 🔧 开发说明

### 主进程（main.js）

主要功能：
- 创建和管理主窗口
- 系统托盘集成
- 应用菜单
- 自动更新
- 配置持久化
- IPC 通信
- 单实例锁

### 预加载脚本（preload.js）

通过 `contextBridge` 安全地向渲染进程暴露 API：

```javascript
window.electronAPI = {
  getConfig(),        // 获取配置
  saveConfig(config), // 保存配置
  checkUpdates(),     // 检查更新
  getAppVersion(),    // 获取应用版本
  reloadWindow(),     // 重新加载窗口
  platform,           // 平台信息
  isElectron          // 是否为 Electron 环境
}
```

### 错误页面（error.html）

当无法连接到服务器时显示的页面，提供：
- 错误提示
- 服务器地址配置
- 重试功能
- 常见问题解答
- 版本信息显示

## 🐛 常见问题

### 1. 应用启动后显示空白页面

**原因**：服务器地址配置错误或服务器未启动。

**解决方法**：
- 检查服务器是否正常运行
- 在错误页面修改服务器地址
- 确保网络连接正常

### 2. 系统托盘图标不显示

**原因**：缺少图标文件或图标格式不正确。

**解决方法**：
- 在 `assets` 目录添加 `icon.png` 文件
- 确保图片格式为 PNG
- 建议尺寸 512x512 像素

### 3. 自动更新不工作

**原因**：更新服务器配置错误或网络问题。

**解决方法**：
- 检查 `package.json` 中的 `publish` 配置
- 确保更新服务器可访问
- 检查网络连接和防火墙设置
- 查看开发者工具中的错误信息

### 4. 无法最小化到托盘

**原因**：`minimizeToTray` 配置为 false 或托盘创建失败。

**解决方法**：
- 检查配置文件中的 `minimizeToTray` 设置
- 确保系统托盘正常工作
- 查看控制台错误信息

### 5. 多个实例同时运行

**原因**：单实例锁失效。

**解决方法**：
- 确保所有实例都已完全退出
- 在任务管理器中结束所有相关进程
- 重新启动应用

## 📝 注意事项

1. 首次启动需要配置服务器地址
2. 建议将应用添加到防火墙白名单
3. 自动更新需要稳定的网络连接
4. 便携版的数据保存在用户目录，不在 exe 同级目录
5. 系统托盘功能在某些 Windows 版本中可能需要手动启用
6. 建议使用 64 位版本以获得更好的性能

## 🤝 相关文档

- [自动更新配置说明](./UPDATE.md)
- [项目主 README](../README.md)
- [后端 API 文档](../backend/README.md)
- [前端使用说明](../frontend/README.md)

## 📄 许可证

MIT License
