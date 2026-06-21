# 🖥️ 服务器监控系统

一个轻量级、现代化的服务器监控系统，包含完整的前后端实现，支持实时监控服务器的 CPU、内存、磁盘、网络等系统资源。

## ✨ 功能特性

- **实时监控**：通过 WebSocket 实时推送系统状态数据，每2秒更新一次
- **CPU 监控**：CPU 使用率、核心数、型号、温度（支持时）
- **内存监控**：内存使用率、已用/总量、详细统计
- **磁盘监控**：多磁盘分区使用情况，可视化进度条
- **网络监控**：实时上传/下载速度，总流量统计
- **历史数据**：自动记录最近60个数据点，展示趋势图表
- **数据持久化**：历史数据自动保存到硬盘，重启服务不丢失
- **用户认证**：支持用户登录认证，保护监控面板安全
- **系统信息**：主机名、操作系统、内核版本、运行时间等
- **SSH 终端**：内置 Web SSH 终端，支持密码和私钥认证
- **响应式设计**：支持桌面端和移动端访问
- **现代化 UI**：深色主题，玻璃拟态设计风格
- **音乐播放**：内置网易云音乐播放器，支持搜索、播放、歌词显示
- **桌面客户端**：Windows 桌面客户端，支持自动更新、系统托盘、原生体验

## 🛠️ 技术栈

### 后端
- Node.js + Express
- WebSocket (ws 库)
- systeminformation (系统信息采集)
- ssh2 (SSH 客户端)

### 前端
- 原生 HTML/CSS/JavaScript
- Chart.js (图表可视化)
- xterm.js (终端组件)
- WebSocket 实时通信

### 桌面客户端
- Electron 28 (跨平台桌面应用框架)
- electron-builder (打包工具)
- 深色玻璃拟态 UI 设计

## 📦 安装与使用

### 前置要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 快速开始（推荐）

使用一键部署脚本：

```bash
git clone https://github.com/5418814520666/server-monitor.git
cd server-monitor
chmod +x deploy.sh
./deploy.sh
```

脚本会自动检查环境、安装依赖并启动服务，还支持可选安装 PM2 进行进程管理。

**指定端口启动：**
```bash
./deploy.sh -p 8080
```

### 手动安装

1. **克隆项目**
```bash
git clone https://github.com/5418814520666/server-monitor.git
cd server-monitor
```

2. **安装依赖**
```bash
npm run install:all
```

3. **启动服务**
```bash
npm start
```

4. **访问监控面板**
打开浏览器访问：`http://localhost:3000`

### 开发模式
```bash
npm run dev
```
使用 nodemon 自动重启服务。

## 📁 项目结构

```
server-monitor/
├── backend/              # 后端服务
│   ├── server.js        # 主服务器文件（API + WebSocket + SSH + 认证 + 数据持久化 + 音乐API）
│   ├── ssh-handler.js   # SSH 终端处理器
│   └── package.json     # 后端依赖配置
├── frontend/            # 前端页面
│   ├── index.html       # 监控面板
│   ├── ssh.html         # SSH 终端页面
│   ├── login.html       # 登录页面
│   ├── music.html       # 音乐播放器页面
│   ├── css/
│   │   ├── style.css    # 主样式文件
│   │   ├── ssh.css      # SSH 终端样式
│   │   ├── login.css    # 登录页面样式
│   │   └── music.css    # 音乐播放器样式
│   └── js/
│       ├── app.js       # 监控逻辑
│       ├── ssh.js       # SSH 终端逻辑
│       ├── login.js     # 登录页面逻辑
│       └── music.js     # 音乐播放器逻辑
├── desktop-client/      # Windows 桌面客户端
│   ├── main.js          # Electron 主进程
│   ├── preload.js       # 预加载脚本
│   ├── package.json     # 桌面客户端配置
│   ├── README.md        # 桌面客户端说明文档
│   ├── assets/          # 资源文件
│   │   └── icon.svg     # 应用图标
│   └── renderer/        # 渲染进程
│       ├── index.html   # 主页面
│       ├── about.html   # 关于页面
│       ├── css/
│       │   └── style.css
│       └── js/
│           └── app.js
├── data/                # 数据存储目录（运行时自动创建）
│   ├── history.json     # 历史数据文件
│   ├── users.json       # 用户数据文件
│   └── sessions.json    # 会话数据文件
├── deploy/              # 部署配置文件
│   ├── server-monitor.service  # systemd 服务配置
│   └── nginx.conf       # Nginx 反向代理配置
├── deploy.sh            # 一键部署脚本
├── ecosystem.config.js  # PM2 生态配置文件
├── package.json         # 项目根配置
├── .gitignore          # Git忽略文件
└── README.md           # 项目说明
```

## 🔌 API 接口

### 认证说明
除登录接口和健康检查接口外，所有 API 接口和 WebSocket 连接都需要身份认证。

**认证方式：**
- REST API：在请求头中携带 `X-Session-Id`
- WebSocket：在 URL 查询参数中携带 `sessionId`

**默认账号：**
- 用户名：`admin`
- 密码：`admin`

### REST API

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/login` | POST | ❌ 否 | 用户登录，获取 sessionId |
| `/api/logout` | POST | ✅ 是 | 用户登出 |
| `/api/auth/check` | GET | ✅ 是 | 检查登录状态 |
| `/api/info` | GET | ✅ 是 | 获取当前系统信息 |
| `/api/history` | GET | ✅ 是 | 获取历史数据 |
| `/api/health` | GET | ❌ 否 | 健康检查 |

### WebSocket

#### 监控 WebSocket
连接地址：`ws://<host>:<port>?sessionId=<your_session_id>`

