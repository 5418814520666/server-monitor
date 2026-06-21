# 🔄 自动更新配置说明

本桌面客户端基于 `electron-updater` 实现自动更新功能，支持多种更新服务器配置方案。

## 📋 更新原理

### 工作流程

1. **检查更新**：应用启动后自动检查更新服务器上的版本信息
2. **版本对比**：对比本地版本与服务器版本
3. **自动下载**：发现新版本时自动下载更新包
4. **提示安装**：下载完成后提示用户重启安装
5. **自动安装**：用户确认后自动重启并安装更新

### 增量更新

electron-updater 支持增量更新（blockmap），只下载变化的部分，大大减少下载流量：
- 完整安装包：通常 50-100MB
- 增量更新包：通常 1-10MB

## 🚀 快速配置

### 方式一：GitHub Releases（推荐）

最简单的方式，使用 GitHub Releases 作为更新服务器。

**步骤：**

1. 在 `package.json` 中配置：

```json
"build": {
  "publish": {
    "provider": "github",
    "owner": "your-github-username",
    "repo": "your-repo-name",
    "releaseType": "release"
  }
}
```

2. 构建并发布：

```bash
# 设置 GitHub Token
export GH_TOKEN="your-github-token"

# 构建并发布到 GitHub Releases
npm run build:win -- --publish always
```

3. 在 GitHub 仓库的 Releases 页面发布新版本

**优点：**
- 免费使用
- 无需自己搭建服务器
- 全球 CDN 加速
- 版本管理方便

**缺点：**
- 国内访问可能较慢
- 有 API 速率限制

### 方式二：静态文件服务器（通用方案）

使用任何静态文件服务器（Nginx、Apache、OSS、CDN 等）。

**步骤：**

1. 在 `package.json` 中配置：

```json
"build": {
  "publish": {
    "provider": "generic",
    "url": "https://your-server.com/releases/"
  }
}
```

2. 构建应用：

```bash
npm run build:win
```

3. 将 `dist` 目录下的所有文件上传到服务器：
   - `服务器监控系统-1.0.0-x64.exe`
   - `服务器监控系统-1.0.0-x64.exe.blockmap`
   - `latest.yml`

4. 确保文件可以通过 HTTP/HTTPS 访问

**优点：**
- 完全可控
- 可以使用自己的 CDN
- 没有速率限制

**缺点：**
- 需要自己维护服务器
- 需要配置 HTTPS

### 方式三：Amazon S3

使用 AWS S3 存储更新文件。

**配置：**

```json
"build": {
  "publish": {
    "provider": "s3",
    "bucket": "your-bucket-name",
    "region": "us-east-1",
    "path": "releases/"
  }
}
```

**环境变量：**
- `AWS_ACCESS_KEY_ID` - AWS 访问密钥 ID
- `AWS_SECRET_ACCESS_KEY` - AWS 秘密访问密钥

### 方式四：Bintray

使用 JFrog Bintray 服务。

**配置：**

```json
"build": {
  "publish": {
    "provider": "bintray",
    "owner": "your-username",
    "repo": "your-repo",
    "package": "your-package-name"
  }
}
```

## 📁 更新文件说明

构建完成后，`dist` 目录会生成以下与更新相关的文件：

| 文件 | 说明 | 是否必须 |
|------|------|----------|
| `latest.yml` | 版本信息文件，包含版本号、文件列表、SHA512 哈希等 | ✅ 必须 |
| `*.exe` | 完整安装包 | ✅ 必须 |
| `*.exe.blockmap` | 增量更新块映射文件 | ⚠️ 推荐 |

### latest.yml 格式示例

```yaml
version: 1.0.1
files:
  - url: 服务器监控系统-1.0.1-x64.exe
    sha512: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    size: 85234567
  - url: 服务器监控系统-1.0.1-x64-portable.exe
    sha512: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    size: 89123456
path: 服务器监控系统-1.0.1-x64.exe
sha512: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
releaseDate: 2024-01-15T10:30:00.000Z
```

## 🔧 发布新版本

### 步骤

1. **修改版本号**

在 `package.json` 中修改版本号：

```json
{
  "version": "1.0.1"
}
```

2. **构建新版本**

```bash
npm run build:win
```

3. **上传更新文件**

将 `dist` 目录下的文件上传到更新服务器。

4. **测试更新**

安装旧版本，启动应用，验证是否能检测到更新并正常安装。

### 版本号规范

建议使用语义化版本（Semantic Versioning）：

```
主版本号.次版本号.修订号
  │       │       │
  │       │       └── 修复 bug、小优化
  │       └────────── 新增功能，向后兼容
  └────────────────── 重大变更，不向后兼容
```

示例：
- `1.0.0` - 初始版本
- `1.0.1` - 修复 bug
- `1.1.0` - 新增功能
- `2.0.0` - 重大更新

## ⚙️ 高级配置

### 自动下载配置

在 `main.js` 中配置自动下载行为：

