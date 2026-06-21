# 服务器监控系统 - 桌面客户端

基于 Electron 开发的跨平台桌面客户端，支持 Windows 和 Linux 系统，内置自动更新功能。

## 功能特性

- 🖥️ **跨平台支持**：Windows (NSIS 安装包) 和 Linux (AppImage + deb)
- 🔄 **自动更新**：基于 GitHub Releases 的自动更新机制
- ⚡ **实时监控**：连接远程服务器，实时查看系统资源状态
- 🔐 **安全连接**：支持 HTTP/HTTPS 连接
- 🎨 **原生体验**：桌面应用级别的用户体验
- 📱 **窗口管理**：支持全屏、缩放、最小化等操作

## 系统要求

### Windows
- Windows 10 或更高版本 (64位)
- 至少 200MB 可用磁盘空间

### Linux
- Ubuntu 18.04+ / Debian 10+ / 其他主流 Linux 发行版
- 64位系统
- 至少 200MB 可用磁盘空间

## 安装方法

### Windows
1. 下载 `Server-Monitor-Setup-<version>-x64.exe`
2. 双击运行安装程序
3. 按照安装向导完成安装
4. 从桌面或开始菜单启动应用

### Linux (AppImage)
1. 下载 `Server-Monitor-<version>-x86_64.AppImage`
2. 添加执行权限：
   ```bash
   chmod +x Server-Monitor-*.AppImage
   ```
3. 双击运行或在终端执行：
   ```bash
   ./Server-Monitor-*.AppImage
   ```

### Linux (deb)
1. 下载 `server-monitor_<version>_amd64.deb`
2. 安装：
   ```bash
   sudo dpkg -i server-monitor_*.deb
   ```
3. 从应用菜单启动或执行：
   ```bash
   server-monitor
   ```

## 使用说明

### 首次配置
1. 启动应用后，会显示服务器配置页面
2. 输入服务器地址（例如：`http://192.168.1.100:3000`）
3. （可选）输入服务器名称，方便识别
4. 点击"保存并连接"按钮

### 切换服务器
1. 点击菜单栏的「文件」→「服务器设置」
2. 修改服务器地址
3. 点击"保存并连接"

### 检查更新
1. 点击菜单栏的「文件」→「检查更新」
2. 如有新版本，会提示是否下载更新
3. 下载完成后，确认重启应用即可完成更新

### 快捷键
- `Ctrl+R`：刷新页面
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
- `F11`：全屏切换
- `F12`：开发者工具
- `Ctrl+Q`：退出应用

## 自动更新

桌面客户端支持自动更新功能，更新源为 GitHub Releases。

### 更新流程
1. 应用启动时自动检查更新（延迟2秒）
2. 发现新版本时会弹出提示
3. 用户确认后开始下载更新
4. 下载完成后提示重启安装
5. 应用退出后自动安装更新

### 手动检查更新
- 菜单栏：文件 → 检查更新
- 配置页面：点击版本号旁边的「检查更新」按钮

## 开发说明

### 技术栈
- Electron 28.x
- electron-builder 24.x（打包构建）
- electron-updater 6.x（自动更新）
- Node.js 16+

### 目录结构
```
desktop/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本
├── package.json         # 项目配置
├── build/               # 构建资源
│   ├── icon.svg         # 图标源文件（SVG）
│   ├── icon.png         # Linux 图标（需自行生成）
│   └── icon.ico         # Windows 图标（需自行生成）
└── renderer/            # 渲染进程
    ├── config.html      # 服务器配置页面
    └── ...              # 其他前端文件
```

### 开发环境搭建
```bash
# 进入桌面客户端目录
cd desktop

# 安装依赖
npm install

# 开发模式运行
npm run dev
```

### 构建打包
```bash
# 构建当前平台版本
npm run build

# 构建 Windows 版本
npm run build:win

# 构建 Linux 版本
npm run build:linux

# 构建所有平台版本
npm run build:all

# 构建并发布到 GitHub Releases
npm run release
```

### 图标生成
项目提供了 SVG 源文件，需要自行转换为 PNG 和 ICO 格式：

```bash
# 使用 ImageMagick 转换（需先安装 ImageMagick）
# 转换为 PNG
convert -background none build/icon.svg -resize 512x512 build/icon.png

# 转换为 ICO（需要多种尺寸）
convert -background none build/icon.svg -resize 256x256 build/icon-256.png
convert -background none build/icon.svg -resize 128x128 build/icon-128.png
convert -background none build/icon.svg -resize 64x64 build/icon-64.png
convert -background none build/icon.svg -resize 48x48 build/icon-48.png
convert -background none build/icon.svg -resize 32x32 build/icon-32.png
convert -background none build/icon.svg -resize 16x16 build/icon-16.png
# 合并为 ICO
convert build/icon-256.png build/icon-128.png build/icon-64.png build/icon-48.png build/icon-32.png build/icon-16.png build/icon.ico
```

或者使用在线工具转换：
- ICO 转换：https://convertio.co/svg-ico/
- PNG 转换：https://cloudconvert.com/svg-to-png

### 发布更新
1. 修改 `package.json` 中的版本号
2. 提交代码并推送到 GitHub
3. 创建 GitHub Release，标签为 `v<version>`（例如 `v1.0.1`）
4. 上传构建好的安装包文件
5. 用户端会自动检测到更新

## 常见问题

### Q: 无法连接到服务器？
A: 请检查：
1. 服务器地址是否正确
2. 服务器是否正在运行
3. 防火墙是否允许连接
4. 网络是否正常

### Q: 自动更新失败？
A: 请检查：
1. 网络连接是否正常
2. GitHub 是否可以正常访问
3. 磁盘空间是否充足

### Q: Linux 下 AppImage 无法运行？
A: 请确保已添加执行权限：
```bash
chmod +x Server-Monitor-*.AppImage
```

### Q: 如何清除配置重新设置？
A: 可以通过以下方式：
1. 菜单栏 → 文件 → 服务器设置，修改后重新连接
2. 或者删除应用配置目录（不推荐）

## 许可证

MIT License