消息类型：
- `info`：实时系统信息
- `history`：历史数据

#### SSH 终端 WebSocket
连接地址：`ws://<host>:<port>/ssh?sessionId=<your_session_id>`

消息类型：
- `connect`：建立 SSH 连接
- `input`：终端输入
- `resize`：调整终端大小
- `disconnect`：断开 SSH 连接
- `status`：连接状态
- `output`：终端输出
- `error`：错误信息

## ⚙️ 配置

### 端口配置
默认端口为 3000，可通过环境变量修改：
```bash
PORT=8080 npm start
```

### 数据保留
默认保留最近 60 个数据点（约2分钟），可在 `backend/server.js` 中修改 `maxPoints` 参数。

### 数据持久化
- 历史数据自动保存到 `data/history.json` 文件
- 用户数据保存在 `data/users.json` 文件
- 会话数据保存在 `data/sessions.json` 文件
- 服务启动时自动加载数据，每分钟自动保存一次
- 服务优雅退出时（Ctrl+C 或 systemd stop）自动保存数据

### 会话配置
- 默认会话有效期：24小时
- 可在 `backend/server.js` 中修改 `SESSION_TTL` 参数

### 默认账号
- 用户名：`admin`
- 密码：`admin`

> ⚠️ **安全提示**：首次部署后请及时修改默认密码！

## 🚀 部署指南

### 方式一：一键部署脚本（推荐）

项目提供了 `deploy.sh` 一键部署脚本，支持多种部署模式：

```bash
# 普通模式部署（后台运行）
./deploy.sh

# 使用 PM2 进程管理器部署（推荐生产环境）
./deploy.sh --pm2

# 使用 systemd 服务部署（需要 root 权限）
sudo ./deploy.sh --systemd

# 指定端口部署
./deploy.sh --port 8080 --pm2

# 查看帮助
./deploy.sh --help
```

**脚本功能：**
- ✅ 自动检查 Node.js 环境
- ✅ 自动安装项目依赖
- ✅ 支持三种部署模式（普通/PM2/systemd）
- ✅ 自动检测并处理端口占用
- ✅ 显示访问地址和管理命令

### 方式二：PM2 部署（生产环境推荐）

使用项目提供的 PM2 生态配置文件：

```bash
# 全局安装 PM2
npm install -g pm2

# 使用生态文件启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs server-monitor

# 保存进程列表（开机自启）
pm2 save
pm2 startup
```

### 方式三：systemd 服务部署

适用于 Linux 系统服务管理：

```bash
# 复制服务文件
sudo cp deploy/server-monitor.service /etc/systemd/system/

# 修改服务文件中的路径和用户
sudo nano /etc/systemd/system/server-monitor.service

# 重载配置并启动
sudo systemctl daemon-reload
sudo systemctl enable server-monitor
sudo systemctl start server-monitor

# 查看状态
sudo systemctl status server-monitor

# 查看日志
sudo journalctl -u server-monitor -f
```

### 方式四：Nginx 反向代理

配置 Nginx 反向代理以支持域名访问和 HTTPS：

```bash
# 复制配置文件
sudo cp deploy/nginx.conf /etc/nginx/sites-available/server-monitor

# 修改配置中的域名
sudo nano /etc/nginx/sites-available/server-monitor

# 启用站点
sudo ln -s /etc/nginx/sites-available/server-monitor /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

详细配置请参考 `deploy/nginx.conf` 文件。

## 💻 桌面客户端

项目提供了基于 Electron 开发的 Windows 桌面客户端，支持系统托盘运行和多服务器管理。

### 功能特性

- 🖥️ **多服务器管理**：支持添加、编辑、删除多个服务器
- 📊 **实时监控**：内嵌完整的 Web 监控面板
- 🔔 **系统托盘**：最小化到托盘，后台运行
- ⚡ **自动连接**：启动时自动连接指定服务器
- 🎨 **深色主题**：与 Web 版一致的玻璃拟态设计
- 🔄 **状态检测**：自动检测服务器在线状态

### 快速开始

```bash
# 进入桌面客户端目录
cd desktop-client

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 打包生成安装包
npm run build:win
```

### 打包产物

- **NSIS 安装包**：标准 Windows 安装程序，支持自定义安装目录
- **Portable 便携版**：单文件 exe，无需安装，可直接运行

详细说明请参考 [desktop-client/README.md](desktop-client/README.md)。

## 📁 部署文件说明

```
deploy/
├── server-monitor.service    # systemd 服务配置
└── nginx.conf               # Nginx 反向代理配置

ecosystem.config.js          # PM2 生态配置文件
deploy.sh                    # 一键部署脚本
```

## 📝 注意事项

1. 历史数据自动保存到硬盘，重启服务不会丢失
2. 默认账号为 admin/admin，生产环境请及时修改密码
3. CPU 温度功能依赖系统支持，部分系统可能无法获取
4. 建议在服务器上本地部署，减少网络延迟
5. SSH 终端功能存在安全风险，生产环境请谨慎使用
6. SSH 凭据通过 WebSocket 传输，建议使用 HTTPS 加密
7. 会话默认有效期 24 小时，过期需要重新登录
8. data 目录包含用户和会话数据，请注意备份和权限设置

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
