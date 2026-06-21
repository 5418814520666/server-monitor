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

### 快速开始

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
├── package.json         # 项目根配置
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

## 🚀 部署建议

### 使用 PM2 部署
```bash
npm install -g pm2
cd backend
pm2 start server.js --name server-monitor
```

### Nginx 反向代理
```nginx
location /monitor {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
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
