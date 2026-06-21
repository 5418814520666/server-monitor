const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const si = require('systeminformation');
const os = require('os');
const url = require('url');
const path = require('path');
const fs = require('fs');
const { handleSSHConnection } = require('./ssh-handler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const sshWss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());

// ==================== 用户认证 ====================

// 默认用户配置
const DEFAULT_USER = {
  username: 'admin',
  password: 'admin',
  isDefault: true // 是否是默认密码
};

// 会话存储（内存 + 文件持久化）
let sessions = {};

// 加载用户数据
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('加载用户数据失败:', err);
  }
  // 默认用户
  const users = [DEFAULT_USER];
  saveUsers(users);
  return users;
}

// 保存用户数据
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('保存用户数据失败:', err);
  }
}

// 加载会话数据
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('加载会话数据失败:', err);
  }
}

// 保存会话数据
function saveSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (err) {
    console.error('保存会话数据失败:', err);
  }
}

// 生成会话ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 认证中间件
function authMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (!sessionId || !sessions[sessionId]) {
    return res.status(401).json({ error: '未登录或会话已过期' });
  }
  
  // 检查会话是否过期（24小时）
  const session = sessions[sessionId];
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    delete sessions[sessionId];
    saveSessions();
    return res.status(401).json({ error: '会话已过期，请重新登录' });
  }
  
  req.session = session;
  next();
}

// WebSocket 认证
function wsAuth(info, callback) {
  const urlParts = url.parse(info.req.url, true);
  const sessionId = urlParts.query.sessionId;
  
  if (!sessionId || !sessions[sessionId]) {
    return callback(false, 401, 'Unauthorized');
  }
  
  const session = sessions[sessionId];
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    delete sessions[sessionId];
    saveSessions();
    return callback(false, 401, 'Session expired');
  }
  
  info.req.session = session;
  callback(true);
}

// 登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  // 创建会话
  const sessionId = generateSessionId();
  sessions[sessionId] = {
    username: user.username,
    createdAt: Date.now()
  };
  saveSessions();
  
  res.json({
    success: true,
    sessionId,
    username: user.username,
    isDefault: user.isDefault || false
  });
});

// 修改密码接口
app.post('/api/user/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '旧密码和新密码不能为空' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度不能少于6位' });
  }
  
  const users = loadUsers();
  const userIndex = users.findIndex(u => u.username === req.session.username);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  const user = users[userIndex];
  
  // 验证旧密码
  if (user.password !== oldPassword) {
    return res.status(400).json({ error: '旧密码错误' });
  }
  
  // 更新密码
  users[userIndex].password = newPassword;
  users[userIndex].isDefault = false;
  users[userIndex].updatedAt = new Date().toISOString();
  
  saveUsers(users);
  
  res.json({
    success: true,
    message: '密码修改成功'
  });
});

// 获取用户信息
app.get('/api/user/info', authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.session.username);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  res.json({
    username: user.username,
    isDefault: user.isDefault || false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });
});

// ==================== 音乐 API ====================

// 发送 HTTPS 请求的辅助函数
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://music.163.com/',
        ...headers
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