```javascript
// 自动下载更新（默认 true）
autoUpdater.autoDownload = true;

// 退出时自动安装（默认 true）
autoUpdater.autoInstallOnAppQuit = true;

// 允许预发布版本（默认 false）
autoUpdater.allowPrerelease = false;
```

### 更新通道

支持不同的更新通道（stable、beta、alpha）：

```json
"build": {
  "publish": {
    "provider": "generic",
    "url": "https://your-server.com/releases/",
    "channel": "beta"
  }
}
```

或者在运行时设置：

```javascript
autoUpdater.channel = 'beta';
```

### 差分更新

electron-updater 默认启用差分更新（基于 blockmap），无需额外配置。

差分更新原理：
1. 将安装包分割成多个小块
2. 计算每个块的哈希值
3. 对比新旧版本的块
4. 只下载变化的块

### 代理设置

如果需要通过代理访问更新服务器：

```javascript
// 设置 HTTP 代理
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://your-server.com/releases/',
  headers: {
    'Proxy-Authorization': 'Basic ' + Buffer.from('user:pass').toString('base64')
  }
});
```

## 🔍 调试更新

### 启用调试日志

设置环境变量启用详细日志：

```bash
# Windows
set DEBUG=electron-updater

# Linux/macOS
export DEBUG=electron-updater
```

### 事件监听

在主进程中监听更新事件：

```javascript
autoUpdater.on('checking-for-update', () => {
  console.log('正在检查更新...');
});

autoUpdater.on('update-available', (info) => {
  console.log('发现新版本:', info.version);
});

autoUpdater.on('update-not-available', () => {
  console.log('当前已是最新版本');
});

autoUpdater.on('download-progress', (progress) => {
  console.log(`下载进度: ${progress.percent.toFixed(2)}%`);
  console.log(`下载速度: ${(progress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s`);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('更新下载完成:', info.version);
});

autoUpdater.on('error', (error) => {
  console.error('更新出错:', error);
});
```

### 手动触发更新

```javascript
// 检查更新
autoUpdater.checkForUpdates();

// 检查更新并返回结果
const result = await autoUpdater.checkForUpdatesAndNotify();

// 下载完成后退出并安装
autoUpdater.quitAndInstall();
```

## 🐛 常见问题

### 1. 无法检测到更新

**可能原因：**
- `latest.yml` 文件没有上传
- 版本号没有增加
- 服务器地址配置错误
- 网络连接问题

**排查方法：**
1. 确认 `latest.yml` 可以通过浏览器访问
2. 检查版本号是否确实比本地版本高
3. 查看开发者工具中的网络请求
4. 启用 DEBUG 日志查看详细错误

### 2. 更新下载失败

**可能原因：**
- 文件不完整
- 哈希校验失败
- 网络中断

**解决方法：**
1. 重新上传所有更新文件
2. 检查文件大小是否正确
3. 确保网络连接稳定
4. 尝试关闭防火墙或代理

### 3. 安装后版本没变

**可能原因：**
- 安装过程中出错
- 旧版本没有完全退出
- 安装到了不同的目录

**解决方法：**
1. 手动运行安装包查看错误信息
2. 在任务管理器中结束所有相关进程
3. 检查安装目录是否正确
4. 尝试完全卸载后重新安装

### 4. 签名验证失败

**可能原因：**
- 应用没有代码签名
- 签名证书过期
- 系统时间不正确

**解决方法：**
1. 购买正规的代码签名证书
2. 更新签名证书
3. 检查系统时间是否正确
4. 测试时可以临时禁用签名验证（不推荐生产环境）

### 5. Windows Defender 误报

**可能原因：**
- 应用没有数字签名
- 下载量较少，被 SmartScreen 拦截

**解决方法：**
1. 添加代码签名
2. 提交给微软进行安全认证
3. 告知用户如何添加信任
4. 使用 EV 代码签名证书（立即获得 SmartScreen 信任）

## 📝 最佳实践

### 1. 版本发布前测试

- 在测试环境中完整测试更新流程
- 测试从多个旧版本升级
- 测试网络中断、下载失败等异常情况

### 2. 灰度发布

- 先发布给小部分用户
- 观察反馈和错误报告
- 确认稳定后全量发布

### 3. 版本说明

- 每次更新都附带详细的更新日志
- 说明新增功能、修复的问题
- 告知用户是否需要手动操作

### 4. 回滚方案

- 保留历史版本的安装包
- 提供手动下载地址
- 准备紧急修复版本的发布流程

### 5. 安全建议

- 使用 HTTPS 提供更新文件
- 启用代码签名
- 验证文件哈希值（electron-updater 自动完成）
- 定期更新依赖库

## 📚 相关资源

- [electron-updater 官方文档](https://www.electron.build/auto-update)
- [electron-builder 官方文档](https://www.electron.build/)
- [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)
- [Windows 代码签名指南](https://docs.microsoft.com/zh-cn/windows/win32/seccrypto/cryptography-tools)

## 🆘 获取帮助

如果遇到问题，可以：
1. 查看 electron-updater 的 GitHub Issues
2. 查看本项目的 README.md
3. 检查应用日志文件
4. 启用 DEBUG 模式获取详细错误信息
