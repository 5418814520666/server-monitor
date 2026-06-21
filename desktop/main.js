const { app, BrowserWindow, Menu, ipcMain, shell, dialog, Tray, Notification, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

// 开发模式判断
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// 全局窗口引用
let mainWindow = null;
let tray = null;

// 服务器状态
let serverStatus = 'unknown'; // unknown, online, warning, offline

// 配置存储路径
const configPath = path.join(app.getPath('userData'), 'config.json');

// 读取配置
function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('读取配置失败:', e);
  }
  return {};
}

// 保存配置
function saveConfig(config) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}

// 获取当前配置
let appConfig = readConfig();

// 默认配置
const defaultConfig = {
  autoStart: false,
  minimizeToTray: true,
  closeToTray: true,
  alwaysOnTop: false,
  enableNotifications: true,
  globalShortcut: 'Ctrl+Shift+M',
  enableGlobalShortcut: true
};

// 合并配置
appConfig = { ...defaultConfig, ...appConfig };

// ==================== 多服务器管理 ====================

// 服务器数据存储路径
const serversPath = path.join(app.getPath('userData'), 'servers.json');

// 读取服务器列表
function readServers() {
  try {
    if (fs.existsSync(serversPath)) {
      const data = JSON.parse(fs.readFileSync(serversPath, 'utf-8'));
      return data.servers || [];
    }
  } catch (e) {
    console.error('读取服务器列表失败:', e);
  }
  return [];
}

