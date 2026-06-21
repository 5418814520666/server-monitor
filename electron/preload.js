const { contextBridge, ipcRenderer } = require('electron');

// 通过 contextBridge 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // 版本信息
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // 更新相关
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, text) => {
      callback(text);
    });
  },
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // 检测是否在 Electron 环境中
  isElectron: true
});