// 音乐搜索
app.get('/api/music/search', authMiddleware, async (req, res) => {
  try {
    const { keyword, limit = 20, offset = 0 } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    const url = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=${offset}&limit=${limit}`;
    const data = await httpsGet(url);
    
    if (data.result && data.result.songs) {
      const songs = data.result.songs.map(song => ({
        id: song.id,
        name: song.name,
        artist: song.artists?.map(a => a.name).join(' / ') || song.artists?.[0]?.name || '未知歌手',
        album: song.album?.name || '未知专辑',
        albumId: song.album?.id,
        picUrl: song.album?.picUrl || song.album?.blurPicUrl,
        duration: song.duration,
        mvId: song.mvid || 0
      }));
      
      res.json({
        success: true,
        songs,
        total: data.result.songCount || 0
      });
    } else {
      res.json({ success: true, songs: [], total: 0 });
    }
  } catch (error) {
    console.error('音乐搜索失败:', error);
    res.status(500).json({ error: '搜索失败，请稍后重试' });
  }
});

// 获取歌曲播放地址
app.get('/api/music/url', authMiddleware, async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: '歌曲ID不能为空' });
    }
    
    // 使用网易云音乐外链地址
    const url = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
    
    res.json({
      success: true,
      url,
      id
    });
  } catch (error) {
    console.error('获取歌曲地址失败:', error);
    res.status(500).json({ error: '获取歌曲地址失败' });
  }
});

// 获取歌词
app.get('/api/music/lyric', authMiddleware, async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: '歌曲ID不能为空' });
    }
    
    const url = `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`;
    const data = await httpsGet(url);
    
    res.json({
      success: true,
      lyric: data.lrc?.lyric || '',
      tlyric: data.tlyric?.lyric || '', // 翻译歌词
      version: data.lrc?.version || 0
    });
  } catch (error) {
    console.error('获取歌词失败:', error);
    res.status(500).json({ error: '获取歌词失败' });
  }
});

// 获取歌曲详情
app.get('/api/music/detail', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ error: '歌曲ID不能为空' });
    }
    
    const url = `https://music.163.com/api/song/detail?ids=[${ids}]`;
    const data = await httpsGet(url);
    
    if (data.songs && data.songs.length > 0) {
      const songs = data.songs.map(song => ({
        id: song.id,
        name: song.name,
        artist: song.artists?.map(a => a.name).join(' / ') || '未知歌手',
        album: song.album?.name || '未知专辑',
        albumId: song.album?.id,
        picUrl: song.album?.picUrl,
        duration: song.duration
      }));
      
      res.json({ success: true, songs });
    } else {
      res.json({ success: true, songs: [] });
    }
  } catch (error) {
    console.error('获取歌曲详情失败:', error);
    res.status(500).json({ error: '获取歌曲详情失败' });
  }
});

// 热门歌单推荐
app.get('/api/music/playlist/hot', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const url = `https://music.163.com/api/playlist/hot?limit=${limit}`;
    const data = await httpsGet(url);
    
    if (data.tags) {
      res.json({ success: true, tags: data.tags });
    } else {
      res.json({ success: true, tags: [] });
    }
  } catch (error) {
    console.error('获取热门歌单失败:', error);
    res.status(500).json({ error: '获取热门歌单失败' });
  }
});

// 推荐新音乐
app.get('/api/music/new', authMiddleware, async (req, res) => {
  try {
    const url = 'https://music.163.com/api/personalized/newsong?type=R_M4_999';
    const data = await httpsGet(url);
    
    if (data.result) {
      const songs = data.result.map(item => ({
        id: item.id,
        name: item.name,
        artist: item.song?.artists?.map(a => a.name).join(' / ') || item.artists?.map(a => a.name).join(' / ') || '未知歌手',
        album: item.song?.album?.name || item.album?.name || '未知专辑',
        picUrl: item.picUrl || item.song?.album?.picUrl,
        duration: item.song?.duration || item.duration
      }));
      
      res.json({ success: true, songs });
    } else {
      res.json({ success: true, songs: [] });
    }
  } catch (error) {
    console.error('获取新音乐失败:', error);
    res.status(500).json({ error: '获取新音乐失败' });
  }
});

// 登出接口
app.post('/api/logout', authMiddleware, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  delete sessions[sessionId];
  saveSessions();
  res.json({ success: true });
});

// 检查登录状态
app.get('/api/auth/check', authMiddleware, (req, res) => {
  res.json({
    loggedIn: true,
    username: req.session.username
  });
});

// ==================== 数据持久化 ====================

// 历史数据配置
const historyConfig = {
  maxPoints: 60, // 保留最近60个数据点
  saveInterval: 60000 // 每分钟保存一次到硬盘
};