// 保存服务器列表
function saveServers(servers) {
  try {
    const dir = path.dirname(serversPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(serversPath, JSON.stringify({ servers }, null, 2));
    return true;
  } catch (e) {
    console.error('保存服务器列表失败:', e);
    return false;
  }
}

// 生成唯一ID
function generateId() {
  return 'server-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// 获取所有服务器
function getServers() {
  return readServers();
}

// 添加服务器
function addServer(server) {
  const servers = readServers();
  const newServer = {
    id: generateId(),
    name: server.name || '未命名服务器',
    url: server.url,
    group: server.group || '默认分组',
    username: server.username || '',
    password: server.password || '', // 注意：生产环境应该加密存储
    status: 'unknown',
    lastCheck: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  servers.push(newServer);
  saveServers(servers);
  return newServer;
}

// 更新服务器
function updateServer(id, updates) {
  const servers = readServers();
  const index = servers.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  servers[index] = {
    ...servers[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  saveServers(servers);
  return servers[index];
}

// 删除服务器
function deleteServer(id) {
  const servers = readServers();
  const filtered = servers.filter(s => s.id !== id);
  saveServers(filtered);
  return filtered.length < servers.length;
}

// 获取服务器分组
function getServerGroups() {
  const servers = readServers();
  const groups = [...new Set(servers.map(s => s.group || '默认分组'))];
  return groups;
}

// 检测服务器状态
async function checkServerStatus(serverId) {
  const servers = readServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return 'unknown';
  
  try {
    const url = server.url.replace(/\/+$/, '') + '/api/health';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const status = data.status === 'ok' ? 'online' : 'warning';
      updateServer(serverId, { status, lastCheck: new Date().toISOString() });
      return status;
    } else {
      updateServer(serverId, { status: 'offline', lastCheck: new Date().toISOString() });
      return 'offline';
    }
  } catch (e) {
    updateServer(serverId, { status: 'offline', lastCheck: new Date().toISOString() });
    return 'offline';
  }
}

// 检测所有服务器状态
async function checkAllServersStatus() {
  const servers = readServers();
  const promises = servers.map(s => checkServerStatus(s.id));
  await Promise.allSettled(promises);
  return readServers();
}

// 当前选中的服务器ID
let currentServerId = null;

// ==================== 多服务器管理结束 ====================

// ==================== 告警系统 ====================

// 告警规则文件路径
const alarmRulesPath = path.join(app.getPath('userData'), 'alarm-rules.json');
// 告警日志文件路径
const alarmLogsPath = path.join(app.getPath('userData'), 'alarm-logs.json');

// 告警规则
let alarmRules = [];
// 告警日志
let alarmLogs = [];
// 告警检测定时器
let alarmCheckInterval = null;
// 服务器状态缓存（用于判断持续时间）
let serverStatusCache = {};

// 读取告警规则
function readAlarmRules() {
  try {
    if (fs.existsSync(alarmRulesPath)) {
      const data = fs.readFileSync(alarmRulesPath, 'utf-8');
      alarmRules = JSON.parse(data);
    }
  } catch (e) {
    console.error('读取告警规则失败:', e);
    alarmRules = [];
  }
  return alarmRules;
}

// 保存告警规则
function saveAlarmRules() {
  try {
    fs.writeFileSync(alarmRulesPath, JSON.stringify(alarmRules, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存告警规则失败:', e);
    return false;
  }
}

// 读取告警日志
function readAlarmLogs() {
  try {
    if (fs.existsSync(alarmLogsPath)) {
      const data = fs.readFileSync(alarmLogsPath, 'utf-8');
      alarmLogs = JSON.parse(data);
    }
  } catch (e) {
    console.error('读取告警日志失败:', e);
    alarmLogs = [];
  }
  return alarmLogs;
}

// 保存告警日志
function saveAlarmLogs() {
  try {
    // 只保留最近 1000 条日志
    if (alarmLogs.length > 1000) {
      alarmLogs = alarmLogs.slice(-1000);
    }
    fs.writeFileSync(alarmLogsPath, JSON.stringify(alarmLogs, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存告警日志失败:', e);
    return false;
  }
}

// 添加告警日志
function addAlarmLog(serverId, serverName, type, value, threshold, level, message) {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    serverId,
    serverName,
    type,
    value,
    threshold,
    level,
    message,
    timestamp: new Date().toISOString(),
    resolved: false,
    resolvedAt: null
  };
  
  alarmLogs.unshift(log);
  saveAlarmLogs();
  
  // 发送通知
  if (appConfig.enableNotifications !== false) {
    sendNotification(
      `⚠️ ${level === 'critical' ? '严重' : '警告'}告警 - ${serverName}`,
      message,
      { urgency: level === 'critical' ? 'critical' : 'normal' }
    );
  }
  
  // 通知渲染进程
  if (mainWindow) {
    mainWindow.webContents.send('alarm-triggered', log);
  }
  
  return log;
}

// 解决告警
function resolveAlarm(logId) {
  const log = alarmLogs.find(l => l.id === logId);
  if (log && !log.resolved) {
    log.resolved = true;
    log.resolvedAt = new Date().toISOString();
    saveAlarmLogs();
    
    if (mainWindow) {
      mainWindow.webContents.send('alarm-resolved', log);
    }
    
    return true;
  }
  return false;
}

// 添加告警规则
function addAlarmRule(rule) {
  const newRule = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    serverId: rule.serverId || null, // null 表示所有服务器
    type: rule.type, // cpu, memory, disk, network, offline
    threshold: rule.threshold,
    duration: rule.duration || 60, // 持续时间，默认60秒
    level: rule.level || 'warning', // warning, critical
    enabled: rule.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  alarmRules.push(newRule);
  saveAlarmRules();
  
  if (mainWindow) {
    mainWindow.webContents.send('alarm-rules-updated', alarmRules);
  }
  
  return newRule;
}

// 更新告警规则
function updateAlarmRule(ruleId, updates) {
  const index = alarmRules.findIndex(r => r.id === ruleId);
  if (index !== -1) {
    alarmRules[index] = {
      ...alarmRules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveAlarmRules();
    
    if (mainWindow) {
      mainWindow.webContents.send('alarm-rules-updated', alarmRules);
    }
    
    return alarmRules[index];
  }
  return null;
}

// 删除告警规则
function deleteAlarmRule(ruleId) {
  const index = alarmRules.findIndex(r => r.id === ruleId);
  if (index !== -1) {
    alarmRules.splice(index, 1);
    saveAlarmRules();
    
    if (mainWindow) {
      mainWindow.webContents.send('alarm-rules-updated', alarmRules);
    }
    
    return true;
  }
  return false;
}

// 检测服务器告警
async function checkServerAlarms(server) {
  if (!server || !server.url) return;
  
  const serverId = server.id;
  const serverName = server.name;
  
  // 初始化缓存
  if (!serverStatusCache[serverId]) {
    serverStatusCache[serverId] = {
      cpu: { overThreshold: false, startTime: null },
      memory: { overThreshold: false, startTime: null },
      disk: { overThreshold: false, startTime: null },
      network: { overThreshold: false, startTime: null },
      offline: { overThreshold: false, startTime: null }
    };
  }
  
  try {
    // 检测服务器是否在线
    const healthUrl = `${server.url}/api/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('服务器响应异常');
    }
    
    // 服务器在线，尝试获取详细信息
    try {
      const infoUrl = `${server.url}/api/info`;
      const infoResponse = await fetch(infoUrl, {
        signal: AbortSignal.timeout(5000),
        headers: server.username ? {
          'Authorization': 'Basic ' + Buffer.from(`${server.username}:${server.password}`).toString('base64')
        } : {}
      });
      
      if (infoResponse.ok) {
        const data = await infoResponse.json();
        
        // 检测各项指标
        checkMetricAlarm(serverId, serverName, 'cpu', data.cpu?.usage || 0, serverStatusCache[serverId].cpu);
        checkMetricAlarm(serverId, serverName, 'memory', data.memory?.usage || 0, serverStatusCache[serverId].memory);
        
        // 磁盘检测（取使用率最高的分区）
        if (data.disk && data.disk.length > 0) {
          const maxDiskUsage = Math.max(...data.disk.map(d => d.usage || 0));
          checkMetricAlarm(serverId, serverName, 'disk', maxDiskUsage, serverStatusCache[serverId].disk);
        }
        
        // 网络检测（取总速率）
        if (data.network) {
          const totalSpeed = (data.network.uploadSpeed || 0) + (data.network.downloadSpeed || 0);
          // 网络告警阈值单位为 MB/s，转换为 KB/s 比较
          checkMetricAlarm(serverId, serverName, 'network', totalSpeed / 1024, serverStatusCache[serverId].network);
        }
        
        // 离线状态恢复
        if (serverStatusCache[serverId].offline.overThreshold) {
          serverStatusCache[serverId].offline.overThreshold = false;
          serverStatusCache[serverId].offline.startTime = null;
          // 查找未解决的离线告警并标记为已解决
          const offlineAlarms = alarmLogs.filter(
            l => l.serverId === serverId && l.type === 'offline' && !l.resolved
          );
          offlineAlarms.forEach(alarm => resolveAlarm(alarm.id));
        }
        
        return;
      }
    } catch (e) {
      // 获取详细信息失败，但健康检查成功，可能是认证问题
      console.log(`获取服务器 ${serverName} 详细信息失败:`, e.message);
    }
    
    // 服务器在线但无法获取详细信息，只检查离线告警恢复
    if (serverStatusCache[serverId].offline.overThreshold) {
      serverStatusCache[serverId].offline.overThreshold = false;
      serverStatusCache[serverId].offline.startTime = null;
      const offlineAlarms = alarmLogs.filter(
        l => l.serverId === serverId && l.type === 'offline' && !l.resolved
      );
      offlineAlarms.forEach(alarm => resolveAlarm(alarm.id));
    }
    
  } catch (e) {
    // 服务器离线
    checkOfflineAlarm(serverId, serverName, serverStatusCache[serverId].offline);
  }
}

// 检测指标告警
function checkMetricAlarm(serverId, serverName, type, currentValue, cache) {
  // 查找适用的规则
  const rules = alarmRules.filter(
    r => r.enabled && r.type === type && (r.serverId === serverId || r.serverId === null)
  );
  
  if (rules.length === 0) return;
  
  // 取最严格的规则（阈值最低或级别最高）
  const rule = rules.reduce((prev, curr) => {
    if (curr.level === 'critical' && prev.level !== 'critical') return curr;
    if (curr.threshold < prev.threshold) return curr;
    return prev;
  });
  
  const isOverThreshold = currentValue >= rule.threshold;
  const now = Date.now();
  
  if (isOverThreshold) {
    if (!cache.overThreshold) {
      cache.overThreshold = true;
      cache.startTime = now;
    } else {
      const duration = (now - cache.startTime) / 1000;
      if (duration >= rule.duration) {
        // 检查是否已有未解决的同类型告警
        const existingAlarm = alarmLogs.find(
          l => l.serverId === serverId && l.type === type && !l.resolved
        );
        
        if (!existingAlarm) {
          const typeNames = {
            cpu: 'CPU使用率',
            memory: '内存使用率',
            disk: '磁盘使用率',
            network: '网络速率'
          };
          
          const unit = type === 'network' ? ' MB/s' : '%';
          
          addAlarmLog(
            serverId,
            serverName,
            type,
            currentValue,
            rule.threshold,
            rule.level,
            `${typeNames[type]}超过阈值：${currentValue.toFixed(1)}${unit}（阈值：${rule.threshold}${unit}）`
          );
        }
      }
    }
  } else {
    if (cache.overThreshold) {
      cache.overThreshold = false;
      cache.startTime = null;
      
      // 查找未解决的同类型告警并标记为已解决
      const typeAlarms = alarmLogs.filter(
        l => l.serverId === serverId && l.type === type && !l.resolved
      );
      typeAlarms.forEach(alarm => resolveAlarm(alarm.id));
    }
  }
}

// 检测离线告警
function checkOfflineAlarm(serverId, serverName, cache) {
  // 查找离线告警规则
  const rules = alarmRules.filter(
    r => r.enabled && r.type === 'offline' && (r.serverId === serverId || r.serverId === null)
  );
  
  if (rules.length === 0) return;
  
  const rule = rules.reduce((prev, curr) => {
    if (curr.level === 'critical' && prev.level !== 'critical') return curr;
    if (curr.duration < prev.duration) return curr;
    return prev;
  });
  
  const now = Date.now();
  
  if (!cache.overThreshold) {
    cache.overThreshold = true;
    cache.startTime = now;
  } else {
    const duration = (now - cache.startTime) / 1000;
    if (duration >= rule.duration) {
      const existingAlarm = alarmLogs.find(
        l => l.serverId === serverId && l.type === 'offline' && !l.resolved
      );
      
      if (!existingAlarm) {
        addAlarmLog(
          serverId,
          serverName,
          'offline',
          0,
          0,
          rule.level,
          `服务器离线，无法连接`
        );
      }
    }
  }
}

// 检测所有服务器告警
async function checkAllServersAlarms() {
  for (const server of servers) {
    await checkServerAlarms(server);
  }
}

// 启动告警检测
function startAlarmCheck() {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval);
  }
  
  // 每 30 秒检测一次
  alarmCheckInterval = setInterval(() => {
    checkAllServersAlarms().catch(e => {
      console.error('告警检测失败:', e);
    });
  }, 30000);
  
  console.log('告警检测已启动');
}

// 停止告警检测
function stopAlarmCheck() {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval);
    alarmCheckInterval = null;
    console.log('告警检测已停止');
  }
}

// ==================== 告警系统结束 ====================

// 创建托盘图标（根据状态）
function createTrayIcon(status) {
  // 使用 nativeImage 创建简单的图标
  // 实际使用时应该用 build/icon.png
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  
  try {
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    }
  } catch (e) {
    console.log('图标文件不存在，使用默认图标');
  }
  
  // 创建一个简单的 16x16 图标
  const size = 16;
  const icon = nativeImage.createEmpty();
  // 由于无法直接绘制，返回空图标，实际使用时需要准备图标文件
  return icon;
}

// 创建系统托盘
function createTray() {
  const icon = createTrayIcon(serverStatus);
  tray = new Tray(icon);
  
  updateTrayMenu();
  
  // 点击托盘显示/隐藏窗口
  tray.on('click', () => {
    toggleWindow();
  });
  
  // 双击托盘显示窗口
  tray.on('double-click', () => {
    showWindow();
  });
}

// 更新托盘菜单
function updateTrayMenu() {
  if (!tray) return;
  
  const statusText = {
    'unknown': '状态未知',
    'online': '服务器正常',
    'warning': '服务器告警',
    'offline': '服务器离线'
  };
  
  const contextMenu = Menu.buildFromTemplate([
    { label: `服务器状态: ${statusText[serverStatus]}`, enabled: false },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => showWindow()
    },
    {
      label: '隐藏窗口',
      click: () => hideWindow()
    },
    { type: 'separator' },
    {
      label: '窗口置顶',
      type: 'checkbox',
      checked: appConfig.alwaysOnTop,
      click: () => toggleAlwaysOnTop()
    },
    {
      label: '开机自启动',
      type: 'checkbox',
      checked: appConfig.autoStart,
      click: () => toggleAutoStart()
    },
    { type: 'separator' },
    {
      label: '服务器设置',
      click: () => {
        showWindow();
        if (mainWindow) {
          mainWindow.loadFile(path.join(__dirname, 'renderer', 'config.html'));
        }
      }
    },
    {
      label: '检查更新',
      click: () => checkForUpdates()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`服务器监控系统 - ${statusText[serverStatus]}`);
}

// 更新服务器状态
function updateServerStatus(status) {
  serverStatus = status;
  updateTrayMenu();
  
  // 更新托盘图标（如果有不同状态的图标）
  // tray.setImage(createTrayIcon(status));
}

// 显示窗口
function showWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

// 隐藏窗口
function hideWindow() {
  if (mainWindow) {
    mainWindow.hide();
  }
}

// 切换窗口显示/隐藏
function toggleWindow() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  }
}

// 切换窗口置顶
function toggleAlwaysOnTop() {
  if (mainWindow) {
    appConfig.alwaysOnTop = !appConfig.alwaysOnTop;
    mainWindow.setAlwaysOnTop(appConfig.alwaysOnTop);
    saveConfig(appConfig);
    updateTrayMenu();
    
    // 通知渲染进程
    sendConfigUpdate();
  }
}

// 切换开机自启动
function toggleAutoStart() {
  appConfig.autoStart = !appConfig.autoStart;
  
  app.setLoginItemSettings({
    openAtLogin: appConfig.autoStart,
    path: process.execPath
  });
  
  saveConfig(appConfig);
  updateTrayMenu();
  
  // 通知渲染进程
  sendConfigUpdate();
}

// 发送配置更新到渲染进程
function sendConfigUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('config-update', appConfig);
  }
}

// 发送桌面通知
function sendNotification(title, body, options = {}) {
  if (!appConfig.enableNotifications) return;
  
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'build', 'icon.png'),
      silent: options.silent || false,
      urgency: options.urgency || 'normal'
    });
    
    notification.on('click', () => {
      showWindow();
    });
    
    notification.show();
  }
}

// 注册全局快捷键
function registerGlobalShortcuts() {
  if (!appConfig.enableGlobalShortcut || !appConfig.globalShortcut) return;
  
  try {
    globalShortcut.register(appConfig.globalShortcut, () => {
      toggleWindow();
    });
    console.log('全局快捷键已注册:', appConfig.globalShortcut);
  } catch (e) {
    console.error('注册全局快捷键失败:', e);
  }
}

// 注销全局快捷键
function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll();
}

// 配置自动更新
function setupAutoUpdater() {
  if (isDev) {
    console.log('开发模式，跳过自动更新检查');
    return;
  }

  // 自动更新配置
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // 更新检查
  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...');
    sendUpdateStatus('checking', '正在检查更新...');
  });

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    console.log('发现新版本:', info.version);
    sendUpdateStatus('available', `发现新版本 v${info.version}`, info);
    
    // 发送通知
    sendNotification('发现新版本', `服务器监控系统 v${info.version} 已发布，点击查看详情`);
    
    // 询问用户是否更新
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${info.version}`,
      detail: '是否现在下载并安装更新？',
      buttons: ['稍后再说', '立即更新'],
      defaultId: 1,
      cancelId: 0
    }).then((result) => {
      if (result.response === 1) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  // 没有可用更新
  autoUpdater.on('update-not-available', (info) => {
    console.log('当前已是最新版本');
    sendUpdateStatus('not-available', '当前已是最新版本', info);
  });

  // 更新下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `下载速度: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s - 已下载 ${Math.round(progressObj.percent)}% (${Math.round(progressObj.transferred / 1024 / 1024)} MB / ${Math.round(progressObj.total / 1024 / 1024)} MB)`;
    console.log(logMessage);
    sendUpdateStatus('downloading', logMessage, {
      percent: progressObj.percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  // 更新下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('更新下载完成，准备安装');
    sendUpdateStatus('downloaded', '更新下载完成，即将安装...', info);
    
    // 发送通知
    sendNotification('更新下载完成', '点击立即重启安装更新');
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新下载完成',
      message: '更新已下载完成',
      detail: '应用将在退出后自动安装更新。是否现在重启应用？',
      buttons: ['稍后重启', '立即重启'],
      defaultId: 1,
      cancelId: 0
    }).then((result) => {
      if (result.response === 1) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // 更新错误
  autoUpdater.on('error', (error) => {
    console.error('更新出错:', error);
    sendUpdateStatus('error', `更新出错: ${error.message}`, { error: error.message });
  });
}

// 发送更新状态到渲染进程
function sendUpdateStatus(status, message, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', {
      status,
      message,
      data,
      currentVersion: app.getVersion()
    });
  }
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '服务器监控系统',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    backgroundColor: '#1a1a2e',
    frame: true,
    titleBarStyle: 'default',
    alwaysOnTop: appConfig.alwaysOnTop
  });

  // 加载页面
  if (isDev) {
    // 开发模式加载本地服务器
    mainWindow.loadURL('http://localhost:3000');
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式先加载配置页面
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'config.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 窗口关闭时
  mainWindow.on('close', (event) => {
    if (!app.isQuiting && appConfig.closeToTray) {
      event.preventDefault();
      hideWindow();
      sendNotification('已最小化到托盘', '程序在后台继续运行');
    }
  });

  // 窗口关闭后
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 最小化时
  mainWindow.on('minimize', (event) => {
    if (appConfig.minimizeToTray) {
      event.preventDefault();
      hideWindow();
    }
  });

  // 新窗口在浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 创建菜单
  createMenu();
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: '服务器设置',
          click: () => {
            if (mainWindow) {
              mainWindow.loadFile(path.join(__dirname, 'renderer', 'config.html'));
            }
          }
        },
        {
          label: '检查更新',
          click: () => {
            checkForUpdates();
          }
        },
        { type: 'separator' },
        {
          label: '最小化到托盘',
          click: () => hideWindow()
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.isQuiting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '放大',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom + 0.5);
            }
          }
        },
        {
          label: '缩小',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomLevel();
              mainWindow.webContents.setZoomLevel(currentZoom - 0.5);
            }
          }
        },
        {
          label: '重置缩放',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomLevel(0);
            }
          }
        },
        { type: 'separator' },
        {
          label: '窗口置顶',
          type: 'checkbox',
          checked: appConfig.alwaysOnTop,
          accelerator: 'Ctrl+Shift+T',
          click: () => toggleAlwaysOnTop()
        },
        {
          label: '全屏',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: '设置',
      submenu: [
        {
          label: '开机自启动',
          type: 'checkbox',
          checked: appConfig.autoStart,
          click: () => toggleAutoStart()
        },
        {
          label: '桌面通知',
          type: 'checkbox',
          checked: appConfig.enableNotifications,
          click: () => {
            appConfig.enableNotifications = !appConfig.enableNotifications;
            saveConfig(appConfig);
            createMenu();
            sendConfigUpdate();
          }
        },
        {
          label: '关闭时最小化到托盘',
          type: 'checkbox',
          checked: appConfig.closeToTray,
          click: () => {
            appConfig.closeToTray = !appConfig.closeToTray;
            saveConfig(appConfig);
            createMenu();
            updateTrayMenu();
            sendConfigUpdate();
          }
        },
        {
          label: '最小化时到托盘',
          type: 'checkbox',
          checked: appConfig.minimizeToTray,
          click: () => {
            appConfig.minimizeToTray = !appConfig.minimizeToTray;
            saveConfig(appConfig);
            createMenu();
            updateTrayMenu();
            sendConfigUpdate();
          }
        },
        { type: 'separator' },
        {
          label: '全局快捷键',
          type: 'checkbox',
          checked: appConfig.enableGlobalShortcut,
          click: () => {
            appConfig.enableGlobalShortcut = !appConfig.enableGlobalShortcut;
            saveConfig(appConfig);
            
            if (appConfig.enableGlobalShortcut) {
              registerGlobalShortcuts();
            } else {
              unregisterGlobalShortcuts();
            }
            
            createMenu();
            sendConfigUpdate();
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于服务器监控系统',
              message: `服务器监控系统 v${app.getVersion()}`,
              detail: '一个轻量级的服务器监控系统桌面客户端\n\n支持实时监控CPU、内存、磁盘、网络等系统资源\n支持SSH终端、音乐播放等功能',
              buttons: ['确定']
            });
          }
        },
        {
          label: 'GitHub 仓库',
          click: () => {
            shell.openExternal('https://github.com/5418814520666/server-monitor');
          }
        }
      ]
    }
  ];

  // macOS 特殊处理
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 检查更新
function checkForUpdates() {
  if (isDev) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '开发模式',
      message: '当前为开发模式',
      detail: '自动更新功能仅在打包后的正式版本中可用。',
      buttons: ['确定']
    });
    return;
  }

  autoUpdater.checkForUpdates().catch((error) => {
    console.error('检查更新失败:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: '检查更新失败',
      message: '无法检查更新',
      detail: error.message,
      buttons: ['确定']
    });
  });
}

