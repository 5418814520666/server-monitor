const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const si = require('systeminformation');
const os = require('os');
const url = require('url');
const { handleSSHConnection } = require('./ssh-handler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const sshWss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 存储历史数据（内存存储，生产环境建议使用数据库）
const historyData = {
  cpu: [],
  memory: [],
  network: [],
  maxPoints: 60 // 保留最近60个数据点
};

// 获取系统信息
async function getSystemInfo() {
  try {
    const [cpu, mem, fs, network, osInfo, cpuTemp] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
      si.cpuTemperature().catch(() => ({ main: null }))
    ]);

    const uptime = os.uptime();
    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: cpu.currentLoad.toFixed(2),
        cores: cpu.cpus.length,
        model: os.cpus()[0].model,
        temperature: cpuTemp.main
      },
      memory: {
        total: (mem.total / 1024 / 1024 / 1024).toFixed(2),
        used: (mem.used / 1024 / 1024 / 1024).toFixed(2),
        free: (mem.free / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: ((mem.used / mem.total) * 100).toFixed(2)
      },
      disk: fs.map(d => ({
        filesystem: d.fs,
        mount: d.mount,
        total: (d.size / 1024 / 1024 / 1024).toFixed(2),
        used: (d.used / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: ((d.used / d.size) * 100).toFixed(2)
      })),
      network: network.map(n => ({
        interface: n.iface,
        rx: (n.rx_sec / 1024).toFixed(2),
        tx: (n.tx_sec / 1024).toFixed(2),
        rxTotal: (n.rx / 1024 / 1024).toFixed(2),
        txTotal: (n.tx / 1024 / 1024).toFixed(2)
      })),
      system: {
        hostname: os.hostname(),
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        kernel: osInfo.kernel,
        arch: osInfo.arch,
        uptime: `${uptimeDays}天 ${uptimeHours}小时 ${uptimeMinutes}分钟`
      }
    };
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return null;
  }
}

// 更新历史数据
function updateHistory(data) {
  if (!data) return;

  const timestamp = Date.now();
  
  historyData.cpu.push({ time: timestamp, value: parseFloat(data.cpu.usage) });
  if (historyData.cpu.length > historyData.maxPoints) {
    historyData.cpu.shift();
  }

  historyData.memory.push({ time: timestamp, value: parseFloat(data.memory.usagePercent) });
  if (historyData.memory.length > historyData.maxPoints) {
    historyData.memory.shift();
  }

  const netRx = data.network.reduce((sum, n) => sum + parseFloat(n.rx), 0);
  const netTx = data.network.reduce((sum, n) => sum + parseFloat(n.tx), 0);
  historyData.network.push({ time: timestamp, rx: netRx, tx: netTx });
  if (historyData.network.length > historyData.maxPoints) {
    historyData.network.shift();
  }
}

// REST API 路由
app.get('/api/info', async (req, res) => {
  const info = await getSystemInfo();
  if (info) {
    res.json(info);
  } else {
    res.status(500).json({ error: '获取系统信息失败' });
  }
});

app.get('/api/history', (req, res) => {
  res.json(historyData);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 监控 WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('新的监控WebSocket连接');
  
  // 发送初始数据
  getSystemInfo().then(info => {
    if (info) {
      ws.send(JSON.stringify({ type: 'info', data: info }));
    }
    ws.send(JSON.stringify({ type: 'history', data: historyData }));
  });

  ws.on('close', () => {
    console.log('监控WebSocket连接断开');
  });

  ws.on('error', (error) => {
    console.error('监控WebSocket错误:', error);
  });
});

// SSH WebSocket 连接处理
sshWss.on('connection', (ws) => {
  console.log('新的SSH WebSocket连接');
  handleSSHConnection(ws);
});

// 处理 WebSocket 升级请求
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/ssh') {
    sshWss.handleUpgrade(request, socket, head, (ws) => {
      sshWss.emit('connection', ws, request);
    });
  } else {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// 定时采集数据并广播
setInterval(async () => {
  const info = await getSystemInfo();
  if (info) {
    updateHistory(info);
    
    // 广播给所有连接的客户端
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'info', data: info }));
      }
    });
  }
}, 2000); // 每2秒更新一次

// 提供前端静态文件
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器监控系统运行在 http://localhost:${PORT}`);
  console.log(`WebSocket 服务已启动`);
});
