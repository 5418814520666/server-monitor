const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 版本信息
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // 更新相关
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  
  // 更新状态监听
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 服务器页面加载
  loadServer: (url) => ipcRenderer.invoke('load-server', url),
  goConfig: () => ipcRenderer.invoke('go-config'),
  
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config) => ipcRenderer.invoke('set-config', config),
  
  // 配置更新监听
  onConfigUpdate: (callback) => {
    ipcRenderer.on('config-update', (event, data) => callback(data));
  },
  
  // 窗口控制
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  toggleAutoStart: () => ipcRenderer.invoke('toggle-auto-start'),
  hideToTray: () => ipcRenderer.invoke('hide-to-tray'),
  
  // 通知
  sendNotification: (title, body, options) => ipcRenderer.invoke('send-notification', title, body, options),
  
  // 服务器状态
  updateServerStatus: (status) => ipcRenderer.invoke('update-server-status', status),
  
  // 多服务器管理
  getServers: () => ipcRenderer.invoke('get-servers'),
  addServer: (server) => ipcRenderer.invoke('add-server', server),
  updateServer: (id, updates) => ipcRenderer.invoke('update-server', id, updates),
  deleteServer: (id) => ipcRenderer.invoke('delete-server', id),
  getServerGroups: () => ipcRenderer.invoke('get-server-groups'),
  checkServerStatus: (serverId) => ipcRenderer.invoke('check-server-status', serverId),
  checkAllServersStatus: () => ipcRenderer.invoke('check-all-servers-status'),
  getCurrentServer: () => ipcRenderer.invoke('get-current-server'),
  setCurrentServer: (serverId) => ipcRenderer.invoke('set-current-server', serverId),
  connectServer: (serverId) => ipcRenderer.invoke('connect-server', serverId),
  connectSSH: (serverId) => ipcRenderer.invoke('connect-ssh', serverId),
  
  // 服务器列表更新监听
  onServersUpdate: (callback) => {
    ipcRenderer.on('servers-update', (event, data) => callback(data));
  },
  
  // 告警系统
  getAlarmRules: () => ipcRenderer.invoke('get-alarm-rules'),
  addAlarmRule: (rule) => ipcRenderer.invoke('add-alarm-rule', rule),
  updateAlarmRule: (ruleId, updates) => ipcRenderer.invoke('update-alarm-rule', ruleId, updates),
  deleteAlarmRule: (ruleId) => ipcRenderer.invoke('delete-alarm-rule', ruleId),
  getAlarmLogs: (options) => ipcRenderer.invoke('get-alarm-logs', options),
  resolveAlarm: (logId) => ipcRenderer.invoke('resolve-alarm', logId),
  checkAlarms: () => ipcRenderer.invoke('check-alarms'),
  startAlarmCheck: () => ipcRenderer.invoke('start-alarm-check'),
  stopAlarmCheck: () => ipcRenderer.invoke('stop-alarm-check'),
  
  // 告警事件监听
  onAlarmTriggered: (callback) => {
    ipcRenderer.on('alarm-triggered', (event, data) => callback(data));
  },
  onAlarmResolved: (callback) => {
    ipcRenderer.on('alarm-resolved', (event, data) => callback(data));
  },
  onAlarmRulesUpdated: (callback) => {
    ipcRenderer.on('alarm-rules-updated', (event, data) => callback(data));
  },
  
  // 本地历史记录
  getHistory: (serverId, options) => ipcRenderer.invoke('get-history', serverId, options),
  getHistorySummary: () => ipcRenderer.invoke('get-history-summary'),
  addHistoryPoint: (serverId, data) => ipcRenderer.invoke('add-history-point', serverId, data),
  clearServerHistory: (serverId) => ipcRenderer.invoke('clear-server-history', serverId),
  clearAllHistory: () => ipcRenderer.invoke('clear-all-history'),
  exportHistory: (serverId, format) => ipcRenderer.invoke('export-history', serverId, format),
  
  // 导出告警日志
  exportAlarmLogs: (format) => ipcRenderer.invoke('export-alarm-logs', format),
  
  // 导出服务器配置
  exportServers: (format) => ipcRenderer.invoke('export-servers', format),
  
  // 截图功能
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  openScreenshotsFolder: () => ipcRenderer.invoke('open-screenshots-folder'),
  
  // 迷你悬浮窗
  showMiniWindow: () => ipcRenderer.invoke('show-mini-window'),
  hideMiniWindow: () => ipcRenderer.invoke('hide-mini-window'),
  toggleMiniWindow: () => ipcRenderer.invoke('toggle-mini-window'),
  miniWindowShowMain: () => ipcRenderer.invoke('mini-window-show-main'),
  moveMiniWindow: (dx, dy) => ipcRenderer.invoke('move-mini-window', dx, dy),
  
  // 悬浮窗数据更新监听
  onUpdateData: (callback) => {
    ipcRenderer.on('update-data', (event, data) => callback(data));
  },
  
  // 平台信息
  platform: process.platform,
  
  // 环境信息
  isDesktop: true
});