// IPC 通信
ipcMain.handle('check-updates', () => {
  checkForUpdates();
  return { success: true };
});

ipcMain.handle('get-version', () => {
  return { version: app.getVersion() };
});

ipcMain.handle('download-update', () => {
  if (!isDev) {
    autoUpdater.downloadUpdate();
  }
  return { success: true };
});

ipcMain.handle('install-update', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
  return { success: true };
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return { success: true };
});

// 加载服务器页面
ipcMain.handle('load-server', (event, serverUrl) => {
  if (mainWindow && serverUrl) {
    mainWindow.loadURL(serverUrl).catch((error) => {
      console.error('加载服务器页面失败:', error);
      dialog.showErrorBox('加载失败', `无法连接到服务器: ${error.message}`);
      updateServerStatus('offline');
    });
    
    // 假设加载成功，状态设为在线
    // 实际应该通过 WebSocket 监听真实状态
    updateServerStatus('online');
  }
  return { success: true };
});

// 返回配置页面
ipcMain.handle('go-config', () => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'config.html'));
  }
  return { success: true };
});

// 获取配置
ipcMain.handle('get-config', () => {
  return { ...appConfig };
});

// 设置配置
ipcMain.handle('set-config', (event, newConfig) => {
  const oldConfig = { ...appConfig };
  appConfig = { ...appConfig, ...newConfig };
  saveConfig(appConfig);
  
  // 处理需要立即生效的配置
  if (newConfig.alwaysOnTop !== undefined && mainWindow) {
    mainWindow.setAlwaysOnTop(appConfig.alwaysOnTop);
  }
  
  if (newConfig.autoStart !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: appConfig.autoStart,
      path: process.execPath
    });
  }
  
  if (newConfig.enableGlobalShortcut !== undefined || newConfig.globalShortcut !== undefined) {
    unregisterGlobalShortcuts();
    if (appConfig.enableGlobalShortcut) {
      registerGlobalShortcuts();
    }
  }
  
  // 更新菜单和托盘
  createMenu();
  updateTrayMenu();
  
  return { success: true, config: appConfig };
});

