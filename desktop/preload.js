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
  
  // 平台信息
  platform: process.platform,
  
  // 环境信息
  isDesktop: true
});
