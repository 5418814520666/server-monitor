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