// 发送通知
ipcMain.handle('send-notification', (event, title, body, options) => {
  sendNotification(title, body, options);
  return { success: true };
});

// 切换窗口置顶
ipcMain.handle('toggle-always-on-top', () => {
  toggleAlwaysOnTop();
  return { success: true, alwaysOnTop: appConfig.alwaysOnTop };
});

// 切换开机自启动
ipcMain.handle('toggle-auto-start', () => {
  toggleAutoStart();
  return { success: true, autoStart: appConfig.autoStart };
});

// 隐藏窗口到托盘
ipcMain.handle('hide-to-tray', () => {
  hideWindow();
  return { success: true };
});

// 更新服务器状态
ipcMain.handle('update-server-status', (event, status) => {
  updateServerStatus(status);
  return { success: true };
});

// ==================== 多服务器管理 IPC ====================

// 获取所有服务器
ipcMain.handle('get-servers', () => {
  return { success: true, servers: getServers() };
});

// 添加服务器
ipcMain.handle('add-server', (event, server) => {
  const newServer = addServer(server);
  // 通知渲染进程服务器列表已更新
  sendServersUpdate();
  return { success: true, server: newServer };
});

// 更新服务器
ipcMain.handle('update-server', (event, id, updates) => {
  const updated = updateServer(id, updates);
  if (updated) {
    sendServersUpdate();
    return { success: true, server: updated };
  }
  return { success: false, error: '服务器不存在' };
});