// 历史数据（内存缓存）
let historyData = {
  cpu: [],
  memory: [],
  network: [],
  maxPoints: historyConfig.maxPoints
};

// 加载历史数据
function loadHistoryData() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      historyData = {
        ...data,
        maxPoints: historyConfig.maxPoints
      };
      console.log('历史数据加载成功，共', 
        data.cpu?.length || 0, '条CPU记录，',
        data.memory?.length || 0, '条内存记录，',
        data.network?.length || 0, '条网络记录'
      );
    }
  } catch (err) {
    console.error('加载历史数据失败:', err);
  }
}

// 保存历史数据
function saveHistoryData() {
  try {
    const dataToSave = {
      cpu: historyData.cpu,
      memory: historyData.memory,
      network: historyData.network
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(dataToSave));
  } catch (err) {
    console.error('保存历史数据失败:', err);
  }
}

// ==================== 系统信息采集 ====================

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

// ==================== REST API 路由 ====================

// 登录接口不需要认证
app.post('/api/login', (req, res) => { /* 已在上面定义 */ });

// 健康检查不需要认证
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 需要认证的 API
app.get('/api/info', authMiddleware, async (req, res) => {
  const info = await getSystemInfo();
  if (info) {
    res.json(info);
  } else {
    res.status(500).json({ error: '获取系统信息失败' });
  }
});

app.get('/api/history', authMiddleware, (req, res) => {
  res.json(historyData);
});

app.get('/api/auth/check', authMiddleware, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.session.username);
  
  res.json({
    loggedIn: true,
    username: req.session.username,
    isDefault: user?.isDefault || false
  });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  delete sessions[sessionId];
  saveSessions();
  res.json({ success: true });
});

// ==================== WebSocket 连接处理 ====================

// 监控 WebSocket
wss.on('connection', (ws, request) => {
  console.log('新的监控WebSocket连接，用户:', request.session?.username);
  
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

// SSH WebSocket
sshWss.on('connection', (ws, request) => {
  console.log('新的SSH WebSocket连接，用户:', request.session?.username);
  handleSSHConnection(ws);
});

// 处理 WebSocket 升级请求
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  
  // WebSocket 认证
  wsAuth({ req: request }, (ok, code, reason) => {
    if (!ok) {
      socket.write(`HTTP/1.1 ${code} ${reason}\r\n\r\n`);
      socket.destroy();
      return;
    }
    
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
});

// ==================== 定时任务 ====================

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

// 定时保存历史数据到硬盘
setInterval(() => {
  saveHistoryData();
}, historyConfig.saveInterval); // 每分钟保存一次

// ==================== 静态文件 ====================

// 登录页面不需要认证
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// 认证检查中间件（用于静态页面）
function pageAuthMiddleware(req, res, next) {
  const sessionId = req.cookies?.sessionId || req.query.sessionId;
  
  // 检查是否是登录页面或静态资源
  if (req.path === '/login.html' || 
      req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') ||
      req.path === '/favicon.ico') {
    return next();
  }
  
  // 检查会话
  const urlSessionId = req.query.sessionId;
  if (urlSessionId && sessions[urlSessionId]) {
    return next();
  }
  
  // 未登录，重定向到登录页
  res.redirect('/login.html');
}

app.use(pageAuthMiddleware);
app.use(express.static(path.join(__dirname, '../frontend')));

// ==================== 初始化 ====================

// 启动时加载数据
loadHistoryData();
loadSessions();
loadUsers();

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器监控系统运行在 http://localhost:${PORT}`);
  console.log(`数据存储目录: ${DATA_DIR}`);
  console.log(`默认账号: admin / admin`);
  console.log(`WebSocket 服务已启动`);
});

// 优雅退出时保存数据
process.on('SIGINT', () => {
  console.log('\n正在保存数据...');
  saveHistoryData();
  saveSessions();
  console.log('数据已保存，正在退出...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在保存数据...');
  saveHistoryData();
  saveSessions();
  console.log('数据已保存，正在退出...');
  process.exit(0);
});
