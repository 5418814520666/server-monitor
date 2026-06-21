const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// 开发模式判断
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// 全局窗口引用
let mainWindow = null;

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
    titleBarStyle: 'default'
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
  mainWindow.on('closed', () => {
    mainWindow = null;
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
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
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
    });
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

// 应用就绪
app.whenReady().then(() => {
  // 设置自动更新
  setupAutoUpdater();
  
  // 创建主窗口
  createMainWindow();
  
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
    }
  });
});

// 所有窗口关闭时
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 第二次启动实例时（单例模式）
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}