// 删除服务器
ipcMain.handle('delete-server', (event, id) => {
  const deleted = deleteServer(id);
  if (deleted) {
    sendServersUpdate();
    // 如果删除的是当前服务器，清空当前服务器
    if (currentServerId === id) {
      currentServerId = null;
    }
    return { success: true };
  }
  return { success: false, error: '服务器不存在' };
});

// 获取服务器分组
ipcMain.handle('get-server-groups', () => {
  return { success: true, groups: getServerGroups() };
});

// 检测单个服务器状态
ipcMain.handle('check-server-status', async (event, serverId) => {
  const status = await checkServerStatus(serverId);
  sendServersUpdate();
  return { success: true, status };
});

// 检测所有服务器状态
ipcMain.handle('check-all-servers-status', async () => {
  const servers = await checkAllServersStatus();
  sendServersUpdate();
  return { success: true, servers };
});

// 获取当前选中的服务器
ipcMain.handle('get-current-server', () => {
  const servers = getServers();
  const current = servers.find(s => s.id === currentServerId) || null;
  return { success: true, server: current, serverId: currentServerId };
});

// 设置当前选中的服务器
ipcMain.handle('set-current-server', (event, serverId) => {
  currentServerId = serverId;
  return { success: true, serverId: currentServerId };
});

