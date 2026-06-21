# 🖥️ 服务器监控系统

一个轻量级、现代化的服务器监控系统，包含完整的前后端实现，支持实时监控服务器的 CPU、内存、磁盘、网络等系统资源。

## ✨ 功能特性

- **实时监控**：通过 WebSocket 实时推送系统状态数据，每2秒更新一次
- **CPU 监控**：CPU 使用率、核心数、型号、温度（支持时）
- **内存监控**：内存使用率、已用/总量、详细统计
- **磁盘监控**：多磁盘分区使用情况，可视化进度条
- **网络监控**：实时上传/下载速度，总流量统计
- **历史数据**：自动记录最近60个数据点，展示趋势图表
- **系统信息**：主机名、操作系统、内核版本、运行时间等
- **响应式设计**：支持桌面端和移动端访问
- **现代化 UI**：深色主题，玻璃拟态设计风格

## 🛠️ 技术栈

### 后端
- Node.js + Express
- WebSocket (ws 库)
- systeminformation (系统信息采集)

### 前端
- 原生 HTML/CSS/JavaScript
- Chart.js (图表可视化)
- WebSocket 实时通信

## 📦 安装与使用

### 前置要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 快速开始（推荐）

使用一键部署脚本：

```bash
git clone <your-repo-url>
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
git clone <your-repo-url>
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
│   ├── server.js        # 主服务器文件
│   └── package.json     # 后端依赖配置
├── frontend/            # 前端页面
│   ├── index.html       # 主页面
│   ├── css/
│   │   └── style.css    # 样式文件
│   └── js/
│       └── app.js       # 前端逻辑
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

### REST API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/info` | GET | 获取当前系统信息 |
| `/api/history` | GET | 获取历史数据 |
| `/api/health` | GET | 健康检查 |

### WebSocket

连接地址：`ws://<host>:<port>`

消息类型：
- `info`：实时系统信息
- `history`：历史数据

## ⚙️ 配置

### 端口配置
默认端口为 3000，可通过环境变量修改：
```bash
PORT=8080 npm start
```

### 数据保留
默认保留最近 60 个数据点（约2分钟），可在 `backend/server.js` 中修改 `maxPoints` 参数。

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

## 📁 部署文件说明

```
deploy/
├── server-monitor.service    # systemd 服务配置
└── nginx.conf               # Nginx 反向代理配置

ecosystem.config.js          # PM2 生态配置文件
deploy.sh                    # 一键部署脚本
```

## 📝 注意事项

1. 历史数据存储在内存中，重启服务后会丢失
2. 生产环境建议添加身份验证
3. CPU 温度功能依赖系统支持，部分系统可能无法获取
4. 建议在服务器上本地部署，减少网络延迟

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
