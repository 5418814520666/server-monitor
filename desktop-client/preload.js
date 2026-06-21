const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // 窗口控制
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),

  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 托盘
  updateTrayTooltip: (tooltip) => ipcRenderer.invoke('update-tray-tooltip', tooltip),

  // 监听来自主进程的消息
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', callback);
  }
});