// 连接到指定服务器
ipcMain.handle('connect-server', (event, serverId) => {
  const servers = getServers();
  const server = servers.find(s => s.id === serverId);
  
  if (!server) {
    return { success: false, error: '服务器不存在' };
  }
  
  currentServerId = serverId;
  
  if (mainWindow && server.url) {
    mainWindow.loadURL(server.url).catch((error) => {
      console.error('加载服务器页面失败:', error);
      updateServerStatus('offline');
    });
    
    // 检测服务器状态
    checkServerStatus(serverId);
  }
  
  return { success: true, server };
});

// 发送服务器列表更新到渲染进程
function sendServersUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('servers-update', {
      servers: getServers(),
      currentServerId
    });
  }
}

// ==================== 多服务器管理 IPC 结束 ====================

// ==================== 告警系统 IPC ====================

// 获取告警规则
ipcMain.handle('get-alarm-rules', () => {
  return { success: true, rules: readAlarmRules() };
});

// 添加告警规则
ipcMain.handle('add-alarm-rule', (event, rule) => {
  const newRule = addAlarmRule(rule);
  return { success: true, rule: newRule };
});

// 更新告警规则
ipcMain.handle('update-alarm-rule', (event, ruleId, updates) => {
  const updated = updateAlarmRule(ruleId, updates);
  if (updated) {
    return { success: true, rule: updated };
  }
  return { success: false, error: '告警规则不存在' };
});

// 删除告警规则
ipcMain.handle('delete-alarm-rule', (event, ruleId) => {
  const deleted = deleteAlarmRule(ruleId);
  if (deleted) {
    return { success: true };
  }
  return { success: false, error: '告警规则不存在' };
});

// 获取告警日志
ipcMain.handle('get-alarm-logs', (event, options = {}) => {
  let logs = readAlarmLogs();
  
  // 按服务器过滤
  if (options.serverId) {
    logs = logs.filter(l => l.serverId === options.serverId);
  }
  
  // 按类型过滤
  if (options.type) {
    logs = logs.filter(l => l.type === options.type);
  }
  
  // 按级别过滤
  if (options.level) {
    logs = logs.filter(l => l.level === options.level);
  }
  
  // 按状态过滤
  if (options.resolved !== undefined) {
    logs = logs.filter(l => l.resolved === options.resolved);
  }
  
  // 分页
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const total = logs.length;
  logs = logs.slice(offset, offset + limit);
  
  return { success: true, logs, total, limit, offset };
});

// 解决告警
ipcMain.handle('resolve-alarm', (event, logId) => {
  const resolved = resolveAlarm(logId);
  if (resolved) {
    return { success: true };
  }
  return { success: false, error: '告警日志不存在或已解决' };
});

// 手动检测告警
ipcMain.handle('check-alarms', async () => {
  await checkAllServersAlarms();
  return { success: true };
});

// 启动告警检测
ipcMain.handle('start-alarm-check', () => {
  startAlarmCheck();
  return { success: true };
});

// 停止告警检测
ipcMain.handle('stop-alarm-check', () => {
  stopAlarmCheck();
  return { success: true };
});

// ==================== 告警系统 IPC 结束 ====================

// 应用就绪
app.whenReady().then(() => {
  // 设置开机自启动
  if (appConfig.autoStart) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath
    });
  }
  
  // 设置自动更新
  setupAutoUpdater();
  
  // 创建主窗口
  createMainWindow();
  
  // 创建系统托盘
  createTray();
  
  // 注册全局快捷键
  registerGlobalShortcuts();
  
  // 初始化告警系统
  readAlarmRules();
  readAlarmLogs();
  startAlarmCheck();
  
  // 启动后检查更新（延迟2秒）
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(console.error);
    }, 2000);
  }
  
  // macOS 激活时
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      showWindow();
    }
  });
});

// 所有窗口关闭时
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 如果设置了关闭到托盘，则不退出
    if (!appConfig.closeToTray) {
      app.quit();
    }
  }
});

// 应用退出前
app.on('before-quit', () => {
  app.isQuiting = true;
  unregisterGlobalShortcuts();
});

// 第二次启动实例时（单例模式）
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showWindow();
    }
  });
}
